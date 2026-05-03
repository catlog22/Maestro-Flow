/**
 * Spec Writer
 *
 * Append new spec entries to the appropriate category file.
 * Uses spec-entry-parser for formatting and spec-loader for directory resolution.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatNewEntry } from './spec-entry-parser.js';
import { resolveSpecDir, CATEGORY_MAP, type SpecCategory, type SpecScope } from './spec-loader.js';

// ============================================================================
// Types
// ============================================================================

export interface SpecAddResult {
  ok: boolean;
  file: string;
  category: SpecCategory;
  title: string;
  duplicate: boolean;
}

// ============================================================================
// Reverse lookup: category -> filename
// ============================================================================

function categoryToFilename(category: SpecCategory): string | undefined {
  for (const [filename, cat] of Object.entries(CATEGORY_MAP)) {
    if (cat === category) return filename;
  }
  return undefined;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Append a new spec entry to the appropriate file for the given category.
 *
 * - Resolves target directory via scope
 * - Creates directory and file if missing
 * - Skips duplicates (case-insensitive title match)
 * - Formats entry using `formatNewEntry` and appends to file
 */
export function appendSpecEntry(
  projectPath: string,
  category: SpecCategory,
  title: string,
  content: string,
  keywords: string[],
  source?: string,
  scope?: SpecScope,
  uid?: string,
): SpecAddResult {
  const specsDir = resolveSpecDir(projectPath, scope ?? 'project', uid);

  const filename = categoryToFilename(category);
  if (!filename) {
    return { ok: false, file: '', category, title, duplicate: false };
  }

  // Ensure directory exists
  if (!existsSync(specsDir)) {
    mkdirSync(specsDir, { recursive: true });
  }

  const filePath = join(specsDir, filename);

  // Create file with header if it doesn't exist
  if (!existsSync(filePath)) {
    const headerTitle = filename.replace('.md', '').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    writeFileSync(filePath, `# ${headerTitle}\n\n## Entries\n\n`, 'utf-8');
  }

  // Read current content
  const existing = readFileSync(filePath, 'utf-8');

  // Simple duplicate check: case-insensitive title match
  if (existing.toLowerCase().includes(title.toLowerCase())) {
    return { ok: true, file: filePath, category, title, duplicate: true };
  }

  // Generate and append entry
  const date = new Date().toISOString().slice(0, 10);
  const entry = formatNewEntry(category, keywords, date, title, content, source);
  writeFileSync(filePath, existing + '\n\n' + entry, 'utf-8');

  return { ok: true, file: filePath, category, title, duplicate: false };
}
