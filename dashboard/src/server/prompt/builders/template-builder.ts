// ---------------------------------------------------------------------------
// TemplatePromptBuilder — applies mustache-style variable substitution
// ---------------------------------------------------------------------------
// Extracted from ExecutionScheduler.applyTemplate().
// ---------------------------------------------------------------------------

import type { PromptBuilder, PromptContext, PromptResult } from '../prompt-builder.js';

export class TemplatePromptBuilder implements PromptBuilder {
  readonly name = 'template';

  async build(context: PromptContext): Promise<PromptResult> {
    const { issue, customTemplate } = context;

    if (!customTemplate) {
      throw new Error('TemplatePromptBuilder requires customTemplate in context');
    }

    const userPrompt = customTemplate
      .replace(/\{\{\s*issue\.id\s*\}\}/g, issue.id)
      .replace(/\{\{\s*issue\.title\s*\}\}/g, issue.title)
      .replace(/\{\{\s*issue\.description\s*\}\}/g, issue.description)
      .replace(/\{\{\s*issue\.type\s*\}\}/g, issue.type)
      .replace(/\{\{\s*issue\.priority\s*\}\}/g, issue.priority)
      .replace(/\{\{\s*issue\.status\s*\}\}/g, issue.status);

    return { userPrompt, mode: 'template' };
  }
}
