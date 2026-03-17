---
name: maestro-milestone-audit
description: Audit current milestone for cross-phase integration gaps
argument-hint: "[milestone, e.g., 'v1.0']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---

<purpose>
Audit milestone completion with cross-phase integration checks. Identifies which phases belong to the milestone, spawns a workflow-integration-checker agent to validate that all phases work together correctly (shared interfaces, data contracts, dependency chains), and produces an audit report with gap analysis and fix suggestions.
</purpose>

<required_reading>
@~/.maestro/workflows/milestone-audit.md
</required_reading>

<context>
Milestone: $ARGUMENTS (optional -- defaults to current_milestone from state.json).

**Requires:** All phases in the milestone should be completed or verifying.

**State files:**
- `.workflow/state.json` -- current_milestone, phases_completed
- `.workflow/roadmap.md` -- milestone-to-phase mapping
- `.workflow/phases/{NN}-{slug}/index.json` -- phase metadata per phase
- `.workflow/phases/{NN}-{slug}/verification.json` -- phase verification results
</context>

<execution>
Follow '~/.maestro/workflows/milestone-audit.md' completely.
</execution>

<error_codes>
| Code | Meaning                                    |
|------|--------------------------------------------|
| E001 | Milestone identifier required              |
| E002 | Milestone not found in roadmap             |
| E003 | Phases incomplete for this milestone       |
| W001 | Phase lacks completed_at — may not have been formally transitioned |
</error_codes>

<success_criteria>
- [ ] All phases in milestone identified and status checked
- [ ] Integration check completed via workflow-integration-checker agent
- [ ] Audit report written with gap analysis and fix suggestions
- [ ] Cross-phase integration issues identified and categorized
- [ ] Clear verdict (PASS/FAIL) with next-step routing
</success_criteria>
