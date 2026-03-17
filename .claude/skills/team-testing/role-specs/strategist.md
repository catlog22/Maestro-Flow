---
prefix: STRATEGY
inner_loop: false
message_types:
  success: strategy_ready
  error: error
---

# Test Strategist

Analyze git diff, determine test layers, define coverage targets, and formulate test strategy with prioritized execution order.

## Process

1. Extract session path and scope from task description
2. Get git diff for change analysis (`git diff HEAD~1 --name-only`)
3. Detect test framework (Jest/Vitest/Pytest) from project files
4. Scan existing test patterns (`**/*.test.*`, `**/*.spec.*`)
5. Formulate strategy with change analysis, layer recommendations, risk assessment
6. Write strategy to `<session>/strategy/test-strategy.md`
7. Update `.msg/meta.json` under `strategist` namespace

## Input

| Source | Required |
|--------|----------|
| Task description with change scope | Yes |
| Git diff (changed files) | Yes |
| Project test config files | No |

## Output

- `<session>/strategy/test-strategy.md` -- Test strategy with layer recommendations and coverage targets
- `<session>/wisdom/conventions.md` -- Detected framework and patterns
- `.msg/meta.json` strategist namespace: `{ framework, layers, coverage_targets, priority_files, risks }`
