#!/usr/bin/env bash
# agent-mail.sh — async agent-to-agent messaging via shared mailbox convention
#
# Usage:
#   agent-mail send --to <agent> [--from <agent>] [--subject "..."] [--priority normal|high|urgent] "body"
#   agent-mail read [--agent <agent>] [--unread]
#   agent-mail archive <message-file>
#   agent-mail drain [--agent <agent>]   # read + archive all
#   agent-mail list [--all]              # list all inboxes (requires access to _shared/mailboxes/)
#
# Mailbox layout:
#   _shared/mailboxes/<agent>/           ← central store (this file lives here)
#   _shared/mailboxes/<agent>/processed/ ← archived after reading
#   <agent>/inbox/                       ← symlink → ../_shared/mailboxes/<agent>/
#
# Message file format: {ISO8601}-{from}-{short-id}.json
# Fields: id, from, to, subject, body, timestamp, priority, thread_id, read

set -euo pipefail

command -v python3 >/dev/null 2>&1 || { echo "agent-mail: error: python3 is required but not found" >&2; exit 1; }

WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
MAILBOXES="$WORKSPACE/_shared/mailboxes"

# ── helpers ──────────────────────────────────────────────────────────────────

_die() { echo "agent-mail: error: $*" >&2; exit 1; }

_mailbox_dir() {
  local agent="$1"
  local dir="$MAILBOXES/$agent"
  [[ -d "$dir" ]] || _die "no mailbox for agent '$agent' (not heartbeat-eligible, or typo)"
  echo "$dir"
}

_detect_agent() {
  # Infer current agent from OPENCLAW_AGENT_ID env, or from cwd basename
  if [[ -n "${OPENCLAW_AGENT_ID:-}" ]]; then
    echo "$OPENCLAW_AGENT_ID"
    return
  fi
  local cwd
  cwd="$(pwd)"
  local rel="${cwd#$WORKSPACE/}"
  # If cwd IS the workspace root, we're Merlin
  if [[ "$rel" == "$cwd" ]] || [[ "$rel" == "." ]] || [[ -z "$rel" ]]; then
    echo "merlin"
    return
  fi
  # First path component = agent name
  echo "${rel%%/*}"
}

_short_id() {
  # 8-char hex ID
  head -c 4 /dev/urandom | xxd -p 2>/dev/null || echo "$(date +%s%N | tail -c 8)"
}

_iso8601() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

_filename_ts() {
  date -u +"%Y%m%dT%H%M%SZ"
}

# ── commands ─────────────────────────────────────────────────────────────────

cmd_send() {
  local to="" from="" subject="(no subject)" body="" priority="normal" thread_id="null"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --to)       to="$2";       shift 2 ;;
      --from)     from="$2";     shift 2 ;;
      --subject)  subject="$2";  shift 2 ;;
      --priority) priority="$2"; shift 2 ;;
      --thread)   thread_id="\"$2\""; shift 2 ;;
      --*)        _die "unknown option: $1" ;;
      *)          body="$1";     shift ;;
    esac
  done

  [[ -n "$to" ]]   || _die "send requires --to <agent>"
  [[ -n "$body" ]] || _die "send requires a message body as the last positional argument"
  [[ -z "$from" ]] && from="$(_detect_agent)"

  local dir
  dir="$(_mailbox_dir "$to")"

  local id ts filename
  id="$(_short_id)"
  ts="$(_iso8601)"
  filename="$(_filename_ts)-${from}-${id}.json"

  python3 - "$dir/$filename" "$id" "$from" "$to" "$subject" "$body" "$ts" "$priority" "$thread_id" <<'PYEOF'
import json, sys
path, mid, frm, to, subj, body, ts, pri, tid = sys.argv[1:]
msg = {
    "id": mid,
    "from": frm,
    "to": to,
    "subject": subj,
    "body": body,
    "timestamp": ts,
    "priority": pri,
    "thread_id": None if tid == "null" else tid,
    "read": False,
}
with open(path, "w") as fh:
    json.dump(msg, fh, indent=2)
    fh.write("\n")
PYEOF

  echo "✉️  Sent to $to/$filename"
}

cmd_read() {
  local agent="" unread_only=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agent)  agent="$2"; shift 2 ;;
      --unread) unread_only=true; shift ;;
      *)        _die "unknown option: $1" ;;
    esac
  done

  [[ -z "$agent" ]] && agent="$(_detect_agent)"

  local dir
  dir="$(_mailbox_dir "$agent")"

  local files=()
  while IFS= read -r -d '' f; do
    files+=("$f")
  done < <(find "$dir" -maxdepth 1 -name "*.json" -print0 | sort -z)

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "📭  No messages in $agent's inbox."
    return 0
  fi

  echo "📬  Inbox for $agent (${#files[@]} message(s)):"
  echo "────────────────────────────────────────"

  for f in "${files[@]}"; do
    # Read all fields and mark as read in a single python3 invocation
    local fields
    fields=$(python3 - "$f" "$unread_only" <<'PYEOF'
import json, sys
path = sys.argv[1]
unread_only = sys.argv[2] == "true"
with open(path) as fh:
    d = json.load(fh)
if unread_only and d.get("read", False):
    sys.exit(1)  # signal skip
print(d.get("from", "?"))
print(d.get("subject", "?"))
print(d.get("timestamp", "?"))
print(d.get("priority", "normal"))
print(d.get("body", ""))
d["read"] = True
with open(path, "w") as fh:
    json.dump(d, fh, indent=2)
    fh.write("\n")
PYEOF
    ) 2>/dev/null || { echo "  (error reading $(basename "$f"))"; continue; }
    # exit(1) from python means skip (already read + unread_only mode)
    [[ -z "$fields" ]] && continue

    local from subject ts priority body
    from=$(echo "$fields" | sed -n '1p')
    subject=$(echo "$fields" | sed -n '2p')
    ts=$(echo "$fields" | sed -n '3p')
    priority=$(echo "$fields" | sed -n '4p')
    body=$(echo "$fields" | sed -n '5,$p')

    local badge=""
    [[ "$priority" == "high" ]]   && badge="🔶 "
    [[ "$priority" == "urgent" ]] && badge="🔴 "

    echo "${badge}From: $from  |  $ts  |  $subject"
    echo "$body"
    echo "  [file: $(basename "$f")]"
    echo "────────────────────────────────────────"
  done
}

cmd_archive() {
  local file="$1"
  [[ -f "$file" ]] || _die "file not found: $file"
  local dir
  dir="$(dirname "$file")"
  local processed="$dir/processed"
  mkdir -p "$processed"
  mv "$file" "$processed/"
  echo "📁  Archived: $(basename "$file")"
}

cmd_drain() {
  local agent=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agent) agent="$2"; shift 2 ;;
      *)       _die "unknown option: $1" ;;
    esac
  done

  [[ -z "$agent" ]] && agent="$(_detect_agent)"

  local dir
  dir="$(_mailbox_dir "$agent")"

  # Collect file list ONCE, then read and archive the same set.
  # This avoids a race where a message arriving between read and archive
  # would be silently archived without being displayed.
  local files=()
  while IFS= read -r -d '' f; do
    files+=("$f")
  done < <(find "$dir" -maxdepth 1 -name "*.json" -print0 | sort -z)

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "📭  No messages in $agent's inbox."
    return 0
  fi

  echo "📬  Inbox for $agent (${#files[@]} message(s)):"
  echo "────────────────────────────────────────"

  for f in "${files[@]}"; do
    local fields
    fields=$(python3 - "$f" <<'PYEOF'
import json, sys
path = sys.argv[1]
with open(path) as fh:
    d = json.load(fh)
print(d.get("from", "?"))
print(d.get("subject", "?"))
print(d.get("timestamp", "?"))
print(d.get("priority", "normal"))
print(d.get("body", ""))
PYEOF
    ) 2>/dev/null || { echo "  (error reading $(basename "$f"))"; continue; }

    local from subject ts priority body
    from=$(echo "$fields" | sed -n '1p')
    subject=$(echo "$fields" | sed -n '2p')
    ts=$(echo "$fields" | sed -n '3p')
    priority=$(echo "$fields" | sed -n '4p')
    body=$(echo "$fields" | sed -n '5,$p')

    local badge=""
    [[ "$priority" == "high" ]]   && badge="🔶 "
    [[ "$priority" == "urgent" ]] && badge="🔴 "

    echo "${badge}From: $from  |  $ts  |  $subject"
    echo "$body"
    echo "  [file: $(basename "$f")]"
    echo "────────────────────────────────────────"
  done

  local processed="$dir/processed"
  mkdir -p "$processed"
  for f in "${files[@]}"; do
    [[ -f "$f" ]] && mv "$f" "$processed/"
  done
  echo "📁  Archived ${#files[@]} message(s)."
}

cmd_list() {
  local all=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all) all=true; shift ;;
      *)     _die "unknown option: $1" ;;
    esac
  done

  echo "📮  Agent mailbox summary:"
  echo "────────────────────────────────────────"
  for dir in "$MAILBOXES"/*/; do
    local agent
    agent="$(basename "$dir")"
    local count
    count=$(find "$dir" -maxdepth 1 -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
    if $all || [[ "$count" -gt 0 ]]; then
      printf "  %-12s  %s message(s)\n" "$agent" "$count"
    fi
  done
}

# ── dispatch ─────────────────────────────────────────────────────────────────

[[ $# -eq 0 ]] && { echo "Usage: agent-mail <send|read|archive|drain|list> [options]"; exit 1; }

CMD="$1"; shift
case "$CMD" in
  send)    cmd_send "$@" ;;
  read)    cmd_read "$@" ;;
  archive) cmd_archive "$@" ;;
  drain)   cmd_drain "$@" ;;
  list)    cmd_list "$@" ;;
  *)       _die "unknown command: $CMD. Use send|read|archive|drain|list" ;;
esac
