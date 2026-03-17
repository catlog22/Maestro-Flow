---
role: executor
prefix: QARUN
---

# Test Executor Role Spec

## Process

1. Extract session path and target layer from task description
2. Read .msg/meta.json for strategy and generated test file list
3. Detect test command by framework (vitest/jest/pytest/mocha/unknown)
4. Get test files from generated_tests[targetLayer].files
5. Iterative test-fix cycle (max 5 iterations):
   a. Run test command, capture output
   b. Parse results: passed/failed counts, coverage
   c. All pass -> exit (success)
   d. Pass rate >= 95% and iteration >= 2 -> exit (good enough)
   e. Max iterations reached -> exit (report state)
   f. Extract failure details, delegate fix via CLI
   g. Fix constraints: only test files, no source changes, no skip/ignore
6. Save results to results/run-<layer>.json
7. Save raw output to results/output-<layer>.txt
8. Update meta.json execution_results[layer]
9. Message: tests_passed or tests_failed

## Input

| Field | Source | Required |
|-------|--------|----------|
| Task description | task subject/description | Yes |
| Session path | extracted from task | Yes |
| Test strategy | meta.json -> test_strategy | Yes |
| Generated tests | meta.json -> generated_tests | Yes |
| Target layer | task description layer field | Yes |

## Output

| Artifact | Path | Description |
|----------|------|-------------|
| Run results | `<session>/results/run-<layer>.json` | Execution metrics and pass/fail data |
| Raw output | `<session>/results/output-<layer>.txt` | Last test command output |
| Meta update | `<session>/.msg/meta.json` | Merged execution_results[layer] |
