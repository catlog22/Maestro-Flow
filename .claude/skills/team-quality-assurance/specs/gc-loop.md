# Generator-Critic (GC) Loop Pattern

The GC loop is a convergence mechanism used in the quality-assurance pipeline to iteratively improve test coverage until targets are met. It operates between the Generator and Executor roles.

## Overview

```
Generator (QAGEN) produces tests
        |
        v
Executor (QARUN) runs tests, measures coverage
        |
        v
    coverage >= target? ----YES----> proceed to next stage
        |
       NO (and rounds < MAX_GC_ROUNDS)
        |
        v
Generator-fix (QAGEN-fix) fixes failing tests, adds coverage
        |
        v
Executor-gc (QARUN-gc) re-runs tests, re-measures coverage
        |
        v
    coverage >= target? ----YES----> proceed to next stage
        |
       NO (and rounds < MAX_GC_ROUNDS)
        |
        v
    ... repeat ...
        |
    rounds >= MAX_GC_ROUNDS
        |
        v
    Accept current coverage with WARNING
```

## Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| MAX_GC_ROUNDS | 3 | Maximum fix-retest iterations per layer |
| Coverage target | Per-layer | L1: 80%, L2: 60%, L3: 40% (configurable via strategy) |
| Pass threshold | 95% | Minimum pass rate to consider "good enough" |

## Task Naming Convention

| Round | Generator Task | Executor Task |
|-------|---------------|---------------|
| Initial | QAGEN-001 / QAGEN-L1-001 | QARUN-001 / QARUN-L1-001 |
| GC Round 1 | QAGEN-fix-1 | QARUN-gc-1 |
| GC Round 2 | QAGEN-fix-2 | QARUN-gc-2 |
| GC Round 3 | QAGEN-fix-3 | QARUN-gc-3 |

## Trigger Conditions

The coordinator triggers a GC round when:
1. An executor task (QARUN-*) completes
2. The coverage result is below the layer target
3. The current gc_rounds count is below MAX_GC_ROUNDS

## GC Fix Task Behavior

**Generator-fix** (QAGEN-fix-N):
- Reads previous execution results and failure details
- Fixes failing assertions, imports, mocks, or test setup
- Adds missing test cases to improve coverage
- Does NOT modify source code
- Does NOT skip or ignore failing tests
- Reports with message type `tests_revised`

**Executor-gc** (QARUN-gc-N):
- Re-runs the full test suite for the target layer
- Measures updated coverage
- Reports pass/fail with coverage data
- Coordinator evaluates and decides: proceed or trigger next GC round

## Coordinator Decision Logic

```
on QARUN-* completion:
  read coverage from meta.json
  read gc_rounds from session state

  if coverage >= target OR gc_rounds >= MAX_GC_ROUNDS:
    if gc_rounds >= MAX_GC_ROUNDS AND coverage < target:
      log WARNING: "Coverage target not met after {MAX_GC_ROUNDS} GC rounds"
    proceed to handleSpawnNext (unblock dependent tasks)

  else:
    gc_rounds += 1
    create QAGEN-fix-{gc_rounds} task (blockedBy: none, ready immediately)
    create QARUN-gc-{gc_rounds} task (blockedBy: QAGEN-fix-{gc_rounds})
    spawn generator worker for fix task
```

## State Tracking

The GC loop state is tracked in `<session>/.msg/meta.json`:

```json
{
  "gc_rounds": 0,
  "coverage_history": [
    { "round": 0, "coverage": 45, "pass_rate": 85 },
    { "round": 1, "coverage": 62, "pass_rate": 92 },
    { "round": 2, "coverage": 78, "pass_rate": 98 }
  ]
}
```

## Integration with Pipeline Modes

- **Discovery mode**: GC loop applies to the single L1 test cycle
- **Testing mode**: GC loop applies independently to L1 and L2 cycles
- **Full mode**: GC loop applies to parallel L1 and L2 cycles independently

## Constraints

- Generator-fix must only modify test files, never source code
- Each GC round creates exactly 2 tasks (fix + re-execute)
- GC tasks follow the same blockedBy dependency model as regular pipeline tasks
- Coverage regression (lower than previous round) triggers a warning but does not halt the loop
