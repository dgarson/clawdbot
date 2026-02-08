# PR Review Comment Monitor — Design Spec

## Overview

Automated system to monitor GitHub Pull Request review comments from third-party AI code review integrations (ChatGPT, Claude, etc.), proactively notify the team, and dispatch work to resolve the feedback.

## Requirements (from David)

1. **Hook into PR review comments** — Monitor comments posted by ChatGPT/Claude GitHub App integrations on PRs
2. **Proactive notifications** — Notify via Slack when AI review bots post new feedback
3. **In-progress reaction** — When acting on feedback, add a reaction to the PR comment that is **NOT** thumbs-up (use 👀 `eyes` for in-progress)
4. **Fix and push** — Address the code concern, commit, and push back to the branch
5. **Completion reaction** — Add ✅ `white_check_mark` reaction when the fix is committed and pushed

## Architecture

### Approach: Cron-Based Polling

Use a cron job that periodically polls GitHub API for new PR review comments from known AI bot accounts. This avoids needing to set up GitHub webhooks infrastructure.

### Components

#### 1. `src/webhooks/github-pr-review.ts` — Core Module

**Functions:**

- `pollPRReviewComments(opts)` — Polls GitHub API for new comments on open PRs
- `identifyAIBotComments(comments)` — Filters comments from known AI bot accounts
- `addReaction(commentId, reaction)` — Adds a reaction to a PR comment
- `removeReaction(commentId, reaction)` — Removes a reaction from a PR comment
- `formatSlackNotification(comment)` — Formats a comment for Slack notification

**Known AI Bot Accounts to Monitor:**

- `github-actions[bot]` (when used by AI review workflows)
- `coderabbitai[bot]` — CodeRabbit AI
- `sourcery-ai[bot]` — Sourcery AI
- `codiumai-pr-agent-pro[bot]` — CodiumAI PR-Agent
- `ellipsis-dev[bot]` — Ellipsis AI
- `claude-ai[bot]` / `anthropic-ai[bot]` — Claude integrations
- `openai-gpt[bot]` — ChatGPT integrations
- Custom bot names configurable via config

**State Tracking:**

- Track last-seen comment ID per PR to avoid duplicate processing
- Store in `~/.openclaw/pr-review-state.json`

#### 2. Cron Job Configuration

```yaml
# Poll every 5 minutes
schedule:
  kind: cron
  expr: "*/5 * * * *"
payload:
  kind: agentTurn
  message: "Check for new AI review comments on open PRs and notify"
```

#### 3. Reaction Workflow

```
New AI comment detected
  → Send Slack notification to #cb-ideas or configured channel
  → Add 👀 (eyes) reaction to the comment
  → Create work item for the fix
  → Dispatch Codex worker or subagent to fix
  → Worker fixes code, commits, pushes
  → Remove 👀 reaction
  → Add ✅ (white_check_mark) reaction
```

### GitHub API Endpoints Used

```bash
# List review comments on a PR
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments

# List issue comments on a PR (general comments)
gh api repos/{owner}/{repo}/issues/{pr_number}/comments

# Add reaction to a PR review comment
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions \
  -f content=eyes

# Add reaction to an issue comment
gh api repos/{owner}/{repo}/issues/comments/{comment_id}/reactions \
  -f content=white_check_mark

# List open PRs
gh api repos/{owner}/{repo}/pulls?state=open
```

### Configuration

Add to `openclaw.yaml` or `clawdbrain.yaml`:

```yaml
prReviewMonitor:
  enabled: true
  repo: openclaw/openclaw
  pollIntervalMinutes: 5
  slackChannel: "#cb-ideas"
  # Bot accounts to monitor (login names)
  botAccounts:
    - "coderabbitai[bot]"
    - "sourcery-ai[bot]"
    - "codiumai-pr-agent-pro[bot]"
    - "ellipsis-dev[bot]"
  # Reactions
  inProgressReaction: "eyes" # 👀
  completedReaction: "white_check_mark" # ✅
  # Auto-fix settings
  autoFix: true
  autoFixAgent: "codex-dev-worker-smart"
```

### State File Schema (`pr-review-state.json`)

```json
{
  "version": 1,
  "lastPollAt": "2026-02-08T18:00:00Z",
  "prs": {
    "12032": {
      "lastReviewCommentId": 123456789,
      "lastIssueCommentId": 987654321,
      "processedCommentIds": [123456789, 123456790]
    }
  }
}
```

## Implementation Steps

1. Create `src/webhooks/github-pr-review.ts` with polling logic
2. Create `src/webhooks/github-pr-review.test.ts` with unit tests
3. Register the webhook route (or standalone cron script)
4. Add configuration schema to config types
5. Create cron job for periodic polling
6. Wire Slack notifications
7. Wire work queue integration for auto-fix dispatch

## Files to Create/Modify

- **NEW**: `src/webhooks/github-pr-review.ts`
- **NEW**: `src/webhooks/github-pr-review.test.ts`
- **MODIFY**: `src/config/types.ts` (add prReviewMonitor config)
- **MODIFY**: `src/webhooks/` (add index.ts if needed)

## Success Criteria

- [ ] Polling detects new AI review comments within 5 minutes
- [ ] Slack notification sent with PR link, comment body, and AI bot name
- [ ] 👀 reaction added immediately when acting on feedback
- [ ] ✅ reaction added after fix is committed and pushed
- [ ] No duplicate processing of already-seen comments
- [ ] Graceful handling of rate limits and API errors
