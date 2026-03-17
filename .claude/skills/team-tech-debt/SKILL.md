---
name: team-tech-debt
description: Unified team skill for tech debt identification and remediation. 5-role pipeline (scanner, assessor, planner, executor, validator) with 5 debt dimensions. Triggers on "team-tech-debt".
argument-hint: "[scope or target] [--mode=scan|remediate|targeted] [-y]"
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Tech Debt

Systematic tech debt governance: scan -> assess -> plan -> fix -> validate. Built on **team-worker agent architecture** -- all worker roles share a single agent definition with role-specific Phase 2-4 loaded from `roles/<role>/role.md`.

## Architecture

```
Skill(skill="team-tech-debt", args="task description")
                    |
         SKILL.md (this file) = Router
                    |
     +--------------+--------------+
     |                             |
  no --role flag              --role <name>
     |                             |
  Coordinator                  Worker
  roles/coordinator/role.md    roles/<name>/role.md
     |
     +-- analyze -> dispatch -> spawn workers -> STOP
                                    |
                    +-------+-------+-------+-------+
                    v       v       v       v       v
           [team-worker agents, each loads roles/<role>/role.md]
          scanner  assessor  planner  executor  validator
```

## Role Registry

| Role | Path | Prefix | Inner Loop |
|------|------|--------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | -- | -- |
| scanner | [roles/scanner/role.md](roles/scanner/role.md) | TDSCAN-* | false |
| assessor | [roles/assessor/role.md](roles/assessor/role.md) | TDEVAL-* | false |
| planner | [roles/planner/role.md](roles/planner/role.md) | TDPLAN-* | false |
| executor | [roles/executor/role.md](roles/executor/role.md) | TDFIX-* | true |
| validator | [roles/validator/role.md](roles/validator/role.md) | TDVAL-* | false |

## Role Router

Parse `$ARGUMENTS`:
- Has `--role <name>` -> Read `roles/<name>/role.md`, execute Phase 2-4
- No `--role` -> Read `roles/coordinator/role.md`, execute entry router

## Shared Constants

- **Session prefix**: `TD`
- **Session path**: `.workflow/.team/TD-<slug>-<date>/`
- **Team name**: `tech-debt`
- **CLI tools**: `ccw cli --mode analysis` (read-only), `ccw cli --mode write` (modifications)
- **Message bus**: `mcp__ccw-tools__team_msg(session_id=<session-id>, ...)`
- **Max GC rounds**: 3

## Worker Spawn Template

Coordinator spawns workers using this template:

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker for <task-id>",
  team_name: "tech-debt",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: <project>/.claude/skills/team-tech-debt/roles/<role>/role.md
session: <session-folder>
session_id: <session-id>
team_name: tech-debt
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role Phase 2-4 -> built-in Phase 5 (report).`
})
```

## User Commands

| Command | Action |
|---------|--------|
| `check` / `status` | View execution status graph |
| `resume` / `continue` | Advance to next step |
| `--mode=scan` | Run scan-only pipeline (TDSCAN + TDEVAL) |
| `--mode=targeted` | Run targeted pipeline (TDPLAN + TDFIX + TDVAL) |
| `--mode=remediate` | Run full pipeline (default) |
| `-y` / `--yes` | Skip confirmations |

## Completion Action

When pipeline completes, coordinator presents:

```
AskUserQuestion({
  questions: [{
    question: "Tech debt pipeline complete. What would you like to do?",
    header: "Completion",
    multiSelect: false,
    options: [
      { label: "Archive & Clean (Recommended)", description: "Archive session, clean up team" },
      { label: "Keep Active", description: "Keep session for follow-up work" },
      { label: "New Target", description: "Start new tech debt scan with different scope" }
    ]
  }]
})
```

## Specs Reference

- [specs/pipelines.md](specs/pipelines.md) -- Pipeline definitions and task registry
- [specs/team-config.json](specs/team-config.json) -- Team configuration

## Session Directory

```
.workflow/.team/TD-<slug>-<date>/
+-- .msg/
|   +-- messages.jsonl      # Team message bus
|   +-- meta.json           # Pipeline config + role state snapshot
+-- scan/                   # Scanner output
+-- assessment/             # Assessor output
+-- plan/                   # Planner output
+-- fixes/                  # Executor output
+-- validation/             # Validator output
+-- wisdom/                 # Cross-task knowledge
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown command | Error with available command list |
| Role not found | Error with role registry |
| Session corruption | Attempt recovery, fallback to manual |
| Fast-advance conflict | Coordinator reconciles on next callback |
| Completion action fails | Default to Keep Active |
| Scanner finds no debt | Report clean codebase, skip to summary |
