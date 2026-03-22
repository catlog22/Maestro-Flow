// ---------------------------------------------------------------------------
// StateAnalyzerAgent — uses SDK query() with MCP tools to analyze workflow state
// ---------------------------------------------------------------------------

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultSuccess } from '@anthropic-ai/claude-agent-sdk';

import type { StateManager } from '../../state/state-manager.js';
import type { WorkflowSnapshot } from '../types.js';
import { loadPrompt } from '../prompts/index.js';
import { createWorkflowMcpServer } from '../tools/workflow-mcp-server.js';

// ---------------------------------------------------------------------------
// JSON extraction helper (same pattern as requirement-expander.ts)
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
// Default snapshot for when analysis fails
// ---------------------------------------------------------------------------

const DEFAULT_SNAPSHOT: WorkflowSnapshot = {
  initialized: false,
  currentPhase: 0,
  phaseStatus: 'pending',
  artifacts: { brainstorm: false, analysis: false, context: false, plan: false, verification: false, uat: false },
  execution: { tasksCompleted: 0, tasksTotal: 0 },
  verification: 'not_started',
  uat: 'not_started',
  phasesTotal: 0,
  phasesCompleted: 0,
  hasBlockers: false,
  accumulatedContext: [],
  progressSummary: 'Unable to analyze workflow state',
  suggestedNextAction: 'init',
  readiness: 'unknown',
};

// ---------------------------------------------------------------------------
// StateAnalyzerAgent
// ---------------------------------------------------------------------------

export class StateAnalyzerAgent {
  private readonly mcpServer;

  constructor(
    private readonly stateManager: StateManager,
    workflowRoot: string,
  ) {
    this.mcpServer = createWorkflowMcpServer(stateManager, workflowRoot);
  }

  async analyze(): Promise<WorkflowSnapshot> {
    try {
      const systemPrompt = await loadPrompt('state-analyzer');
      const project = this.stateManager.getProject();

      const userPrompt = `Analyze the current workflow state. Project: ${project.project_name || 'unknown'}, current phase: ${project.current_phase ?? 'none'}, status: ${project.status || 'unknown'}. Use the MCP tools to gather detailed state information.`;

      let resultText = '';

      for await (const message of query({
        prompt: userPrompt,
        options: {
          systemPrompt,
          tools: [],
          allowedTools: [],
          permissionMode: 'dontAsk' as const,
          mcpServers: { 'workflow-state': this.mcpServer },
          maxTurns: 5,
          persistSession: false,
        },
      })) {
        const msg = message as Record<string, unknown>;
        if (msg.type === 'result' && msg.subtype === 'success') {
          resultText = (message as unknown as SDKResultSuccess).result;
        }
      }

      if (!resultText) {
        console.warn('[StateAnalyzerAgent] Empty result, returning default snapshot');
        return { ...DEFAULT_SNAPSHOT };
      }

      const jsonStr = extractJson(resultText);
      if (!jsonStr) {
        console.warn('[StateAnalyzerAgent] Could not extract JSON from result');
        return { ...DEFAULT_SNAPSHOT };
      }

      return JSON.parse(jsonStr) as WorkflowSnapshot;
    } catch (err) {
      console.error('[StateAnalyzerAgent] Analysis failed:', err instanceof Error ? err.message : String(err));
      return { ...DEFAULT_SNAPSHOT };
    }
  }
}
