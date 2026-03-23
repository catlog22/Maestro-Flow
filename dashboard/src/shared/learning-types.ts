// ---------------------------------------------------------------------------
// Learning system types -- command patterns, knowledge base, suggestions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command pattern tracking
// ---------------------------------------------------------------------------

export interface CommandPattern {
  command: string;
  frequency: number;
  successRate: number;
  avgDuration: number;
  lastUsed: string;
  contexts: string[];
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  source: 'auto' | 'manual';
  usageCount: number;
  lastAccessed: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Learning statistics & suggestions
// ---------------------------------------------------------------------------

export interface LearningSuggestion {
  type: 'optimize' | 'alert' | 'automate';
  title: string;
  description: string;
  confidence: number;
  action?: string;
}

export interface LearningStats {
  totalCommands: number;
  uniquePatterns: number;
  topPatterns: CommandPattern[];
  suggestions: LearningSuggestion[];
  knowledgeBaseSize: number;
}
