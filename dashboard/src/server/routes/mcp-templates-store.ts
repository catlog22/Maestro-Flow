/**
 * MCP Templates Store — JSON file-based template storage
 * Stores MCP server configurations as reusable templates.
 * Uses a simple JSON file instead of SQLite to avoid native module dependencies.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Storage path: ~/.maestro/data/mcp-templates.json
const DATA_DIR = join(homedir(), '.maestro', 'data');
const STORE_PATH = join(DATA_DIR, 'mcp-templates.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpTemplate {
  id: number;
  name: string;
  description?: string;
  serverConfig: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  tags?: string[];
  category?: string;
  createdAt: number;
  updatedAt: number;
}

interface TemplateStore {
  version: 1;
  nextId: number;
  templates: McpTemplate[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadStore(): Promise<TemplateStore> {
  try {
    const raw = await readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as TemplateStore;
  } catch {
    return { version: 1, nextId: 1, templates: [] };
  }
}

async function saveStore(store: TemplateStore): Promise<void> {
  await ensureDir();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function saveTemplate(
  input: Omit<McpTemplate, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: number },
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const store = await loadStore();
    const now = Date.now();
    const existing = store.templates.findIndex((t) => t.name === input.name);

    if (existing >= 0) {
      // Update
      store.templates[existing] = {
        ...store.templates[existing],
        ...input,
        updatedAt: now,
      };
      await saveStore(store);
      return { success: true, id: store.templates[existing].id };
    }

    // Insert
    const id = store.nextId++;
    store.templates.push({
      id,
      name: input.name,
      description: input.description,
      serverConfig: input.serverConfig,
      tags: input.tags,
      category: input.category,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    });
    await saveStore(store);
    return { success: true, id };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getAllTemplates(): Promise<McpTemplate[]> {
  const store = await loadStore();
  return store.templates.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplateByName(name: string): Promise<McpTemplate | null> {
  const store = await loadStore();
  return store.templates.find((t) => t.name === name) ?? null;
}

export async function getTemplatesByCategory(category: string): Promise<McpTemplate[]> {
  const store = await loadStore();
  return store.templates
    .filter((t) => t.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteTemplate(name: string): Promise<{ success: boolean; error?: string }> {
  const store = await loadStore();
  const idx = store.templates.findIndex((t) => t.name === name);
  if (idx < 0) return { success: false, error: 'Template not found' };
  store.templates.splice(idx, 1);
  await saveStore(store);
  return { success: true };
}

export async function searchTemplates(keyword: string): Promise<McpTemplate[]> {
  const store = await loadStore();
  const lc = keyword.toLowerCase();
  return store.templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lc) ||
      (t.description?.toLowerCase().includes(lc) ?? false) ||
      (t.tags?.some((tag) => tag.toLowerCase().includes(lc)) ?? false),
  );
}

export async function getAllCategories(): Promise<string[]> {
  const store = await loadStore();
  const cats = new Set<string>();
  for (const t of store.templates) {
    if (t.category) cats.add(t.category);
  }
  return [...cats].sort();
}
