# Inter-Agent Mail — Skill Guide

Use the `mail` tool to communicate with other agents through a reliable asynchronous mail system. Messages are delivered to recipient mailboxes and notifications are injected into agent prompts automatically.

## Core: The Two-Step Claim-Ack Pattern

**You cannot read message content without claiming it.** Calling `mail(action='inbox')` atomically transitions matched messages from `unread` → `processing`. This is a _lease_ — you have a limited window (default: 5 minutes) to ack each message before it resets to `unread` and can be re-delivered. This prevents message loss on crashes.

**Always ack after acting.** Never claim without acking when done:

```
1. mail(action='inbox')           → claim messages, get content
2. [act on each message]
3. mail(action='ack', message_ids=[...])  → mark processed
```

If you crash between step 1 and step 3, the messages automatically reset to `unread` after the TTL expires. Do not skip the ack step.

## Actions at a Glance

| Action       | What it does                                 | Required params                  |
| ------------ | -------------------------------------------- | -------------------------------- |
| `inbox`      | Claim unread messages (→ processing)         | —                                |
| `ack`        | Mark claimed messages as processed           | `message_ids`                    |
| `send`       | Send a new message                           | `to_agent_id`, `subject`, `body` |
| `forward`    | Route a message (acks source automatically)  | `message_id`, `to_agent_id`      |
| `recipients` | List agents you can reach; fuzzy name search | —                                |

## Reading Your Inbox

```
mail(action='inbox')
```

- Process urgent messages first (check the `urgency` field).
- Use `filter_urgency: ['urgent', 'high']` to triage priority mail.
- Use `filter_tags: ['task']` to filter by classification.
- Use `include_stale: true` if you restarted and want to see what you were processing before (messages still within their lease window; does not re-claim them).

## Sending Mail

```
mail(action='send', to_agent_id='researcher', subject='Research task', body='...')
```

- Use `action='recipients'` first if unsure of the recipient's agent id. The `search` param supports fuzzy matching on name or id.
- Set `urgency='urgent'` only when immediate action is required — this may wake the recipient immediately.
- Use `tags` to classify messages (e.g. `['task', 'research']`) for easier filtering on the receiving end.

## Forwarding

```
mail(action='forward', message_id='msg_123', to_agent_id='specialist', notes='Delegating to you for domain expertise.')
```

- Forwarding automatically acks the source message — you don't need a separate ack call.
- The recipient sees the full lineage chain so they know the delegation path.
- Preserve tags and urgency unless you have a reason to override them.

## Finding Recipients

```
mail(action='recipients', search='data')
```

Returns all known agents with their display names and whether routing allows you to send to them. Use `search` to fuzzy-match on name or agent id.

## Bounce (if enabled)

The `bounce_mail` tool is opt-in and only available if explicitly granted. Use it when a message is clearly misrouted to you and the original sender should know why.

```
bounce_mail(message_id='msg_123', reason='This task requires database access which I don't have.', confidence=0.9)
```

- `confidence` (0–1): how certain you are the message was misrouted. Be honest — this data helps operators improve routing rules and context engineering.
- Bouncing automatically acks the source message.
- Do NOT bounce speculatively or to avoid work. Use it only when the routing was clearly a mistake.

## Key Rules

1. **Claim before reading** — the system enforces this; there is no way to read content without claiming.
2. **Always ack** — leaving messages in `processing` indefinitely wastes the TTL window and delays re-delivery.
3. **Close the loop** — when you act on a message, reply or ack so the sender knows it was handled.
4. **Don't bounce liberally** — bounce is a learning signal, not a rejection escape hatch.
5. **Use urgency accurately** — `urgent` should mean "requires immediate action"; overuse degrades signal quality.
