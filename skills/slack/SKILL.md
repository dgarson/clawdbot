---
name: slack
description: "Use when communicating via Slack — sending messages, reacting, pinning, reading channels, and all agent-to-human communication. Governs both the Slack API actions and communication patterns (tone, formatting, interactive follow-ups, report delivery, proactive notifications). Applies to every Slack interaction."
metadata: { "openclaw": { "emoji": "💬", "requires": { "config": ["channels.slack"] } } }
---

# Slack — API Actions & Communication Patterns

## Overview

Use `slack` to react, manage pins, send/edit/delete messages, and fetch member info. The tool uses the bot token configured for OpenClaw.

This skill also governs **how** to communicate with David over Slack — tone, structure, formatting, interactive follow-ups, and proactive notification patterns.

---

## Part 1: Slack API Actions

### Inputs to collect

- `channelId` and `messageId` (Slack message timestamp, e.g. `1712023032.1234`).
- For reactions, an `emoji` (Unicode or `:name:`).
- For message sends, a `to` target (`channel:<ID>` or `user:<ID>`) and `content`.

Message context lines include `slack message id` and `channel` fields you can reuse directly.

### ℹ️ Channel ID Format

**Channel IDs are automatically normalized to uppercase.** You can use lowercase IDs and the tool will handle the conversion.

| Input                 | Normalized    |
| --------------------- | ------------- |
| `channel:c0aap72r7l5` | `C0AAP72R7L5` |
| `#c0aap72r7l5`        | `C0AAP72R7L5` |
| `C0AAP72R7L5`         | `C0AAP72R7L5` |

When extracting channel IDs from context (like `[channel: C0AAP72R7L5]`), you can use them directly.

### Action groups

| Action group | Default | Notes                  |
| ------------ | ------- | ---------------------- |
| reactions    | enabled | React + list reactions |
| messages     | enabled | Read/send/edit/delete  |
| pins         | enabled | Pin/unpin/list         |
| memberInfo   | enabled | Member info            |
| emojiList    | enabled | Custom emoji list      |

### React to a message

```json
{
  "action": "react",
  "channelId": "C123",
  "messageId": "1712023032.1234",
  "emoji": "✅"
}
```

### List reactions

```json
{
  "action": "reactions",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}
```

### Send a message

```json
{
  "action": "sendMessage",
  "to": "channel:C123",
  "content": "Hello from OpenClaw"
}
```

### Edit a message

```json
{
  "action": "editMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234",
  "content": "Updated text"
}
```

### Delete a message

```json
{
  "action": "deleteMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}
```

### Read recent messages

```json
{
  "action": "readMessages",
  "channelId": "C123",
  "limit": 20
}
```

### Pin a message

```json
{
  "action": "pinMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}
```

### Unpin a message

```json
{
  "action": "unpinMessage",
  "channelId": "C123",
  "messageId": "1712023032.1234"
}
```

### List pinned items

```json
{
  "action": "listPins",
  "channelId": "C123"
}
```

### Member info

```json
{
  "action": "memberInfo",
  "userId": "U123"
}
```

### Emoji list

```json
{
  "action": "emojiList"
}
```

---

## Part 2: Communication Patterns — David Garson

### Identity & Tone

- **Address David as "David"** (never "Mr. Garson", never "user").
- **Conversational-professional**: Direct, confident, no filler ("I'd be happy to help!"), no hedging. Write like a sharp co-founder briefing their partner — not like a support bot.
- **Mirror David's energy**: If he's terse, be terse. If he's exploratory, expand. Match the register of his message.
- David enjoys **bullish/bearish language** from his technical-analysis background — lean into it naturally when context fits (market talk, risk assessment, momentum metaphors).
- Use first person when speaking as the agent ("I completed…", "I recommend…").

### Message Structure

#### Default format for all substantive messages

1. **Lead emoji + bold title** — every message starts with a relevant emoji and a bold summary line.
2. **Scannable body** — bullet points, short paragraphs, or numbered lists. Never walls of text.
3. **Visual hierarchy** — use `*bold*`, `_italic_`, `:emoji:`, and `>` blockquotes to create clear sections.
4. **Key metrics highlighted** — numbers, counts, percentages, and statuses should be visually distinct (bold, emoji-tagged, or in a summary line).

#### Length guidelines

| Context               | Target length                                                        |
| --------------------- | -------------------------------------------------------------------- |
| Quick acknowledgement | 1-2 lines                                                            |
| Answer to a question  | 3-8 lines                                                            |
| Status report         | Structured blocks (use `SlackRichMessage` patterns)                  |
| Briefing / deep-dive  | Sectioned with headers, max ~30 lines in channel; overflow to thread |

#### When to use threads

- **Always thread** replies to David's specific questions (reply in the thread of his message).
- **Always thread** detail expansions on reports — keep the channel clean, put depth in threads.
- **Never thread** proactive notifications or new reports — these go top-level in the channel.

### Report Delivery

#### Formatting standard

All reports (status, daily briefings, work queue updates) must use rich, well-structured formatting:

- **Header block** with emoji + title + date/time in David's timezone (MST)
- **Sections** with italic or bold labels (e.g., _Completed:_, _In Progress:_, _Blocked:_)
- **Bullet points** for items, with status emoji (✅ ⏳ 🚫 ⚠️ 🔄)
- Use `SlackRichMessage` pattern `status`, `progress`, or `info_grid` when appropriate
- **Audio companion**: When TTS is available, include an audio summary with `:headphones:` + `~N minute audio attached`

#### Interactive follow-up questions (MANDATORY)

After **every text-based report**, generate **2–4 multiple-choice questions** using `AskSlackQuestion`:

- Questions must relate to **decisions, priorities, or next steps** from the report
- Cover areas like: priority ranking, approval/rejection of recommendations, preference selection, resource allocation, scope decisions
- Send to David (`@David Garson` / user ID `U0A9JFQU3S9`) or the active channel
- Use `AskSlackQuestion` (blocks until answered — agent processes the response)

#### Report timing context

- David's timezone is **MST (Mountain Standard Time)**
- Reference times in MST in all reports
- Date format: `Mon DD` or `Day of Week, Month DD, YYYY` — never ISO-only

### Proactive Communication

#### When to proactively message David

- **Blockers**: Immediately notify when work is blocked and requires David's input
- **Completions**: Notify when significant milestones or batches of work items complete
- **Anomalies**: Flag unexpected failures, errors, or divergences from expected behavior
- **Decisions needed**: When the agent reaches a fork requiring David's judgment
- **Scheduled reports**: Per cron schedule (status reports, daily briefings)

#### When NOT to message David

- Routine progress on in-flight work (save for the next report)
- Internal agent coordination (use agent-to-agent channels)
- Speculative updates with no actionable content
- Repeating information already delivered in the current report cycle

### Confirmation & Approval Patterns

#### Use `AskSlackConfirmation` for

- Destructive actions (deleting data, resetting state)
- High-cost operations (spawning many subagents, large API calls)
- Scope changes to active work

#### Use `AskSlackQuestion` for

- Priority ranking among multiple options
- Feature/approach selection (2–4 choices)
- Post-report follow-ups (mandatory, see above)

#### Use `AskSlackForm` for

- Collecting multiple data points at once (rare — prefer questions)
- Structured input like names, URLs, configuration values

### Emoji Usage

#### Consistent status emoji vocabulary

| Emoji | Meaning                   |
| ----- | ------------------------- |
| ✅    | Completed / success       |
| ⏳    | In progress / pending     |
| 🚫    | Blocked / failed          |
| ⚠️    | Warning / needs attention |
| 🔄    | Retry / in review         |
| 📊    | Report / metrics          |
| 🎯    | Goal / target / priority  |
| 🔥    | Urgent / hot item         |
| 📋    | Task list / work queue    |
| 🎧    | Audio attachment          |
| 🗞️    | News briefing             |
| 🧪    | Experiment / testing      |
| 🚀    | Launch / deploy / shipped |
| 💡    | Insight / suggestion      |
| 🔧    | Fix / maintenance         |

#### Reactions on David's messages

- React ✅ to acknowledge a directive has been received and will be acted on
- React 👀 to acknowledge a message has been seen but is being processed
- React 🎯 when a request has been queued as a work item

### Error & Bad News Communication

- **Lead with the impact**, then the cause, then the fix/plan
- Never bury bad news — put it first with ⚠️ or 🚫 emoji
- Always include a **next step or recommendation** — never just report a problem
- If something failed repeatedly, include the count and pattern ("failed 3/3 attempts over 45min")

### Channel Hygiene

- **`#cb-notifications`** (`C0AAQJBCU0N`) is the primary human-agent channel
- Keep messages self-contained — David should understand context without scrolling back
- Reference work item IDs (e.g., `EXP-1`, `WQ-42`) when discussing tracked work
- If a previous message needs correction, **edit it** rather than posting a correction (use `message.edit`)
- Pin important decisions or reference material (use `message.pin`)

---

## Tool Selection Guide

| Need                           | Tool                                              |
| ------------------------------ | ------------------------------------------------- |
| Plain text message             | `message` action `send`                           |
| Rich formatted blocks          | `SlackRichMessage`                                |
| Yes/no approval                | `AskSlackConfirmation`                            |
| Multiple choice (2-10 options) | `AskSlackQuestion`                                |
| Multi-field data collection    | `AskSlackForm`                                    |
| Status/progress indicator      | `SlackRichMessage` pattern `status` or `progress` |
| Emoji reaction                 | `message` action `react`                          |
| Read conversation context      | `message` action `read`                           |

## Ideas to try

- React with ✅ to mark completed tasks.
- Pin key decisions or weekly status updates.
