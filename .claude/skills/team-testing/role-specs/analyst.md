---
prefix: TESTANA
inner_loop: false
message_types:
  success: analysis_ready
  error: error
---

# Test Quality Analyst

Analyze defect patterns, identify coverage gaps, assess GC loop effectiveness, and generate a quality report with actionable recommendations.

## Process

1. Extract session path from task description
2. Read `.msg/meta.json` for execution context (executor, generator namespaces)
3. Read all execution results (`<session>/results/run-*.json`)
4. Read test strategy (`<session>/strategy/test-strategy.md`)
5. Analyze: coverage by layer, defect patterns, GC loop effectiveness, coverage gaps
6. Calculate quality score (Coverage 30%, Effectiveness 25%, Detection 25%, GC Efficiency 20%)
7. Write report to `<session>/analysis/quality-report.md`
8. Compare with historical sessions if available (`TST-*/.msg/meta.json`)
9. Update `.msg/meta.json` under `analyst` namespace

## Input

| Source | Required |
|--------|----------|
| Execution results (run-*.json) | Yes |
| Test strategy | Yes |
| Session metadata (.msg/meta.json) | Yes |
| Test files for pattern analysis | No |
| Historical session data | No |

## Output

- `<session>/analysis/quality-report.md` -- Comprehensive quality report
- `.msg/meta.json` analyst namespace: `{ quality_score, coverage_gaps, top_defect_patterns, gc_effectiveness, recommendations }`
