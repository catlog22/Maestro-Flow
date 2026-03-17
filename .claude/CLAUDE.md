# Maestro

Workflow orchestration CLI with MCP endpoint support and extensible architecture.

## Project Structure

```
maestro/
├── bin/              # CLI entry points (maestro.js, maestro-mcp.js)
├── src/              # TypeScript source
│   ├── cli.ts        # CLI definition (Commander.js)
│   ├── commands/     # CLI command implementations
│   ├── config/       # Configuration & paths
│   ├── core/         # Tool registry, extension loader
│   ├── mcp/          # MCP server (stdio transport)
│   ├── tools/        # Built-in tool implementations
│   └── types/        # TypeScript type definitions
├── templates/        # Workflow template files
├── commands/         # Claude Code slash commands (.md)
├── agents/           # Agent definitions (.md)
├── workflows/        # Workflow definitions
└── extensions/       # Extension directory (plugin system)
```

## Development

- `npm run build` — Compile TypeScript
- `npm run dev` — Watch mode
- `npm start` — Run CLI
- `npm run mcp` — Start MCP server

## Conventions

- ESM modules (`"type": "module"`)
- Strict TypeScript
- Commander.js for CLI
- MCP SDK for tool exposure
- Extensions loaded from `~/.maestro/extensions/` or local `extensions/`

## Command-Workflow Architecture

Commands (`.claude/commands/`) are **thin contract layers** (~40-80 lines) that define the user-facing API:
- YAML frontmatter, `<purpose>`, `<required_reading>`, `<context>`, `<execution>`, `<error_codes>`, `<success_criteria>`
- `<execution>` routes to the workflow: `Follow @~/.maestro/workflows/xxx.md completely.`
- **No `<step>` tags** — all process logic lives in workflows

Workflows (`workflows/`) are the **single source of truth** for implementation:
- Pure Markdown with `### Step N:` headings
- Contains all process steps, bash blocks, agent startup details, report formats
- Skill() cross-references for next-step routing

## Completion Criteria Hierarchy

Three levels of "done" criteria flow through the pipeline — each serves a different abstraction:

| Term | Where | Purpose | Example |
|------|-------|---------|---------|
| **Success Criteria** | `roadmap.md` phases | High-level, user-centric phase goals | "User can log in and stay logged in across sessions" |
| **convergence.criteria** | `TASK-*.json` | Low-level, grep-verifiable task checks | "`auth.ts` contains `export function verifyToken(`" |
| **acceptance criteria** | `spec-generate` REQ/Story | Mid-level, testable feature conditions | "Password reset email sent within 30s" |

Flow: roadmap Success Criteria → plan decomposes into tasks → each task has `convergence.criteria` (machine-verifiable).

## Architecture Reference

- **融合架构设计 v3**: @docs/fusion-design.md — Maestro 总设计文档（**实现时必读**），含：
  - `.workflow/` 统一目录结构（project.md + roadmap.md + state.json + config.json）
  - Phase 即容器：阶段目录自包含全部生命周期产物（探索/规划/执行/验证/测试/调试）
  - 7 套 JSON Schema（state / index / task / verification / validation / scratch-index / doc-index）
  - Specs 双轨制 + Codebase 文档系统
  - 阶段管线 + 非阶段 scratch/ 任务
  - 24 个命令 + 15 个 Agent + 配置系统
  - 16 条架构原则 + 5 阶段实施路线图

- **GSD 架构参考**: @docs/gsd-architecture-reference.md — GSD 原始架构详细文档（设计溯源）
