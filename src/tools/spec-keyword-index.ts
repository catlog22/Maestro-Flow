/**
 * Spec Keyword Index
 *
 * Builds an inverted index from keyword → spec entries.
 * Scans all `.workflow/specs/*.md` files, parses <spec-entry> tags,
 * and indexes by keyword for fast lookup.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpecEntries, type SpecEntryParsed } from './spec-entry-parser.js';
import { CATEGORY_MAP } from './spec-loader.js';

// ============================================================================
// Types
// ============================================================================

export interface IndexedEntry {
  file: string;
  category: string;
  keywords: string[];
  content: string;
  title: string;
  id: string;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build a keyword → entries inverted index from all spec files.
 * Each keyword maps to an array of matching entries.
 */
export function buildKeywordIndex(projectPath: string): Map<string, IndexedEntry[]> {
  const index = new Map<string, IndexedEntry[]>();
  const specsDir = join(projectPath, '.workflow', 'specs');

  if (!existsSync(specsDir)) return index;

  let files: string[];
  try {
    files = readdirSync(specsDir).filter(f => f.endsWith('.md'));
  } catch {
    return index;
  }

  for (const file of files) {
    const filePath = join(specsDir, file);
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const body = stripFrontmatter(raw);
    const { entries } = parseSpecEntries(body);
    const fileCategory = CATEGORY_MAP[file] ?? 'learning';

    for (const entry of entries) {
      const indexed: IndexedEntry = {
        file,
        category: entry.category || fileCategory,
        keywords: entry.keywords,
        content: entry.content,
        title: entry.title,
        id: `${file}:${entry.lineStart}`,
      };

      for (const kw of entry.keywords) {
        const list = index.get(kw);
        if (list) {
          list.push(indexed);
        } else {
          index.set(kw, [indexed]);
        }
      }
    }
  }

  return index;
}

/**
 * Look up entries matching a keyword.
 */
export function lookupKeyword(index: Map<string, IndexedEntry[]>, keyword: string): IndexedEntry[] {
  return index.get(keyword.toLowerCase()) ?? [];
}

/**
 * Look up entries matching any of the given keywords.
 * Returns deduplicated entries (by id).
 */
export function lookupKeywords(index: Map<string, IndexedEntry[]>, keywords: string[]): IndexedEntry[] {
  const seen = new Set<string>();
  const results: IndexedEntry[] = [];

  for (const kw of keywords) {
    const entries = index.get(kw.toLowerCase()) ?? [];
    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        results.push(entry);
      }
    }
  }

  return results;
}

// ============================================================================
// Internal
// ============================================================================

function stripFrontmatter(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return raw;
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) return raw;
  return trimmed.substring(endIdx + 4).trim();
}
