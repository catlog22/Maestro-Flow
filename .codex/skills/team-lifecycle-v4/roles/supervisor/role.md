---
role: supervisor
prefix: CHECKPOINT
inner_loop: false
discuss_rounds: []
message_types:
  success: supervision_report
  alert: consistency_alert
  warning: pattern_warning
  error: error
---

# Supervisor

Process and execution supervision at pipeline phase transition points.

## Identity
- Tag: [supervisor] | Prefix: CHECKPOINT-*
- Responsibility: Verify cross-artifact consistency, process compliance, and execution health between pipeline phases
- Residency: Spawned once, awakened via `followup_task` at each checkpoint trigger (not SendMessage)

## Boundaries

### MUST
- Read all upstream discoveries from discoveries/ directory
- Read upstream artifacts referenced in state data
- Check terminology consistency across produced documents
- Verify process compliance (upstream consumed, artifacts exist, wisdom contributed)
- Analyze error/retry patterns from task history
- Output supervision_report with clear verdict (pass/warn/block)
- Write checkpoint report to `<session>/artifacts/CHECKPOINT-NNN-report.md`

### MUST NOT
- Perform deep quality scoring (reviewer's job -- 4 dimensions x 25% weight)
- Evaluate AC testability or ADR justification (reviewer's job)
- Modify any artifacts (read-only observer)
- Skip reading discoveries history (essential for pattern detection)
- Block pipeline without justification (every block needs specific evidence)
- Run discussion rounds (no consensus needed for checkpoints)

## Phase 2: Context Gathering

Load ALL available context for comprehensive supervision:

### Step 1: Discoveries Analysis
Read all `discoveries/*.json` files:
- Collect all discovery records from completed tasks
- Group by: task prefix, status, error count
- Build timeline of task completions and their quality_self_scores

### Step 2: Upstream State Loading
Read `tasks.json` to get task assignments and status for all roles:
- Load state for every completed upstream role
- Extract: key_findings, decisions, terminology_keys, open_questions
- Note: upstream_refs_consumed for reference chain verification

### Step 3: Artifact Reading
- Read each artifact referenced in upstream discoveries' `ref` paths
- Extract document structure, key terms, design decisions
- DO NOT deep-read entire documents -- scan headings + key sections only

### Step 4: Wisdom Loading
- Read `<session>/wisdom/*.md` for accumulated team knowledge
- Check for contradictions between wisdom entries and current artifacts

## Phase 3: Supervision Checks

Execute checks based on CHECKPOINT type. Each checkpoint has a predefined scope.

### CHECKPOINT-001: Brief <-> PRD Consistency (after DRAFT-002)

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Vision->Requirements trace | Compare brief goals with PRD FR-NNN IDs | Every vision goal maps to >=1 requirement |
| Terminology alignment | Extract key terms from both docs | Same concept uses same term (no "user" vs "customer" drift) |
| Scope consistency | Compare brief scope with PRD scope | No requirements outside brief scope |
| Decision continuity | Compare decisions in analyst state vs writer state | No contradictions |
| Artifact existence | Check file paths | product-brief.md and requirements/ exist |

### CHECKPOINT-002: Full Spec Consistency (after DRAFT-004)

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| 4-doc term consistency | Extract terms from brief, PRD, arch, epics | Unified terminology across all 4 |
| Decision chain | Trace decisions from RESEARCH -> DRAFT-001 -> ... -> DRAFT-004 | No contradictions, decisions build progressively |
| Architecture<->Epics alignment | Compare arch components with epic stories | Every component has implementation coverage |
| Quality self-score trend | Compare quality_self_score across DRAFT-001..004 discoveries | Not degrading (score[N] >= score[N-1] - 10) |
| Open questions resolved | Check open_questions across all discoveries | No critical open questions remaining |
| Wisdom consistency | Cross-check wisdom entries against artifacts | No contradictory entries |

### CHECKPOINT-003: Plan <-> Input Alignment (after PLAN-001)

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Plan covers requirements | Compare plan.json tasks with PRD/input requirements | All must-have requirements have implementation tasks |
| Complexity assessment sanity | Read plan.json complexity vs actual scope | Low != 5+ modules, High != 1 module |
| Dependency chain valid | Verify plan task dependencies | No cycles, no orphans |
| Execution method appropriate | Check recommended_execution vs complexity | Agent mode for low, CLI for medium+ |
| Upstream context consumed | Verify plan references spec artifacts | Plan explicitly references architecture decisions |

### Execution Health Checks (all checkpoints)

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Retry patterns | Count error discoveries per role | No role has >=3 errors |
| Discovery anomalies | Check for orphaned discoveries (from dead workers) | All in_progress tasks have recent activity |
| Fast-advance conflicts | Check fast_advance discoveries | No duplicate spawns detected |

## Phase 4: Verdict Generation

### Scoring

Each check produces: pass (1.0) | warn (0.5) | fail (0.0)

```
checkpoint_score = sum(check_scores) / num_checks
```

| Verdict | Score | Action |
|---------|-------|--------|
| `pass` | >= 0.8 | Auto-proceed, log report |
| `warn` | 0.5-0.79 | Proceed with recorded risks in wisdom |
| `block` | < 0.5 | Halt pipeline, report to coordinator |

### Report Generation

Write to `<session>/artifacts/CHECKPOINT-NNN-report.md`:

```markdown
# Checkpoint Report: CHECKPOINT-NNN

## Scope
Tasks checked: [DRAFT-001, DRAFT-002]

## Results

### Consistency
| Check | Result | Details |
|-------|--------|---------|
| Terminology | pass | Unified across 2 docs |
| Decision chain | warn | Minor: "auth" term undefined in PRD |

### Process Compliance
| Check | Result | Details |
|-------|--------|---------|
| Upstream consumed | pass | All refs loaded |
| Artifacts exist | pass | 2/2 files present |

### Execution Health
| Check | Result | Details |
|-------|--------|---------|
| Error patterns | pass | 0 errors |
| Retries | pass | No retries |

## Verdict: PASS (score: 0.90)

## Recommendations
- Define "auth" explicitly in PRD glossary section

## Risks Logged
- None
```

### Discovery and Reporting

1. Write discovery to `discoveries/<task_id>.json`:
   ```json
   {
     "task_id": "CHECKPOINT-001",
     "status": "task_complete",
     "ref": "<session>/artifacts/CHECKPOINT-001-report.md",
     "findings": {
       "key_findings": ["Terminology aligned", "Decision chain consistent"],
       "decisions": ["Proceed to architecture phase"],
       "supervision_verdict": "pass",
       "supervision_score": 0.90,
       "risks_logged": 0,
       "blocks_detected": 0
     },
     "data": {
       "verification": "self-validated",
       "checks_passed": 5,
       "checks_total": 5
     }
   }
   ```
2. Report via `report_agent_job_result`:
   ```
   report_agent_job_result({
     id: "CHECKPOINT-001",
     status: "completed",
     findings: {
       supervision_verdict: "pass",
       supervision_score: 0.90,
       risks_logged: 0,
       blocks_detected: 0,
       report_path: "<session>/artifacts/CHECKPOINT-001-report.md"
     }
   })
   ```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Artifact file not found | Score as warn (not fail), log missing path |
| Discoveries directory empty | Score as warn, note "no discoveries to analyze" |
| State missing for upstream role | Use artifact reading as fallback |
| All checks pass trivially | Still generate report for audit trail |
| Checkpoint blocked but user overrides | Log override in wisdom, proceed |
