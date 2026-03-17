---
name: spec-map
description: Analyze codebase with parallel mapper agents to produce .workflow/codebase/ documents
argument-hint: "[optional: focus area, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---
<purpose>
Analyze the existing codebase using 4 parallel mapper agents, each focused on a different dimension.
Produces structured documents in `.workflow/codebase/` that downstream commands consume for planning and execution.
Can run before or after Skill({ skill: "maestro-init" }) -- works on any codebase with source files.
</purpose>

<required_reading>
@~/.maestro/workflows/map.md
@~/.maestro/agents/workflow-codebase-mapper.md
</required_reading>

<context>
$ARGUMENTS -- optional focus area (e.g., "api", "auth", "database") to scope mapper agents

**Load project state if exists:**
Check for `.workflow/state.json` -- loads context if project already initialized.

**This command can run:**
- Before Skill({ skill: "maestro-init" }) (brownfield codebases) -- creates codebase map first
- After Skill({ skill: "maestro-init" }) (greenfield codebases) -- updates codebase map as code evolves
- Anytime to refresh codebase understanding
</context>

<execution>
Follow '~/.maestro/workflows/map.md' completely.

**Mapper agent assignments:**
| Agent | Focus | Output file |
|-------|-------|-------------|
| Mapper 1 | **Tech stack** -- languages, frameworks, dependencies, build system | `tech-stack.md` |
| Mapper 2 | **Architecture** -- layers, module boundaries, data flow, entry points | `architecture.md` |
| Mapper 3 | **Features** -- capabilities, API surface, user-facing functionality | `features.md` |
| Mapper 4 | **Cross-cutting concerns** -- error handling, logging, auth, config, testing | `concerns.md` |

**Report format on completion:**
```
== map complete ==
Output: .workflow/codebase/
  tech-stack.md     [OK|MISSING]
  architecture.md   [OK|MISSING]
  features.md       [OK|MISSING]
  concerns.md       [OK|MISSING]

Focus: <focus_area or "full codebase">
Agents: <N>/4 completed

Next: Skill({ skill: "maestro-init" }) (if not initialized)
      Skill({ skill: "manage-status" }) (if initialized)
      Skill({ skill: "manage-codebase-refresh" }) (to update specific docs)
```
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | fatal | `.workflow/` directory not initialized -- run Skill({ skill: "maestro-init" }) first or create manually | parse_input |
| W001 | warning | Mapper agent failed for one dimension -- remaining docs still valid | spawn_mappers |
| W002 | warning | `.workflow/codebase/` already exists -- user prompted for refresh/skip/merge | check_existing |
</error_codes>

<success_criteria>
- [ ] `.workflow/codebase/` directory created
- [ ] All 4 mapper agents spawned in parallel
- [ ] `tech-stack.md` written with language/framework/dependency analysis
- [ ] `architecture.md` written with structural analysis
- [ ] `features.md` written with capability inventory
- [ ] `concerns.md` written with cross-cutting concern analysis
- [ ] All output docs verified as non-empty
- [ ] Report displayed with next steps
</success_criteria>
