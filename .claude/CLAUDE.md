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

## Knowledge Capture

- **Spec writes** → always `<spec-entry>` closed-tag format with `category`, `keywords`, `date`, `source`. Never raw Markdown. Route through `spec-add` when possible.
- **Capture signal** → when execution surfaces non-obvious knowledge (plan deviation, retry pattern, root cause, constraint violation), ask user once whether to persist it. Match category to content: decisions→`arch`, pitfalls→`debug`/`learning`, patterns→`coding`, rules→`quality`.
- **Promotion** → at milestone close, scan learnings for repeated keywords (≥2 entries) and offer to graduate them into formal conventions.
- **Traceability** → every entry needs a source anchor: `file:line`, `INS-{id}`, commit, or phase path.

