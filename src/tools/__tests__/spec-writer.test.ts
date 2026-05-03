import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { appendSpecEntry, type SpecAddResult } from '../spec-writer.js';

// ---------------------------------------------------------------------------
// Temp directory lifecycle
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'maestro-test-spec-writer-'));
  // Create .workflow so resolveSpecDir can resolve 'project' scope
  mkdirSync(join(testDir, '.workflow', 'specs'), { recursive: true });
});

afterEach(() => {
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Basic add
// ---------------------------------------------------------------------------

describe('appendSpecEntry - basic add', () => {
  it('creates entry in correct file and returns ok=true, duplicate=false', () => {
    const result = appendSpecEntry(
      testDir,
      'coding',
      'Use camelCase',
      'Always use camelCase for variables.',
      ['naming', 'style'],
    );

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.category).toBe('coding');
    expect(result.title).toBe('Use camelCase');
    expect(result.file).toContain('coding-conventions.md');

    // Verify file content
    const content = readFileSync(result.file, 'utf-8');
    expect(content).toContain('### Use camelCase');
    expect(content).toContain('Always use camelCase for variables.');
    expect(content).toContain('<spec-entry');
    expect(content).toContain('</spec-entry>');
  });
});

// ---------------------------------------------------------------------------
// Creates directory and file if missing
// ---------------------------------------------------------------------------

describe('appendSpecEntry - creates directory and file if missing', () => {
  it('creates specs directory and file when they do not exist', () => {
    // Use a fresh dir without pre-created .workflow/specs
    const freshDir = mkdtempSync(join(tmpdir(), 'maestro-test-spec-writer-fresh-'));
    try {
      const result = appendSpecEntry(
        freshDir,
        'coding',
        'New Rule',
        'Some content.',
        ['test'],
      );

      expect(result.ok).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(existsSync(result.file)).toBe(true);

      // Verify file has header followed by entry
      const content = readFileSync(result.file, 'utf-8');
      expect(content).toContain('# Coding Conventions');
      expect(content).toContain('## Entries');
      expect(content).toContain('### New Rule');
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

describe('appendSpecEntry - duplicate detection', () => {
  it('returns duplicate=true without modifying file when same title added twice', () => {
    const first = appendSpecEntry(
      testDir,
      'coding',
      'Use semicolons',
      'Always use semicolons.',
      ['style'],
    );
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);

    const contentAfterFirst = readFileSync(first.file, 'utf-8');

    const second = appendSpecEntry(
      testDir,
      'coding',
      'Use semicolons',
      'Duplicate content.',
      ['style'],
    );
    expect(second.ok).toBe(true);
    expect(second.duplicate).toBe(true);

    // File should NOT have been modified
    const contentAfterSecond = readFileSync(second.file, 'utf-8');
    expect(contentAfterSecond).toBe(contentAfterFirst);
  });

  it('detects case-insensitive duplicate titles', () => {
    appendSpecEntry(
      testDir,
      'coding',
      'Use JWT',
      'JWT is standard.',
      ['auth'],
    );

    const result = appendSpecEntry(
      testDir,
      'coding',
      'use jwt',
      'Different content.',
      ['auth'],
    );

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Different categories route to different files
// ---------------------------------------------------------------------------

describe('appendSpecEntry - category routing', () => {
  it('routes arch to architecture-constraints.md', () => {
    const result = appendSpecEntry(
      testDir,
      'arch',
      'No circular deps',
      'Modules must not have circular dependencies.',
      ['module', 'boundary'],
    );

    expect(result.ok).toBe(true);
    expect(result.file).toContain('architecture-constraints.md');
  });

  it('routes coding to coding-conventions.md', () => {
    const result = appendSpecEntry(
      testDir,
      'coding',
      'Use ESM',
      'Always use ESM imports.',
      ['imports'],
    );

    expect(result.ok).toBe(true);
    expect(result.file).toContain('coding-conventions.md');
  });

  it('routes learning to learnings.md', () => {
    const result = appendSpecEntry(
      testDir,
      'learning',
      'Found off-by-one',
      'Array index was wrong.',
      ['bug'],
    );

    expect(result.ok).toBe(true);
    expect(result.file).toContain('learnings.md');
  });

  it('routes debug to debug-notes.md', () => {
    const result = appendSpecEntry(
      testDir,
      'debug',
      'Check logs first',
      'Always check logs.',
      ['logging'],
    );

    expect(result.ok).toBe(true);
    expect(result.file).toContain('debug-notes.md');
  });

  it('routes quality to quality-rules.md', () => {
    const result = appendSpecEntry(
      testDir,
      'quality',
      'Code coverage',
      'Maintain 80% coverage.',
      ['testing'],
    );

    expect(result.ok).toBe(true);
    expect(result.file).toContain('quality-rules.md');
  });

  it('routes different categories to different files', () => {
    const arch = appendSpecEntry(testDir, 'arch', 'Rule A', 'Content A.', ['a']);
    const coding = appendSpecEntry(testDir, 'coding', 'Rule B', 'Content B.', ['b']);

    expect(arch.file).not.toBe(coding.file);
    expect(arch.file).toContain('architecture-constraints.md');
    expect(coding.file).toContain('coding-conventions.md');
  });
});

// ---------------------------------------------------------------------------
// Source attribute
// ---------------------------------------------------------------------------

describe('appendSpecEntry - source attribute', () => {
  it('includes source in the output entry when provided', () => {
    const result = appendSpecEntry(
      testDir,
      'coding',
      'Agent discovery',
      'Found during analysis.',
      ['discovery'],
      'agent',
    );

    expect(result.ok).toBe(true);
    const content = readFileSync(result.file, 'utf-8');
    expect(content).toContain('source="agent"');
  });

  it('omits source when not provided', () => {
    const result = appendSpecEntry(
      testDir,
      'coding',
      'Manual rule',
      'Added by user.',
      ['manual'],
    );

    expect(result.ok).toBe(true);
    const content = readFileSync(result.file, 'utf-8');
    expect(content).not.toContain('source=');
  });
});

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

describe('appendSpecEntry - keywords', () => {
  it('includes provided keywords in the spec-entry tag', () => {
    const result = appendSpecEntry(
      testDir,
      'coding',
      'Token rotation',
      'Rotate tokens regularly.',
      ['auth', 'token', 'security'],
    );

    expect(result.ok).toBe(true);
    const content = readFileSync(result.file, 'utf-8');
    expect(content).toContain('keywords="auth,token,security"');
  });
});

// ---------------------------------------------------------------------------
// Invalid category
// ---------------------------------------------------------------------------

describe('appendSpecEntry - invalid category', () => {
  it('returns ok=false for invalid category', () => {
    const result = appendSpecEntry(
      testDir,
      'nonexistent' as any,
      'Bad entry',
      'Should fail.',
      ['test'],
    );

    expect(result.ok).toBe(false);
    expect(result.file).toBe('');
    expect(result.duplicate).toBe(false);
  });
});
