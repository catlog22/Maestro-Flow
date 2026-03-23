// ---------------------------------------------------------------------------
// PromptBuilder — unified interface for prompt construction
// ---------------------------------------------------------------------------

import type { Issue } from '../../shared/issue-types.js';
import type { SchedulerConfig, PromptMode } from '../../shared/execution-types.js';

// ---------------------------------------------------------------------------
// Context passed to every prompt builder
// ---------------------------------------------------------------------------

export interface PromptContext {
  issue: Issue;
  config: SchedulerConfig;
  promptMode: PromptMode;
  customTemplate?: string;
  workflowRoot?: string;
  /** Additional context for specialized builders */
  extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Result returned by every prompt builder
// ---------------------------------------------------------------------------

export interface PromptResult {
  systemPrompt?: string;
  userPrompt: string;
  /** Original prompt mode that produced this result */
  mode: string;
}

// ---------------------------------------------------------------------------
// PromptBuilder interface
// ---------------------------------------------------------------------------

export interface PromptBuilder {
  readonly name: string;
  build(context: PromptContext): Promise<PromptResult>;
}
