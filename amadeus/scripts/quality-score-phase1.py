#!/usr/bin/env python3
"""
Quality Score Phase 1 — Retroactive Session Scoring
Author: Amadeus (CAIO)
Date: 2026-02-21

Parses session transcript JSONL files from the last 7 days,
computes Q scores (0.0–1.0) per session, outputs CSV + JSONL
for Robert's ROI pipeline.

No API calls. Pure transcript parsing.
"""

import json
import os
import sys
import csv
import glob
from datetime import datetime, timedelta, timezone
from pathlib import Path
from collections import defaultdict

# ─── Configuration ───────────────────────────────────────────────
AGENTS_DIR = os.path.expanduser("~/.openclaw/agents")
OUTPUT_DIR = os.path.expanduser("~/.openclaw/workspace/robert/quality-scores")
DAYS_BACK = 7
ALERT_Q_THRESHOLD = 0.40
ALERT_COST_THRESHOLD = 0.10  # Robert's cost-qualified threshold

# Task-type weight profiles: (completion, execution, efficiency, outcome)
WEIGHT_PROFILES = {
    "coding":      (0.15, 0.20, 0.15, 0.50),
    "operations":  (0.20, 0.30, 0.30, 0.20),
    "research":    (0.25, 0.15, 0.20, 0.40),
    "chat":        (0.40, 0.20, 0.25, 0.15),
    "discovery":   (0.30, 0.15, 0.20, 0.35),
    "heartbeat":   (0.30, 0.25, 0.35, 0.10),
}


def classify_task_type(session_data):
    """Classify session task type from transcript signals."""
    messages = session_data.get("messages", [])
    tools_used = set(session_data.get("tools_used", []))
    first_user_msg = session_data.get("first_user_message", "").lower()
    agent_id = session_data.get("agent_id", "")
    final_text = session_data.get("final_assistant_text", "").lower()
    trigger = session_data.get("trigger_type", "unknown")

    # Heartbeat detection
    if "heartbeat" in first_user_msg or "heartbeat_ok" in final_text:
        return "heartbeat"

    # Coding signals
    coding_tools = {"exec", "write", "edit", "read"}
    coding_keywords = ["pr ", "pull request", "implement", "fix", "bug", "code",
                       "branch", "commit", "merge", "refactor", "build", "test"]
    if (tools_used & coding_tools and
        any(kw in first_user_msg for kw in coding_keywords)):
        return "coding"

    # Operations signals
    ops_keywords = ["cron", "monitor", "check", "status", "deploy", "restart",
                    "health", "log", "alert", "config"]
    if any(kw in first_user_msg for kw in ops_keywords):
        return "operations"

    # Research signals
    research_keywords = ["research", "analyze", "investigate", "evaluate",
                         "compare", "review", "spec", "design", "brainstorm",
                         "proposal", "strategy"]
    if any(kw in first_user_msg for kw in research_keywords):
        return "research"

    # Discovery signals (creative/exploratory agents)
    discovery_keywords = ["discover", "explore", "prototype", "experiment",
                          "creative", "idea", "innovation"]
    if any(kw in first_user_msg for kw in discovery_keywords):
        return "discovery"

    # Default: if heavy tool use → operations, else chat
    if len(tools_used) >= 3:
        return "operations"

    return "chat"


def parse_session(filepath):
    """Parse a session transcript JSONL file and extract scoring signals."""
    data = {
        "session_id": None,
        "agent_id": filepath.split("/agents/")[1].split("/")[0] if "/agents/" in filepath else "unknown",
        "filepath": filepath,
        "timestamp": None,
        "model": None,
        "provider": None,
        "messages": [],
        "tools_used": set(),
        "tool_calls_total": 0,
        "tool_calls_success": 0,
        "tool_calls_error": 0,
        "tool_calls_first_attempt": 0,
        "assistant_turns": 0,
        "user_turns": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cache_read": 0,
        "total_cost": 0.0,
        "first_user_message": "",
        "final_assistant_text": "",
        "final_stop_reason": "",
        "has_compaction": False,
        "compaction_count": 0,
        "spawn_count": 0,
        "spawn_success": 0,
        "user_corrections": 0,
        "trigger_type": "unknown",
        "artifacts_produced": 0,
        "thinking_level": None,
    }

    tool_call_ids_pending = {}  # track tool calls awaiting results
    tool_retry_tracker = {}     # track tool name → consecutive failures

    try:
        with open(filepath) as f:
            for line in f:
                try:
                    obj = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue

                etype = obj.get("type")

                if etype == "session":
                    data["session_id"] = obj.get("id")
                    data["timestamp"] = obj.get("timestamp")

                elif etype == "model_change":
                    data["model"] = obj.get("modelId")
                    data["provider"] = obj.get("provider")

                elif etype == "thinking_level_change":
                    data["thinking_level"] = obj.get("thinkingLevel")

                elif etype == "message":
                    msg = obj.get("message", {})
                    role = msg.get("role", "")
                    content = msg.get("content", "")
                    stop_reason = msg.get("stopReason", "")

                    # Accumulate usage
                    usage = msg.get("usage", {})
                    if usage:
                        data["total_input_tokens"] += usage.get("input", 0)
                        data["total_output_tokens"] += usage.get("output", 0)
                        data["total_cache_read"] += usage.get("cacheRead", 0)
                        cost = usage.get("cost", {})
                        if isinstance(cost, dict):
                            data["total_cost"] += cost.get("total", 0)
                        elif isinstance(cost, (int, float)):
                            data["total_cost"] += cost

                    if role == "user":
                        data["user_turns"] += 1
                        text = extract_text(content)
                        if data["user_turns"] == 1:
                            data["first_user_message"] = text[:500]
                        # Detect user corrections
                        correction_phrases = ["no, ", "that's wrong", "i meant",
                                              "actually,", "not what i asked",
                                              "try again", "that's not right"]
                        if any(p in text.lower() for p in correction_phrases):
                            data["user_corrections"] += 1

                    elif role == "assistant":
                        data["assistant_turns"] += 1
                        data["final_stop_reason"] = stop_reason
                        text = extract_text(content)
                        data["final_assistant_text"] = text[:500]

                        # Count tool calls in content
                        if isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict):
                                    btype = block.get("type", "")
                                    if btype in ("toolCall", "tool_use"):
                                        tool_name = block.get("name", block.get("toolName", "unknown"))
                                        call_id = block.get("id", block.get("toolCallId", ""))
                                        data["tools_used"].add(tool_name)
                                        data["tool_calls_total"] += 1
                                        tool_call_ids_pending[call_id] = tool_name

                                        # Track artifacts
                                        if tool_name in ("write", "edit"):
                                            data["artifacts_produced"] += 1
                                        if tool_name == "sessions_spawn":
                                            data["spawn_count"] += 1
                                        if tool_name == "message":
                                            data["artifacts_produced"] += 1

                    elif role == "toolResult":
                        call_id = msg.get("toolCallId", "")
                        tool_name = msg.get("toolName", tool_call_ids_pending.get(call_id, "unknown"))
                        text = extract_text(content)
                        is_error = msg.get("isError", False) or '"status": "error"' in text.lower()

                        if is_error:
                            data["tool_calls_error"] += 1
                            tool_retry_tracker[tool_name] = tool_retry_tracker.get(tool_name, 0) + 1
                        else:
                            data["tool_calls_success"] += 1
                            # First attempt success if no prior failures for this tool
                            if tool_retry_tracker.get(tool_name, 0) == 0:
                                data["tool_calls_first_attempt"] += 1
                            tool_retry_tracker[tool_name] = 0

                            # Spawn success detection
                            if tool_name == "sessions_spawn" and '"status": "ok"' in text:
                                data["spawn_success"] += 1

                        if call_id in tool_call_ids_pending:
                            del tool_call_ids_pending[call_id]

                elif etype == "custom":
                    custom_type = obj.get("customType", "")
                    if "compaction" in custom_type.lower():
                        data["has_compaction"] = True
                        data["compaction_count"] += 1

    except Exception as e:
        data["parse_error"] = str(e)

    # Convert set to list for JSON serialization
    data["tools_used"] = list(data["tools_used"])
    return data


def extract_text(content):
    """Extract plain text from content (string or content blocks array)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    texts.append(block.get("text", ""))
            elif isinstance(block, str):
                texts.append(block)
        return " ".join(texts)
    return ""


def score_completion(data):
    """Score: did the session accomplish its goal? (0.0–1.0)"""
    signals = []

    # 1. Normal termination (not error/timeout)
    stop = data.get("final_stop_reason", "")
    if stop in ("stop", "end_turn", "toolUse", "tool_use"):
        signals.append(1.0)
    elif stop == "":
        signals.append(0.3)  # unknown/missing
    else:
        signals.append(0.0)

    # 2. Substantive output
    final_text = data.get("final_assistant_text", "")
    assistant_turns = data.get("assistant_turns", 0)
    if assistant_turns == 0:
        signals.append(0.0)
    elif final_text.strip().upper() in ("HEARTBEAT_OK", "NO_REPLY", "REPLY_SKIP", "ANNOUNCE_SKIP"):
        signals.append(0.5)  # valid but minimal
    elif len(final_text) > 100 or data.get("tool_calls_total", 0) > 0:
        signals.append(1.0)
    else:
        signals.append(0.6)

    # 3. No user corrections
    corrections = data.get("user_corrections", 0)
    if corrections == 0:
        signals.append(1.0)
    elif corrections == 1:
        signals.append(0.5)
    else:
        signals.append(0.2)

    return sum(signals) / len(signals) if signals else 0.0


def score_execution(data):
    """Score: how well did the agent execute? (0.0–1.0)"""
    total_calls = data.get("tool_calls_total", 0)

    if total_calls == 0:
        # No tool calls — execution quality is neutral (not penalized)
        return 0.75

    # Tool call success rate (weight 0.5)
    success_rate = data.get("tool_calls_success", 0) / total_calls

    # First-attempt success (weight 0.25)
    first_attempt_rate = data.get("tool_calls_first_attempt", 0) / total_calls

    # Error recovery (weight 0.15)
    error_rate = data.get("tool_calls_error", 0) / total_calls
    if error_rate == 0:
        recovery_score = 1.0
    elif error_rate < 0.2:
        recovery_score = 0.7
    elif error_rate < 0.5:
        recovery_score = 0.4
    else:
        recovery_score = 0.2

    # Sub-agent success (weight 0.1)
    spawn_count = data.get("spawn_count", 0)
    if spawn_count == 0:
        spawn_score = 1.0  # no spawns, no penalty
    else:
        spawn_score = data.get("spawn_success", 0) / spawn_count

    return (0.5 * success_rate +
            0.25 * first_attempt_rate +
            0.15 * recovery_score +
            0.10 * spawn_score)


def score_efficiency(data):
    """Score: was the session resource-appropriate? (0.0–1.0)"""
    signals = []

    # Token efficiency: output / (input + cache_read)
    total_in = data.get("total_input_tokens", 0) + data.get("total_cache_read", 0)
    total_out = data.get("total_output_tokens", 0)
    if total_in > 0:
        ratio = total_out / total_in
        # Baseline: 0.05–0.3 is typical. Score normalized.
        if ratio >= 0.15:
            signals.append(1.0)
        elif ratio >= 0.05:
            signals.append(0.7)
        elif ratio >= 0.01:
            signals.append(0.4)
        else:
            signals.append(0.2)
    else:
        signals.append(0.5)

    # Turn count efficiency: fewer turns = more efficient
    assistant_turns = data.get("assistant_turns", 0)
    if assistant_turns <= 2:
        signals.append(1.0)
    elif assistant_turns <= 5:
        signals.append(0.8)
    elif assistant_turns <= 10:
        signals.append(0.6)
    else:
        signals.append(0.4)

    # Compaction events
    compactions = data.get("compaction_count", 0)
    if compactions == 0:
        signals.append(1.0)
    elif compactions == 1:
        signals.append(0.8)
    else:
        signals.append(0.5)

    # Model appropriateness (simplified without intent classifier)
    # Penalize Opus/expensive models on heartbeat/simple tasks
    model = (data.get("model") or "").lower()
    task_type = data.get("task_type", "chat")
    if task_type == "heartbeat" and ("opus" in model or "gpt-5" in model):
        signals.append(0.4)  # over-provisioned
    elif task_type == "chat" and "opus" in model:
        signals.append(0.6)
    else:
        signals.append(1.0)

    return sum(signals) / len(signals) if signals else 0.5


def score_outcome(data):
    """Score: did the work produce measurable results? (0.0–1.0)"""
    task_type = data.get("task_type", "chat")

    # Artifact produced
    artifacts = data.get("artifacts_produced", 0)
    if artifacts > 0:
        artifact_score = min(1.0, artifacts * 0.25)  # cap at 1.0
    else:
        artifact_score = 0.0

    # For heartbeat sessions: correct no-op is a valid outcome
    if task_type == "heartbeat":
        final = data.get("final_assistant_text", "").strip().upper()
        if final in ("HEARTBEAT_OK", "NO_REPLY"):
            return 0.80  # correctly identified nothing to do

    # For chat sessions: substantive response is the outcome
    if task_type == "chat":
        final = data.get("final_assistant_text", "")
        if len(final) > 200:
            return max(0.7, artifact_score)
        elif len(final) > 50:
            return max(0.5, artifact_score)
        else:
            return max(0.2, artifact_score)

    # For all other types: artifact-based
    tool_count = data.get("tool_calls_total", 0)
    success_count = data.get("tool_calls_success", 0)
    if tool_count > 0 and success_count > 0:
        return max(0.6, artifact_score)

    return artifact_score


def compute_quality_score(data):
    """Compute composite Q score with task-type-specific weights."""
    task_type = classify_task_type(data)
    data["task_type"] = task_type

    # Compute sub-scores
    c = score_completion(data)
    e = score_execution(data)
    f = score_efficiency(data)
    o = score_outcome(data)

    data["score_completion"] = round(c, 4)
    data["score_execution"] = round(e, 4)
    data["score_efficiency"] = round(f, 4)
    data["score_outcome"] = round(o, 4)

    # Get weights for task type
    weights = WEIGHT_PROFILES.get(task_type, WEIGHT_PROFILES["chat"])
    w_c, w_e, w_f, w_o = weights

    # Composite
    q = w_c * c + w_e * e + w_f * f + w_o * o
    data["quality_score"] = round(q, 4)
    data["quality_label"] = score_label(q)

    # Alert flag (Robert's cost-qualified threshold)
    cost = data.get("total_cost", 0)
    data["alert"] = q < ALERT_Q_THRESHOLD and cost > ALERT_COST_THRESHOLD

    return data


def score_label(q):
    if q >= 0.90: return "excellent"
    if q >= 0.75: return "good"
    if q >= 0.60: return "acceptable"
    if q >= 0.40: return "poor"
    return "failed"


def find_sessions(days_back=7):
    """Find all session transcript files from the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    sessions = []

    for agent_dir in glob.glob(os.path.join(AGENTS_DIR, "*", "sessions")):
        for jsonl_file in glob.glob(os.path.join(agent_dir, "*.jsonl")):
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(jsonl_file), tz=timezone.utc)
                if mtime >= cutoff:
                    sessions.append(jsonl_file)
            except OSError:
                continue

    return sessions


def main():
    print(f"Quality Score Phase 1 — Retroactive Session Scoring")
    print(f"Scanning last {DAYS_BACK} days of sessions...")
    print()

    sessions = find_sessions(DAYS_BACK)
    print(f"Found {len(sessions)} session transcripts")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    results = []
    errors = []
    alerts = []

    for filepath in sessions:
        try:
            data = parse_session(filepath)
            data = compute_quality_score(data)
            results.append(data)

            if data.get("alert"):
                alerts.append(data)
        except Exception as e:
            errors.append({"file": filepath, "error": str(e)})

    # Sort by quality score ascending (worst first)
    results.sort(key=lambda x: x.get("quality_score", 0))

    # ─── Write JSONL output ─────────────────────────────────────
    jsonl_path = os.path.join(OUTPUT_DIR, "quality-scores-7d.jsonl")
    with open(jsonl_path, "w") as f:
        for r in results:
            # Clean for serialization
            out = {
                "session_id": r.get("session_id"),
                "agent_id": r.get("agent_id"),
                "timestamp": r.get("timestamp"),
                "model": r.get("model"),
                "provider": r.get("provider"),
                "thinking_level": r.get("thinking_level"),
                "task_type": r.get("task_type"),
                "quality_score": r.get("quality_score"),
                "quality_label": r.get("quality_label"),
                "score_completion": r.get("score_completion"),
                "score_execution": r.get("score_execution"),
                "score_efficiency": r.get("score_efficiency"),
                "score_outcome": r.get("score_outcome"),
                "total_cost": r.get("total_cost"),
                "total_input_tokens": r.get("total_input_tokens"),
                "total_output_tokens": r.get("total_output_tokens"),
                "total_cache_read": r.get("total_cache_read"),
                "tool_calls_total": r.get("tool_calls_total"),
                "tool_calls_success": r.get("tool_calls_success"),
                "tool_calls_error": r.get("tool_calls_error"),
                "assistant_turns": r.get("assistant_turns"),
                "user_turns": r.get("user_turns"),
                "artifacts_produced": r.get("artifacts_produced"),
                "user_corrections": r.get("user_corrections"),
                "compaction_count": r.get("compaction_count"),
                "spawn_count": r.get("spawn_count"),
                "final_stop_reason": r.get("final_stop_reason"),
                "alert": r.get("alert"),
                "parent_session_id": None,  # Phase 2: populate from spawn metadata
                "roi": round(r["quality_score"] / r["total_cost"], 2) if r.get("total_cost", 0) > 0 else None,
            }
            f.write(json.dumps(out) + "\n")

    # ─── Write CSV output ───────────────────────────────────────
    csv_path = os.path.join(OUTPUT_DIR, "quality-scores-7d.csv")
    if results:
        fieldnames = ["session_id", "agent_id", "timestamp", "model", "provider",
                      "task_type", "quality_score", "quality_label",
                      "score_completion", "score_execution", "score_efficiency", "score_outcome",
                      "total_cost", "roi", "total_input_tokens", "total_output_tokens",
                      "tool_calls_total", "tool_calls_success", "tool_calls_error",
                      "assistant_turns", "artifacts_produced", "alert"]
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in results:
                r["roi"] = round(r["quality_score"] / r["total_cost"], 2) if r.get("total_cost", 0) > 0 else None
                writer.writerow(r)

    # ─── Summary statistics ─────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"QUALITY SCORE SUMMARY — Last {DAYS_BACK} Days")
    print(f"{'='*60}")
    print(f"Sessions scored: {len(results)}")
    print(f"Parse errors: {len(errors)}")
    print(f"Alerts (Q<{ALERT_Q_THRESHOLD} & Cost>${ALERT_COST_THRESHOLD}): {len(alerts)}")
    print()

    if results:
        scores = [r["quality_score"] for r in results]
        print(f"Score distribution:")
        print(f"  Mean:   {sum(scores)/len(scores):.3f}")
        print(f"  Median: {sorted(scores)[len(scores)//2]:.3f}")
        print(f"  Min:    {min(scores):.3f}")
        print(f"  Max:    {max(scores):.3f}")
        print()

        # By quality tier
        tiers = defaultdict(int)
        for r in results:
            tiers[r["quality_label"]] += 1
        print(f"Quality tiers:")
        for label in ["excellent", "good", "acceptable", "poor", "failed"]:
            count = tiers.get(label, 0)
            pct = count / len(results) * 100
            print(f"  {label:12s}: {count:4d} ({pct:5.1f}%)")
        print()

        # By task type
        by_type = defaultdict(list)
        for r in results:
            by_type[r["task_type"]].append(r["quality_score"])
        print(f"By task type:")
        for tt, scores_list in sorted(by_type.items()):
            avg = sum(scores_list) / len(scores_list)
            print(f"  {tt:12s}: n={len(scores_list):3d}, avg_Q={avg:.3f}")
        print()

        # By model
        by_model = defaultdict(list)
        for r in results:
            model = r.get("model") or "unknown"
            by_model[model].append(r)
        print(f"By model:")
        for model, model_results in sorted(by_model.items()):
            avg_q = sum(r["quality_score"] for r in model_results) / len(model_results)
            total_cost = sum(r.get("total_cost", 0) for r in model_results)
            avg_cost = total_cost / len(model_results)
            print(f"  {model:25s}: n={len(model_results):3d}, avg_Q={avg_q:.3f}, avg_cost=${avg_cost:.4f}")
        print()

        # By agent
        by_agent = defaultdict(list)
        for r in results:
            by_agent[r["agent_id"]].append(r)
        print(f"By agent (top 15 by volume):")
        for agent, agent_results in sorted(by_agent.items(), key=lambda x: -len(x[1]))[:15]:
            avg_q = sum(r["quality_score"] for r in agent_results) / len(agent_results)
            total_cost = sum(r.get("total_cost", 0) for r in agent_results)
            print(f"  {agent:12s}: n={len(agent_results):3d}, avg_Q={avg_q:.3f}, total_cost=${total_cost:.4f}")
        print()

        # Alerts
        if alerts:
            print(f"⚠️  ALERTS ({len(alerts)} sessions):")
            for a in alerts[:10]:
                print(f"  [{a['agent_id']}] Q={a['quality_score']:.3f} cost=${a['total_cost']:.4f} "
                      f"model={a.get('model')} type={a['task_type']} session={a['session_id'][:8]}")
            print()

    print(f"Output files:")
    print(f"  JSONL: {jsonl_path}")
    print(f"  CSV:   {csv_path}")
    print()

    return len(results), len(alerts)


if __name__ == "__main__":
    main()
