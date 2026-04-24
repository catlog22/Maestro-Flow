# Workflow: specs-setup

System specs initialization -- scan project structure, detect tech stack, generate convention files.

## Trigger

- First `/maestro-init` (automatic)
- Manual `/spec-setup`

## Prerequisites

- Project root must exist
- `.workflow/` directory should exist (create if missing)

## Execution Steps

### Step 1: Ensure Directory Structure

```
Create directories if not present:
  .workflow/
  .workflow/specs/
```

### Step 2: Scan Project Structure

Scan the project root for tech stack indicators:

```
Detection targets:
  package.json        --> Node.js ecosystem (read dependencies for framework detection)
  tsconfig.json       --> TypeScript
  pyproject.toml      --> Python (modern)
  requirements.txt    --> Python (legacy)
  go.mod              --> Go
  Cargo.toml          --> Rust
  pom.xml             --> Java (Maven)
  build.gradle        --> Java/Kotlin (Gradle)
  composer.json        --> PHP
  Gemfile             --> Ruby
  .csproj / .sln      --> .NET/C#
  Dockerfile          --> Container deployment
  docker-compose.yml  --> Multi-container orchestration

Framework detection (from dependency files):
  react / next        --> React / Next.js
  vue                 --> Vue.js
  angular             --> Angular
  express / fastify   --> Node.js server
  django / flask      --> Python web
  gin / echo          --> Go web
  spring              --> Java Spring
```

### Step 3: Detect Code Patterns

Scan source files for coding conventions:

```
Indentation:  Count leading spaces/tabs in first 20 source files
Naming:       Scan exports for camelCase / PascalCase / snake_case patterns
Imports:      Check import style (named vs default, path aliases, barrel exports)
Formatting:   Check for .prettierrc, .editorconfig, eslint config
File naming:  kebab-case vs camelCase vs PascalCase for source files
```

### Step 4: Generate Core Files (always created)

#### 4a: coding-conventions.md

Output: `.workflow/specs/coding-conventions.md`

```markdown
---
title: "Coding Conventions"
category: coding
---
# Coding Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Formatting
- Indentation: {detected}
- Line length: {detected or "not configured"}
- Trailing commas: {detected}
- Semicolons: {detected}

## Naming
- Variables/functions: {camelCase | snake_case}
- Classes/types: {PascalCase}
- Constants: {UPPER_SNAKE_CASE | camelCase}
- Files: {kebab-case | camelCase | PascalCase}

## Imports
- Style: {named imports | default imports | mixed}
- Path aliases: {@ | ~ | none}
- Order: {built-in, external, internal, relative}

## Patterns
{list detected patterns from codebase analysis}

## Entries
{empty section for spec-add entries}
```

#### 4b: architecture-constraints.md

Output: `.workflow/specs/architecture-constraints.md`

```markdown
---
title: "Architecture Constraints"
category: arch
---
# Architecture Constraints

Auto-generated from project structure. Update manually as architecture evolves.

## Module Structure
- Type: {monorepo | single-package | multi-package}
- Key modules: {list detected top-level directories with purposes}

## Layer Boundaries
{detected layers: e.g., commands/ -> core/ -> tools/ -> types/}

## Dependency Rules
{detected from imports: which modules import from which}

## Technology Constraints
- Runtime: {Node.js >= X | Python >= X | ...}
- Module system: {ESM | CommonJS | ...}
- Strict mode: {yes | no}

## Entries
{empty section for spec-add entries}
```

#### 4c: learnings.md

Output: `.workflow/specs/learnings.md`

```markdown
---
title: "Learnings"
category: learning
---
# Learnings

Bugs, gotchas, and lessons learned during development.
Add entries with: `/spec-add learning <description>`

## Entries

{empty -- entries added via spec-add}
```

### Step 5: Generate Optional Files (when signals detected)

#### 5a: quality-rules.md (when linter config or CI detected)

Output: `.workflow/specs/quality-rules.md`

```markdown
---
title: "Quality Rules"
category: quality
---
# Quality Rules

## Entries

{empty -- entries added via spec-add}
```

#### 5b: test-conventions.md (when test framework or test files detected)

Scan existing test files for conventions (framework, naming, directory structure, patterns).

Output: `.workflow/specs/test-conventions.md`

```markdown
---
title: "Test Conventions"
category: test
---
# Test Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Framework
- Framework: {detected: Jest | Vitest | pytest | Mocha | none}
- Run command: {detected: npm test | pytest | etc.}

## Directory Structure
- Pattern: {detected: __tests__/ | tests/ | co-located | etc.}

## Naming Conventions
- Test files: {detected: *.test.ts | *.spec.ts | test_*.py | etc.}

## Patterns
{detected patterns from existing test files}

## Entries
{empty section for spec-add entries}
```

#### 5c: debug-notes.md and review-standards.md

These are NOT created during setup. They are created on demand when `spec-add debug` or `spec-add review` is first used.

### Step 6: Summary

Display what was created:
```
Specs initialized:
  .workflow/specs/coding-conventions.md          (category: coding)
  .workflow/specs/architecture-constraints.md    (category: arch)
  .workflow/specs/learnings.md                   (category: learning)
  {if created:}
  .workflow/specs/quality-rules.md               (category: quality)
  .workflow/specs/test-conventions.md            (category: test)

Categories: coding, arch, quality, debug, test, review, learning
  debug-notes.md and review-standards.md created on demand via /spec-add
```

## Output

All files listed above under `.workflow/`.
