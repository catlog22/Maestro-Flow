import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  keywordMatches,
  calculateMatchScore,
  STOP_WORDS,
} from './spec-keyword-extractor.js';

describe('STOP_WORDS', () => {
  it('contains common English stop words', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('is')).toBe(true);
    expect(STOP_WORDS.has('and')).toBe(true);
  });

  it('does not contain technical terms', () => {
    expect(STOP_WORDS.has('api')).toBe(false);
    expect(STOP_WORDS.has('database')).toBe(false);
  });
});

describe('extractKeywords', () => {
  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('returns empty array for null-ish input', () => {
    expect(extractKeywords(null as unknown as string)).toEqual([]);
    expect(extractKeywords(undefined as unknown as string)).toEqual([]);
  });

  it('extracts English words and lowercases them', () => {
    const keywords = extractKeywords('User Authentication Module');
    expect(keywords).toContain('user');
    expect(keywords).toContain('authentication');
    expect(keywords).toContain('module');
  });

  it('removes stop words', () => {
    const keywords = extractKeywords('The user is in the system');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('in');
    expect(keywords).toContain('user');
    expect(keywords).toContain('system');
  });

  it('filters out single characters', () => {
    const keywords = extractKeywords('a b c hello');
    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('b');
    expect(keywords).not.toContain('c');
  });

  it('filters out pure numbers', () => {
    const keywords = extractKeywords('version 123 release');
    expect(keywords).not.toContain('123');
    expect(keywords).toContain('version');
    expect(keywords).toContain('release');
  });

  it('extracts CJK characters as segments', () => {
    const keywords = extractKeywords('用户认证模块');
    expect(keywords).toContain('用户认证模块');
  });

  it('generates CJK bigrams for segments > 2 chars', () => {
    const keywords = extractKeywords('用户认证');
    expect(keywords).toContain('用户认证');
    expect(keywords).toContain('用户');
    expect(keywords).toContain('户认');
    expect(keywords).toContain('认证');
  });

  it('handles mixed English and CJK', () => {
    const keywords = extractKeywords('API 用户认证 module');
    expect(keywords).toContain('api');
    expect(keywords).toContain('module');
    expect(keywords).toContain('用户认证');
  });

  it('returns unique keywords', () => {
    const keywords = extractKeywords('test test test');
    const unique = new Set(keywords);
    expect(keywords.length).toBe(unique.size);
  });
});

describe('keywordMatches', () => {
  it('matches exact (case insensitive)', () => {
    expect(keywordMatches('auth', ['Auth', 'Login'])).toBe(true);
  });

  it('matches when keyword contains target', () => {
    expect(keywordMatches('authentication', ['auth'])).toBe(true);
  });

  it('matches when target contains keyword', () => {
    expect(keywordMatches('auth', ['authentication'])).toBe(true);
  });

  it('returns false when no match', () => {
    expect(keywordMatches('database', ['auth', 'login'])).toBe(false);
  });
});

describe('calculateMatchScore', () => {
  it('returns 0 for empty extracted list', () => {
    expect(calculateMatchScore([], ['auth'])).toBe(0);
  });

  it('returns 0 for empty spec keywords', () => {
    expect(calculateMatchScore(['auth'], [])).toBe(0);
  });

  it('counts matching keywords', () => {
    expect(calculateMatchScore(
      ['auth', 'login', 'database'],
      ['authentication', 'user'],
    )).toBe(1); // 'auth' matches 'authentication'
  });

  it('returns correct score for full matches', () => {
    expect(calculateMatchScore(
      ['auth', 'login'],
      ['auth', 'login'],
    )).toBe(2);
  });
});
