/**
 * Spec Keyword Extractor
 *
 * Extracts keywords from user prompt text for matching against
 * spec document YAML frontmatter keywords.
 *
 * Supports English word tokenization and CJK character extraction.
 */

export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into',
  'about', 'between', 'through', 'after', 'before', 'above', 'below',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while', 'so', 'because',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'may', 'might', 'can', 'could', 'must',
  'get', 'got', 'make', 'made', 'let', 'go', 'going', 'come', 'take', 'give',
  'not', 'no', 'yes', 'also', 'just', 'only', 'very', 'too', 'now', 'here',
  'there', 'how', 'why', 'where', 'all', 'each', 'every', 'both', 'some',
  'any', 'most', 'more', 'less', 'much', 'many', 'few', 'other', 'such',
  'please', 'need', 'want', 'like', 'know', 'think', 'see', 'use', 'using',
  'way', 'thing', 'something', 'anything', 'nothing',
]);

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const CJK_SEGMENT_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g;
const WORD_SPLIT_REGEX = /[\s,;:!?.()\[\]{}<>"'`~@#$%^&*+=|\\/_\-\u3001\u3002\uff0c\uff1b\uff1a\uff01\uff1f]+/;

/**
 * Extract keywords from prompt text.
 * English: tokenize, lowercase, remove stop words.
 * CJK: extract contiguous segments + 2-char bigrams.
 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const keywords = new Set<string>();

  // English keywords
  const cleaned = text.replace(CJK_SEGMENT_REGEX, ' ');
  const tokens = cleaned
    .split(WORD_SPLIT_REGEX)
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
  for (const t of tokens) keywords.add(t);

  // CJK keywords
  if (CJK_REGEX.test(text)) {
    const segments = text.match(CJK_SEGMENT_REGEX);
    if (segments) {
      for (const seg of segments) {
        keywords.add(seg);
        if (seg.length > 2) {
          for (let i = 0; i <= seg.length - 2; i++) {
            keywords.add(seg.substring(i, i + 2));
          }
        }
      }
    }
  }

  return Array.from(keywords);
}

/**
 * Check if a keyword matches any entry in a keyword list.
 */
export function keywordMatches(keyword: string, targets: string[]): boolean {
  const lower = keyword.toLowerCase();
  return targets.some(t => {
    const lt = t.toLowerCase();
    return lower === lt || lt.includes(lower) || lower.includes(lt);
  });
}

/**
 * Calculate match score between extracted and spec keywords.
 */
export function calculateMatchScore(extracted: string[], specKeywords: string[]): number {
  if (!extracted.length || !specKeywords.length) return 0;
  let score = 0;
  for (const kw of extracted) {
    if (keywordMatches(kw, specKeywords)) score++;
  }
  return score;
}
