/**
 * Spec Loader
 *
 * Core loading logic for the spec system. Reads index, filters specs
 * by readMode/category/keyword match, loads MD content, merges by
 * priority, and formats output for CLI or Hook consumption.
 *
 * Data flow:
 *   Keywords -> SpecIndex -> Filter(required + keyword-matched) ->
 *   MDLoader -> PriorityMerger -> OutputFormatter
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { getSpecIndex, type SpecIndex, type SpecIndexEntry, type SpecCategory } from './spec-index-builder.js';
import { extractKeywords, calculateMatchScore } from './spec-keyword-extractor.js';

// ============================================================================
// Types
// ============================================================================

export interface SpecLoadOptions {
  projectPath: string;
  category?: SpecCategory;
  keywords?: string[];
  outputFormat: 'cli' | 'hook';
  stdinData?: { user_prompt?: string; prompt?: string; [key: string]: unknown };
  maxLength?: number;
  truncateOnExceed?: boolean;
}

export interface SpecLoadResult {
  content: string;
  format: 'markdown' | 'json';
  matchedSpecs: string[];
  totalLoaded: number;
  contentLength: {
    original: number;
    final: number;
    maxLength: number;
    truncated: boolean;
    percentage: number;
  };
}

interface LoadedSpec {
  title: string;
  priority: string;
  content: string;
}

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Lightweight Frontmatter Stripper
// ============================================================================

function stripFrontmatter(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) return raw;
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) return raw;
  return trimmed.substring(endIdx + 4).trim();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load specs based on options.
 *
 * Pipeline:
 *   1. Resolve keywords
 *   2. Read index (cache-first)
 *   3. Filter: required specs + optional with keyword match
 *   4. Load MD content (strip frontmatter)
 *   5. Merge by priority
 *   6. Truncate if needed
 *   7. Format for CLI or Hook
 */
export function loadSpecs(options: SpecLoadOptions): SpecLoadResult {
  const { projectPath, outputFormat } = options;
  const maxLength = options.maxLength ?? 8000;
  const truncateOnExceed = options.truncateOnExceed ?? true;

  // Step 1: Resolve keywords
  const keywords = resolveKeywords(options);

  // Step 2: Read index
  const index = getSpecIndex(projectPath);

  // Step 3: Filter specs
  const { required, matched } = filterSpecs(index, keywords, options.category);

  // Step 4: Load content
  const entriesToLoad = [...required, ...matched];
  const loadedSpecs = loadSpecContent(projectPath, entriesToLoad);

  // Step 5: Merge by priority
  const mergedContent = mergeByPriority(loadedSpecs);

  // Step 6: Truncate
  const originalLength = mergedContent.length;
  let finalContent = mergedContent;
  let truncated = false;

  if (originalLength > maxLength && truncateOnExceed) {
    finalContent = truncateContent(mergedContent, maxLength);
    truncated = true;
  }

  // Step 7: Format
  const matchedTitles = loadedSpecs.map(s => s.title);
  const content = formatOutput(finalContent, matchedTitles, outputFormat);
  const percentage = maxLength > 0 ? Math.round((originalLength / maxLength) * 100) : 0;

  return {
    content,
    format: outputFormat === 'cli' ? 'markdown' : 'json',
    matchedSpecs: matchedTitles,
    totalLoaded: loadedSpecs.length,
    contentLength: {
      original: originalLength,
      final: finalContent.length,
      maxLength,
      truncated,
      percentage: Math.min(percentage, 100),
    },
  };
}

// ============================================================================
// Core Functions
// ============================================================================

export function filterSpecs(
  index: SpecIndex,
  keywords: string[],
  category?: SpecCategory
): { required: SpecIndexEntry[]; matched: SpecIndexEntry[] } {
  const required: SpecIndexEntry[] = [];
  const matched: SpecIndexEntry[] = [];

  for (const entry of index.entries) {
    // Category filter: skip if specified and doesn't match (allow 'general' always)
    if (category && entry.category !== category && entry.category !== 'general') {
      continue;
    }

    if (entry.readMode === 'required') {
      required.push(entry);
      continue;
    }

    if (keywords.length > 0 && entry.keywords.length > 0) {
      const score = calculateMatchScore(keywords, entry.keywords);
      if (score > 0) {
        matched.push(entry);
      }
    }
  }

  return { required, matched };
}

export function mergeByPriority(specs: LoadedSpec[]): string {
  if (specs.length === 0) return '';

  const sorted = [...specs].sort((a, b) => {
    const priA = PRIORITY_WEIGHT[a.priority] ?? 0;
    const priB = PRIORITY_WEIGHT[b.priority] ?? 0;
    return priB - priA;
  });

  return sorted
    .map(spec => `## ${spec.title}\n\n${spec.content.trim()}`)
    .join('\n\n---\n\n');
}

// ============================================================================
// Internal Helpers
// ============================================================================

function resolveKeywords(options: SpecLoadOptions): string[] {
  if (options.keywords && options.keywords.length > 0) return options.keywords;
  const prompt = options.stdinData?.user_prompt || options.stdinData?.prompt;
  if (prompt && typeof prompt === 'string') return extractKeywords(prompt);
  return [];
}

function loadSpecContent(projectPath: string, entries: SpecIndexEntry[]): LoadedSpec[] {
  const loaded: LoadedSpec[] = [];

  for (const entry of entries) {
    const filePath = join(projectPath, entry.file);
    if (!existsSync(filePath)) continue;

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const body = stripFrontmatter(raw);
    if (!body.trim()) continue;

    // Strip the top-level `# Title` heading (we add ## title in merge)
    const content = stripLeadingHeading(body);

    // Skip placeholder-only specs with no real content
    if (isPlaceholderOnly(content)) continue;

    loaded.push({
      title: entry.title,
      priority: entry.priority,
      content,
    });
  }

  return loaded;
}

function formatOutput(
  mergedContent: string,
  matchedTitles: string[],
  format: 'cli' | 'hook'
): string {
  if (!mergedContent) {
    if (format === 'hook') return JSON.stringify({ continue: true });
    return '(No matching specs found)';
  }

  if (format === 'cli') {
    return `# Project Specs (${matchedTitles.length} loaded)\n\n${mergedContent}`;
  }

  const wrapped = `<project-specs>\n${mergedContent}\n</project-specs>`;
  return JSON.stringify({ continue: true, systemMessage: wrapped });
}

/**
 * Strip leading `# Title` heading from body since mergeByPriority adds `## title`.
 */
function stripLeadingHeading(body: string): string {
  const lines = body.split('\n');
  let startIdx = 0;
  // Skip leading blank lines
  while (startIdx < lines.length && !lines[startIdx].trim()) startIdx++;
  // If first non-blank line is a `# Heading`, remove it
  if (startIdx < lines.length && /^# [^#]/.test(lines[startIdx])) {
    startIdx++;
    // Also skip blank line immediately after heading
    while (startIdx < lines.length && !lines[startIdx].trim()) startIdx++;
  }
  return lines.slice(startIdx).join('\n').trim();
}

/**
 * Detect if spec content is purely placeholder templates with no real user data.
 * A line is considered placeholder if it contains (detected), (populated by...), etc.
 * or is generic boilerplate from spec-init.
 */
function isPlaceholderOnly(content: string): boolean {
  const lines = content.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('---'));

  if (lines.length === 0) return true;

  // Patterns that indicate placeholder/template content
  const placeholderPatterns = [
    /\(detected\b/i,
    /\(populated\b/i,
    /\(empty\b/i,
    /\(to be\b/i,
    /\(not configured\)/i,
    /^Auto-generated\b/i,
    /^Add entries with:/i,
    /^Each entry follows:/i,
    /^Project-specific\b/i,
    /^Update manually\b/i,
    /^Bugs, gotchas, and lessons/i,
  ];

  // Generic boilerplate from spec-init seed docs (not user-written content)
  const boilerplateExact = new Set([
    'Variables/functions: camelCase',
    'Classes/types: PascalCase',
    'Constants: UPPER_SNAKE_CASE',
    'Files: kebab-case',
    'Style: named imports',
    'Order: built-in, external, internal, relative',
    'Prefer composition over inheritance',
    'Use early returns to reduce nesting',
    'Keep functions under 30 lines when practical',
    'Always handle errors explicitly',
    'Prefer typed errors over generic catch-all',
    'External dependencies require justification',
    'Prefer standard library when available',
    'Pin dependency versions for reproducibility',
    'Module system: ESM',
    'Strict mode: yes',
  ]);

  let realLines = 0;
  for (const line of lines) {
    const stripped = line.replace(/^[-*]\s*/, '');
    if (!stripped) continue;
    const isPlaceholder = placeholderPatterns.some(p => p.test(stripped));
    const isBoilerplate = boilerplateExact.has(stripped);
    if (!isPlaceholder && !isBoilerplate) realLines++;
  }

  return realLines === 0;
}

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  const sections = content.split('\n\n---\n\n');

  while (sections.length > 1) {
    sections.pop();
    const joined = sections.join('\n\n---\n\n');
    if (joined.length <= maxLength) {
      return joined + '\n\n---\n\n[Content truncated due to length limit]';
    }
  }

  const truncated = sections[0]?.substring(0, maxLength - 50) ?? '';
  return truncated + '\n\n[Content truncated due to length limit]';
}
