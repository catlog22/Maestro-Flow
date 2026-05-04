---
name: maestro-ralph
description: Closed-loop lifecycle decision engine — read project state, infer position, build adaptive command chain with decision/skill/cli nodes
argument-hint: "[-y] \"intent\" | status | continue"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
---
<purpose>
Closed-loop decision engine for the maestro workflow lifecycle.

Reads project state → infers lifecycle position → builds adaptive command chain → delegates execution.

Three node types:
- **skill**: In-session `Skill()` call (synchronous, lightweight)
- **cli**: `maestro delegate` (context-isolated, heavy computation)
- **decision**: Hand back to ralph for re-evaluation (adaptive branching)

Key difference from maestro coordinator:
- maestro: static chain → one-time selection → runs all steps sequentially
- ralph: living chain → decision nodes re-evaluate after critical steps → chain grows/shrinks dynamically

Session path: `.workflow/.maestro/ralph-{YYYYMMDD-HHmmss}/status.json`
Mutual invocation with `/maestro-ralph-execute` forms a self-perpetuating work loop.
</purpose>

<context>
$ARGUMENTS — user intent text, flags, or keywords.

**State files:**
- `.workflow/state.json` — artifact registry, milestones, phases
- `.workflow/roadmap.md` — milestone/phase structure
- `.workflow/.maestro/ralph-*/status.json` — ralph session state
</context>

<execution>

## Step 1: Parse & Route

```
Parse $ARGUMENTS:
  -y flag       → auto_confirm = true (skip confirmation, NOT ambiguity resolution)
  .md/.txt path → input_doc (supplementary context for downstream commands)
  Remaining     → intent

Route:
  intent == "status"   → handleStatus()
  intent == "continue" → handleContinue()
  
  Check running ralph session (.workflow/.maestro/ralph-*/status.json, session status=="running"):
    If found AND steps[current_step].type == "decision" AND steps[current_step].status == "running":
      → Step 3: Decision Evaluation Mode
    Else if intent is non-empty:
      → Step 2: New Session Mode
    Else:
      → AskUserQuestion: "请描述目标，或输入 status/continue"
```

### handleStatus()
```
Find latest ralph session (by created_at).
Display:
  Session:  {id}
  Status:   {status}
  Position: {lifecycle_position}
  Progress: {completed}/{total} commands
  Current:  [{current_step}] {steps[current_step].skill} [{type}]
  
  Commands:
    [✓] 0. maestro-analyze 1         [skill]
    [▸] 1. maestro-plan 1            [skill]
    [ ] 2. maestro-execute 1         [cli]
    ...
End.
```

### handleContinue()
```
Find latest running ralph session.
If not found → "无运行中的 ralph 会话". End.
Skill({ skill: "maestro-ralph-execute" }). End.
```

---

## Step 2: New Session Mode

### 2.1: Read project state

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

Also check: `.workflow/roadmap.md` existence, `.workflow/scratch/` for result files.

### 2.2: Infer lifecycle position

**Phase 1 — Bootstrap detection:**

| Condition | Position | Chain starts at |
|-----------|----------|-----------------|
| No `.workflow/` + no source files (empty project) | `brainstorm` | brainstorm → init → roadmap → ... |
| No `.workflow/` + has source files (existing code) | `init` | init → roadmap → ... |
| Has `.workflow/` but no `state.json` | `init` | init → roadmap → ... |
| Has `state.json` | → Phase 2 below | — |

HARD RULE: `input_doc` is supplementary context only. It NEVER substitutes for lifecycle stages.

**Phase 2 — Artifact-based inference (when state.json exists):**

Filter artifacts by `milestone == current_milestone`, group by target phase. Find latest completed artifact type:

| State | Position |
|-------|----------|
| No milestones[] or no roadmap.md | `roadmap` |
| No artifacts for target phase | `analyze` |
| Latest type == "analyze" | `plan` |
| Latest type == "plan" | `execute` |
| Latest type == "execute" | `verify` |
| Latest type == "verify" | → Refine by result files below |

**Refine from verify results** (read `{artifact_dir}/` files):

| Condition | Position |
|-----------|----------|
| verification.json: `passed==false` or `gaps[]` non-empty | `verify-failed` |
| verification.json: `passed==true`, no review.json | `business-test` |
| review.json: `verdict=="BLOCK"` | `review-failed` |
| review.json: `verdict!="BLOCK"` | `test` |
| uat.md: all passed | `milestone-audit` |
| uat.md: has failures | `test-failed` |

### 2.3: Resolve phase number

Priority order:
1. Regex from intent: `phase\s*(\d+)` or bare number
2. Latest in-progress artifact's phase field
3. First incomplete phase in current milestone's `phases[]`
4. `null` if position is brainstorm/init/roadmap (deferred to post-roadmap)
5. AskUserQuestion if ambiguous (auto_confirm does NOT skip this)

### 2.4: Build command sequence

Generate steps from `lifecycle_position` to target (default: `milestone-complete`).

**Lifecycle stages reference:**

| Stage | Skill command | Type | Decision after |
|-------|--------------|------|----------------|
| brainstorm | `maestro-brainstorm "{intent}"` | cli | — (0→1 only) |
| init | `maestro-init` | skill | — |
| roadmap | `maestro-roadmap "{intent}"` | skill | — |
| analyze | `maestro-analyze {phase}` | cli | — |
| plan | `maestro-plan {phase}` | skill | — |
| execute | `maestro-execute {phase}` | cli | — |
| verify | `maestro-verify {phase}` | skill | `post-verify` |
| business-test | `quality-auto-test {phase}` | skill | `post-business-test` |
| review | `quality-review {phase}` | skill | `post-review` |
| test-gen | `quality-auto-test {phase}` | skill | — |
| test | `quality-test {phase}` | skill | `post-test` |
| milestone-audit | `maestro-milestone-audit` | skill | — |
| milestone-complete | `maestro-milestone-complete` | skill | `post-milestone` |

**Type rationale:**
- `cli` = heavy computation needing isolated context (analyze, execute, brainstorm)
- `skill` = needs user interaction or is lightweight (plan, verify, quality-*, milestone-*)

**Build rules:**
1. Start from inferred position, skip completed stages
2. After each decision-triggering stage, insert a decision node with `{ decision, retry_count: 0, max_retries: 2 }`
3. Args use placeholders resolved at execution time by ralph-execute:
   - `{phase}` → session.phase
   - `{intent}` → session.intent
   - `{scratch_dir}` → latest artifact path
4. Phase-independent commands (brainstorm, roadmap, init) use `"{intent}"` as args
5. Commands needing prior output (analyze→plan, plan→execute) have args resolved via artifact lookup at execution time by ralph-execute

**Example — from "plan" position:**
```json
[
  { "index": 0, "type": "skill", "skill": "maestro-plan", "args": "{phase}" },
  { "index": 1, "type": "cli",  "skill": "maestro-execute", "args": "{phase}" },
  { "index": 2, "type": "skill", "skill": "maestro-verify", "args": "{phase}" },
  { "index": 3, "type": "decision", "skill": "maestro-ralph", "args": "{\"decision\":\"post-verify\",\"retry_count\":0,\"max_retries\":2}" },
  { "index": 4, "type": "skill", "skill": "quality-auto-test", "args": "{phase}" },
  { "index": 5, "type": "decision", "skill": "maestro-ralph", "args": "{\"decision\":\"post-business-test\",\"retry_count\":0,\"max_retries\":2}" },
  { "index": 6, "type": "skill", "skill": "quality-review", "args": "{phase}" },
  { "index": 7, "type": "decision", "skill": "maestro-ralph", "args": "{\"decision\":\"post-review\",\"retry_count\":0,\"max_retries\":2}" },
  { "index": 8, "type": "skill", "skill": "quality-auto-test", "args": "{phase}" },
  { "index": 9, "type": "skill", "skill": "quality-test", "args": "{phase}" },
  { "index": 10, "type": "decision", "skill": "maestro-ralph", "args": "{\"decision\":\"post-test\",\"retry_count\":0,\"max_retries\":2}" },
  { "index": 11, "type": "skill", "skill": "maestro-milestone-audit", "args": "" },
  { "index": 12, "type": "skill", "skill": "maestro-milestone-complete", "args": "" },
  { "index": 13, "type": "decision", "skill": "maestro-ralph", "args": "{\"decision\":\"post-milestone\"}" }
]
```

### 2.5: Create session

```json
{
  "session_id": "ralph-{YYYYMMDD-HHmmss}",
  "source": "ralph",
  "created_at": "{ISO}", "updated_at": "{ISO}",
  "intent": "{user_intent}",
  "status": "running",
  "chain_name": "ralph-lifecycle",
  "task_type": "lifecycle",
  "lifecycle_position": "{position}",
  "target": "milestone-complete",
  "phase": null | N,
  "milestone": "{M}",
  "auto_mode": false,
  "cli_tool": "gemini",
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

Write to `.workflow/.maestro/{session_id}/status.json`.

### 2.6: Display plan + confirm

```
============================================================
  RALPH DECISION
============================================================
  Position:  {lifecycle_position} (Phase {N}, {milestone})
  Target:    {target}
  Commands:  {total} steps ({decision_count} decision points)

  [ ] 0. maestro-plan 1                  [skill]
  [ ] 1. maestro-execute 1               [cli]
  [ ] 2. maestro-verify 1                [skill]
  [ ] 3. ◆ post-verify                   [decision]
  ...
============================================================
```

- If auto_confirm (`-y`): proceed directly
- Else: AskUserQuestion → Proceed / Edit / Cancel

### 2.7: Launch execution

HARD RULE: Ralph's job ends at session creation. Do NOT execute steps, read project files for execution, or update step statuses directly.

```
Skill({ skill: "maestro-ralph-execute" })
End.
```

---

## Step 3: Decision Evaluation Mode

Triggered when ralph-execute encounters a decision node and hands back to ralph.

### 3.1: Load session + resolve artifact dir

Read session status.json. Identify decision node at `steps[current_step]`.

**Artifact dir resolution:**
```
Read .workflow/state.json
Filter: milestone == session.milestone, phase == session.phase
Sort: created_at DESC

artifact_dir = .workflow/scratch/{artifact.path}/

Fallback if path not found:
  glob .workflow/scratch/*-P{phase}-*/ sorted by date DESC, take first
```

### 3.2: Parse decision metadata

```
meta = JSON.parse(decision_node.args)
// { decision: "post-verify", retry_count: 0, max_retries: 2 }
```

### 3.3: Evaluate by decision type

Each decision reads specific result files and decides: proceed or insert fix loop.

**Common pattern for failures with retries:**
- If `retry_count >= max_retries` → escalate: insert `[quality-debug, decision:post-debug-escalate]`
- Else → insert fix loop with `retry_count + 1`

---

#### post-verify

Read: `{artifact_dir}/verification.json` — check `passed` and `gaps[]`

| Condition | Action |
|-----------|--------|
| `passed==true`, no gaps | Proceed |
| Gaps found, retries remaining | Insert: `quality-debug "{gaps}" → maestro-plan --gaps → maestro-execute [cli] → maestro-verify → decision:post-verify {retry+1}` |
| Gaps found, max retries reached | Escalate to `post-debug-escalate` |

#### post-business-test

Read: `{artifact_dir}/business-test-results.json` — check `failures[]` or `passed`

| Condition | Action |
|-----------|--------|
| All pass | Proceed |
| Failures, retries remaining | Insert: `quality-debug --from-business-test → maestro-plan --gaps → maestro-execute [cli] → maestro-verify → decision:post-verify {0} → quality-auto-test → decision:post-business-test {retry+1}` |
| Failures, max retries reached | Escalate to `post-debug-escalate` |

#### post-review

Read: `{artifact_dir}/review.json` — check `verdict` and `issues[].severity`

| Condition | Action |
|-----------|--------|
| verdict == "PASS" or "WARN" | Proceed |
| verdict == "BLOCK" or critical issues, retries remaining | Insert: `quality-debug "{issues}" → maestro-plan --gaps → maestro-execute [cli] → quality-review → decision:post-review {retry+1}` |
| BLOCK, max retries reached | Escalate to `post-debug-escalate` |

#### post-test

Read: `{artifact_dir}/uat.md` + `{artifact_dir}/.tests/test-results.json`

| Condition | Action |
|-----------|--------|
| All pass | Proceed |
| Failures, retries remaining | Insert full re-run loop: `quality-debug --from-uat → maestro-plan --gaps → maestro-execute [cli] → maestro-verify → decision:post-verify {0} → quality-auto-test → decision:post-business-test {0} → quality-review → decision:post-review {0} → quality-auto-test → quality-test → decision:post-test {retry+1}` |
| Failures, max retries reached | Escalate to `post-debug-escalate` |

#### post-milestone

Read: `.workflow/state.json` — check for next milestone with status "pending" or "active"

| Condition | Action |
|-----------|--------|
| Next milestone found | Update session (milestone, phase = first phase). Insert full lifecycle for next milestone (analyze through milestone-complete + decision nodes) |
| No next milestone | Proceed — session completes naturally |

#### post-debug-escalate

Terminal escalation — max retries exceeded after debug.

```
Set session status = "paused"
Display: ◆ 已达最大重试次数，debug 已执行。请人工介入检查结果。
Display: 使用 /maestro-ralph continue 在处理后恢复
End.
```

### 3.4: Insert commands + update session

```
Insert new_commands at position (current_step + 1)
Reindex all steps: step.index = array position
Mark current decision node: status = "completed", completed_at = now
Write status.json

Display: ◆ Decision: {type} → {outcome}, +{N} commands inserted
```

### 3.5: Resume execution

```
Skill({ skill: "maestro-ralph-execute" })
End.
```

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Cannot infer lifecycle position | Show raw state, ask user |
| E003 | error | Artifact dir not found for decision evaluation | Show glob results, ask user |
| E004 | error | Result file missing in artifact dir | Warn, treat as failure |
| W001 | warning | Decision node expanded chain | Auto-handled, log expansion |
| W002 | warning | Max retries reached, escalating | Auto-handled |
| W003 | warning | Multiple running sessions found | Use latest, warn user |
</error_codes>

<success_criteria>
- [ ] state.json parsed with correct schema (type, path, scope, milestone, artifacts[])
- [ ] Lifecycle position inferred from bootstrap state + artifact chain + result files
- [ ] Artifact dir resolved: `.workflow/scratch/{artifact.path}/` with fallback glob
- [ ] Full quality pipeline generated: verify → business-test → review → test-gen → test
- [ ] Decision nodes inserted after: post-verify, post-business-test, post-review, post-test, post-milestone
- [ ] Every failure path starts with quality-debug before plan --gaps
- [ ] retry_count tracked per decision, max_retries enforced, escalation to post-debug-escalate
- [ ] Command insertion + reindex preserves step integrity
- [ ] Ralph never executes steps — only creates sessions and evaluates decisions
- [ ] Handoff to maestro-ralph-execute via Skill() at session creation and after decision evaluation
</success_criteria>
