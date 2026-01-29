# PR 1: Tool Schema Descriptions

## Summary

Add comprehensive descriptions to all tool schema properties to improve model guidance, documentation generation, and IDE support.

## PR Description

```markdown
## Summary

- Add `description` fields to all tool schema properties across 13 tool files
- Improves Claude's understanding of parameter purposes and expected values
- Enables better documentation generation and IDE autocomplete

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Existing tool behavior unchanged (descriptions are metadata-only)
- [ ] Schema validation still works

## Motivation

Tool schemas currently lack descriptions, making it harder for:
1. Claude to understand parameter semantics
2. Documentation generators to produce helpful docs
3. IDE tooling to provide meaningful autocomplete

This is a purely additive change with zero runtime impact.
```

## Files Changed

| File | Changes | Notes |
|------|---------|-------|
| `src/agents/tools/browser-tool.schema.ts` | +148/-67 | Browser automation params |
| `src/agents/tools/canvas-tool.ts` | +50/-25 | Canvas/screenshot params |
| `src/agents/tools/cron-tool.ts` | +54/-25 | Scheduled job params |
| `src/agents/tools/gateway-tool.ts` | +44/-25 | Gateway control params |
| `src/agents/tools/image-tool.ts` | +25/-12 | Image generation params |
| `src/agents/tools/memory-tool.ts` | +35/-8 | Memory search params |
| `src/agents/tools/message-tool.ts` | +198/-109 | Messaging params (largest) |
| `src/agents/tools/nodes-tool.ts` | +97/-53 | Node device params |
| `src/agents/tools/session-status-tool.ts` | +13/-6 | Session status params |
| `src/agents/tools/sessions-history-tool.ts` | +17/-5 | History retrieval params |
| `src/agents/tools/sessions-list-tool.ts` | +28/-9 | Session listing params |
| `src/agents/tools/sessions-send-tool.ts` | +35/-11 | Cross-session messaging |
| `src/agents/tools/sessions-spawn-tool.ts` | +50/-24 | Sub-agent spawning |

## Example Change

Before:
```typescript
const BrowserToolSchema = Type.Object({
  url: Type.Optional(Type.String()),
  width: Type.Optional(Type.Number()),
  // ...
});
```

After:
```typescript
const BrowserToolSchema = Type.Object({
  url: Type.Optional(Type.String({ description: "URL to navigate to" })),
  width: Type.Optional(Type.Number({ description: "Browser viewport width in pixels" })),
  // ...
});
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking existing tools | None | Descriptions are metadata-only |
| Schema validation issues | None | TypeBox handles descriptions natively |
| Performance impact | None | No runtime cost |

## Dependencies

None - this PR is completely independent.

## Rollback Strategy

Revert the commit. No data migration or state changes required.

## Verification Checklist

- [ ] All 13 files have consistent description formatting
- [ ] No typos or unclear descriptions
- [ ] Complex parameters have detailed guidance
- [ ] Default values documented where applicable

## Reviewer Notes

This is a large diff by line count but extremely low risk. Consider:
- Spot-checking a few files for description quality
- Verifying build/test passes
- No need for deep code review

## Related Work

This PR prepares the codebase for multi-runtime support where different runtimes may parse schemas differently. Having rich descriptions ensures consistent behavior across:
- Pi Agent (current)
- Claude Code SDK (future)
- Potential MCP tool bridges

---

*Estimated Review Time: 15 minutes*
*Merge Complexity: Trivial*
