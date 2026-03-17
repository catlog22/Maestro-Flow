/**
 * Specs Routes -- CRUD API for spec entries in .workflow/specs/*.md files.
 *
 * Each .md file has YAML frontmatter (title, readMode, priority, category, keywords)
 * and contains entries as heading-delimited sections within the markdown body.
 *
 * Entry format in .md files:
 *   ### [YYYY-MM-DD] type: Title text
 *   Content paragraph(s)...
 *
 * Follows the Hono factory pattern used by issues.ts and mcp.ts.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpecEntry {
  id: string;
  type: 'bug' | 'pattern' | 'decision' | 'rule' | 'general';
  title: string;
  content: string;
  file: string;
  timestamp: string;
}

interface SpecFileMeta {
  name: string;
  path: string;
  title: string;
  category: string;
  entryCount: number;
}

// ---------------------------------------------------------------------------
// Entry type detection
// ---------------------------------------------------------------------------

const ENTRY_TYPES = ['bug', 'pattern', 'decision', 'rule'] as const;
type EntryType = typeof ENTRY_TYPES[number];

/** Map file basenames to default entry types when heading lacks a marker. */
const FILE_TYPE_MAP: Record<string, EntryType> = {
  'learnings': 'bug',
  'coding-conventions': 'pattern',
  'architecture-constraints': 'rule',
  'quality-rules': 'rule',
};

/** Detect entry type from heading text or fall back to file-based default. */
function detectEntryType(heading: string, fileName: string): SpecEntry['type'] {
  const lower = heading.toLowerCase();
  for (const t of ENTRY_TYPES) {
    if (lower.includes(`[${t}]`) || lower.includes(`${t}:`)) return t;
  }
  const stem = basename(fileName, extname(fileName));
  return FILE_TYPE_MAP[stem] ?? 'general';
}

// ---------------------------------------------------------------------------
// Frontmatter parser (lightweight, matches spec-index-builder.ts)
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw };
  }
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { data: {}, content: raw };
  }
  const yamlBlock = trimmed.substring(3, endIdx).trim();
  const content = trimmed.substring(endIdx + 4);
  const data: Record<string, unknown> = {};

  let currentKey = '';
  let arrayItems: string[] | null = null;

  for (const line of yamlBlock.split('\n')) {
    const trimLine = line.trim();
    if (trimLine.startsWith('- ') && arrayItems !== null) {
      arrayItems.push(trimLine.substring(2).trim());
      continue;
    }
    if (arrayItems !== null && currentKey) {
      data[currentKey] = arrayItems;
      arrayItems = null;
    }
    const colonIdx = trimLine.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimLine.substring(0, colonIdx).trim();
    const value = trimLine.substring(colonIdx + 1).trim();
    currentKey = key;
    if (value === '' || value === '[]') {
      arrayItems = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(s => s.length > 0);
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  if (arrayItems !== null && currentKey) {
    data[currentKey] = arrayItems;
  }
  return { data, content };
}

// ---------------------------------------------------------------------------
// Markdown entry parser
// ---------------------------------------------------------------------------

/** Heading regex: matches ## or ### at start of line. */
const HEADING_RE = /^(#{2,3})\s+(.+)$/;

/**
 * Parse markdown body into heading-delimited sections.
 * Each section becomes one SpecEntry.
 */
function parseEntries(body: string, fileName: string): SpecEntry[] {
  const lines = body.split('\n');
  const sections: { heading: string; level: number; bodyLines: string[] }[] = [];
  let current: { heading: string; level: number; bodyLines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[2].trim(), level: m[1].length, bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) sections.push(current);

  const stem = basename(fileName, extname(fileName));
  const entries: SpecEntry[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const content = sec.bodyLines.join('\n').trim();
    // Skip purely structural headings with no content (e.g. "# Learnings", "## Format")
    if (!content) continue;

    const type = detectEntryType(sec.heading, fileName);
    const id = `${stem}-${String(i + 1).padStart(3, '0')}`;

    // Try to extract date from heading: ### [2025-01-15] ...
    const dateMatch = sec.heading.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    const timestamp = dateMatch ? dateMatch[1] : '';

    entries.push({ id, type, title: sec.heading, content, file: fileName, timestamp });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

async function getSpecsDir(workflowRoot: string): Promise<string> {
  return join(workflowRoot, 'specs');
}

async function listSpecFiles(specsDir: string): Promise<string[]> {
  try {
    const names = await readdir(specsDir);
    return names.filter(n => extname(n).toLowerCase() === '.md');
  } catch {
    return [];
  }
}

async function readSpecFile(specsDir: string, fileName: string): Promise<string> {
  return readFile(join(specsDir, fileName), 'utf-8');
}

async function writeSpecFile(specsDir: string, fileName: string, content: string): Promise<void> {
  await mkdir(specsDir, { recursive: true });
  await writeFile(join(specsDir, fileName), content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Write lock (same pattern as issues.ts)
// ---------------------------------------------------------------------------

let writeLock: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let resolve!: () => void;
  writeLock = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(resolve);
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

/**
 * Specs routes following the Hono factory pattern.
 *
 * GET    /api/specs           - list all spec entries across all .md files
 * GET    /api/specs/files     - list spec files with metadata
 * GET    /api/specs/file/:name - read a specific spec file content + entries
 * POST   /api/specs           - add a new entry to a spec file
 * DELETE /api/specs/:id       - remove an entry by ID
 */
export function createSpecsRoutes(workflowRoot: string): Hono {
  const app = new Hono();

  // -------------------------------------------------------------------------
  // GET /api/specs — list all entries across all spec files
  // -------------------------------------------------------------------------

  app.get('/api/specs', async (c) => {
    try {
      const specsDir = await getSpecsDir(workflowRoot);
      const files = await listSpecFiles(specsDir);
      const allEntries: SpecEntry[] = [];

      for (const fileName of files) {
        const raw = await readSpecFile(specsDir, fileName);
        const { content } = parseFrontmatter(raw);
        const entries = parseEntries(content, fileName);
        allEntries.push(...entries);
      }

      return c.json({ entries: allEntries });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/specs/files — list spec files with metadata
  // -------------------------------------------------------------------------

  app.get('/api/specs/files', async (c) => {
    try {
      const specsDir = await getSpecsDir(workflowRoot);
      const fileNames = await listSpecFiles(specsDir);
      const files: SpecFileMeta[] = [];

      for (const fileName of fileNames) {
        const raw = await readSpecFile(specsDir, fileName);
        const { data, content } = parseFrontmatter(raw);
        const entries = parseEntries(content, fileName);
        files.push({
          name: fileName,
          path: `specs/${fileName}`,
          title: typeof data.title === 'string' ? data.title : basename(fileName, extname(fileName)),
          category: typeof data.category === 'string' ? data.category : 'general',
          entryCount: entries.length,
        });
      }

      return c.json({ files });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/specs/file/:name — read a specific spec file
  // -------------------------------------------------------------------------

  app.get('/api/specs/file/:name', async (c) => {
    try {
      const name = c.req.param('name');
      // Sanitize: only allow alphanumeric, hyphens, underscores + .md
      if (!/^[\w-]+\.md$/i.test(name)) {
        return c.json({ error: 'Invalid file name' }, 400);
      }

      const specsDir = await getSpecsDir(workflowRoot);
      let raw: string;
      try {
        raw = await readSpecFile(specsDir, name);
      } catch {
        return c.json({ error: `File not found: ${name}` }, 404);
      }

      const { content } = parseFrontmatter(raw);
      const entries = parseEntries(content, name);

      return c.json({ name, content: raw, entries });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/specs — add a new entry
  // -------------------------------------------------------------------------

  app.post('/api/specs', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const { type, content, file } = body;

      if (typeof content !== 'string' || !content.trim()) {
        return c.json({ error: 'content is required' }, 400);
      }
      if (typeof file !== 'string' || !file.trim()) {
        return c.json({ error: 'file is required' }, 400);
      }
      // Sanitize filename
      const fileName = file.endsWith('.md') ? file : `${file}.md`;
      if (!/^[\w-]+\.md$/i.test(fileName)) {
        return c.json({ error: 'Invalid file name' }, 400);
      }

      const entryType = typeof type === 'string' && ENTRY_TYPES.includes(type as EntryType) ? type : 'general';
      const date = new Date().toISOString().slice(0, 10);
      const firstLine = content.trim().split('\n')[0].substring(0, 80);
      const heading = `### [${date}] ${entryType}: ${firstLine}`;
      const entryBlock = `\n${heading}\n\n${content.trim()}\n`;

      let newId = '';

      await withWriteLock(async () => {
        const specsDir = await getSpecsDir(workflowRoot);
        let existing = '';
        try {
          existing = await readSpecFile(specsDir, fileName);
        } catch {
          // File does not exist -- create with minimal frontmatter
          const stem = basename(fileName, extname(fileName));
          existing = `---\ntitle: "${stem}"\nreadMode: optional\npriority: medium\ncategory: general\nkeywords: []\n---\n\n# ${stem}\n`;
        }

        const updated = existing.trimEnd() + '\n' + entryBlock;
        await writeSpecFile(specsDir, fileName, updated);

        // Parse to get the new entry ID
        const { content: body } = parseFrontmatter(updated);
        const entries = parseEntries(body, fileName);
        if (entries.length > 0) {
          newId = entries[entries.length - 1].id;
        }
      });

      return c.json({ success: true, id: newId }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/specs/:id — remove an entry by ID
  // -------------------------------------------------------------------------

  app.delete('/api/specs/:id', async (c) => {
    try {
      const targetId = c.req.param('id');
      // ID format: <stem>-<nnn>  e.g. "learnings-003"
      const dashIdx = targetId.lastIndexOf('-');
      if (dashIdx === -1) {
        return c.json({ error: `Invalid entry ID format: ${targetId}` }, 400);
      }
      const stem = targetId.substring(0, dashIdx);
      if (!/^[\w-]+$/i.test(stem)) {
        return c.json({ error: 'Invalid entry ID format' }, 400);
      }
      const fileName = `${stem}.md`;

      let found = false;

      await withWriteLock(async () => {
        const specsDir = await getSpecsDir(workflowRoot);
        let raw: string;
        try {
          raw = await readSpecFile(specsDir, fileName);
        } catch {
          return;
        }

        const { content: body } = parseFrontmatter(raw);
        const entries = parseEntries(body, fileName);
        const target = entries.find(e => e.id === targetId);
        if (!target) return;

        found = true;

        // Remove the section from the raw file content.
        // Rebuild: find heading in raw content, remove heading + body until next heading.
        const rawLines = raw.split('\n');
        const headingLine = `### ${target.title}`;
        // Also try ## prefix
        const headingLine2 = `## ${target.title}`;

        let startLine = -1;
        for (let i = 0; i < rawLines.length; i++) {
          const trimmed = rawLines[i].trim();
          if (trimmed === headingLine || trimmed === headingLine2) {
            startLine = i;
            break;
          }
        }

        if (startLine === -1) {
          // Fallback: match by partial heading content
          for (let i = 0; i < rawLines.length; i++) {
            const trimmed = rawLines[i].trim();
            if (HEADING_RE.test(trimmed) && trimmed.includes(target.title)) {
              startLine = i;
              break;
            }
          }
        }

        if (startLine === -1) return;

        // Find end: next heading of same or higher level, or EOF
        let endLine = rawLines.length;
        const startMatch = rawLines[startLine].match(HEADING_RE);
        const startLevel = startMatch ? startMatch[1].length : 3;

        for (let i = startLine + 1; i < rawLines.length; i++) {
          const m = rawLines[i].match(HEADING_RE);
          if (m && m[1].length <= startLevel) {
            endLine = i;
            break;
          }
        }

        // Remove lines [startLine, endLine) and any trailing blank lines
        const before = rawLines.slice(0, startLine);
        const after = rawLines.slice(endLine);

        // Trim trailing blank lines from 'before'
        while (before.length > 0 && before[before.length - 1].trim() === '') {
          before.pop();
        }

        const updated = before.join('\n') + '\n' + (after.length > 0 ? '\n' + after.join('\n') : '\n');
        await writeSpecFile(specsDir, fileName, updated);
      });

      if (!found) {
        return c.json({ error: `Entry not found: ${targetId}` }, 404);
      }
      return c.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
