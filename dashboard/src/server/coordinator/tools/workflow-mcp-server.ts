// ---------------------------------------------------------------------------
// Workflow MCP Server — SDK in-process MCP server for workflow state access
// ---------------------------------------------------------------------------
// Provides get_project_state, get_phase_state, check_artifacts, list_phase_tasks
// tools to Agent SDK queries (injected via options.mcpServers).
// ---------------------------------------------------------------------------

import { join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';

import type { StateManager } from '../../state/state-manager.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function buildTools(stateManager: StateManager, workflowRoot: string) {
  const getProjectStateTool = tool(
    'get_project_state',
    'Get project-level state including current phase, status, phases summary, and accumulated context.',
    {},
    async () => {
      const project = stateManager.getProject();
      return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] };
    },
  );

  const getPhaseStateTool = tool(
    'get_phase_state',
    'Get detailed state for a specific phase including status, plan, execution progress, verification, and validation.',
    { phase: z.number().describe('Phase number (e.g. 1, 2, 3)') },
    async (args) => {
      const phase = stateManager.getPhase(args.phase);
      if (!phase) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Phase ${args.phase} not found` }) }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(phase, null, 2) }] };
    },
  );

  const checkArtifactsTool = tool(
    'check_artifacts',
    'Check which workflow artifacts exist in a phase directory (brainstorm.md, analysis.md, context.md, plan-overview.json, tasks, verification, uat).',
    { phase: z.number().describe('Phase number to check artifacts for') },
    async (args) => {
      const phaseDir = await findPhaseDir(workflowRoot, args.phase);
      if (!phaseDir) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `Phase ${args.phase} directory not found` }) }], isError: true };
      }

      const artifacts: Record<string, boolean> = {
        brainstorm: false,
        analysis: false,
        context: false,
        plan: false,
        verification: false,
        uat: false,
      };

      const checks = [
        ['brainstorm', 'brainstorm.md'],
        ['analysis', 'analysis.md'],
        ['context', 'context.md'],
        ['plan', 'plan-overview.json'],
      ] as const;

      for (const [key, file] of checks) {
        artifacts[key] = await fileExists(join(phaseDir, file));
      }

      // Check for task files
      const taskDir = join(phaseDir, '.task');
      if (await fileExists(taskDir)) {
        try {
          const files = await readdir(taskDir);
          artifacts.plan = artifacts.plan || files.some(f => f.startsWith('TASK-') && f.endsWith('.json'));
        } catch { /* ignore */ }
      }

      // Check verification and uat from phase state
      const phase = stateManager.getPhase(args.phase);
      if (phase) {
        artifacts.verification = phase.verification?.status === 'passed' || phase.verification?.status === 'failed';
        artifacts.uat = phase.uat?.status === 'passed' || phase.uat?.status === 'failed';
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(artifacts, null, 2) }] };
    },
  );

  const listPhaseTasksTool = tool(
    'list_phase_tasks',
    'List task summaries for a given phase including id, title, status, and convergence criteria.',
    { phase: z.number().describe('Phase number to list tasks for') },
    async (args) => {
      const tasks = await stateManager.getTasks(args.phase);
      const summaries = tasks.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        convergence: t.convergence,
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(summaries, null, 2) }] };
    },
  );

  return [getProjectStateTool, getPhaseStateTool, checkArtifactsTool, listPhaseTasksTool];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findPhaseDir(workflowRoot: string, phaseNum: number): Promise<string | null> {
  try {
    const entries = await readdir(workflowRoot);
    const prefix = `phase-${String(phaseNum).padStart(2, '0')}`;
    const match = entries.find(e => e.startsWith(prefix));
    return match ? join(workflowRoot, match) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWorkflowMcpServer(
  stateManager: StateManager,
  workflowRoot: string,
): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: 'workflow-state',
    tools: buildTools(stateManager, workflowRoot),
  });
}
