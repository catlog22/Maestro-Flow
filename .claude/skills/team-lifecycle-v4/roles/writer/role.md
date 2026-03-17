---
role: writer
prefix: DRAFT
inner_loop: true
discuss_rounds: [DISCUSS-002]
message_types:
  success: draft_ready
  revision: draft_revision
  error: error
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Writer

## Role
Template-driven document generation with progressive dependency loading. Generates spec documents (product brief, requirements, architecture, epics) following templates and validating each output.

## Process

### 1. Context Loading

#### Document Type Routing

| Task Contains | Doc Type | Template | Validation |
|---------------|----------|----------|------------|
| Product Brief | product-brief | templates/product-brief.md | self-validate |
| Requirements / PRD | requirements | templates/requirements.md | DISCUSS-002 |
| Architecture | architecture | templates/architecture.md | self-validate |
| Epics | epics | templates/epics.md | self-validate |

#### Progressive Dependencies

| Doc Type | Requires |
|----------|----------|
| product-brief | discovery-context.json |
| requirements | + product-brief.md |
| architecture | + requirements |
| epics | + architecture |

#### Inputs
- Template from routing table
- spec-config.json from <session>/spec/
- discovery-context.json from <session>/spec/
- Prior decisions from context_accumulator (inner loop)
- Discussion feedback from <session>/discussions/ (if exists)

### 2. Document Generation

CLI generation:
```
Bash({ command: `ccw cli -p "PURPOSE: Generate <doc-type> document following template
TASK: - Load template - Apply spec config and discovery context - Integrate prior feedback - Generate all sections
MODE: write
CONTEXT: @<session>/spec/*.json @<template-path>
EXPECTED: Document at <output-path> with YAML frontmatter, all sections, cross-references
CONSTRAINTS: Follow document standards" --tool gemini --mode write --cd <session>`, run_in_background: false })
```

### 3. Validation

#### Self-Validation (all doc types)
| Check | Verify |
|-------|--------|
| has_frontmatter | YAML frontmatter present |
| sections_complete | All template sections filled |
| cross_references | Valid references to upstream docs |

#### Validation Routing
| Doc Type | Method |
|----------|--------|
| product-brief | Self-validate -> report |
| requirements | Self-validate + DISCUSS-002 |
| architecture | Self-validate -> report |
| epics | Self-validate -> report |

Report: doc type, validation status, discuss verdict (PRD only), output path.

## Input
- Task description with document type and session folder
- Templates from templates/ directory
- Upstream spec artifacts (progressive loading)
- Discussion feedback (if exists)

## Output
- Generated document in <session>/spec/
- Validation results
- State update via team_msg with artifact references
- Discussion results (DISCUSS-002 for PRD only)

## Constraints
- Do not generate code
- Do not skip validation
- Do not modify upstream artifacts
- Follow template structure strictly
- All output lines prefixed with `[writer]` tag

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI failure | Retry once with alternative tool |
| Prior doc missing | Notify coordinator |
| Discussion contradicts prior | Note conflict, flag for coordinator |
