---
name: maestro-link-coordinate
description: Chain-graph coordinator via maestro coordinate endpoint — step-mode execution with session tracking
argument-hint: "\"intent text\" [--list] [-c [sessionId]] [--chain <name>] [--tool <tool>] [-y]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
---
<purpose>
Graph-driven workflow coordinator using `maestro coordinate` CLI endpoint.
Uses step-mode subcommands (start/next/status) to walk chain graphs node by node.
Each command node executed via `maestro cli` internally by the coordinate engine.
Decision/gate/eval nodes auto-resolve between steps.
</purpose>

<required_reading>
@~/.maestro/workflows/maestro-link-coordinate.md
</required_reading>

<context>
$ARGUMENTS — user intent text, or flags.

**Flags:**
- `--list` — List all available chain graphs
- `-c` / `--continue [sessionId]` — Resume previous session via `coordinate next`
- `--chain <name>` — Force a specific chain graph
- `--tool <tool>` — CLI tool override (default: claude)
- `-y` / `--yes` — Auto mode

**CLI endpoints used:**
- `maestro coordinate list` — enumerate chains
- `maestro coordinate start "intent" --chain X` — begin step-mode session
- `maestro coordinate next [sessionId]` — advance one step
- `maestro coordinate status [sessionId]` — query state
- `maestro coordinate run "intent"` — autonomous full run
</context>

<execution>
Follow '~/.maestro/workflows/maestro-link-coordinate.md' completely.
</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no --list/--chain | Suggest --list |
| E002 | error | Chain graph not found | Show list output |
| E003 | error | Step execution failed | Check status, retry next |
| E004 | error | Resume session not found | List sessions |
| E005 | error | CLI endpoint unavailable | Check maestro installation |
</error_codes>

<success_criteria>
- [ ] Chain graph loaded via `maestro coordinate start`
- [ ] Each step executed via `maestro coordinate next` loop
- [ ] JSON output parsed for session tracking
- [ ] Decision nodes auto-resolved between steps
- [ ] Session persisted and resumable via `-c`
- [ ] Completion summary displayed
</success_criteria>
