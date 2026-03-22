// ---------------------------------------------------------------------------
// IntentClassifierAgent — LLM-based intent classification with regex fallback
// ---------------------------------------------------------------------------

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

import type { ClassifiedIntent, WorkflowSnapshot } from '../types.js';
import { CHAIN_MAP, TASK_TO_CHAIN, detectTaskType } from '../chain-map.js';
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
// IntentClassifierAgent
// ---------------------------------------------------------------------------

export class IntentClassifierAgent {
  async classify(intent: string, snapshot: WorkflowSnapshot): Promise<ClassifiedIntent> {
    try {
      const systemPrompt = await loadPrompt('intent-classifier');
      const chainNames = Object.keys(CHAIN_MAP).join(', ');

      const userPrompt = `Classify this intent and select the best command chain.

Intent: "${intent}"

Current State:
${JSON.stringify(snapshot, null, 2)}

Available chain names: ${chainNames}`;

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
        return this.fallbackClassify(intent);
      }

      const jsonStr = extractJson(resultText);
      if (!jsonStr) {
        return this.fallbackClassify(intent);
      }

      const parsed = JSON.parse(jsonStr) as ClassifiedIntent;

      // Validate chainName exists
      if (!CHAIN_MAP[parsed.chainName]) {
        console.warn(`[IntentClassifierAgent] Invalid chainName "${parsed.chainName}", falling back`);
        return this.fallbackClassify(intent);
      }

      // Ensure steps match chain map
      parsed.steps = CHAIN_MAP[parsed.chainName].map(def => ({
        cmd: def.cmd,
        args: def.args ?? '',
      }));

      return parsed;
    } catch (err) {
      console.error('[IntentClassifierAgent] Classification failed:', err instanceof Error ? err.message : String(err));
      return this.fallbackClassify(intent);
    }
  }

  private fallbackClassify(intent: string): ClassifiedIntent {
    const taskType = detectTaskType(intent);
    const chainName = TASK_TO_CHAIN[taskType] ?? taskType;
    const chain = CHAIN_MAP[chainName] ?? CHAIN_MAP['quick'];
    const resolvedChainName = CHAIN_MAP[chainName] ? chainName : 'quick';

    return {
      taskType,
      confidence: 0.6,
      chainName: resolvedChainName,
      steps: chain.map(def => ({ cmd: def.cmd, args: def.args ?? '' })),
      reasoning: `Regex fallback: matched pattern "${taskType}"`,
      clarificationNeeded: false,
      clarificationQuestion: null,
    };
  }
}
