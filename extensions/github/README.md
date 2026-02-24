# GitHub Tools (OpenClaw plugin)

Granular GitHub tooling via `gh` CLI for commit inspection, diffs, PR workflows, comments, and merges.

## Enable

Bundled plugins are disabled by default. Enable this one:

```bash
openclaw plugins enable github
```

Restart the gateway after enabling.

## Tools

Read-only tools:

- `github_commit_show`
- `github_diff_compare`
- `github_pr_list`
- `github_pr_view`
- `github_pr_checks`
- `github_pr_comments_list`

Write tools:

- `github_pr_comment_create`
- `github_pr_comment_edit`
- `github_pr_comment_delete`
- `github_pr_create`
- `github_pr_edit`
- `github_pr_update_branch`
- `github_pr_close`
- `github_pr_reopen`

Critical tool:

- `github_pr_merge`

## Permission model

All plugin tools are registered as **optional**, so you can grant each tool name per agent.

Example (`agents.list[].tools.allow`):

- Read-only reviewer: `github_commit_show`, `github_diff_compare`, `github_pr_view`, `github_pr_checks`
- Review commenter: read-only set + `github_pr_comment_create`
- Maintainer: write set + `github_pr_merge`

## Optional repo guardrails

Configure `plugins.entries.github.config`:

- `allowedRepos`: global repo allowlist for all actions.
- `writeAllowedRepos`: repo allowlist for mutating actions.
- `mergeAllowedRepos`: strict repo allowlist for merges.

The plugin requires `gh` authentication (`gh auth status`).
