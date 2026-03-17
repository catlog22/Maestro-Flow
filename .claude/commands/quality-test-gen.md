---
name: quality-test-gen
description: Generate missing tests with TDD/E2E classification and RED-GREEN methodology
argument-hint: "<phase> [--layer <unit|e2e|all>]"
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
Generate missing automated tests for a phase based on gap analysis from maestro-verify (Nyquist audit) and quality-test (UAT coverage gaps). Classifies changed files into unit test vs E2E vs skip categories, discovers existing test infrastructure, generates a test plan for user approval, then writes tests using RED-GREEN methodology.

Key mechanisms from GSD add-tests:
- **TDD/E2E/Skip classification**: Categorize changed files by appropriate test type
- **Test structure discovery**: Find existing test patterns, frameworks, conventions
- **Test plan with user approval**: Present plan before writing any tests
- **RED-GREEN generation**: Write failing test first, verify it targets the right behavior
- **Bug discovery, not fix**: Tests expose bugs; fixing is for quality-debug or maestro-execute

This command is the "test gap filler" -- it bridges the gap between verification (maestro-verify finds MISSING coverage) and testing (quality-test runs UAT). It produces the automated tests that make Nyquist coverage pass.
</purpose>

<required_reading>
@~/.maestro/workflows/test-gen.md
</required_reading>

<context>
Phase: $ARGUMENTS (required -- phase number)

**Flags:**
- `--layer <unit|e2e|all>` -- Generate only specific test layer (default: all)

Context files:
- `.workflow/phases/{NN}-{slug}/verification.json` -- Nyquist gaps (MISSING/PARTIAL)
- `.workflow/phases/{NN}-{slug}/validation.json` -- requirement-to-test mapping
- `.workflow/phases/{NN}-{slug}/.tests/coverage-report.json` -- UAT coverage gaps
- `.workflow/phases/{NN}-{slug}/.summaries/TASK-*.md` -- what was built
</context>

<execution>
Follow '~/.maestro/workflows/test-gen.md' completely.
</execution>

<error_codes>
| Code | Severity | Description | Stage |
|------|----------|-------------|-------|
| E001 | error | Phase number required | parse_input |
| E002 | error | No verification results found (run maestro-verify first) | parse_input |
| E003 | error | No test framework detected | discover_test_infrastructure |
| W001 | warning | Some generated tests fail (bugs discovered) | run_all_tests |
| W002 | warning | Regression in existing tests | run_all_tests |
</error_codes>

<success_criteria>
- [ ] Test infrastructure discovered (framework, patterns, conventions)
- [ ] Gaps identified from verification.json and coverage-report.json
- [ ] Changed files classified into unit/integration/e2e/skip
- [ ] Test plan generated and approved by user
- [ ] Tests written following existing patterns (RED-GREEN methodology)
- [ ] Tests run and results categorized (passing/failing/regression)
- [ ] test-gen-report.json written with full results
- [ ] validation.json updated with new coverage status
- [ ] Bugs discovered documented (not fixed)
- [ ] Next steps suggested based on results
</success_criteria>
