---
name: maestro-ralph
description: Closed-loop lifecycle decision engine — read state, infer position, build adaptive chain, execute via CSV waves, delegate-evaluate at decision nodes
argument-hint: "\"intent\" [-y] | status | continue | execute"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Closed-loop decision engine for the maestro workflow lifecycle.
Coordinator assembles fully-resolved skill calls → spawns via `spawn_agents_on_csv` →
delegates evaluation at decision nodes → dynamically expands/shrinks chain.

Entry points:
- **`$maestro-ralph "intent"`** — New session: read state → infer → build → execute
- **`$maestro-ralph execute`** / **`continue`** — Resume: run next wave(s) until decision or completion
- **`$maestro-ralph status`** — Display session progress

Two node types:
- **external**: Executed via `spawn_agents_on_csv`. Barrier steps solo; non-barriers parallel.
- **decision**: Delegate evaluation via `maestro delegate --role analyze`, then expand/proceed/escalate.

Key difference from maestro coordinator:
- maestro: static chain → run all waves
- ralph: living chain → decision nodes delegate-evaluate → chain adapts dynamically

Session at `.workflow/.maestro/ralph-{YYYYMMDD-HHmmss}/status.json`.
</purpose>

<context>
$ARGUMENTS — intent text or keywords.

**Routing:**
```
"status"              → handleStatus(). End.
"execute" | "continue"→ Phase 2 (Wave Execution).
otherwise             → Phase 1 (New Session).
```

**Flags:**
- `-y` / `--yes` → `session.auto_mode = true`
  - Skip confirmation prompts
  - Decision nodes: auto-follow delegate verdict (no STOP), except post-debug-escalate
  - Failures: retry once then skip

**`-y` downstream propagation** (appended to skill_call in CSV):

| Skill | Flag | Effect |
|-------|------|--------|
| maestro-init | `-y` | 跳过交互提问 |
| maestro-analyze | `-y` | 跳过 scoping 交互 |
| maestro-brainstorm | `-y` | 跳过交互提问 |
| maestro-roadmap | `-y` | 跳过交互选择 |
| maestro-plan | `-y` | 跳过确认和澄清 |
| maestro-execute | `-y` | 跳过确认，blocked 自动继续 |
| quality-auto-test | `-y` | 跳过计划确认 |
| quality-test | `-y --auto-fix` | 自动触发 gap-fix loop |
| maestro-milestone-complete | `-y` | 跳过 knowledge promotion 交互 |

未列出的命令无 auto flag，原样执行。
</context>

<invariants>
1. **ALL external steps via spawn_agents_on_csv** — coordinator NEVER executes skill logic directly
2. **Coordinator = prompt assembler** — classify → enrich args → build CSV → spawn → read results → assemble next
3. **Decision nodes delegate-evaluate** — use `maestro delegate --role analyze` for quality-gate assessment; structural decisions (post-milestone, post-debug-escalate) evaluated directly
4. **Decision STOP behavior** — default: STOP after evaluation; `-y` mode: auto-continue (except post-debug-escalate always STOPs)
5. **Barrier = solo wave** — analyze, plan, execute, brainstorm, roadmap always run alone
6. **Non-barriers can parallel** — consecutive non-barrier, non-decision external steps grouped into one wave
7. **Wave-by-wave** — never start wave N+1 before wave N results are read
8. **Coordinator owns context** — sub-agents never read prior results; coordinator assembles full skill_call
9. **Abort on failure** — `-y`: retry once then skip; non-`-y`: mark remaining skipped → pause
10. **Quality mode governs steps** — full/standard/quick determines which quality stages are included
11. **passed_gates skip** — already-passed gates not re-run in retry loops (unless code changed)
</invariants>

<execution>

## Phase 1: New Session

### 1.1: Read project state

Read `.workflow/state.json` schema:
```json
{
  "current_milestone": "MVP",
  "milestones": [{ "id": "M1", "name": "MVP", "status": "active", "phases": [1, 2] }],
  "artifacts": [{
    "id": "ANL-001", "type": "analyze|plan|execute|verify",
    "milestone": "MVP", "phase": 1, "scope": "phase|milestone|adhoc|standalone",
    "path": "phases/01-auth-multi-tenant",  // relative to .workflow/scratch/
    "status": "completed", "depends_on": "PLN-001", "harvested": true
  }],
  "accumulated_context": { "key_decisions": [], "deferred": [] }
}
```

### 1.2: Infer lifecycle position

**Bootstrap detection:**

| Condition | Position | Chain starts at |
|-----------|----------|-----------------|
| No `.workflow/` + no source files | `brainstorm` | brainstorm → init → roadmap → ... |
| No `.workflow/` + has source files | `init` | init → roadmap → ... |
| Has `.workflow/` but no state.json | `init` | init → roadmap → ... |
| Has state.json | → Artifact-based inference below |

**Artifact-based inference:**

Filter by `milestone == current_milestone`, target phase. Find latest completed artifact type:

| State | Position |
|-------|----------|
| No milestones[] or no roadmap.md | `roadmap` |
| No artifacts for target phase | `analyze` |
| Latest == "analyze" | `plan` |
| Latest == "plan" | `execute` |
| Latest == "execute" | `verify` |
| Latest == "verify" | → Refine by result files |

**Refine from verify results** (read `{artifact_dir}/`):

| Condition | Position |
|-----------|----------|
| verification.json: `passed==false` or `gaps[]` non-empty | `verify-failed` |
| verification.json: `passed==true`, no review.json | `post-verify` |
| review.json: `verdict=="BLOCK"` | `review-failed` |
| review.json: `verdict!="BLOCK"` | `test` |
| uat.md: all passed | `milestone-audit` |
| uat.md: has failures | `test-failed` |

**resolve_artifact_dir(artifact):**
```
Full path = .workflow/scratch/{artifact.path}/
Fallback: glob .workflow/scratch/*-P{phase}-*/ sorted by date DESC, take first
```

### 1.3: Determine quality mode

**Auto-inference (can be overridden by user to any mode):**

| Condition | Mode | Pipeline |
|-----------|------|----------|
| Has requirements/REQ-*.md + phase scope | `full` | verify → business-test → review → test-gen → test |
| Default | `standard` | verify → review → test (test-gen conditional on coverage < 80%) |
| User explicit `--quality quick` | `quick` | verify → review --tier quick |

User can specify `--quality full|standard|quick` to override auto-inference.

### 1.4: Build command sequence

**Lifecycle stages:**

| Stage | Skill | Barrier | Decision after | Condition |
|-------|-------|---------|----------------|-----------|
| brainstorm | `maestro-brainstorm "{intent}"` | yes | — | 0→1 only |
| init | `maestro-init` | no | — | always |
| roadmap | `maestro-roadmap "{intent}"` | yes | — | always |
| analyze | `maestro-analyze {phase}` | yes | — | always |
| plan | `maestro-plan {phase}` | yes | — | always |
| execute | `maestro-execute {phase}` | yes | — | always |
| verify | `maestro-verify {phase}` | no | `post-verify` | always |
| business-test | `quality-auto-test {phase}` | no | `post-biz-test` | full only |
| review | `quality-review {phase}` | no | `post-review` | always (quick: +`--tier quick`) |
| test-gen | `quality-auto-test {phase}` | no | — | full; standard if coverage < 80% |
| test | `quality-test {phase}` | no | `post-test` | full/standard |
| milestone-audit | `maestro-milestone-audit` | no | — | always |
| milestone-complete | `maestro-milestone-complete` | no | `post-milestone` | always |

**Build rules:**
1. Start from inferred position, skip completed stages
2. Filter by quality_mode (remove inapplicable stages)
3. After each decision-triggering stage, insert decision node: `{ decision, retry_count: 0, max_retries: 2 }`
4. Conditional steps (test-gen in standard) use: `{ "condition": "check_coverage", "threshold": 80 }`
5. Args use placeholders resolved at wave build time by coordinator

### 1.5: Create session

Write `.workflow/.maestro/ralph-{YYYYMMDD-HHmmss}/status.json`:
```json
{
  "session_id": "ralph-{YYYYMMDD-HHmmss}",
  "source": "ralph",
  "created_at": "ISO", "updated_at": "ISO",
  "intent": "{user_intent}",
  "status": "running",
  "chain_name": "ralph-lifecycle",
  "lifecycle_position": "{position}",
  "target": "milestone-complete",
  "phase": null | N,
  "milestone": null | "{M}",
  "auto_mode": false,
  "quality_mode": "standard",
  "passed_gates": [],
  "context": {
    "issue_id": null, "milestone_num": null, "spec_session_id": null,
    "scratch_dir": null, "plan_dir": null, "analysis_dir": null, "brainstorm_dir": null
  },
  "steps": [...],
  "waves": [],
  "current_step": 0
}
```

### 1.6: Initialize plan + confirm

```
functions.update_plan({
  explanation: "Ralph lifecycle: {position} → milestone-complete",
  plan: steps.map(step => ({ step: stepLabel(step), status: "pending" }))
})
```

Display:
```
============================================================
  RALPH DECISION ENGINE
============================================================
  Position:  {position} (Phase {N}, {milestone})
  Target:    milestone-complete
  Quality:   {quality_mode}
  Steps:     {total} ({decision_count} decision points)

  [ ] 0. maestro-plan {phase}              [barrier]
  [ ] 1. maestro-execute {phase}           [barrier]
  [ ] 2. maestro-verify {phase}            [external]
  [ ] 3. ◆ post-verify                     [decision]
  ...
============================================================
```

- If `-y`: proceed directly
- Else: AskUserQuestion → Proceed / Cancel / Change quality mode

Fall through to Phase 2.

---

## Phase 2: Wave Execution Loop

### 2.1: Load session + find next step

Read status.json. Rebuild `update_plan` from step statuses.
Find first pending step.

- If decision node → Step 2.2 (Delegate Evaluation)
- If external node → Step 2.3 (Wave Execution)
- If no pending → Phase 3 (Completion)

### 2.2: Delegate Evaluation (decision nodes)

**Route by decision type:**
- Quality-gate decisions (post-verify, post-biz-test, post-review, post-test) → delegate analysis
- Structural decisions (post-milestone, post-debug-escalate) → direct evaluation

#### 2.2a: Delegate quality-gate assessment

Read decision metadata: `{ decision, retry_count, max_retries }`

**Result file mapping:**

| Decision | Files to include |
|----------|-----------------|
| post-verify | `{artifact_dir}/verification.json` |
| post-biz-test | `{artifact_dir}/business-test-results.json` |
| post-review | `{artifact_dir}/review.json` |
| post-test | `{artifact_dir}/uat.md`, `{artifact_dir}/.tests/test-results.json` |

```
Bash({
  command: `maestro delegate "PURPOSE: 评估 ${meta.decision} 质量门结果
TASK: 读取结果文件 | 分析通过/失败 | 评估严重性 | 给出建议
MODE: analysis
CONTEXT: @${result_files}
EXPECTED: 严格按格式输出:
---VERDICT---
STATUS: proceed | fix | escalate
REASON: 一句话解释
GAP_SUMMARY: 问题描述（fix/escalate 时填写）
CONFIDENCE: high | medium | low
---END---
CONSTRAINTS: 只评估 | STATUS 三选一 | retry ${meta.retry_count}/${meta.max_retries} 达上限必须 escalate" --role analyze --mode analysis`,
  run_in_background: true
})
STOP — wait for callback.
```

**Parse verdict** (on callback):
```
Extract STATUS / REASON / GAP_SUMMARY / CONFIDENCE from output.
If parse fails → fallback: STATUS = "fix", GAP_SUMMARY = generic
```

**Apply verdict:**

| Mode | Behavior |
|------|----------|
| `-y` (auto_mode) | Follow verdict directly, no user prompt |
| Interactive | Display recommendation, AskUserQuestion: "按建议执行 / 覆盖 / 取消" |

**Verdict → action:**

| Verdict | Action |
|---------|--------|
| `proceed` | Add gate to passed_gates, continue |
| `fix` | Clear passed_gates (code will change), insert fix-loop |
| `escalate` | Insert `[quality-debug "{gap_summary}", decision:post-debug-escalate]` |

#### 2.2b: Fix-loop templates

The delegate's `gap_summary` is passed as context to `quality-debug`.

**post-verify fix-loop:**
```
quality-debug "{gap_summary}"
maestro-plan --gaps {phase}           [barrier]
maestro-execute {phase}               [barrier]
maestro-verify {phase}
decision:post-verify {retry+1}
```

**post-biz-test fix-loop (full mode):**
```
quality-debug --from-business-test "{gap_summary}"
maestro-plan --gaps {phase}           [barrier]
maestro-execute {phase}               [barrier]
maestro-verify {phase}
decision:post-verify {retry: 0}
quality-auto-test {phase}
decision:post-biz-test {retry+1}
```

**post-review fix-loop:**
```
quality-debug "{gap_summary}"
maestro-plan --gaps {phase}           [barrier]
maestro-execute {phase}               [barrier]
quality-review {phase}
decision:post-review {retry+1}
```

**post-test fix-loop:**
```
quality-debug --from-uat "{gap_summary}"
maestro-plan --gaps {phase}           [barrier]
maestro-execute {phase}               [barrier]
maestro-verify {phase}
decision:post-verify {retry: 0}
quality-test {phase}
decision:post-test {retry+1}
```

#### 2.2c: Structural decisions (direct evaluation)

**post-milestone:**
```
Read .workflow/state.json — check next milestone (status "pending"/"active")
If found: update session (milestone, phase, reset passed_gates), re-infer quality_mode,
          insert lifecycle via buildSteps() for next milestone
If none: proceed — session completes naturally
```

**post-debug-escalate:**
```
Set session status = "paused"
Display: ◆ 已达最大重试次数，debug 已执行。请人工介入检查结果。
STOP (always, regardless of -y)
```

#### 2.2d: Finalize decision

```
Mark decision step "completed"
Reindex steps if commands inserted
Write status.json
Sync update_plan

Display: ◆ Decision: {type} → {verdict.status} ({verdict.reason})

STOP behavior:
  post-debug-escalate → always STOP
  auto_mode == true   → no STOP, continue to 2.3
  auto_mode == false  → STOP. Display: ⏸ 使用 $maestro-ralph execute 继续
```

### 2.3: Build and Execute Wave

**Loop while pending non-decision steps exist:**

**1. buildNextWave:**
- Conditional step → evaluate condition, skip if not met:
  - `check_coverage`: read `{artifact_dir}/validation.json`, if `coverage >= threshold` → skip test-gen; else → include
  - If validation.json not found → include (assume coverage insufficient)
- Barrier step → solo wave (single row CSV)
- Non-barrier → collect consecutive non-barrier, non-decision steps (multi-row CSV)
- Stop at first decision node

**2. buildSkillCall(step, session)** — assemble fully-resolved command:

Placeholder resolution:
```
{phase} → session.phase
{intent} → session.intent
{scratch_dir} → latest artifact path
{plan_dir} → session.context.plan_dir
{analysis_dir} → session.context.analysis_dir
```

Per-skill enrichment:
| Skill | Enrichment |
|-------|-----------|
| maestro-brainstorm | args empty → `"{intent}"` |
| maestro-roadmap | args empty → `"{intent}"` |
| maestro-analyze | args empty → `{phase}` |
| maestro-plan | resolve latest analyze artifact → `--dir .workflow/scratch/{path}` |
| maestro-execute | resolve latest plan artifact → `--dir .workflow/scratch/{path}` |
| quality-debug | append gap_summary or `--from-uat`/`--from-business-test` |
| quality-* / maestro-verify / milestone-* | args empty → `{phase}` or empty |

Auto flag: append from propagation table if `auto_mode == true`.

Result: `$<skill-name> <enriched-args> [auto-flag]`

**3. Write wave CSV:** `{sessionDir}/wave-{N}.csv`

**4. Update plan** (mark wave steps in_progress)

**5. Spawn:**
```
spawn_agents_on_csv({
  csv_path: "{sessionDir}/wave-{N}.csv",
  id_column: "id",
  instruction: WAVE_INSTRUCTION,
  max_workers: <wave_size>,
  max_runtime_seconds: 3600,
  output_csv_path: "{sessionDir}/wave-{N}-results.csv",
  output_schema: RESULT_SCHEMA
})
```

**6. Read results** — update step statuses from results CSV

**7. Barrier context update:**

| Barrier | Read | Update |
|---------|------|--------|
| maestro-analyze | context.md, state.json | context.analysis_dir |
| maestro-plan | plan.json | context.plan_dir |
| maestro-execute | results | context.exec_status |
| maestro-brainstorm | .brainstorming/ | context.brainstorm_dir |
| maestro-roadmap | specs/ | context.spec_session_id |

**8. Persist** — write status.json + sync update_plan

**9. Failure check:**
- `-y`: retry once, then skip and continue
- Non-`-y`: mark remaining skipped → pause → STOP

**10. Next step check:**
- Decision node + auto_mode → loop to 2.2
- Decision node + non-auto → STOP
- External node → loop to step 1

---

## Phase 3: Completion

```
status.status = "completed"
status.updated_at = now
Write status.json

functions.update_plan({
  explanation: "Ralph lifecycle complete",
  plan: steps.map(step => ({ step: stepLabel(step), status: "completed" }))
})
```

Display:
```
============================================================
  RALPH COMPLETE
============================================================
  Session:  {session_id}
  Quality:  {quality_mode}
  Phase:    {phase} → {milestone}
  Waves:    {wave_count} executed
  Steps:    {completed}/{total} ({skipped} skipped)

  [✓] 0. maestro-plan 1            [W1]
  [✓] 1. maestro-execute 1         [W2]
  [✓] 2. maestro-verify 1          [W3]
  [✓] 3. ◆ post-verify → proceed   [decision]
  [~] 4. quality-auto-test 1       [skipped: standard mode]
  [✓] 5. quality-review 1          [W4]
  ...
============================================================
```

</execution>

<csv_schema>
### wave-{N}.csv

Coordinator 已完成 arg 组装 + auto flag 附加：

```csv
id,skill_call,topic
"3","$maestro-verify 1","Ralph step 3/14: verify phase 1"
"4","$quality-review 1 --tier quick","Ralph step 4/14: review phase 1"
```

Rules:
- `skill_call`: complete `$<skill> <args> [auto-flag]` from `buildSkillCall()`
- `topic`: human-readable step description
- Non-barrier external + non-decision → multi-row (parallel)
- Barrier external → single-row (solo)
- Decision nodes NEVER appear in CSV — processed by coordinator directly

### Sub-Agent Instruction

```
你是 CSV job 子 agent。

执行技能调用：{skill_call}
任务说明：{topic}

限制：
- 不要修改 .workflow/.maestro/ 下的 status 文件
- skill 内部有自己的 session 管理，按 skill SKILL.md 执行

完成后调用 `report_agent_job_result`，返回：
{"status":"completed|failed","skill_call":"{skill_call}","summary":"一句话结果","artifacts":"产物路径","error":"失败原因"}
```

### Result Schema

`{ status, skill_call, summary, artifacts, error }` — all string
</csv_schema>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Cannot infer lifecycle position | Show raw state, ask user |
| E003 | error | Artifact dir not found for decision | Show glob results, ask user |
| E004 | error | Delegate verdict parse failed | Fallback: treat as "fix" |
| E005 | error | Delegate execution failed | Fallback: treat as "fix" with generic summary |
| E006 | error | Wave timeout (max_runtime_seconds) | Mark step failed, pause |
| E007 | error | No session found for execute/continue | Suggest $maestro-ralph "intent" |
| W001 | warning | Decision node expanded chain | Auto-handled, log expansion |
| W002 | warning | Max retries reached, escalating | Auto-handled |
| W003 | warning | Multiple running sessions found | Use latest, warn user |
| W004 | warning | Delegate confidence == "low" | Show warning in interactive mode |
</error_codes>

<success_criteria>
- [ ] state.json parsed with actual schema (type, path, scope, milestone, depends_on)
- [ ] Lifecycle position inferred from bootstrap + artifact chain + result files
- [ ] Artifact dir resolved via resolve_artifact_dir() with fallback glob
- [ ] Quality mode (full/standard/quick) correctly inferred and governs step generation
- [ ] Conditional steps evaluated at decision time (coverage threshold)
- [ ] buildSkillCall() completes arg enrichment + auto flag, CSV contains full commands
- [ ] Quality-gate decisions delegate-evaluated via `maestro delegate --role analyze`
- [ ] Delegate verdict parsed: STATUS / REASON / GAP_SUMMARY / CONFIDENCE
- [ ] `-y` mode: auto-follow delegate verdict, no STOP (except post-debug-escalate)
- [ ] Interactive mode: display recommendation + AskUserQuestion with override
- [ ] Delegate failure fallback: treat as "fix" verdict
- [ ] passed_gates[] tracks passed quality gates, skips re-runs in retry loops
- [ ] passed_gates cleared when code changes (fix-loop inserts execute step)
- [ ] Fix-loop templates correctly use gap_summary from delegate
- [ ] retry_count tracked per decision, max_retries enforced → escalation
- [ ] ALL external steps via spawn_agents_on_csv — coordinator never executes directly
- [ ] Barrier steps solo wave, non-barriers parallel
- [ ] functions.update_plan() initialized in 1.6, synced per wave, finalized in Phase 3
- [ ] status.json persisted after every wave and decision
- [ ] Command insertion + reindex preserves step integrity
</success_criteria>
