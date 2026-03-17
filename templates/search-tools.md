# Search Tools

## Priority

```
ACE (semantic) → Grep (pattern) → Glob (files) → CLI (deep analysis)
```

## Tool Selection

| Scenario | Tool | Usage |
|----------|------|-------|
| Find by intent/behavior | `mcp__ace-tool__search_context` | `query="<description> Keywords: <terms>"` |
| Known identifier/regex | `Grep` | `pattern="<regex>"`, `glob="<filter>"` |
| Find files by name/ext | `Glob` | `pattern="**/*.test.ts"` |
| Complex cross-file reasoning | `ccw cli --tool gemini --mode analysis` | Multi-file architecture analysis |
| Read identified file | `Read` | After locating via search |

## Fallback

- **ACE unavailable** → Grep + Glob pattern scanning; log degraded mode
- **Grep insufficient** → Escalate to CLI analysis
- **CLI error** → Retry with shorter scope, proceed with available results

## Combined Strategy

For thorough exploration: ACE (broad) → Grep (validate) → Glob (enumerate) → Read (deep examine)
