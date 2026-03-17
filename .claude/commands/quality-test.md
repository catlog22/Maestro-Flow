---
name: quality-test
description: Conversational UAT with session persistence, auto-diagnosis, and gap-plan closure loop
argument-hint: "[phase] [--smoke] [--auto-fix]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<purpose>
Run UAT-style conversational testing for a completed phase. Designs test scenarios from verification criteria, walks through each scenario interactively one at a time with plain text responses, and records pass/fail results with severity inference.

When issues are found, spawns parallel debug agents (one per gap cluster) to diagnose root causes, then optionally triggers the gap-fix loop (plan --gaps -> execute -> re-verify) to auto-close gaps.

Key mechanisms from GSD verify-work:
- **Session persistence**: uat.md survives context resets, resume from any point
- **Severity inference**: Natural language -> blocker/major/minor/cosmetic (never ask)
- **Cold-start smoke tests**: --smoke flag injects basic sanity tests before UAT
- **Parallel auto-diagnosis**: Spawn debug agents per gap cluster with pre-filled symptoms
- **Gap-plan closure loop**: --auto-fix triggers verify -> plan --gaps -> execute -> re-verify
</purpose>

<required_reading>
@~/.maestro/workflows/test.md
</required_reading>

<context>
Phase or task: $ARGUMENTS (optional)

**Flags:**
- `--smoke` -- Run cold-start smoke tests before UAT (basic sanity: app starts, routes respond, no crash)
- `--auto-fix` -- After diagnosis, auto-trigger gap-fix loop instead of asking user

Context files resolved from target directory:
- verification.json (must_haves, gaps from maestro-verify)
- validation.json (coverage, requirement mapping)
- index.json (success_criteria, execution results)
- plan.json (task overview)
- .summaries/TASK-*.md (execution summaries)
- uat.md (existing session, if resuming)
</context>

<execution>
Follow '~/.maestro/workflows/test.md' completely.
</execution>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Phase or task target required (no active sessions) | Prompt user for phase number |
| E002 | error | Phase not verified yet (no verification.json) | Suggest Skill({ skill: "maestro-verify" }) first |
| E003 | error | Smoke test failed (app won't start) | Suggest Skill({ skill: "quality-debug" }) |
| W001 | warning | One or more test scenarios failed | Auto-diagnose, suggest fix options |
| W002 | warning | Coverage below threshold | Suggest Skill({ skill: "quality-test-gen" }) |
</error_codes>

<success_criteria>
- [ ] Target resolved (phase or scratch task)
- [ ] Active sessions checked, resume offered if applicable
- [ ] Smoke tests run if --smoke flag set
- [ ] test-plan.json generated with categorized tests mapped to requirements
- [ ] uat.md created/resumed with all tests
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from natural language (never asked)
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] test-results.json and coverage-report.json written
- [ ] index.json uat fields updated
- [ ] If issues: parallel debug agents spawned per gap cluster
- [ ] Gaps updated with root_cause, fix_direction, affected_files
- [ ] Gap-fix loop triggered if --auto-fix (max 2 iterations)
- [ ] Next steps suggested based on results
</success_criteria>
