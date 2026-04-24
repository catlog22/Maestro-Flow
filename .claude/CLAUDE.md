# Maestro

Workflow orchestration CLI with MCP endpoint support and extensible architecture.

- **Coding Philosophy**: @~/.maestro/workflows/coding-philosophy.md

## Delegate & CLI

- **Delegate Usage**: @~/.maestro/workflows/delegate-usage.md
- **CLI Endpoints Config**: @~/.maestro/cli-tools.json

**Strictly follow the cli-tools.json configuration**

Available CLI endpoints are dynamically defined by the config file

## Code Diagnostics

- **Prefer `mcp__ide__getDiagnostics`** for code error checking over shell-based TypeScript compilation

## Knowledge Capture Discipline

### Spec Format Enforcement

- All writes to `.workflow/specs/` **must** use `<spec-entry>` closed-tag format with `category`, `keywords`, `date` attributes
- Never write unstructured Markdown directly (legacy heading format is read-only for backward compatibility)
- Manual writes go through `spec-add`; automated writes follow `workflows/specs-add.md` format template

### Inquiry Triggers

At the following key moments, **proactively ask** the user whether knowledge should be captured:

| Trigger Condition | Inquiry Direction | Target Category |
|-------------------|-------------------|-----------------|
| Task execution deviates from plan (approach change, dependency swap) | "Should this decision be recorded as an architecture constraint?" | `arch` |
| Task succeeds after ≥2 retries | "Should this fix pattern be documented in debug-notes?" | `debug` |
| `maestro-verify` finds anti-patterns or constraint violations | "Should quality-rules or architecture-constraints be updated?" | `quality` / `arch` |
| `quality-debug` confirms root cause | "Should this root cause pattern be recorded as a learning to prevent recurrence?" | `learning` / `debug` |
| Milestone completion | "Were any established conventions bypassed during this milestone? Should coding-conventions be updated?" | `coding` |

### Knowledge Promotion

- At milestone retrospective, proactively scan `learnings.md` for high-frequency patterns (keywords appearing in ≥2 entries) and suggest promoting them to formal conventions (`coding` / `arch` / `quality`)
- When promoting from `learning` to another category, preserve original `date` and source traceability
- `manage-harvest` routing: universal design patterns → `coding`/`arch`; component-level pitfalls → `learning`; quality rules → `quality`

### Evidence Chain

- Each spec entry should include at least one traceable source: `file:line` reference, `INS-{id}` or `HRV-{id}` provenance ID, commit hash, or phase/plan path
- `source` attribute indicates write origin: `manual` / `execute` / `retrospective` / `milestone-complete` / `harvest` / `debug`

