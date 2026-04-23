// ---------------------------------------------------------------------------
// Merge Validator — Pre-merge integrity checks for worktree → main merges.
//
// Pure functions — no side effects, no git operations. Takes paths and returns
// validation results. Called by the maestro-merge workflow before merging.
//
// Checks:
//   1. Phase completeness: all owned phases must be "completed"
//   2. State consistency: worktree state.json fields don't conflict with main
//   3. Artifact integrity: every owned phase has valid artifacts
//   4. Dependency check: dependency phases still exist in main
//
// Supports artifact registry (state.json.artifacts) with fallback to legacy
// phases/ directory structure for backward compatibility.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MergeValidation {
  phase_completeness: boolean;
  state_consistency: boolean;
  artifact_integrity: boolean;
  dependency_check: boolean;
}

export interface MergeValidationResult {
  valid: boolean;
  checks: MergeValidation;
  errors: string[];
  warnings: string[];
}

interface WorktreeScope {
  worktree: boolean;
  milestone_num: number;
  milestone: string;
  owned_phases: number[];
  phase_dependencies?: Record<string, number[]>;
  main_worktree: string;
  branch: string;
  base_commit: string;
  created_at: string;
}

interface PhaseIndex {
  phase: number;
  title?: string;
  slug?: string;
  status: string;
  depends_on?: number[];
  updated_at?: string;
}

interface Artifact {
  id: string;
  type: string;
  milestone?: string | null;
  phase?: number | null;
  scope?: string;
  path?: string;
  status: string;
  depends_on?: string | string[] | null;
}

// ---------------------------------------------------------------------------
// Main validation entry point
// ---------------------------------------------------------------------------

/**
 * Validate that a worktree is ready to merge back to main.
 *
 * @param worktreePath  Absolute path to the worktree root
 * @param mainPath      Absolute path to the main worktree root
 * @param milestoneNum  Milestone number being merged
 * @param opts          Options (force skips completeness check)
 */
export function validateMergeReadiness(
  worktreePath: string,
  mainPath: string,
  milestoneNum: number,
  opts?: { force?: boolean },
): MergeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Load worktree-scope.json
  const scope = loadWorktreeScope(worktreePath);
  if (!scope) {
    return {
      valid: false,
      checks: { phase_completeness: false, state_consistency: false, artifact_integrity: false, dependency_check: false },
      errors: ['Cannot read .workflow/worktree-scope.json in worktree'],
      warnings: [],
    };
  }

  if (scope.milestone_num !== milestoneNum) {
    errors.push(
      `Milestone mismatch: worktree owns M${scope.milestone_num} but merge requested for M${milestoneNum}`,
    );
  }

  // Check 1: Phase completeness
  const completeness = checkPhaseCompleteness(worktreePath, scope.owned_phases);
  if (!completeness.passed) {
    if (opts?.force) {
      warnings.push(...completeness.messages.map(m => `[force] ${m}`));
    } else {
      errors.push(...completeness.messages);
    }
  }

  // Check 2: State consistency
  const consistency = checkStateConsistency(worktreePath, mainPath);
  if (!consistency.passed) {
    errors.push(...consistency.messages);
  }

  // Check 3: Artifact integrity
  const integrity = checkArtifactIntegrity(worktreePath, scope.owned_phases);
  if (!integrity.passed) {
    errors.push(...integrity.messages);
  }

  // Check 4: Dependency check
  const deps = checkDependencies(worktreePath, mainPath, scope.owned_phases, scope);
  if (!deps.passed) {
    warnings.push(...deps.messages);
  }

  const checks: MergeValidation = {
    phase_completeness: completeness.passed || (opts?.force === true),
    state_consistency: consistency.passed,
    artifact_integrity: integrity.passed,
    dependency_check: deps.passed,
  };

  return {
    valid: errors.length === 0,
    checks,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Check 1: Phase Completeness
// ---------------------------------------------------------------------------

interface CheckResult {
  passed: boolean;
  messages: string[];
}

function checkPhaseCompleteness(
  worktreePath: string,
  ownedPhases: number[],
): CheckResult {
  const wfDir = join(worktreePath, '.workflow');
  const artifacts = loadArtifacts(wfDir);

  if (artifacts) {
    return checkPhaseCompletenessFromRegistry(artifacts, ownedPhases);
  }
  return checkPhaseCompletenessLegacy(wfDir, ownedPhases);
}

function checkPhaseCompletenessFromRegistry(artifacts: Artifact[], ownedPhases: number[]): CheckResult {
  const messages: string[] = [];
  for (const phaseNum of ownedPhases) {
    const execArtifacts = artifacts.filter(a => a.type === 'execute' && a.phase === phaseNum);
    if (execArtifacts.length === 0) {
      messages.push(`Phase ${phaseNum}: no execute artifact found`);
      continue;
    }
    const incomplete = execArtifacts.filter(a => a.status !== 'completed');
    if (incomplete.length > 0) {
      messages.push(
        `Phase ${phaseNum}: ${incomplete[0].id} status is "${incomplete[0].status}", expected "completed"`,
      );
    }
  }
  return { passed: messages.length === 0, messages };
}

function checkPhaseCompletenessLegacy(wfDir: string, ownedPhases: number[]): CheckResult {
  const phasesDir = join(wfDir, 'phases');
  if (!existsSync(phasesDir)) {
    return { passed: false, messages: ['No artifact registry and no .workflow/phases/ directory in worktree'] };
  }
  const messages: string[] = [];
  for (const phaseNum of ownedPhases) {
    const index = findPhaseIndex(phasesDir, phaseNum);
    if (!index) {
      messages.push(`Phase ${phaseNum}: index.json not found`);
      continue;
    }
    if (index.status !== 'completed') {
      messages.push(
        `Phase ${phaseNum} (${index.title ?? index.slug ?? '?'}): status is "${index.status}", expected "completed"`,
      );
    }
  }
  return { passed: messages.length === 0, messages };
}

// ---------------------------------------------------------------------------
// Check 2: State Consistency (reads state.json directly — no phases dependency)
// ---------------------------------------------------------------------------

function checkStateConsistency(worktreePath: string, mainPath: string): CheckResult {
  const messages: string[] = [];

  const wtStatePath = join(worktreePath, '.workflow', 'state.json');
  const mainStatePath = join(mainPath, '.workflow', 'state.json');

  const wtState = loadJson(wtStatePath);
  const mainState = loadJson(mainStatePath);

  if (!wtState) {
    messages.push('Cannot read .workflow/state.json in worktree');
    return { passed: false, messages };
  }
  if (!mainState) {
    messages.push('Cannot read .workflow/state.json in main');
    return { passed: false, messages };
  }

  // Check that project-level fields haven't diverged
  if (wtState.project_name && mainState.project_name &&
      wtState.project_name !== mainState.project_name) {
    messages.push(
      `project_name diverged: worktree="${wtState.project_name}" vs main="${mainState.project_name}"`,
    );
  }

  // Check milestones array length consistency
  const wtMilestones = Array.isArray(wtState.milestones) ? wtState.milestones.length : 0;
  const mainMilestones = Array.isArray(mainState.milestones) ? mainState.milestones.length : 0;
  if (wtMilestones !== mainMilestones && wtMilestones > 0 && mainMilestones > 0) {
    messages.push(
      `milestones array length differs: worktree=${wtMilestones} vs main=${mainMilestones}`,
    );
  }

  return { passed: messages.length === 0, messages };
}

// ---------------------------------------------------------------------------
// Check 3: Artifact Integrity
// ---------------------------------------------------------------------------

function checkArtifactIntegrity(worktreePath: string, ownedPhases: number[]): CheckResult {
  const wfDir = join(worktreePath, '.workflow');
  const artifacts = loadArtifacts(wfDir);

  if (artifacts) {
    return checkArtifactIntegrityFromRegistry(artifacts, ownedPhases, wfDir);
  }
  return checkArtifactIntegrityLegacy(wfDir, ownedPhases);
}

function checkArtifactIntegrityFromRegistry(artifacts: Artifact[], ownedPhases: number[], wfDir: string): CheckResult {
  const messages: string[] = [];
  for (const phaseNum of ownedPhases) {
    const phaseArtifacts = artifacts.filter(a => a.phase === phaseNum);
    if (phaseArtifacts.length === 0) {
      messages.push(`Phase ${phaseNum}: no artifacts in registry`);
      continue;
    }
    for (const art of phaseArtifacts) {
      if (!art.id || typeof art.id !== 'string') {
        messages.push(`Phase ${phaseNum}: artifact missing "id" field`);
      }
      if (!art.status || typeof art.status !== 'string') {
        messages.push(`Phase ${phaseNum}: artifact ${art.id ?? '?'} missing "status" field`);
      }
      if (art.path) {
        const artDir = join(wfDir, art.path);
        if (!existsSync(artDir)) {
          messages.push(`Phase ${phaseNum}: artifact ${art.id} path "${art.path}" does not exist`);
        }
      }
    }
  }
  return { passed: messages.length === 0, messages };
}

function checkArtifactIntegrityLegacy(wfDir: string, ownedPhases: number[]): CheckResult {
  const phasesDir = join(wfDir, 'phases');
  const messages: string[] = [];
  for (const phaseNum of ownedPhases) {
    const index = findPhaseIndex(phasesDir, phaseNum);
    if (!index) {
      messages.push(`Phase ${phaseNum}: missing index.json`);
      continue;
    }
    if (typeof index.phase !== 'number') {
      messages.push(`Phase ${phaseNum}: index.json missing "phase" field`);
    }
    if (typeof index.status !== 'string') {
      messages.push(`Phase ${phaseNum}: index.json missing "status" field`);
    }
  }
  return { passed: messages.length === 0, messages };
}

// ---------------------------------------------------------------------------
// Check 4: Dependency Check
// ---------------------------------------------------------------------------

function checkDependencies(
  worktreePath: string,
  mainPath: string,
  ownedPhases: number[],
  scope: WorktreeScope,
): CheckResult {
  const wtWfDir = join(worktreePath, '.workflow');
  const mainWfDir = join(mainPath, '.workflow');
  const mainArtifacts = loadArtifacts(mainWfDir);

  // New: use artifact registry + worktree-scope.phase_dependencies
  if (mainArtifacts && scope.phase_dependencies) {
    return checkDepsFromRegistry(mainArtifacts, ownedPhases, scope);
  }

  // Fallback: legacy phases/ directory
  return checkDepsLegacy(wtWfDir, mainPath, ownedPhases);
}

function checkDepsFromRegistry(
  mainArtifacts: Artifact[],
  ownedPhases: number[],
  scope: WorktreeScope,
): CheckResult {
  const messages: string[] = [];
  const allDeps = new Set<number>();

  for (const phaseNum of ownedPhases) {
    const deps = scope.phase_dependencies?.[String(phaseNum)] ?? [];
    for (const dep of deps) {
      if (!ownedPhases.includes(dep)) {
        allDeps.add(dep);
      }
    }
  }

  for (const dep of allDeps) {
    const depExec = mainArtifacts.filter(
      a => a.type === 'execute' && a.phase === dep && a.status === 'completed',
    );
    if (depExec.length === 0) {
      messages.push(`Dependency phase ${dep} has no completed execute artifact in main`);
    }
  }

  return { passed: messages.length === 0, messages };
}

function checkDepsLegacy(
  wtWfDir: string,
  mainPath: string,
  ownedPhases: number[],
): CheckResult {
  const messages: string[] = [];
  const wtPhasesDir = join(wtWfDir, 'phases');
  const mainPhasesDir = join(mainPath, '.workflow', 'phases');

  const allDeps = new Set<number>();
  for (const phaseNum of ownedPhases) {
    const index = findPhaseIndex(wtPhasesDir, phaseNum);
    if (index?.depends_on) {
      for (const dep of index.depends_on) {
        if (!ownedPhases.includes(dep)) {
          allDeps.add(dep);
        }
      }
    }
  }

  for (const dep of allDeps) {
    const mainIndex = findPhaseIndex(mainPhasesDir, dep);
    if (!mainIndex) {
      messages.push(`Dependency phase ${dep} not found in main .workflow/phases/`);
    } else if (mainIndex.status !== 'completed') {
      messages.push(
        `Dependency phase ${dep} in main has status "${mainIndex.status}" (expected "completed")`,
      );
    }
  }

  return { passed: messages.length === 0, messages };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadWorktreeScope(worktreePath: string): WorktreeScope | null {
  const scopePath = join(worktreePath, '.workflow', 'worktree-scope.json');
  return loadJson(scopePath) as WorktreeScope | null;
}

function loadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load artifacts array from state.json. Returns null if no artifacts
 * or the array is empty (triggers fallback to legacy phases/).
 */
function loadArtifacts(wfDir: string): Artifact[] | null {
  const state = loadJson(join(wfDir, 'state.json'));
  const artifacts = state?.artifacts;
  if (Array.isArray(artifacts) && artifacts.length > 0) {
    return artifacts as Artifact[];
  }
  return null;
}

/**
 * Find a phase's index.json by phase number (legacy phases/ directory).
 * Phases are stored as `{NN}-{slug}/index.json` where NN is zero-padded.
 */
function findPhaseIndex(phasesDir: string, phaseNum: number): PhaseIndex | null {
  if (!existsSync(phasesDir)) return null;

  const prefix = String(phaseNum).padStart(2, '0') + '-';
  try {
    const entries = readdirSync(phasesDir);
    const match = entries.find(e => e.startsWith(prefix));
    if (!match) return null;

    const indexPath = join(phasesDir, match, 'index.json');
    if (!existsSync(indexPath)) return null;

    return JSON.parse(readFileSync(indexPath, 'utf-8')) as PhaseIndex;
  } catch {
    return null;
  }
}
