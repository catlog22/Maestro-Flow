// ---------------------------------------------------------------------------
// contentParser — Parse YAML frontmatter and markdown content
// ---------------------------------------------------------------------------

export interface ParsedContent {
  frontmatter: Record<string, unknown>;
  content: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * Supports both --- and --- delimiters
 */
export function parseFrontmatter(markdown: string): ParsedContent {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const [, frontmatterText, content] = match;
  const frontmatter = parseYaml(frontmatterText);

  return { frontmatter, content };
}

/**
 * Simple YAML parser for frontmatter
 * Handles common formats: strings, arrays, key-value pairs
 */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey: string | null = null;
  let isArray = false;
  const currentArray: unknown[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Array item
    if (trimmed.startsWith('- ')) {
      isArray = true;
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // End of array
    if (isArray && !trimmed.startsWith('- ') && currentKey) {
      result[currentKey] = [...currentArray];
      currentArray.length = 0;
      isArray = false;
      currentKey = null;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      if (currentKey && !isArray) {
        // Previous key didn't have value, set to empty
        result[currentKey] = '';
      }

      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value && !value.startsWith('#')) {
        // Remove quotes if present
        const cleanedValue = value.replace(/^["']|["']$/g, '');
        result[currentKey] = cleanedValue;
      }
    }
  }

  // Handle last array
  if (isArray && currentKey) {
    result[currentKey] = [...currentArray];
  }

  return result;
}

/**
 * Extract XML-style tags from content (e.g., <purpose>, <context>, etc.)
 */
export function extractXmlTags(content: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(content)) !== null) {
    tags[match[1]] = match[2].trim();
  }

  return tags;
}

/**
 * Extract specific sections from content by heading
 */
export function extractSection(content: string, heading: string): string | null {
  const headingRegex = new RegExp(`^#{1,6}\\s+${heading}\\s*$`, 'im');
  const match = content.match(headingRegex);

  if (!match) {
    return null;
  }

  const startIndex = match.index!;
  const afterHeading = content.slice(startIndex + match[0].length);

  // Find the next heading at same or higher level
  const nextHeadingRegex = /\n#{1,6}\s+/;
  const nextHeadingMatch = afterHeading.match(nextHeadingRegex);

  if (nextHeadingMatch) {
    return afterHeading.slice(0, nextHeadingMatch.index).trim();
  }

  return afterHeading.trim();
}

/**
 * Convert markdown content to plain text (strip markdown formatting)
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/`(.+?)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/\n+/g, ' ') // Replace newlines with space
    .trim();
}
