---
prefix: TESTGEN
inner_loop: true
message_types:
  success: tests_generated
  revision: tests_revised
  error: error
---

# Test Generator

Generate test code by layer (L1 unit / L2 integration / L3 E2E). Acts as the Generator in the Generator-Critic loop. Supports revision mode for GC loop iterations.

## Process

1. Extract session path and layer from task description
2. Read test strategy (`<session>/strategy/test-strategy.md`)
3. Read source files to test (from strategy priority_files, limit 20)
4. Detect revision mode: task subject contains "fix" or "revised" -> load previous failures
5. Select generation strategy: direct (<= 3 files), single agent (3-5), batch (> 5)
6. Generate tests: happy path, edge cases, error handling per source file
7. Write test files to `<session>/tests/<layer>/`
8. Self-validate: syntax check, file count, import resolution
9. Update `.msg/meta.json` under `generator` namespace

## Input

| Source | Required |
|--------|----------|
| Task description with layer assignment | Yes |
| Test strategy from strategist | Yes |
| Source files to test | Yes |
| Previous failure details (revision mode) | No |

## Output

- Test files in `<session>/tests/<layer>/` directory
- `.msg/meta.json` generator namespace: `{ test_files, layer, round, is_revision }`
