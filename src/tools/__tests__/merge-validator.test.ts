import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { validateMergeReadiness } from '../merge-validator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let wtDir: string;
let mainDir: string;

function setup(): void {
  wtDir = mkdtempSync(join(tmpdir(), 'merge-wt-'));
  mainDir = mkdtempSync(join(tmpdir(), 'merge-main-'));
}

function teardown(): void {
  if (wtDir && existsSync(wtDir)) rmSync(wtDir, { recursive: true, force: true });
  if (mainDir && existsSync(mainDir)) rmSync(mainDir, { recursive: true, force: true });
}

function setupWorktree(opts: {
  milestoneNum?: number;
  ownedPhases?: number[];
  phaseStatuses?: Record<number, string>;
}): void {
  const wfDir = join(wtDir, '.workflow');
  mkdirSync(wfDir, { recursive: true });

  // worktree-scope.json
  writeFileSync(join(wfDir, 'worktree-scope.json'), JSON.stringify({
    worktree: true,
    milestone_num: opts.milestoneNum ?? 2,
    milestone: 'Production',
    owned_phases: opts.ownedPhases ?? [3, 4],
    main_worktree: mainDir,
    branch: 'milestone/production',
    base_commit: 'abc1234',
    created_at: '2026-04-10T00:00:00Z',
  }), 'utf-8');

  // state.json
  writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
    project_name: 'test-project',
    current_phase: 3,
    milestones: [{ name: 'MVP' }, { name: 'Production' }],
  }), 'utf-8');

  // Phase directories
  const phasesDir = join(wfDir, 'phases');
  const statuses = opts.phaseStatuses ?? { 3: 'completed', 4: 'completed' };
  for (const [num, status] of Object.entries(statuses)) {
    const phaseDir = join(phasesDir, `${String(num).padStart(2, '0')}-phase-${num}`);
    mkdirSync(phaseDir, { recursive: true });
    writeFileSync(join(phaseDir, 'index.json'), JSON.stringify({
      phase: Number(num),
      title: `Phase ${num}`,
      slug: `phase-${num}`,
      status,
      depends_on: Number(num) > 1 ? [Number(num) - 1] : [],
    }), 'utf-8');
  }
}

function setupMain(opts?: {
  phaseStatuses?: Record<number, string>;
}): void {
  const wfDir = join(mainDir, '.workflow');
  mkdirSync(wfDir, { recursive: true });

  // state.json
  writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
    project_name: 'test-project',
    current_phase: 2,
    milestones: [{ name: 'MVP' }, { name: 'Production' }],
  }), 'utf-8');

  // Dependency phases (completed in main)
  const phasesDir = join(wfDir, 'phases');
  const statuses = opts?.phaseStatuses ?? { 1: 'completed', 2: 'completed' };
  for (const [num, status] of Object.entries(statuses)) {
    const phaseDir = join(phasesDir, `${String(num).padStart(2, '0')}-phase-${num}`);
    mkdirSync(phaseDir, { recursive: true });
    writeFileSync(join(phaseDir, 'index.json'), JSON.stringify({
      phase: Number(num),
      title: `Phase ${num}`,
      slug: `phase-${num}`,
      status,
    }), 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('merge-validator', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('fails when worktree-scope.json is missing', () => {
    mkdirSync(join(wtDir, '.workflow'), { recursive: true });
    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('worktree-scope.json');
  });

  it('fails on milestone mismatch', () => {
    setupWorktree({ milestoneNum: 2 });
    setupMain();
    const result = validateMergeReadiness(wtDir, mainDir, 3); // asking for M3 but worktree owns M2
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Milestone mismatch'))).toBe(true);
  });

  it('passes when all phases completed and state consistent', () => {
    setupWorktree({ phaseStatuses: { 3: 'completed', 4: 'completed' } });
    setupMain();
    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checks.phase_completeness).toBe(true);
    expect(result.checks.state_consistency).toBe(true);
    expect(result.checks.artifact_integrity).toBe(true);
  });

  it('fails when phases not completed', () => {
    setupWorktree({ phaseStatuses: { 3: 'completed', 4: 'in_progress' } });
    setupMain();
    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Phase 4') && e.includes('in_progress'))).toBe(true);
    expect(result.checks.phase_completeness).toBe(false);
  });

  it('force mode downgrades completeness errors to warnings', () => {
    setupWorktree({ phaseStatuses: { 3: 'completed', 4: 'in_progress' } });
    setupMain();
    const result = validateMergeReadiness(wtDir, mainDir, 2, { force: true });
    expect(result.valid).toBe(true); // force → valid
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('[force]') && w.includes('Phase 4'))).toBe(true);
    expect(result.checks.phase_completeness).toBe(true); // forced pass
  });

  it('detects state consistency issues (project_name divergence)', () => {
    setupWorktree({ phaseStatuses: { 3: 'completed', 4: 'completed' } });
    setupMain();
    // Modify main state to have different project name
    const mainStatePath = join(mainDir, '.workflow', 'state.json');
    writeFileSync(mainStatePath, JSON.stringify({
      project_name: 'different-project',
      current_phase: 2,
      milestones: [{ name: 'MVP' }, { name: 'Production' }],
    }), 'utf-8');

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('project_name diverged'))).toBe(true);
    expect(result.checks.state_consistency).toBe(false);
  });

  it('detects missing dependency phases in main', () => {
    setupWorktree({
      ownedPhases: [3, 4],
      phaseStatuses: { 3: 'completed', 4: 'completed' },
    });
    // Main has NO phases at all
    const wfDir = join(mainDir, '.workflow');
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
      project_name: 'test-project',
      milestones: [{ name: 'MVP' }, { name: 'Production' }],
    }), 'utf-8');

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    // Dependency check fails but as warning
    expect(result.warnings.some(w => w.includes('Dependency phase'))).toBe(true);
  });

  it('artifact integrity fails when index.json has missing fields', () => {
    setupWorktree({ phaseStatuses: { 3: 'completed', 4: 'completed' } });
    setupMain();

    // Corrupt phase 4 index.json — remove required fields
    const phase4Dir = join(wtDir, '.workflow', 'phases', '04-phase-4');
    writeFileSync(join(phase4Dir, 'index.json'), JSON.stringify({
      title: 'Phase 4',
      // missing 'phase' and 'status' fields
    }), 'utf-8');

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.checks.artifact_integrity).toBe(false);
    expect(result.errors.some(e => e.includes('Phase 4') && e.includes('missing'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Artifact registry tests (new scratch-based model)
// ---------------------------------------------------------------------------

describe('merge-validator (artifact registry)', () => {
  beforeEach(setup);
  afterEach(teardown);

  function setupWorktreeWithArtifacts(opts: {
    milestoneNum?: number;
    ownedPhases?: number[];
    artifacts: Array<{ id: string; type: string; phase: number; status: string; path?: string }>;
    phaseDeps?: Record<string, number[]>;
  }): void {
    const wfDir = join(wtDir, '.workflow');
    mkdirSync(wfDir, { recursive: true });

    // worktree-scope.json
    writeFileSync(join(wfDir, 'worktree-scope.json'), JSON.stringify({
      worktree: true,
      milestone_num: opts.milestoneNum ?? 2,
      milestone: 'Production',
      owned_phases: opts.ownedPhases ?? [3, 4],
      phase_dependencies: opts.phaseDeps,
      main_worktree: mainDir,
      branch: 'milestone/production',
      base_commit: 'abc1234',
      created_at: '2026-04-10T00:00:00Z',
    }), 'utf-8');

    // state.json with artifacts
    writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
      project_name: 'test-project',
      current_phase: 3,
      milestones: [{ name: 'MVP' }, { name: 'Production' }],
      artifacts: opts.artifacts,
    }), 'utf-8');

    // Create scratch dirs for artifacts that have paths
    for (const art of opts.artifacts) {
      if (art.path) {
        mkdirSync(join(wfDir, art.path), { recursive: true });
      }
    }
  }

  function setupMainWithArtifacts(opts: {
    artifacts: Array<{ id: string; type: string; phase: number; status: string; path?: string }>;
  }): void {
    const wfDir = join(mainDir, '.workflow');
    mkdirSync(wfDir, { recursive: true });

    writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
      project_name: 'test-project',
      milestones: [{ name: 'MVP' }, { name: 'Production' }],
      artifacts: opts.artifacts,
    }), 'utf-8');

    for (const art of opts.artifacts) {
      if (art.path) {
        mkdirSync(join(wfDir, art.path), { recursive: true });
      }
    }
  }

  it('passes when all phases have completed execute artifacts', () => {
    setupWorktreeWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/plan-auth-2026' },
        { id: 'EXC-002', type: 'execute', phase: 4, status: 'completed', path: 'scratch/plan-storage-2026' },
      ],
    });
    setupMainWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 1, status: 'completed', path: 'scratch/plan-setup-2026' },
      ],
    });

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(true);
    expect(result.checks.phase_completeness).toBe(true);
    expect(result.checks.artifact_integrity).toBe(true);
  });

  it('fails when execute artifact is not completed', () => {
    setupWorktreeWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/plan-auth-2026' },
        { id: 'EXC-002', type: 'execute', phase: 4, status: 'in_progress', path: 'scratch/plan-storage-2026' },
      ],
    });
    setupMainWithArtifacts({ artifacts: [] });

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('EXC-002') && e.includes('in_progress'))).toBe(true);
  });

  it('fails when phase has no execute artifact', () => {
    setupWorktreeWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/plan-auth-2026' },
        { id: 'PLN-002', type: 'plan', phase: 4, status: 'completed', path: 'scratch/plan-storage-2026' },
      ],
    });
    setupMainWithArtifacts({ artifacts: [] });

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Phase 4') && e.includes('no execute artifact'))).toBe(true);
  });

  it('force mode passes with incomplete artifacts', () => {
    setupWorktreeWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/plan-auth-2026' },
        { id: 'EXC-002', type: 'execute', phase: 4, status: 'in_progress', path: 'scratch/plan-storage-2026' },
      ],
    });
    setupMainWithArtifacts({ artifacts: [] });

    const result = validateMergeReadiness(wtDir, mainDir, 2, { force: true });
    expect(result.valid).toBe(true);
    expect(result.checks.phase_completeness).toBe(true);
    expect(result.warnings.some(w => w.includes('[force]'))).toBe(true);
  });

  it('detects artifact path that does not exist', () => {
    const wfDir = join(wtDir, '.workflow');
    mkdirSync(wfDir, { recursive: true });

    writeFileSync(join(wfDir, 'worktree-scope.json'), JSON.stringify({
      worktree: true,
      milestone_num: 2,
      milestone: 'Production',
      owned_phases: [3],
      main_worktree: mainDir,
      branch: 'milestone/production',
      base_commit: 'abc1234',
      created_at: '2026-04-10T00:00:00Z',
    }), 'utf-8');

    writeFileSync(join(wfDir, 'state.json'), JSON.stringify({
      project_name: 'test-project',
      milestones: [{ name: 'MVP' }, { name: 'Production' }],
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/nonexistent' },
      ],
    }), 'utf-8');
    // Do NOT create the scratch directory

    setupMainWithArtifacts({ artifacts: [] });

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.checks.artifact_integrity).toBe(false);
    expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
  });

  it('checks dependency phases via phase_dependencies', () => {
    setupWorktreeWithArtifacts({
      ownedPhases: [3, 4],
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 3, status: 'completed', path: 'scratch/plan-auth-2026' },
        { id: 'EXC-002', type: 'execute', phase: 4, status: 'completed', path: 'scratch/plan-storage-2026' },
      ],
      phaseDeps: { '3': [1, 2], '4': [3] },
    });
    // Main has phase 1 completed but NOT phase 2
    setupMainWithArtifacts({
      artifacts: [
        { id: 'EXC-001', type: 'execute', phase: 1, status: 'completed', path: 'scratch/plan-setup-2026' },
      ],
    });

    const result = validateMergeReadiness(wtDir, mainDir, 2);
    expect(result.warnings.some(w => w.includes('Dependency phase 2'))).toBe(true);
  });
});
