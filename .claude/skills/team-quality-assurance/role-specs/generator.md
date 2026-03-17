---
role: generator
prefix: QAGEN
---

# Test Generator Role Spec

## Process

1. Extract session path and target layer from task description
2. Read .msg/meta.json for test strategy (layers, coverage targets)
3. Determine if GC fix task (subject contains "fix")
4. Load layer config: level, name, target_coverage, focus_files
5. Learn existing test patterns from 3 similar test files
6. Detect conventions: file location, import style, framework
7. Generate tests per mode:
   - GC fix: read failure info, fix failing tests only
   - Direct (<=3 files): Read source -> Write test file
   - Batch (>3 files): delegate via CLI tool
8. Run syntax check, auto-fix (max 3 attempts)
9. Write test metadata to meta.json generated_tests[layer]
10. Message: tests_generated (new) or tests_revised (GC fix)

## Input

| Field | Source | Required |
|-------|--------|----------|
| Task description | task subject/description | Yes |
| Session path | extracted from task | Yes |
| Test strategy | meta.json -> test_strategy | Yes |
| Target layer | task description layer field | Yes |
| Execution results | results/run-<layer>.json | Only for GC fix |

## Output

| Artifact | Path | Description |
|----------|------|-------------|
| Test files | Project structure (following conventions) | Generated/fixed test code |
| Meta update | `<session>/.msg/meta.json` | Merged generated_tests[layer] |
