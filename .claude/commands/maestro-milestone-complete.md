---
name: maestro-milestone-complete
description: Archive completed milestone and prepare for next
argument-hint: "[milestone, e.g., 'v1.0']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

<purpose>
Mark a milestone as complete after its audit has passed. Validates that the audit report exists and shows a passing verdict, archives the milestone by updating state.json, generates a milestone summary document capturing key outcomes and learnings, and prepares the project state for the next milestone.
</purpose>

<required_reading>
@~/.maestro/workflows/milestone-complete.md
</required_reading>

<context>
Milestone: $ARGUMENTS (optional -- defaults to current_milestone from state.json).

**Requires:** Skill({ skill: "maestro-milestone-audit" }) should have passed (all phases completed, no integration gaps).

**State files:**
- `.workflow/state.json` -- current_milestone, milestones array
- `.workflow/roadmap.md` -- milestone structure
- `.workflow/milestones/{milestone}/audit-report.md` -- audit results
</context>

<execution>
Follow '~/.maestro/workflows/milestone-complete.md' completely.
</execution>

<error_codes>
| Code | Meaning                                        |
|------|------------------------------------------------|
| E001 | Milestone identifier required                  |
| E002 | Audit not passed (report missing or verdict FAIL) |
| E003 | Incomplete phases remain in this milestone     |
</error_codes>

<success_criteria>
- [ ] Audit report verified as PASS before proceeding
- [ ] Milestone marked complete in state.json with timestamp
- [ ] Milestone summary generated with outcomes and learnings
- [ ] Roadmap snapshot saved to milestones directory
- [ ] state.json updated with next milestone as current
</success_criteria>
