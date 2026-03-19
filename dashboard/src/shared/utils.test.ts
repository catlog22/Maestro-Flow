import { describe, it, expect } from 'vitest';
import { toForwardSlash } from './utils.js';

describe('toForwardSlash', () => {
  it('converts backslashes to forward slashes', () => {
    expect(toForwardSlash('a\\b\\c')).toBe('a/b/c');
  });

  it('leaves forward slashes unchanged', () => {
    expect(toForwardSlash('a/b/c')).toBe('a/b/c');
  });

  it('handles empty string', () => {
    expect(toForwardSlash('')).toBe('');
  });

  it('handles single segment (no separators)', () => {
    expect(toForwardSlash('file.ts')).toBe('file.ts');
  });

  it('handles Windows absolute paths', () => {
    const result = toForwardSlash('C:\\Users\\dyw\\project');
    expect(result).toContain('/');
    expect(result).not.toContain('\\');
  });
});
