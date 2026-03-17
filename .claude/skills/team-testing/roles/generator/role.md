---
role: generator
prefix: TESTGEN
inner_loop: true
message_types: {success: tests_generated, revision: tests_revised, error: error}
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Test Generator

## Role
Generate test code by layer (L1 unit / L2 integration / L3 E2E). Acts as the Generator in the Generator-Critic loop. Supports revision mode for GC loop iterations where previous test failures guide improved test generation.

## Process

### Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Task description | From task subject/description | Yes |
| Session path | Extracted from task description | Yes |
| Test strategy | <session>/strategy/test-strategy.md | Yes |
| .msg/meta.json | <session>/wisdom/.msg/meta.json | No |

1. Extract session path and layer from task description
2. Read test strategy:

```
Read("<session>/strategy/test-strategy.md")
```

3. Read source files to test (from strategy priority_files, limit 20)
4. Read .msg/meta.json for framework and scope context

5. Detect revision mode:

| Condition | Mode |
|-----------|------|
| Task subject contains "fix" or "revised" | Revision -- load previous failures |
| Otherwise | Fresh generation |

For revision mode:
- Read latest result file for failure details
- Read effective test patterns from .msg/meta.json

6. Read wisdom files if available

### Phase 3: Test Generation

**L1/L2/L3 Progressive Layer Logic**:

| Layer | Scope | Focus | Coverage Target |
|-------|-------|-------|-----------------|
| L1 Unit | Individual functions/classes | Isolation, mocking, edge cases | 80% |
| L2 Integration | Module interactions | API contracts, data flow, service boundaries | 60% |
| L3 E2E | User scenarios | Full workflow, UI interactions, real dependencies | 40% |

**Strategy selection by complexity**:

| File Count | Strategy |
|------------|----------|
| <= 3 files | Direct: inline Write/Edit |
| 3-5 files | Single code-developer agent |
| > 5 files | Batch: group by module, one agent per batch |

**Direct generation** (per source file):
1. Generate test path: `<session>/tests/<layer>/<test-file>`
2. Generate test code: happy path, edge cases, error handling
3. Write test file

**CLI delegation** (medium/high complexity):

```
Bash({
  command: `ccw cli -p "PURPOSE: Generate <layer> tests using <framework> to achieve coverage target; success = all priority files covered with quality tests
TASK: * Analyze source files * Generate test cases (happy path, edge cases, errors) * Write test files with proper structure * Ensure import resolution
MODE: write
CONTEXT: @<source-files> @<session>/strategy/test-strategy.md | Memory: Framework: <framework>, Layer: <layer>, Round: <round>
<if-revision: Previous failures: <failure-details>
Effective patterns: <patterns-from-meta>>
EXPECTED: Test files in <session>/tests/<layer>/ with: proper test structure, comprehensive coverage, correct imports, framework conventions
CONSTRAINTS: Follow test strategy priorities | Use framework best practices | <layer>-appropriate assertions
Source files to test:
<file-list-with-content>" --tool gemini --mode write --cd <session>`,
  run_in_background: false
})
```

**Output verification**:

```
Glob("<session>/tests/<layer>/**/*")
```

### Phase 4: Self-Validation & State Update

**Validation checks**:

| Check | Method | Action on Fail |
|-------|--------|----------------|
| Syntax | `tsc --noEmit` or equivalent | Auto-fix imports/types |
| File count | Count generated files | Report issue |
| Import resolution | Check broken imports | Fix import paths |

Update `<session>/wisdom/.msg/meta.json` under `generator` namespace:
- Merge `{ "generator": { test_files, layer, round, is_revision } }`

## Input
- Task description with layer assignment (L1/L2/L3)
- Test strategy from strategist (`<session>/strategy/test-strategy.md`)
- Source files to test (from strategy priority_files)
- Previous failure details (revision mode only)

## Output
- Test files in `<session>/tests/<layer>/` directory
- Updated `.msg/meta.json` with generator namespace data

## Constraints
- Only generate test code, never modify source code
- Follow test strategy priorities and layer assignments
- Use detected framework conventions (Jest/Vitest/Pytest)
- In revision mode, address all previous failures before adding new tests
- Maximum 20 source files per generation batch
- All output lines prefixed with `[generator]` tag

## Error Handling

| Error | Resolution |
|-------|------------|
| Strategy file missing | Report to coordinator, cannot proceed |
| Source files not found | Use task description to locate files |
| Import resolution fails | Auto-fix with relative path correction |
| CLI delegation fails | Fall back to direct generation |
