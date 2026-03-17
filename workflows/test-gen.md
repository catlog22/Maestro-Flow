# Test Generation Workflow

Generate missing automated tests for a phase based on gap analysis from maestro-verify (Nyquist audit) and quality-test (UAT coverage gaps). Classifies changed files into unit/E2E/skip, discovers test infrastructure, generates a test plan for user approval, then writes tests using RED-GREEN methodology.

Tests expose bugs -- fixing is for quality-debug or maestro-execute.

---

### Step 0: Load Project Specs

```
specs_content = maestro spec load --category test
```

Follow project test conventions in Step 4 (Generate Test Plan) and Step 5 (Write Tests).

---

### Step 1: Discover Test Infrastructure

Detect existing test framework and patterns.

```bash
# Find test config files
find . -name "jest.config.*" -o -name "vitest.config.*" -o -name "pytest.ini" -o -name "pyproject.toml" -o -name ".mocharc.*" 2>/dev/null | head -10

# Find existing test files
find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -40

# Find test utilities and helpers
find . \( -name "test-utils.*" -o -name "testHelper*" -o -name "conftest.py" -o -name "setup.*" \) -not -path "*/node_modules/*" 2>/dev/null | head -10
```

Extract:
- **Framework**: Jest, Vitest, pytest, Mocha, etc.
- **Test directory structure**: `__tests__/`, `tests/`, co-located, etc.
- **Naming convention**: `*.test.ts`, `*.spec.ts`, `test_*.py`
- **Test utilities**: shared helpers, fixtures, factories
- **Run command**: `npm test`, `pytest`, etc.

Read 2-3 existing test files to learn patterns:
- Import style
- Describe/it nesting
- Assertion library
- Mock/stub patterns
- Setup/teardown conventions

If no test framework detected: Error E003.

---

### Step 2: Identify Gaps

Identify what needs tests from verification artifacts:

1. **From validation.json** (Nyquist audit):
   - `gaps[]` where status = "MISSING" or "PARTIAL"
   - Each gap has requirement_ref and description

2. **From coverage-report.json** (UAT):
   - `requirements_uncovered[]` -- requirements without test evidence

3. **From task summaries**:
   - Files modified/created in this phase
   - Functionality added

Build gap list with priority:
- MISSING (no test at all) -> HIGH priority
- Uncovered requirement -> HIGH priority
- PARTIAL (test exists but incomplete) -> MEDIUM priority

---

### Step 3: Classify Files

Classify changed files into test categories.

For each file modified in this phase:

| File Type | Test Category | Rationale |
|-----------|---------------|-----------|
| Pure function / utility | unit | Isolated, no side effects |
| React component | unit + e2e | Unit for logic, E2E for rendering |
| API route / handler | integration | Needs request context |
| Database model / query | integration | Needs DB connection |
| CLI command | e2e | Needs process execution |
| Config / types / constants | skip | No behavior to test |
| CSS / styles | skip | Visual, not testable with code |
| Test files themselves | skip | Don't test tests |

Output classification:
```json
{
  "unit": ["src/utils/validate.ts", "src/hooks/useChat.ts"],
  "integration": ["src/api/comments.ts", "src/db/queries.ts"],
  "e2e": ["src/components/ChatWindow.tsx"],
  "skip": ["src/types/index.ts", "src/styles/theme.css"]
}
```

Apply --layer filter if set.

---

### Step 4: Generate Test Plan

For each gap + classified file, create a test entry:

```json
{
  "tests": [
    {
      "id": "TG-001",
      "target_file": "src/utils/validate.ts",
      "test_file": "src/utils/__tests__/validate.test.ts",
      "layer": "unit",
      "requirement_ref": "SC-002",
      "description": "Validate email format accepts valid emails, rejects invalid",
      "test_cases": [
        "accepts standard email format",
        "rejects missing @ symbol",
        "rejects empty string",
        "handles unicode characters"
      ],
      "priority": "high"
    }
  ]
}
```

Present plan to user:

```
=== TEST GENERATION PLAN ===
Phase: {phase_name}

| # | Target | Layer | Test Cases | Priority |
|---|--------|-------|------------|----------|
| TG-001 | validate.ts | unit | 4 cases | HIGH |
| TG-002 | ChatWindow.tsx | e2e | 3 cases | HIGH |
| TG-003 | comments.ts | integration | 5 cases | MEDIUM |

Total: {N} test files, {M} test cases

Proceed? (yes/modify/cancel)
```

Wait for user approval via AskUserQuestion.
- "yes" / "y" -> proceed to Step 5
- "modify" -> ask what to change, update plan
- "cancel" -> abort

---

### Step 5: Generate Tests (RED-GREEN)

For each approved test entry:

1. **RED phase** -- Write the test first:
   - Follow existing test patterns (imports, describe/it, assertions)
   - Write test cases that verify the expected behavior
   - Tests should FAIL if the behavior is broken (not trivially pass)

2. **Verify RED** -- Run the test:
   ```bash
   {test_run_command} {test_file} 2>&1 | tail -20
   ```
   - If test passes: the test may be trivial, review and strengthen
   - If test fails with expected error: good, test targets real behavior
   - If test fails with unexpected error: fix test setup, not source code

3. **GREEN assessment** -- Check if source already satisfies:
   - If tests pass: coverage gap was about missing tests, not missing code
   - If tests fail: record as bug discovery (NOT fix -- that's for quality-debug)

**Important**: This command generates tests, it does NOT fix source code.
Failing tests are valuable -- they document missing behavior.

Write each test file to the discovered test directory structure.

---

### Step 6: Run Full Test Suite

Verify no regressions.

```bash
{test_run_command} 2>&1 | tail -50
```

Categorize results:
- New tests passing: coverage gap filled
- New tests failing: bug discovered (document, don't fix)
- Existing tests broken: regression introduced (investigate)

If regressions found, flag as blocker. (W002)

---

### Step 7: Write Artifacts

**Archive previous test-gen artifacts** before writing:
```
IF file exists "$OUTPUT_DIR/.tests/test-gen-report.json":
  mkdir -p "$OUTPUT_DIR/.history"
  TIMESTAMP = current timestamp formatted as "YYYY-MM-DDTHH-mm-ss"
  mv "$OUTPUT_DIR/.tests/test-gen-report.json" "$OUTPUT_DIR/.history/test-gen-report-${TIMESTAMP}.json"
```

Write `.tests/test-gen-report.json`:
```json
{
  "phase": "{phase}",
  "generated_at": "{ISO timestamp}",
  "infrastructure": {
    "framework": "vitest",
    "test_dir": "__tests__/",
    "run_command": "npm test"
  },
  "classification": { "unit": [...], "integration": [...], "e2e": [...], "skip": [...] },
  "generated": [
    {
      "id": "TG-001",
      "test_file": "src/utils/__tests__/validate.test.ts",
      "layer": "unit",
      "test_cases": 4,
      "status": "passing|failing|mixed",
      "bugs_discovered": []
    }
  ],
  "summary": {
    "files_generated": N,
    "test_cases_total": M,
    "passing": P,
    "failing": F,
    "bugs_discovered": B
  }
}
```

Update validation.json gaps: change MISSING -> COVERED for gaps that now have tests.

---

### Step 8: Report

```
=== TEST GENERATION RESULTS ===
Phase:       {phase_name}
Framework:   {framework}

Generated:   {files_generated} test files, {test_cases_total} test cases
  Passing:   {passing} (coverage gaps filled)
  Failing:   {failing} (bugs discovered)

Bugs Found:  {bugs_discovered}
  {list of failing tests with brief description}

Coverage:    {old_pct}% -> {new_pct}% (if measurable)

Files:
  {target_dir}/.tests/test-gen-report.json

Next steps:
  {suggested_next_command}
```

**Next step routing:**

| Result | Suggestion |
|--------|------------|
| All tests passing | Skill({ skill: "maestro-verify", args: "{phase}" }) to update Nyquist coverage |
| Bugs discovered (failing tests) | Skill({ skill: "quality-debug", args: "--from-uat {phase}" }) to investigate |
| Regressions found | Skill({ skill: "quality-debug" }) immediately |
| Coverage still low | Run again with `--layer` for uncovered layers |
