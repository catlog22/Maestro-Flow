// ---------------------------------------------------------------------------
// QualityReviewerAgent — evaluates step output quality with LLM
// ---------------------------------------------------------------------------

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

import type { CoordinateStep } from '../../../shared/coordinate-types.js';
import type { StepAnalysis } from '../types.js';
import { loadPrompt } from '../prompts/index.js';

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  return null;
}

// ---------------------------------------------------------------------------
// Default analysis for fallback
// ---------------------------------------------------------------------------

const DEFAULT_ANALYSIS: StepAnalysis = {
  qualityScore: 50,
  executionAssessment: 'Unable to analyze step output',
  issues: [],
  nextStepHints: '',
  stepSummary: 'Step completed',
};

// ---------------------------------------------------------------------------
// QualityReviewerAgent
// ---------------------------------------------------------------------------

export class QualityReviewerAgent {
  async review(step: CoordinateStep, output: string): Promise<StepAnalysis> {
    try {
      const systemPrompt = await loadPrompt('quality-reviewer');

      // Truncate output to last 200 lines
      const lines = output.split('\n');
      const truncated = lines.length > 200
        ? `[...truncated ${lines.length - 200} lines...]\n${lines.slice(-200).join('\n')}`
        : output;

      const userPrompt = `Evaluate this completed workflow step:

Step ${step.index + 1}: ${step.cmd} ${step.args}
Status: ${step.status}

Output:
${truncated}`;

      let resultText = '';

      for await (const message of query({
        prompt: userPrompt,
        options: {
          systemPrompt,
          tools: [],
          allowedTools: [],
          permissionMode: 'dontAsk' as const,
          maxTurns: 3,
          persistSession: false,
        },
      })) {
        const msg = message as Record<string, unknown>;
        if (msg.type === 'result' && msg.subtype === 'success') {
          resultText = (message as unknown as SDKResultSuccess).result;
        }
      }

      if (!resultText) {
        return { ...DEFAULT_ANALYSIS };
      }

      const jsonStr = extractJson(resultText);
      if (!jsonStr) {
        return { ...DEFAULT_ANALYSIS };
      }

      const parsed = JSON.parse(jsonStr) as StepAnalysis;

      // Clamp quality score
      parsed.qualityScore = Math.max(0, Math.min(100, Math.round(parsed.qualityScore)));

      return parsed;
    } catch (err) {
      console.error('[QualityReviewerAgent] Review failed:', err instanceof Error ? err.message : String(err));
      return { ...DEFAULT_ANALYSIS };
    }
  }
}
