import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  evaluateNamespaceGuard,
  getNamespaceBoundaries,
} from '../namespace-guard.js';

const ROOT = '/projects/my-repo';

// ---------------------------------------------------------------------------
// evaluateNamespaceGuard — pure function tests
// ---------------------------------------------------------------------------

describe('evaluateNamespaceGuard', () => {
  // -- Own namespace (allowed) --

  it('allows write to own member file', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/members/alice.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe(undefined);
  });

  it('allows write to own spec directory', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/specs/alice/api-design.md'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows write to own overlay bundle', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/overlays/alice-bundle.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  // -- Shared paths (allowed) --

  it('allows write to shared activity.jsonl', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/activity.jsonl'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows write to shared overlays/manifest.json', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/overlays/manifest.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  // -- Other members (blocked) --

  it('blocks write to another member file', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/members/bob.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('[NamespaceGuard] Blocked');
    expect(result.reason).toContain('bob.json');
    expect(result.reason).toContain('alice');
  });

  it('blocks write to another member spec directory', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/specs/bob/design.md'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('[NamespaceGuard] Blocked');
    expect(result.reason).toContain('bob');
  });

  it('blocks write to another member overlay bundle', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/overlays/bob-bundle.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('[NamespaceGuard] Blocked');
    expect(result.reason).toContain('bob-bundle.json');
  });

  // -- Outside collab (allowed — not our concern) --

  it('allows paths outside .workflow/collab/', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, 'src/index.ts'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows paths under .workflow/ but not collab/', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/state.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows paths outside project root', () => {
    const result = evaluateNamespaceGuard(
      '/tmp/some-file.txt',
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  // -- Edge cases --

  it('allows non-bundle files under overlays/', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/overlays/some-other-file.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  // -- Tasks namespace (shared writable) --

  it('allows write to tasks/TASK-001.json for any member', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/tasks/TASK-001.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe(undefined);
  });

  it('allows write to tasks/TASK-999.json for any member', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/tasks/TASK-999.json'),
      'bob',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows write to tasks/.counter for any member', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/tasks/.counter'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe(undefined);
  });

  it('allows write to unknown files under tasks/ for any member', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/tasks/other-file.txt'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('handles relative paths', () => {
    // Test with a relative path from project root
    const result = evaluateNamespaceGuard(
      '.workflow/collab/members/bob.json',
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
  });

  it('blocks spec dir even for nested files', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/specs/bob/sub/deep/file.md'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
  });

  it('allows own spec dir for nested files', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/specs/alice/sub/deep/file.md'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(true);
  });

  it('returns descriptive reason on blocked member file', () => {
    const result = evaluateNamespaceGuard(
      join(ROOT, '.workflow/collab/members/charlie.json'),
      'alice',
      ROOT,
    );
    expect(result.allowed).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason!.length).toBeGreaterThan(0);
    expect(result.reason).toContain('charlie.json');
    expect(result.reason).toContain('alice');
  });
});

// ---------------------------------------------------------------------------
// getNamespaceBoundaries
// ---------------------------------------------------------------------------

describe('getNamespaceBoundaries', () => {
  it('returns expected boundaries for a user', () => {
    const boundaries = getNamespaceBoundaries('alice', ROOT);

    expect(boundaries.length).toBeGreaterThanOrEqual(6);
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('members/alice.json')]));
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('specs/alice/')]));
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('overlays/alice-bundle.json')]));
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('activity.jsonl')]));
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('overlays/manifest.json')]));
    expect(boundaries).toEqual(expect.arrayContaining([expect.stringContaining('tasks/')]));
  });

  it('does not include other users paths', () => {
    const boundaries = getNamespaceBoundaries('alice', ROOT);
    for (const b of boundaries) {
      expect(b).not.toContain('bob');
    }
  });
});
