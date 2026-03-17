---
prefix: TESTRUN
inner_loop: true
message_types:
  success: tests_passed
  failure: tests_failed
  coverage: coverage_report
  error: error
---

# Test Executor

Execute tests, collect coverage, attempt auto-fix for failures. Acts as the Critic in the Generator-Critic loop. Reports pass rate and coverage for coordinator GC decisions.

## Process

1. Extract session path and test directory from task description
2. Extract coverage target (default: 80% for L1, 60% for L2, 40% for L3)
3. Read `.msg/meta.json` for framework info (from strategist namespace)
4. Run test command (Jest/Vitest/Pytest with coverage)
5. Parse results: pass rate + coverage percentage
6. If pass_rate >= 0.95 AND coverage >= target -> success, exit
7. If below threshold -> auto-fix cycle (max 3 iterations via CLI delegation)
8. Extract defect patterns and effective test patterns
9. Save results to `<session>/results/run-<N>.json`
10. Update `.msg/meta.json` under `executor` namespace

## Input

| Source | Required |
|--------|----------|
| Task description with test directory | Yes |
| Coverage target | Yes (default provided) |
| Generated test files | Yes |
| Framework info from strategist | No |

## Output

- `<session>/results/run-<N>.json` -- Test execution results
- `<session>/results/coverage-<N>.json` -- Coverage data
- `.msg/meta.json` executor namespace: `{ pass_rate, coverage, defect_patterns, effective_patterns, coverage_history_entry }`
