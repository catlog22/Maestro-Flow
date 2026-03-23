// ---------------------------------------------------------------------------
// DirectPromptBuilder — assembles natural language prompt from issue fields
// ---------------------------------------------------------------------------
// Extracted from ExecutionScheduler.buildPrompt() 'direct' mode branch.
// ---------------------------------------------------------------------------

import type { PromptBuilder, PromptContext, PromptResult } from '../prompt-builder.js';

export class DirectPromptBuilder implements PromptBuilder {
  readonly name = 'direct';

  async build(context: PromptContext): Promise<PromptResult> {
    const { issue } = context;

    const lines: string[] = [
      `You are working on the following ${issue.type} issue:`,
      '',
      `## ${issue.title}`,
      '',
      issue.description,
      '',
      `Priority: ${issue.priority}`,
    ];

    // Inject solution steps if available (from /issue:plan)
    if (issue.solution) {
      lines.push('', '## Solution Plan', '');

      if (issue.solution.context) {
        lines.push('### Context', '', issue.solution.context, '');
      }

      if (issue.solution.steps.length > 0) {
        lines.push('### Steps', '');
        for (let i = 0; i < issue.solution.steps.length; i++) {
          const step = issue.solution.steps[i];
          lines.push(`${i + 1}. ${step.description}`);
          if (step.target) lines.push(`   - Target: ${step.target}`);
          if (step.verification) lines.push(`   - Verify: ${step.verification}`);
        }
      }

      lines.push(
        '',
        'Follow the solution plan above. Execute each step in order.',
        'After completing all steps, verify each step\'s criteria.',
        'When done, provide a summary of the changes made.',
      );
    } else {
      lines.push(
        '',
        'Please implement this issue. Follow existing code patterns and conventions.',
        'When done, provide a summary of the changes made.',
      );
    }

    return { userPrompt: lines.join('\n'), mode: 'direct' };
  }
}
