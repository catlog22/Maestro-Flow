# Dispatch Tasks

Create task chains from pipeline mode with proper blockedBy relationships.

## When to Use

- Phase 3 of Coordinator
- Pipeline mode determined, need to create task chain
- Team created, workers ready to spawn

## Strategy

### Delegation Mode

**Mode**: Direct (coordinator operates TaskCreate/TaskUpdate directly)

### Decision Logic

```javascript
function buildPipeline(pipelineMode, sessionFolder, taskDescription) {
  const pipelines = {
    'scan': [
      { prefix: 'TDSCAN', owner: 'scanner', desc: 'Multi-dimension tech debt scan', blockedBy: [] },
      { prefix: 'TDEVAL', owner: 'assessor', desc: 'Quantitative assessment and priority ranking', blockedBy: ['TDSCAN'] }
    ],
    'remediate': [
      { prefix: 'TDSCAN', owner: 'scanner', desc: 'Multi-dimension tech debt scan', blockedBy: [] },
      { prefix: 'TDEVAL', owner: 'assessor', desc: 'Quantitative assessment and priority ranking', blockedBy: ['TDSCAN'] },
      { prefix: 'TDPLAN', owner: 'planner', desc: 'Phased remediation plan design', blockedBy: ['TDEVAL'] },
      { prefix: 'TDFIX', owner: 'executor', desc: 'Debt cleanup execution', blockedBy: ['TDPLAN'] },
      { prefix: 'TDVAL', owner: 'validator', desc: 'Cleanup result validation', blockedBy: ['TDFIX'] }
    ],
    'targeted': [
      { prefix: 'TDPLAN', owner: 'planner', desc: 'Targeted remediation plan design', blockedBy: [] },
      { prefix: 'TDFIX', owner: 'executor', desc: 'Debt cleanup execution', blockedBy: ['TDPLAN'] },
      { prefix: 'TDVAL', owner: 'validator', desc: 'Cleanup result validation', blockedBy: ['TDFIX'] }
    ]
  }
  return pipelines[pipelineMode] || pipelines['scan']
}
```

## Execution Steps

### Step 1: Context Preparation

```javascript
const pipeline = buildPipeline(pipelineMode, sessionFolder, taskDescription)
```

### Step 2: Execute Strategy

```javascript
const taskIds = {}

for (const stage of pipeline) {
  const fullDesc = [
    stage.desc,
    `\nsession: ${sessionFolder}`,
    `\n\nTarget: ${taskDescription}`
  ].join('')

  TaskCreate({
    subject: `${stage.prefix}-001: ${stage.desc}`,
    description: fullDesc,
    activeForm: `${stage.desc} in progress`
  })

  const allTasks = TaskList()
  const newTask = allTasks.find(t => t.subject.startsWith(`${stage.prefix}-001`))
  taskIds[stage.prefix] = newTask.id

  const blockedByIds = stage.blockedBy
    .map(dep => taskIds[dep])
    .filter(Boolean)

  TaskUpdate({
    taskId: newTask.id,
    owner: stage.owner,
    addBlockedBy: blockedByIds
  })
}
```

### Step 3: Result Processing

```javascript
const allTasks = TaskList()
const chainTasks = pipeline.map(s => taskIds[s.prefix]).filter(Boolean)
const chainValid = chainTasks.length === pipeline.length

if (!chainValid) {
  mcp__ccw-tools__team_msg({
    operation: "log", session_id: sessionId, from: "coordinator",
    type: "error",
    summary: "Task chain creation failed"
  })
}
```

## Fix-Verify Loop Task Creation

When validator reports regressions, coordinator calls this to append tasks:

```javascript
function createFixVerifyTasks(fixVerifyIteration, sessionFolder) {
  TaskCreate({
    subject: `TDFIX-fix-${fixVerifyIteration}: Fix regressions (Fix-Verify #${fixVerifyIteration})`,
    description: `Fix validation regressions\nsession: ${sessionFolder}\ntype: fix-verify`,
    activeForm: `Fix-Verify #${fixVerifyIteration} fix in progress`
  })

  TaskCreate({
    subject: `TDVAL-verify-${fixVerifyIteration}: Re-validate (Fix-Verify #${fixVerifyIteration})`,
    description: `Re-validate fix results\nsession: ${sessionFolder}`,
    activeForm: `Fix-Verify #${fixVerifyIteration} validation in progress`
  })

  // Set dependency: TDVAL-verify depends on TDFIX-fix
  // ... TaskUpdate addBlockedBy
}
```

## Output Format

```
## Task Chain Created

### Mode: [scan|remediate|targeted]
### Pipeline Stages: [count]
- [prefix]-001: [description] (owner: [role], blocked by: [deps])

### Verification: PASS/FAIL
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Task creation fails | Retry once, then report to user |
| Dependency cycle detected | Flatten dependencies, warn coordinator |
| Invalid pipelineMode | Default to 'scan' mode |
| Agent/CLI failure | Retry once, then fallback to inline execution |
| Timeout (>5 min) | Report partial results, notify coordinator |
