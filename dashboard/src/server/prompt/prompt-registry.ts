// ---------------------------------------------------------------------------
// PromptRegistry — central registry for prompt builders
// ---------------------------------------------------------------------------

import type { PromptBuilder } from './prompt-builder.js';
import { DirectPromptBuilder } from './builders/direct-builder.js';
import { SkillPromptBuilder } from './builders/skill-builder.js';
import { TemplatePromptBuilder } from './builders/template-builder.js';
import { DecomposePromptBuilder } from './builders/decompose-builder.js';
import { AssessmentPromptBuilder } from './builders/assessment-builder.js';

export class PromptRegistry {
  private readonly builders = new Map<string, PromptBuilder>();

  register(builder: PromptBuilder): void {
    this.builders.set(builder.name, builder);
  }

  get(name: string): PromptBuilder | undefined {
    return this.builders.get(name);
  }

  list(): string[] {
    return Array.from(this.builders.keys());
  }

  static createDefault(): PromptRegistry {
    const registry = new PromptRegistry();
    registry.register(new DirectPromptBuilder());
    registry.register(new SkillPromptBuilder());
    registry.register(new TemplatePromptBuilder());
    registry.register(new DecomposePromptBuilder());
    registry.register(new AssessmentPromptBuilder());
    return registry;
  }
}
