// ---------------------------------------------------------------------------
// DecomposePromptBuilder — builds prompt for LLM-driven issue decomposition
// ---------------------------------------------------------------------------
// Extracted from wave-executor.ts buildDecomposePrompt().
// ---------------------------------------------------------------------------

import type { PromptBuilder, PromptContext, PromptResult } from '../prompt-builder.js';

export class DecomposePromptBuilder implements PromptBuilder {
  readonly name = 'decompose';

  async build(context: PromptContext): Promise<PromptResult> {
    const { issue } = context;

    const lines = [
      `Decompose the following issue into independent, atomic subtasks suitable for parallel execution.`,
      `Each subtask should be small enough for a single focused agent to complete.`,
      '',
      `## Issue`,
      `**ID**: ${issue.id}`,
      `**Title**: ${issue.title}`,
      `**Type**: ${issue.type}`,
      `**Priority**: ${issue.priority}`,
      '',
      `**Description**:`,
      issue.description,
    ];

    if (issue.solution) {
      lines.push('', `## Existing Solution Plan`);
      if (issue.solution.context) {
        lines.push('', issue.solution.context);
      }
      if (issue.solution.steps.length > 0) {
        lines.push('');
        for (let i = 0; i < issue.solution.steps.length; i++) {
          const step = issue.solution.steps[i];
          lines.push(`${i + 1}. ${step.description}`);
          if (step.target) lines.push(`   Target: ${step.target}`);
          if (step.verification) lines.push(`   Verify: ${step.verification}`);
        }
      }
    }

    lines.push(
      '',
      '## Instructions',
      '- Decompose into 2-6 subtasks',
      '- Each task should be self-contained with a clear description',
      '- Use deps[] to specify which tasks must complete first (by task id)',
      '- Use contextFrom[] to specify which completed tasks should provide context',
      '- Task IDs should be short like "T1", "T2", etc.',
      '- Tasks with no dependencies can run in parallel (same wave)',
      '',
      'Respond with ONLY a valid JSON object. No markdown fences, no explanation before or after:',
      '{"tasks": [{"id": "T1", "title": "...", "description": "...", "deps": [], "contextFrom": []}, ...]}',
    );

    return { userPrompt: lines.join('\n'), mode: 'decompose' };
  }
}
