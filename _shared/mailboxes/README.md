# Agent Mailboxes

Async agent-to-agent messaging via file convention.

## Layout

```
_shared/mailboxes/
  <agent>/             ← inbox for <agent> (symlinked as <agent>/inbox/)
    processed/         ← archived messages (already read)
  README.md            ← this file
```

Each heartbeat-eligible agent has a subdirectory here. That directory is symlinked into the agent's workspace as `inbox/` so agents never need to know the central path.

```
xavier/inbox/  →  ../_shared/mailboxes/xavier/
amadeus/inbox/ →  ../_shared/mailboxes/amadeus/
...
workspace/inbox/ → _shared/mailboxes/merlin/  (Merlin lives at workspace root)
```

## Authority & Progressive Disclosure

- **Agents** can read and write their own `inbox/` without knowing about this directory.
- **Authorized agents** (Merlin, Julia) can read across all subdirectories here for org-wide visibility — pending messages, bottlenecks, delivery failures.
- **Agents without heartbeats** are not eligible (they'd never drain their inbox). Currently: quinn, reed, wes, sam.

## Message Format

Files are named `{ISO8601}-{from}-{short-id}.json` so they sort chronologically.

```json
{
  "id": "6afdbcd5",
  "from": "merlin",
  "to": "xavier",
  "subject": "PR review needed",
  "body": "Please review PR #123 when you wake up.",
  "timestamp": "2026-02-22T05:20:52Z",
  "priority": "normal",
  "thread_id": null,
  "read": false
}
```

Priority values: `normal` | `high` | `urgent`

## Usage (helper script)

```bash
# Send a message to another agent
_shared/scripts/agent-mail.sh send --to xavier --subject "Blocked on merge" "Need your review on PR #456 before I can proceed."

# Read your own inbox (marks messages as read)
_shared/scripts/agent-mail.sh read

# Read + archive all (use in heartbeat)
_shared/scripts/agent-mail.sh drain

# Org-wide view (authorized agents only)
_shared/scripts/agent-mail.sh list --all
```

## Heartbeat Integration

Agents with heartbeats should run `agent-mail drain` at the start of each heartbeat cycle. This reads all pending messages, prints them, and archives them to `processed/`.

```bash
# Step 0 in every heartbeat:
~/.openclaw/workspace/_shared/scripts/agent-mail.sh drain
```

## When to Use `agent-mail` vs Other Mechanisms

| Mechanism           | Use when                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `agent-mail`        | Directed async message to a specific agent who may not be running |
| `sessions_send`     | Real-time message to a peer whose session is actively running     |
| `sessions_spawn`    | Delegate a task (don't just notify — do work)                     |
| `#cb-inbox` (Slack) | Notify David or the whole team of a completion/blocker            |
