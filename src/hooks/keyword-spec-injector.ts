/**
 * Keyword Spec Injector — UserPromptSubmit hook
 *
 * Scans user prompt for keywords, matches against <spec-entry> keyword attributes,
 * injects matching entries as additionalContext. Session dedup prevents re-injection.
 */

import { buildKeywordIndex, lookupKeywords, type IndexedEntry } from '../tools/spec-keyword-index.js';
import { readSpecBridge, markInjected, filterUnjected } from './spec-bridge.js';

// ============================================================================
// Types
// ============================================================================

export interface KeywordInjectionResult {
  inject: boolean;
  content?: string;
  matchedKeywords?: string[];
  matchedEntries?: number;
}

// ============================================================================
// Config
// ============================================================================

const MIN_KEYWORD_LENGTH = 3;

/** Common words to skip when tokenizing prompt */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
  'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say',
  'she', 'too', 'use', 'this', 'that', 'with', 'have', 'from', 'they',
  'been', 'said', 'each', 'make', 'like', 'just', 'over', 'such', 'take',
  'than', 'them', 'very', 'when', 'what', 'some', 'time', 'will', 'into',
  'look', 'only', 'come', 'also', 'back', 'after', 'work', 'first', 'well',
  'then', 'year', 'your', 'them', 'would', 'there', 'their', 'which',
  'about', 'could', 'other', 'these', 'think', 'should', 'please',
  // code-related common words to skip
  'file', 'code', 'function', 'class', 'import', 'export', 'const', 'return',
  'true', 'false', 'null', 'undefined', 'string', 'number', 'type', 'interface',
]);

/** Max entries to inject per prompt to avoid context bloat */
const MAX_ENTRIES_PER_INJECTION = 5;

// ============================================================================
// Public API
// ============================================================================

/**
 * Evaluate whether to inject keyword-matched spec entries for a user prompt.
 *
 * @param prompt      The user's prompt text
 * @param projectPath Working directory for spec file resolution
 * @param sessionId   Session ID for dedup bridge
 */
export function evaluateKeywordInjection(
  prompt: string,
  projectPath: string,
  sessionId: string,
): KeywordInjectionResult {
  // 1. Tokenize prompt into candidate keywords
  const promptKeywords = tokenizePrompt(prompt);
  if (promptKeywords.length === 0) return { inject: false };

  // 2. Build keyword index from spec files
  const index = buildKeywordIndex(projectPath);
  if (index.size === 0) return { inject: false };

  // 3. Look up matching entries
  const matchedAll = lookupKeywords(index, promptKeywords);
  if (matchedAll.length === 0) return { inject: false };

  // 4. Filter out already-injected entries (session dedup)
  const unjected = filterUnjected(sessionId, matchedAll);
  if (unjected.length === 0) return { inject: false };

  // 5. Limit to avoid context bloat
  const toInject = unjected.slice(0, MAX_ENTRIES_PER_INJECTION);

  // 6. Build injection content
  const content = formatInjectionContent(toInject);

  // 7. Mark as injected
  const injectedKeywords = [...new Set(toInject.flatMap(e => e.keywords))];
  const injectedIds = toInject.map(e => e.id);
  markInjected(sessionId, injectedKeywords, injectedIds);

  // 8. Determine which prompt keywords actually matched
  const matchedKws = promptKeywords.filter(kw => index.has(kw));

  return {
    inject: true,
    content,
    matchedKeywords: matchedKws,
    matchedEntries: toInject.length,
  };
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Tokenize prompt into candidate keywords for index lookup.
 * Lowercase, deduplicate, filter by length and stop words.
 */
function tokenizePrompt(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff_-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w));

  return [...new Set(words)];
}

/**
 * Format matched entries for injection as context.
 */
function formatInjectionContent(entries: IndexedEntry[]): string {
  const sections = entries.map(e =>
    `--- ${e.file} (${e.category}) [${e.keywords.join(', ')}] ---\n\n${e.content}`,
  );

  return `<spec-keyword-match count="${entries.length}">\n\n${sections.join('\n\n---\n\n')}\n\n</spec-keyword-match>`;
}
