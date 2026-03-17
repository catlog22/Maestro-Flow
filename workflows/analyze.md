# Workflow: Analyze

Multi-dimensional iterative analysis with CLI exploration, multi-perspective synthesis, discussion timeline, intent tracking, and decision extraction.

## Pipeline Position

```
maestro-brainstorm (optional upstream)
        ↓ ideas, scored options
maestro-analyze ← THIS
        ↓ analysis.md, discussion.md, conclusions.json, context.md
maestro-plan → maestro-execute → maestro-verify
```

## Architecture

```
Full mode (-q omitted):
  Phase 1:    Setup & Scoping         → session init, dimension selection, discussion.md
              |
  Phase 2:    CLI Exploration          → exploration-codebase.json, explorations.json/perspectives.json
              |                           (cli-explore-agent 3-layer + multi-CLI parallel)
              |
  Phase 3:    Interactive Discussion   → discussion.md rounds (max 5)
              |                           (Decision Recording Protocol, Intent Coverage)
              |
  Phase 4:    Six-Dimension Scoring    → 6 dimensions × 1-5 score + risk matrix
              |
  Phase 5:    Synthesis & Conclusion   → conclusions.json, analysis.md, final discussion.md
              |
  Phase 6:    Decision Extraction      → context.md (Locked/Free/Deferred)
              └── Next Step: plan / issue / done

Quick mode (-q):
  Phase 1:    Setup (minimal)          → load context, skip scoping
              |
  Phase 6:    Decision Extraction      → context.md (Locked/Free/Deferred)
              └── Next Step: plan / done
```

## Arguments

```
$ARGUMENTS: "<phase|topic> [-y] [-c] [-q]"

<phase>     -- Phase number (phase mode, operates within phase directory)
<topic>     -- Topic text (scratch mode, creates scratch directory)
-y / --yes  -- Auto mode, skip interactive scoping, auto-deepen
-c / --continue -- Resume from existing session
-q / --quick -- Quick mode, skip exploration + scoring, go straight to decision extraction
```

## Dual-Mode Routing

```
IF $ARGUMENTS matches /^\d+$/
  → Phase mode
  → Resolve phase dir from state.json + roadmap
  → Set OUTPUT_DIR = .workflow/phases/{NN}-{slug}/
  → Update index.json: status → "exploring"

ELSE
  → Scratch mode
  → Slugify topic (lowercase, hyphens, max 40 chars)
  → Set OUTPUT_DIR = .workflow/scratch/analyze-{slug}-{date}/
  → Create directory + index.json from scratch-index template (type="analyze")
```

## Output Structure

```
{OUTPUT_DIR}/
├── discussion.md              # Full timeline: TOC, rounds, decisions, intent coverage
├── analysis.md                # 6-dimension scoring summary + risk matrix + Go/No-Go (skip in -q)
├── exploration-codebase.json  # Codebase exploration (skip in -q)
├── explorations.json          # Single perspective aggregated findings (skip in -q)
├── perspectives.json          # Multi-perspective findings + synthesis (skip in -q)
├── conclusions.json           # Final synthesis, recommendations, decision trail (skip in -q)
└── context.md                 # Decision extraction: Locked/Free/Deferred decisions for plan
```

---

## Process

### Step 1: Parse Input & Initialize Session

Parse $ARGUMENTS to determine mode and flags:
- `-c` present: locate existing session folder (discussion.md exists), resume from last round
- `-y` present: set AUTO_MODE=true
- `-q` present: set QUICK_MODE=true (skip Steps 2-7, jump to Step 8: Decision Extraction)
- Number (e.g., "3") = phase mode: resolve `.workflow/phases/{NN}-*/`, verify phase exists in roadmap
- Text (e.g., "microservices vs monolith") = scratch mode: slugify topic, prepare scratch directory path
- Missing/empty = error E001

**Session initialization:**
- Session ID: `ANL-{slug}-{YYYY-MM-DD}`
- Phase mode output: phase directory
- Scratch mode output: `.workflow/scratch/analyze-{slug}-{date}/`

**Load prior context** (phase mode):
1. Read `.workflow/project.md` — project vision and constraints
2. Read `.workflow/roadmap.md` — phase structure and dependencies
3. Read index.json in phase dir — goal, success_criteria
4. Read `.brainstorming/guidance-specification.md` in phase dir (if exists) — detailed requirements, constraints, RFC 2119 decisions from brainstorm. Skip areas marked as MUST/MUST NOT (already locked).
5. Read `.brainstorming/feature-index.json` in phase dir (if exists) — feature decomposition
6. Read `brainstorm.md` in phase dir (if exists, legacy fallback, skip if guidance-specification.md loaded)
7. Read `analysis.md` in phase dir (if exists, for continuation)
8. Read `conclusions.json` in phase dir (if exists, for continuation)
9. Read prior phases' `context.md` files — skip already-decided areas
10. Read existing `context.md` in this phase (if exists, for continuation)
11. Load project specs: `specs_content = maestro spec load --category planning`
    Ensures analysis decisions don't conflict with existing architecture constraints.

**Quick mode routing**: If QUICK_MODE, skip to Step 8 (Decision Extraction) after loading context.

### Step 1.5: Archive Previous Artifacts

Skip if `-c` (resuming — working on existing session).

Before writing any new artifacts, archive existing ones to preserve history:

```
ARCHIVE_TARGETS = ["discussion.md", "analysis.md", "explorations.json", "perspectives.json", "conclusions.json", "exploration-codebase.json"]

has_existing = false
FOR artifact IN ARCHIVE_TARGETS:
  IF file exists "$OUTPUT_DIR/${artifact}":
    has_existing = true
    break

IF has_existing:
  mkdir -p "$OUTPUT_DIR/.history"
  TIMESTAMP = current timestamp formatted as "YYYY-MM-DDTHH-mm-ss"
  FOR artifact IN ARCHIVE_TARGETS:
    IF file exists "$OUTPUT_DIR/${artifact}":
      // Extract name and extension: "analysis.md" → "analysis" + "md"
      mv "$OUTPUT_DIR/${artifact}" "$OUTPUT_DIR/.history/${name}-${TIMESTAMP}.${ext}"
  display "Archived previous analysis artifacts to .history/"
```

### Step 2: Scoping & Dimension Selection

Skip if `-c` (resuming) or `-y` (auto mode uses defaults).

**Interactive scoping** via single AskUserQuestion (up to 3 questions):

1. **Focus** (multiSelect, header: "分析方向"): Present 3-4 directions from Dimension-Direction Mapping:

   | Dimension | Directions |
   |-----------|-----------|
   | architecture | System Design, Component Interactions, Technology Choices, Design Patterns |
   | implementation | Code Structure, Patterns, Error Handling, Algorithm Analysis |
   | performance | Bottlenecks, Optimization, Resource Utilization, Concurrency |
   | security | Vulnerabilities, Auth, Data Protection, Input Validation |
   | concept | Foundation, Core Mechanisms, Patterns, Trade-offs |
   | comparison | Solution Comparison, Pros/Cons, Technology Evaluation |
   | decision | Criteria, Trade-off Analysis, Risk Assessment, Impact |

2. **Perspectives** (multiSelect, header: "分析视角"): Up to 4:

   | Perspective | CLI Tool | Focus |
   |-------------|----------|-------|
   | Technical | gemini | Implementation, code patterns, feasibility |
   | Architectural | claude | System design, scalability, interactions |
   | Business | codex | Value, ROI, stakeholder impact |
   | Domain Expert | gemini | Domain patterns, best practices, standards |

3. **Depth** (single-select, header: "分析深度"):
   - Quick Overview / Standard / Deep Dive

**Auto mode defaults**: all dimensions relevant to topic, single comprehensive perspective, Standard depth.

### Step 3: Initialize discussion.md

Write initial `discussion.md` to output directory:
- Dynamic TOC (updated after each round/phase)
- Session metadata (id, topic, dimensions, perspectives, depth)
- User Intent section (original topic/question for intent tracking)
- Current Understanding block (replaceable — overwritten each round, NOT appended): initialized as "To be populated after exploration"
- Empty discussion timeline
- Dimension selection rationale

### Step 4: CLI Exploration

Codebase exploration FIRST, then CLI analysis.

**Step 4.1: Codebase Exploration** (cli-explore-agent)

Spawn cli-explore-agent with 3-layer exploration:

| Layer | Focus | Output |
|-------|-------|--------|
| Layer 1: Module Discovery (Breadth) | Search by topic keywords, identify ALL relevant files, map module boundaries | `relevant_files[]` |
| Layer 2: Structure Tracing (Depth) | Top 3-5 key files: trace call chains 2-3 levels deep, identify data flow | `call_chains[]`, `data_flows[]` |
| Layer 3: Code Anchor Extraction (Detail) | Each key finding: extract code snippet (20-50 lines) with file:line | `code_anchors[]` |

Output: `exploration-codebase.json` (single) or `explorations/{perspective}.json` (multi-perspective, parallel up to 4)

**Step 4.2: CLI Analysis** (AFTER exploration)

Build exploration context from Step 4.1 findings, then spawn CLI analysis:
- **Single perspective**: one comprehensive CLI call with exploration context
- **Multi-perspective** (up to 4): parallel CLI calls per perspective, each with perspective-specific focus

CLI calls use `run_in_background: true`. Wait for results before continuing.

**Step 4.3: Aggregate Findings**

- Consolidate explorations + CLI results
- Multi-perspective: extract synthesis (convergent themes, conflicting views, unique contributions)
- Write to `explorations.json` (single) or `perspectives.json` (multi)

**Step 4.4: Update discussion.md — Round 1**

Append Round 1 to discussion timeline:
- Sources used
- Key findings with code anchors
- Discussion points
- Open questions

**Step 4.5: Initial Intent Coverage Check**

Re-read original User Intent from discussion.md header. Check each intent item against Round 1 findings:
- ✅ addressed
- 🔄 in-progress
- ❌ not yet touched

Append initial Intent Coverage Check to discussion.md.

### Step 5: Interactive Discussion Loop

Max 5 rounds. Each round follows this sequence:

**5.1: Current Understanding Summary** (Round >= 2, BEFORE presenting new findings):
Generate 1-2 sentence recap linking previous round conclusions to current starting point.

**5.2: Present Findings** from latest exploration/analysis

**5.3: Gather Feedback** (AskUserQuestion, single-select, header: "分析反馈"):
- **继续深入**: Deepen analysis — auto or user-specified direction
- **调整方向**: Different focus or specific questions
- **补充信息**: User has additional context, constraints, or corrections
- **分析完成**: Sufficient — exit to Phase 4

**5.4: Process Response** (always record user choice + impact to discussion.md):

| Choice | Action |
|--------|--------|
| 继续深入 | Sub-question (max 4 options: 3 context-driven + 1 heuristic frame-breaker) → CLI/agent exploration → merge findings |
| 调整方向 | Capture new direction → new CLI exploration → Record Decision (old vs new, reason, impact) |
| 补充信息 | Capture user input → integrate → answer questions via CLI if needed → Record corrections |
| 分析完成 | Exit loop → Record why concluding |

**5.5: Update discussion.md** after each round:
- **Append** Round N: user input, direction, Q&A, corrections, new insights
- **Replace** `## Current Understanding` block with latest consolidated understanding
- **Update** `## Table of Contents` with links to new sections

**5.6: Round Narrative Synthesis** (append after each round):
```markdown
### Round N: Narrative Synthesis
**起点**: 基于上一轮的 [conclusions/questions]，本轮从 [starting point] 切入。
**关键进展**: [New findings] [confirmed/refuted/modified] 了之前关于 [hypothesis] 的理解。
**决策影响**: 用户选择 [feedback type]，导致分析方向 [adjusted/deepened/maintained]。
**当前理解**: 经过本轮，核心认知更新为 [updated understanding]。
**遗留问题**: [remaining questions driving next round]
```

**5.7: Intent Drift Check** (every round >= 2):
Re-read original User Intent. Check each item:
- ✅ addressed (in Round N)
- 🔄 in-progress
- ⚠️ implicitly absorbed (needs confirmation)
- ❌ not yet discussed

If ❌ or ⚠️ items exist → proactively surface to user at start of next round.

**Auto mode (-y)**: auto-deepen for up to 3 rounds, then synthesize.

### Step 6: Six-Dimension Scoring

Using all exploration findings, discussion insights, and user feedback, score across 6 dimensions:

| Dimension | Focus Areas | Score |
|-----------|------------|-------|
| Feasibility | Technical difficulty, team capability, time, tooling | 1-5 |
| Impact | User value, business value, tech debt reduction, DX | 1-5 |
| Risk | Failure modes, security, scalability, regression | 1-5 |
| Complexity | Integration points, dependencies, learning curve, testing | 1-5 |
| Dependencies | External services, internal modules, data, infrastructure | 1-5 |
| Alternatives | 2+ other approaches with tradeoffs | N/A |

Each dimension scored with specific evidence (code refs, data points from exploration).

Build probability-impact risk matrix from identified risks.

Formulate Go/No-Go/Conditional recommendation with confidence level.

### Step 7: Synthesis & Conclusion

**7.1: Intent Coverage Verification** (MANDATORY before synthesis):

```markdown
### Intent Coverage Matrix
| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | [intent] | ✅ Addressed | Round N, Conclusion #M | |
| 2 | [intent] | 🔀 Transformed | Round N → M | Original: X → Final: Y |
| 3 | [intent] | ❌ Missed | — | Reason |
```

Gate: ❌ Missed items must be either (a) addressed in additional round or (b) confirmed deferred by user.

**7.2: Consolidate Insights**

Compile from all phases:
- Decision Trail from all rounds
- Key conclusions with evidence + confidence (high/medium/low)
- Recommendations with rationale + priority (high/medium/low) + actionable steps
- Open questions, follow-up suggestions
- Write to `conclusions.json`

**7.3: Write analysis.md** (legacy compatible — 6-dimension summary):
- Executive summary with overall assessment
- Per-dimension scores with key evidence
- Dimension summary table
- Risk matrix visualization
- Go/No-Go recommendation with confidence

**7.4: Final discussion.md Update**:
- Conclusions section: summary, ranked key conclusions, prioritized recommendations
- Current Understanding (Final): what established, what clarified/corrected, key insights
- Decision Trail: critical decisions, direction changes timeline, trade-offs
- Intent Coverage Matrix
- Session statistics: rounds, duration, sources, artifacts, decision count

**7.5: Interactive Recommendation Review** (skip in auto mode):

Present recommendations, batch-confirm via AskUserQuestion (max 4 per call, ordered by priority):
- **确认**: Accept as-is → review_status = "accepted"
- **修改**: Adjust scope/steps → review_status = "modified"
- **删除**: Not needed → review_status = "rejected"

Update conclusions.json with review_status for each recommendation.

### Step 8: Decision Extraction

**This step runs ALWAYS** — in full mode after synthesis, in quick mode (`-q`) as the main step.

**8.1: Identify Gray Areas**

Analyze phase goal + loaded context (project.md, roadmap, brainstorm, prior context.md files, exploration findings if available) to find undecided implementation areas.

**Domain-aware gray area generation:**
- Something users SEE: layout, density, interactions, states
- Something users CALL: responses, errors, auth, versioning
- Something users RUN: output format, flags, modes, error handling
- Something users READ: structure, tone, depth, flow
- Something being ORGANIZED: criteria, grouping, naming, exceptions

Generate 3-5 **phase-specific** gray areas.
Skip areas already decided in prior context.md files.
If `guidance-specification.md` loaded: skip MUST/MUST NOT areas (already locked), focus on SHOULD/MAY areas and gaps.
If full mode completed: use exploration findings + scoring to inform gray area quality.

**8.2: Area Selection** (skip if `-y`)

```
AskUserQuestion({
  question: "Which areas need discussion for this phase?",
  options: [
    { label: "Area 1: {title}", description: "{brief description}" },
    { label: "Area 2: {title}", description: "{brief description}" },
    { label: "Area 3: {title}", description: "{brief description}" },
    { label: "All areas", description: "Discuss everything" },
    { label: "Skip", description: "Context is clear enough — no decisions needed" }
  ]
})
```

If "Skip": write minimal context.md (empty Locked/Free/Deferred sections), proceed to Step 9.

**8.3: Deep-Dive Discussion**

For each selected area, conduct multi-round interactive dialog (3-4 questions per area):

```
AskUserQuestion({
  question: "[{area}] {specific question about implementation choice}",
  options: [
    { label: "Option A", description: "{description with tradeoffs}" },
    { label: "Option B", description: "{description with tradeoffs}" },
    { label: "Option C", description: "{description with tradeoffs}" }
  ]
})
```

Record each decision using Decision Recording Protocol.

After questions per area: "More questions about {area}, or move to next?"

**Scope guardrail**: Phase boundary from roadmap.md is FIXED. Discussion clarifies HOW to implement, not WHETHER to add more. If user suggests new capabilities → "That belongs in its own phase. I will note it for later." → capture in Deferred.

**8.4: Classify Decisions**

- **Locked**: firm decisions that cannot be changed during implementation
- **Free**: open for implementation discretion (implementer can choose)
- **Deferred**: postponed to a later phase (captured but not acted on)

**8.5: Write context.md**

Write to `OUTPUT_DIR/context.md`:

```markdown
# Context: Phase {NN} -- {PHASE_TITLE}

**Date**: {date}
**Areas discussed**: {list of areas}

## Decisions

### Decision 1: {TITLE}
- **Context**: {what and why}
- **Options**:
  1. {opt1}
  2. {opt2}
- **Chosen**: {selected}
- **Reason**: {rationale}

## Constraints

### Locked
{decisions that are final and must be followed}

### Free
{decisions left to implementer discretion}

### Deferred
{ideas captured but postponed to later phases}

## Code Context
{relevant code references from exploration or discussion}
```

**8.6: Auto-create Issues from Deferred Items**

```
deferred_items = decisions.filter(d => d.classification == "Deferred")

IF deferred_items.length > 0:
  mkdir -p ".workflow/issues"
  today = format(now(), "YYYYMMDD")
  counter = next sequence number for today

  FOR each item IN deferred_items:
    issue_id = "ISS-{today}-{counter padded to 3 digits}"
    issue = {
      id: issue_id,
      title: "Deferred: " + item.title,
      status: "deferred",
      priority: 5,
      severity: "low",
      source: "analyze",
      phase_ref: PHASE_NUM,
      description: item.context + " -- Chosen to defer: " + item.reason,
      tags: ["deferred", "analyze"],
      created_at: now()
    }
    Append JSON line to .workflow/issues/issues.jsonl
    counter++

  Print: "Created {deferred_items.length} deferred issues for tracking"
```

### Step 9: Report & Next Step

Display summary:
- Overall assessment score and recommendation (full mode) or "Quick decision extraction" (quick mode)
- Decisions captured (Locked/Free/Deferred counts)
- Key conclusions (if full mode)
- Session stats

**Next Step Selection** (AskUserQuestion, single-select, header: "Next Step"):
- **快速执行**: Skill({ skill: "maestro-quick", args: "{task_description} --full" }) — build context from conclusions
- **进入规划**: Phase mode → Skill({ skill: "maestro-plan", args: "{phase}" }); Scratch mode → Skill({ skill: "maestro-plan", args: "--dir {output_dir}" }) — plan directly against scratch directory
- **产出Issue**: Convert recommendations to tracked issues
- **完成**: No further action

Handle selection:

| Choice | Action |
|--------|--------|
| 快速执行 | Build `taskDescription` from high/medium priority accepted recommendations. Assemble context from exploration. Invoke Skill immediately. |
| 进入规划 | Invoke Skill({ skill: "maestro-plan", args: "{phase}" }) immediately. |
| 产出Issue | For each accepted/modified recommendation: create issue. |
| 完成 | No further action. |

Update index.json timestamps.

```
== maestro-analyze complete ==
Session:  {session_id}
Output:   {output_dir}/
Mode:     {full|quick}
Rounds:   {round_count} (full mode only)
Score:    {recommendation} ({confidence}) (full mode only)
Decisions: {decision_count} (Locked: {n}, Free: {n}, Deferred: {n})

Files:
  context.md           — Locked/Free/Deferred decisions for plan
  discussion.md        — Full discussion timeline (full mode)
  analysis.md          — 6-dimension scoring summary (full mode)
  conclusions.json     — Structured conclusions (full mode)

Next:
  Skill({ skill: "maestro-quick", args: "{task}" })          — Quick execute
  Skill({ skill: "maestro-plan", args: "{phase}" })          — Full phase planning (phase mode)
  Skill({ skill: "maestro-plan", args: "--dir {output_dir}" }) — Plan in scratch dir (scratch mode)
```

---

## Decision Recording Protocol

Record immediately when any occur:

| Trigger | What to Record |
|---------|---------------|
| Direction choice | What chosen, why, alternatives discarded |
| Key finding | Content, impact scope, confidence, hypothesis impact |
| Assumption change | Old → new understanding, reason, impact |
| User feedback | Input, rationale for adoption/adjustment |
| Disagreement/trade-off | Conflicting views, trade-off basis, final choice |
| Scope adjustment | Before/after scope, trigger reason |

**Decision Record Format**:
```
> **Decision**: [Description]
> - **Context**: [Trigger]
> - **Options considered**: [Alternatives]
> - **Chosen**: [Approach] — **Reason**: [Rationale]
> - **Rejected**: [Why other options were discarded]
> - **Impact**: [Effect on analysis]
```

## Discussion Timeline (discussion.md)

Each round appends:
- User feedback and direction choice
- New findings with code anchors
- Narrative Synthesis (起点 → 关键进展 → 决策影响 → 当前理解 → 遗留问题)
- Intent Coverage Check (Round >= 2)

Replaceable blocks (overwritten each round):
- `## Current Understanding` — latest consolidated understanding
- `## Table of Contents` — updated with new section links

## Six Dimensions

| Dimension | Focus Areas |
|-----------|------------|
| Feasibility | Technical difficulty, team capability, time, tooling |
| Impact | User value, business value, tech debt reduction, DX |
| Risk | Failure modes, security, scalability, regression |
| Complexity | Integration points, dependencies, learning curve, testing |
| Dependencies | External services, internal modules, data, infrastructure |
| Alternatives | 2+ other approaches with tradeoffs |

## Key Design Principles

1. **Iterative Deepening**: Multi-round discussion (max 5) with user feedback steering direction
2. **CLI-Assisted Exploration**: cli-explore-agent for codebase + multi-CLI parallel analysis
3. **Discussion Timeline**: discussion.md as living document — rounds appended, Current Understanding replaced
4. **Decision Recording Protocol**: Immediate capture of decisions, findings, assumption changes
5. **Intent Coverage Tracking**: Original user intent checked every round (✅🔄⚠️❌)
6. **Six-Dimension Scoring**: Feasibility, Impact, Risk, Complexity, Dependencies, Alternatives
7. **Multi-Perspective Synthesis**: Up to 4 perspectives with convergent/conflicting/unique extraction
8. **Decision Extraction**: Gray area identification → interactive discussion → Locked/Free/Deferred classification → context.md
9. **Dual Depth**: Full mode (explore→score→decide) or Quick mode (-q, decide only)

## Quality Criteria

**Full mode:**
- All 6 dimensions analyzed with evidence-backed scores
- Discussion timeline has narrative synthesis per round
- Decision Recording Protocol applied consistently
- Intent Coverage verified with no unresolved ❌ items
- Risk matrix populated with identified risks
- At least 2 alternatives compared with tradeoffs
- Go/No-Go/Conditional recommendation with confidence level
- Code references included where relevant (file paths, line numbers)

**Both modes (full + quick):**
- context.md written with all decisions classified as Locked/Free/Deferred
- Gray areas identified through phase-specific analysis
- Scope creep redirected to Deferred section
- Every decision follows Context/Options/Chosen/Reason protocol
- Prior context loaded and applied (no re-asking decided questions)

## Error Handling

| Error | Resolution |
|-------|------------|
| cli-explore-agent fails | Continue with available context, note limitation |
| CLI timeout | Retry with shorter prompt, or skip perspective |
| Max rounds reached | Force synthesis, offer continuation |
| No relevant findings | Broaden search, ask user for clarification |
| Session folder conflict | Append timestamp suffix |
