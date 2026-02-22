# GHSA (Repo Advisory) Patch/Publish Workflow

Read `SECURITY.md` before starting.

## Steps

**Fetch the advisory:**
```sh
gh api /repos/openclaw/openclaw/security-advisories/<GHSA>
```

**Check latest npm version:**
```sh
npm view openclaw version --userconfig "$(mktemp)"
```

**Ensure private fork has no open PRs** (publish will fail with HTTP 422 if it does):
```sh
fork=$(gh api /repos/openclaw/openclaw/security-advisories/<GHSA> | jq -r .private_fork.full_name)
gh pr list -R "$fork" --state open   # must be empty
```

**Write description** (avoid `"\n"` strings — use heredoc to get real newlines):
```sh
cat > /tmp/ghsa.desc.md <<'EOF'
... markdown description ...
EOF
```

**Build patch JSON:**
```sh
jq -n --rawfile desc /tmp/ghsa.desc.md \
  '{summary: "...", severity: "...", description: $desc, vulnerabilities: [...]}' \
  > /tmp/ghsa.patch.json
```

**Patch (and optionally publish):**
```sh
gh api -X PATCH /repos/openclaw/openclaw/security-advisories/<GHSA> \
  --input /tmp/ghsa.patch.json
```
To publish in the same call, include `"state": "published"` in the JSON. There is no separate `/publish` endpoint.

**If publish fails (HTTP 422):** check for missing `severity`, `description`, or `vulnerabilities[]`, or an open PR in the private fork.

**Verify:**
```sh
gh api /repos/openclaw/openclaw/security-advisories/<GHSA> | jq '{state, published_at}'
gh api /repos/openclaw/openclaw/security-advisories/<GHSA> | jq -r .description | rg '\\n'
# rg should return nothing (no literal \n in description)
```
