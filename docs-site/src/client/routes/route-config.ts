// ---------------------------------------------------------------------------
// Route Configuration — generated from inventory.json categories
// ---------------------------------------------------------------------------

// Import inventory JSON with type assertion
import inventoryJson from '../data/inventory.json';

// Type definitions
export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Command {
  name: string;
  file: string;
  category: string;
  description: string;
  argumentHint?: string;
  allowedTools?: string[];
}

export interface Skill {
  name: string;
  path: string;
  category: string;
  description: string;
  roles?: string[];
  phases?: string[];
}

export interface InventoryData {
  categories: Category[];
  commands: Command[];
  claude_skills: Skill[];
  codex_skills: Skill[];
}

// Typed inventory data
export const inventory: InventoryData = inventoryJson as InventoryData;

// Export for convenience
export const inventoryData: InventoryData = inventory;

// Extract command slugs from names (e.g., "maestro-init" -> "init")
export const getCommandSlug = (commandName: string): string => {
  const parts = commandName.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : commandName;
};

// Helper: Get category by ID
export const getCategoryById = (id: string): Category | undefined => {
  return inventory.categories.find((c) => c.id === id);
};

// Helper: Get commands by category
export const getCommandsByCategory = (categoryId: string): Command[] => {
  return inventory.commands.filter((c) => c.category === categoryId);
};

// Helper: Get skills by category
export const getSkillsByCategory = (categoryId: string): {
  claude: Skill[];
  codex: Skill[];
} => {
  return {
    claude: inventory.claude_skills.filter((s) => s.category === categoryId),
    codex: inventory.codex_skills.filter((s) => s.category === categoryId),
  };
};

// ---------------------------------------------------------------------------
// Search functionality
// ---------------------------------------------------------------------------

export interface SearchResult {
  type: 'command' | 'claude_skill' | 'codex_skill';
  name: string;
  slug: string;
  category: string;
  description: string;
}

export const searchInventory = (query: string): SearchResult[] => {
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  // Search commands
  inventory.commands.forEach((cmd) => {
    if (
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'command',
        name: cmd.name,
        slug: getCommandSlug(cmd.name),
        category: cmd.category,
        description: cmd.description,
      });
    }
  });

  // Search Claude skills
  inventory.claude_skills.forEach((skill) => {
    if (
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'claude_skill',
        name: skill.name,
        slug: skill.name,
        category: skill.category,
        description: skill.description,
      });
    }
  });

  // Search Codex skills
  inventory.codex_skills.forEach((skill) => {
    if (
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'codex_skill',
        name: skill.name,
        slug: skill.name,
        category: skill.category,
        description: skill.description,
      });
    }
  });

  return results;
};
