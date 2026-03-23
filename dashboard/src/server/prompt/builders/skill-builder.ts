// ---------------------------------------------------------------------------
// SkillPromptBuilder — builds prompt referencing issue metadata for skill mode
// ---------------------------------------------------------------------------
// Extracted from ExecutionScheduler.buildPrompt() 'skill' mode branch.
// ---------------------------------------------------------------------------

import type { PromptBuilder, PromptContext, PromptResult } from '../prompt-builder.js';

export class SkillPromptBuilder implements PromptBuilder {
  readonly name = 'skill';

  async build(context: PromptContext): Promise<PromptResult> {
    const { issue } = context;

    const userPrompt = `Execute the following issue:\n\nIssue ID: ${issue.id}\nTitle: ${issue.title}\nType: ${issue.type}\nPriority: ${issue.priority}\n\nDescription:\n${issue.description}`;

    return { userPrompt, mode: 'skill' };
  }
}
