---
summary: "Minimal Phase 1 developer quickstart: install, configure, run your first agent, and connect Telegram."
read_when:
  - You are evaluating OpenClaw and want a first working agent in under 5 minutes
title: "Developer Quickstart (Phase 1)"
---

# Developer Quickstart (Phase 1)

Goal: go from zero → running Gateway → first chat → (optional) Telegram DM in ~5 minutes.

## 1) Prereqs

- **Node.js 22+**
  - Check: `node --version`
- macOS / Linux / Windows

## 2) Install the OpenClaw CLI

<Tabs>
  <Tab title="macOS/Linux">

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw --version
```

  </Tab>
  <Tab title="Windows (PowerShell)">

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
openclaw --version
```

  </Tab>
</Tabs>

## 3) Minimal `openclaw.json`

OpenClaw reads config from:

- `~/.openclaw/openclaw.json` (JSON5: comments + trailing commas allowed)

Create/edit the file:

```json5
// ~/.openclaw/openclaw.json
{
  // Required for `openclaw gateway` to start without flags.
  gateway: { mode: "local" },

  // Where your agent instructions + memory live.
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",

      // Pick any supported model. For OpenAI models, set OPENAI_API_KEY.
      model: { primary: "openai/gpt-5.1-codex" },
    },
  },
}
```

Set your model API key(s) in your shell (recommended):

```bash
export OPENAI_API_KEY="…"
```

(Alternative: run `openclaw onboard` and let the wizard write auth + defaults for you.)

## 4) Create your first agent workspace (SOUL + AGENTS)

Bootstrap the workspace files:

```bash
openclaw setup
```

This creates (or updates) `~/.openclaw/workspace/` with starter files.

Now edit these two files:

### `~/.openclaw/workspace/SOUL.md`

Keep it short. Example:

```md
# SOUL.md

You are a technical assistant running inside OpenClaw.

- Be concise and correct.
- When you take actions, explain what you changed.
- If you are unsure, ask a specific question.
```

### `~/.openclaw/workspace/AGENTS.md`

Example:

```md
# AGENTS.md

## Main agent

- Purpose: help me evaluate OpenClaw quickly.
- Default behavior: answer directly, then suggest the next smallest step.
```

## 5) Start the Gateway + have a first conversation

Start the Gateway (foreground):

```bash
openclaw gateway
```

In a second terminal, open the Control UI:

```bash
openclaw dashboard
```

Use the chat panel to send:

> "hello — what can you do here?"

If you get blocked on config/schema issues:

```bash
openclaw doctor
openclaw logs --follow
```

## 6) Connect Telegram (one channel)

Telegram is the fastest channel to wire up for evaluation.

### Create a bot token

1. In Telegram, open **@BotFather**
2. Run `/newbot`
3. Copy the token

### Add Telegram to config

Add this to `~/.openclaw/openclaw.json` (keep `gateway.mode` and `agents.defaults` from above):

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
      dmPolicy: "pairing",
    },
  },
}
```

Then set the env var and restart the Gateway:

```bash
export TELEGRAM_BOT_TOKEN="123:abc"
openclaw gateway
```

### Pair your Telegram DM

1. DM your bot (send any message)
2. Approve the pairing code:

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Now DM the bot again — you should get a reply.

(Full Telegram reference: [/channels/telegram](/channels/telegram))

## 7) Trigger your first heartbeat

Heartbeats are optional. This shows the mechanism end-to-end.

1. Create `~/.openclaw/workspace/HEARTBEAT.md`:

```md
# HEARTBEAT.md

If there is nothing urgent to do, reply exactly: HEARTBEAT_OK
```

2. Set a short heartbeat interval:

```bash
openclaw config set agents.defaults.heartbeat.every "10m"
```

3. Trigger a heartbeat immediately:

```bash
openclaw system event --text "Heartbeat test" --mode now
openclaw system heartbeat last
```

The heartbeat runs a normal agent turn and delivers to the configured target (by default, the **last active** chat).

---

### What you have now

- OpenClaw installed
- A minimal `~/.openclaw/openclaw.json`
- A workspace with `SOUL.md` + `AGENTS.md`
- A working first conversation (Control UI)
- Telegram DM wired up (pairing-based)

Next: see [Configuration](/gateway/configuration) and [Channels](/channels).
