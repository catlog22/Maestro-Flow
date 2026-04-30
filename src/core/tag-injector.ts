// ---------------------------------------------------------------------------
// Tag Injector — injects/updates/removes content in doc files using
// HTML comment markers with section attributes for non-destructive,
// idempotent, multi-section installation.
//
// Marker format:
//   <!-- maestro:start section="core" -->
//   ...injected content...
//   <!-- maestro:end section="core" -->
//
//   <!-- maestro:start section="chinese" -->
//   ...chinese response content...
//   <!-- maestro:end section="chinese" -->
// ---------------------------------------------------------------------------

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  addFile,
  addDir,
  type Manifest,
} from './manifest.js';

/** Default section name when none specified (backward compat). */
export const DEFAULT_SECTION = 'core';

export function markerStart(section: string): string {
  return `<!-- maestro:start section="${section}" -->`;
}

export function markerEnd(section: string): string {
  return `<!-- maestro:end section="${section}" -->`;
}

function startRe(section: string): RegExp {
  return new RegExp(`^<!-- maestro:start section="${escapeRe(section)}" -->$`, 'm');
}

function endRe(section: string): RegExp {
  return new RegExp(`^<!-- maestro:end section="${escapeRe(section)}" -->$`, 'm');
}

/** Match any maestro section marker (for generic detection). */
const ANY_START_RE = /^<!-- maestro:start section="[^"]*" -->$/m;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect whether the text contains markers for a specific section.
 */
export function hasSection(text: string, section: string): boolean {
  return startRe(section).test(text) && endRe(section).test(text);
}

/**
 * Detect whether the text contains any maestro markers at all.
 */
export function hasAnyMarkers(text: string): boolean {
  return ANY_START_RE.test(text);
}

// ---------------------------------------------------------------------------
// Legacy migration — similarity detection
// ---------------------------------------------------------------------------

/** Normalize text for comparison: trim lines, collapse blanks, lowercase. */
function normalizeForCompare(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.toLowerCase());
}

/**
 * Compute bidirectional line-level similarity (Jaccard-like).
 * Returns 0..1 where 1 = existing and source have identical line sets.
 * Uses intersection / union to avoid false positives when one is a superset.
 */
export function computeSimilarity(existing: string, source: string): number {
  const existingLines = normalizeForCompare(existing);
  const sourceLines = normalizeForCompare(source);
  if (sourceLines.length === 0 && existingLines.length === 0) return 1;
  if (sourceLines.length === 0 || existingLines.length === 0) return 0;

  const existingSet = new Set(existingLines);
  const sourceSet = new Set(sourceLines);
  const intersection = sourceLines.filter(l => existingSet.has(l)).length;
  const union = new Set([...existingLines, ...sourceLines]).size;

  return intersection / union;
}

export type MigrateAction = 'created' | 'updated' | 'migrated' | 'injected';

export interface MigrateResult {
  /** What action was taken */
  action: MigrateAction;
  /** Final file content */
  content: string;
  /** Warning message for user (legacy content needs manual cleanup) */
  warning?: string;
}

/**
 * Migrate legacy or update existing doc file content with section-based tag injection.
 *
 * Handles scenarios:
 * 1. No existing file        → create with markers (`created`)
 * 2. Has this section        → replace between markers (`updated`)
 * 3. Legacy ≥99% similar (core section only, no markers at all) → replace entire content (`migrated`)
 * 4. Legacy ≥80% similar (core section only) → inject + warn (`injected` + warning)
 * 5. Otherwise               → append markers normally (`injected`)
 */
export function migrateAndInject(
  existingContent: string,
  sourceContent: string,
  targetPath: string,
  section: string = DEFAULT_SECTION,
): MigrateResult {
  const trimmedSource = sourceContent.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const block = `${markerStart(section)}\n${trimmedSource}\n${markerEnd(section)}`;

  // Case 1: no existing file
  if (!existingContent || existingContent.trim() === '') {
    return { action: 'created', content: block + '\n' };
  }

  const text = existingContent.replace(/\r\n/g, '\n');

  // Case 2: already has this section — just update
  if (hasSection(text, section)) {
    return { action: 'updated', content: injectContent(text, sourceContent, section) };
  }

  // If file already has other maestro sections, just append this new section
  if (hasAnyMarkers(text)) {
    const normalized = text.replace(/\n+$/, '');
    return { action: 'injected', content: normalized + '\n\n' + block + '\n' };
  }

  // Case 3-5: legacy file without any markers — check similarity (only for core section)
  if (section === DEFAULT_SECTION) {
    // Exact content match → safe to wrap entirely in markers
    const normExisting = normalizeForCompare(text);
    const normSource = normalizeForCompare(sourceContent);
    const isExactMatch = normExisting.length === normSource.length &&
      normExisting.every((line, i) => line === normSource[i]);

    if (isExactMatch) {
      return { action: 'migrated', content: block + '\n' };
    }

    // Check how much of the source is present in existing (one-directional)
    const existingSet = new Set(normExisting);
    const matched = normSource.filter(l => existingSet.has(l)).length;
    const forwardSimilarity = normSource.length > 0 ? matched / normSource.length : 0;

    if (forwardSimilarity >= 0.8) {
      const normalized = text.replace(/\n+$/, '');
      return {
        action: 'injected',
        content: normalized + '\n\n' + block + '\n',
        warning:
          `${targetPath}: legacy maestro content detected (${Math.round(forwardSimilarity * 100)}% match). ` +
          `New content injected with markers. Please manually remove the old untagged content above the ${markerStart(section)} marker.`,
      };
    }
  }

  // Case 5: just append
  const normalized = text.replace(/\n+$/, '');
  return { action: 'injected', content: normalized + '\n\n' + block + '\n' };
}

/**
 * Inject or update content for a specific section.
 *
 * - If section markers exist, replaces everything between them.
 * - If no section markers, appends section block at the end.
 * - If the file is empty/missing, creates with section block.
 *
 * Returns the updated text.
 */
export function injectContent(
  existingContent: string,
  content: string,
  section: string = DEFAULT_SECTION,
): string {
  const trimmedContent = content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  const block = `${markerStart(section)}\n${trimmedContent}\n${markerEnd(section)}`;

  if (!existingContent || existingContent.trim() === '') {
    return block + '\n';
  }

  const text = existingContent.replace(/\r\n/g, '\n');

  if (hasSection(text, section)) {
    const start = markerStart(section);
    const end = markerEnd(section);
    const startIdx = text.indexOf(start);
    const endIdx = text.indexOf(end);
    if (startIdx === -1 || endIdx === -1) {
      return text + '\n\n' + block + '\n';
    }
    const before = text.slice(0, startIdx);
    const after = text.slice(endIdx + end.length);
    return before + block + after;
  }

  // No section markers — append with a blank line separator
  const normalized = text.replace(/\n+$/, '');
  return normalized + '\n\n' + block + '\n';
}

/**
 * Remove a specific section's markers and content.
 * Returns the cleaned text, or the original text if section not found.
 */
export function removeContent(text: string, section: string = DEFAULT_SECTION): string {
  if (!hasSection(text, section)) return text;

  const normalized = text.replace(/\r\n/g, '\n');
  const start = markerStart(section);
  const end = markerEnd(section);
  const startIdx = normalized.indexOf(start);
  const endIdx = normalized.indexOf(end);
  if (startIdx === -1 || endIdx === -1) return text;

  const before = normalized.slice(0, startIdx);
  const after = normalized.slice(endIdx + end.length);

  // Clean up extra blank lines at the junction
  const result = (before.replace(/\n+$/, '') + after.replace(/^\n+/, '\n')).replace(/\n+$/, '');
  return result ? result + '\n' : '';
}

/**
 * Remove ALL maestro sections from text.
 * Also cleans up any orphaned markers (start without matching end).
 */
export function removeAllSections(text: string): string {
  const sectionRe = /<!-- maestro:start section="([^"]*)" -->/g;
  let result = text;
  let match: RegExpExecArray | null;

  // Collect all section names
  const sections: string[] = [];
  while ((match = sectionRe.exec(text)) !== null) {
    sections.push(match[1]);
  }

  // Remove each complete section
  for (const s of sections) {
    result = removeContent(result, s);
  }

  // Clean up orphaned start markers (no matching end)
  result = result.replace(/^<!-- maestro:start section="[^"]*" -->\n?/gm, '');

  return result;
}

// ---------------------------------------------------------------------------
// File I/O — injectDocFile (shared between CLI and Dashboard)
// ---------------------------------------------------------------------------

export interface CopyStats {
  files: number;
  dirs: number;
  skipped: number;
}

/**
 * Inject source content into a target doc file using sectioned markers.
 * Handles legacy migration with similarity detection.
 *
 * Returns migration result with optional warning.
 */
export function injectDocFile(
  src: string,
  dest: string,
  stats: CopyStats,
  manifest: Manifest,
  section?: string,
): MigrateResult {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
    stats.dirs++;
    addDir(manifest, destDir);
  }

  const sourceContent = readFileSync(src, 'utf-8');
  const existingContent = existsSync(dest) ? readFileSync(dest, 'utf-8') : '';
  const result = migrateAndInject(existingContent, sourceContent, dest, section);

  writeFileSync(dest, result.content, 'utf-8');
  stats.files++;
  addFile(manifest, dest);
  return result;
}
