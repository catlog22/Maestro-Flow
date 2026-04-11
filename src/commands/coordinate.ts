// ---------------------------------------------------------------------------
// `maestro coordinate` — Graph-based workflow coordinator.
// Subcommands: list, start, next, status, run (default: autonomous run).
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { GraphLoader, GraphValidationError } from '../coordinator/graph-loader.js';
import { GraphWalker } from '../coordinator/graph-walker.js';
import { IntentRouter } from '../coordinator/intent-router.js';
import { DefaultPromptAssembler } from '../coordinator/prompt-assembler.js';
import { CliExecutor } from '../coordinator/cli-executor.js';
import { DefaultExprEvaluator } from '../coordinator/expr-evaluator.js';
import { DefaultOutputParser } from '../coordinator/output-parser.js';
import { DefaultParallelExecutor } from '../coordinator/parallel-executor.js';
import { ParallelCliRunner } from '../agents/parallel-cli-runner.js';
import type { SpawnFn } from '../coordinator/cli-executor.js';

const execFileAsync = promisify(execFile);
const ACTIVE_PROGRESS_PHASES = new Set(['exploring', 'planning', 'executing', 'verifying', 'testing', 'blocked']);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolvePaths(workflowRoot: string) {
  const home = homedir();
  const globalChainsRoot = join(home, '.maestro', 'chains');
  const localChainsRoot = join(workflowRoot, 'chains');
  const chainsRoot = existsSync(localChainsRoot) ? localChainsRoot : globalChainsRoot;
  const templateDir = join(home, '.maestro', 'templates', 'cli', 'prompts');
  const sessionDir = join(workflowRoot, '.workflow', '.maestro-coordinate');
  return { chainsRoot, templateDir, sessionDir };
}

function createSpawnFn(): SpawnFn {
  return async (config) => {
    const startTime = Date.now();
    const execId = `coord-${Date.now().toString(36)}`;
    const tool = config.type === 'claude-code' ? 'claude' : config.type;
    const mode = config.approvalMode === 'auto' ? 'write' : 'analysis';

    console.error(`[coordinate] Spawning ${tool} agent...`);
    console.error(`[coordinate] Prompt: ${config.prompt.slice(0, 200)}...`);
    console.error(`[coordinate] WorkDir: ${config.workDir}`);

    try {
      const { stdout, stderr } = await execFileAsync('maestro', [
        'cli', '-p', config.prompt,
        '--tool', tool,
        '--mode', mode,
        '--cd', config.workDir,
      ], {
        cwd: config.workDir,
        timeout: 600000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
        signal: config.signal,
      });

      const output = stdout + (stderr ? '\n' + stderr : '');
      const success = !output.includes('STATUS: FAILURE');

      return {
        output: output || '--- COORDINATE RESULT ---\nSTATUS: SUCCESS\nSUMMARY: Execution completed\n',
        success,
        execId,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: `--- COORDINATE RESULT ---\nSTATUS: FAILURE\nSUMMARY: ${message}\n`,
        success: false,
        execId,
        durationMs: Date.now() - startTime,
      };
    }
  };
}

async function createWalker(workflowRoot: string, opts?: { parallel?: boolean; backend?: string }) {
  const { chainsRoot, templateDir, sessionDir } = resolvePaths(workflowRoot);
  const loader = new GraphLoader(chainsRoot);
  const evaluator = new DefaultExprEvaluator();
  const parser = new DefaultOutputParser();
  const assembler = new DefaultPromptAssembler(workflowRoot, templateDir);
  const spawnFn = createSpawnFn();
  const executor = new CliExecutor(spawnFn);
  const router = new IntentRouter(loader, chainsRoot);

  // Detect terminal backend when --backend terminal is set
  let terminalBackend: import('../agents/terminal-backend.js').TerminalBackend | undefined;
  if (opts?.backend === 'terminal') {
    const { detectBackend } = await import('../agents/terminal-backend.js');
    terminalBackend = detectBackend() ?? undefined;
    if (!terminalBackend) {
      console.error('[coordinate] Warning: no terminal multiplexer detected (need TMUX or WEZTERM_PANE env), falling back to direct');
    }
  }

  // Inject parallel executor when --parallel flag is set
  const parallelExecutor = opts?.parallel
    ? new DefaultParallelExecutor(new ParallelCliRunner(spawnFn, terminalBackend))
    : undefined;

  const walker = new GraphWalker(
    loader, assembler, executor,
    null, parser, evaluator,
    undefined, sessionDir,
    parallelExecutor,
  );
  return { walker, router, loader };
}

function printState(state: {
  session_id: string;
  status: string;
  graph_id: string;
  current_node: string;
  history: Array<{ node_id: string; node_type: string; outcome?: string; summary?: string }>;
  recovery?: {
    total_retries?: number;
    total_failures?: number;
    auto_skips?: number;
    consecutive_failures?: number;
    last_error?: string | null;
  };
}) {
  console.log(JSON.stringify({
    session_id: state.session_id,
    status: state.status,
    graph_id: state.graph_id,
    current_node: state.current_node,
    steps_completed: state.history.filter(h => h.node_type === 'command' && h.outcome === 'success').length,
    steps_failed: state.history.filter(h => h.node_type === 'command' && h.outcome === 'failure').length,
    last_step: state.history.filter(h => h.node_type === 'command').pop() ?? null,
    history: state.history.filter(h => h.node_type === 'command').map(h => ({
      node_id: h.node_id, outcome: h.outcome, summary: h.summary,
    })),
    recovery: state.recovery ?? null,
  }, null, 2));
}

function readProjectSnapshot(workflowRoot: string): Record<string, unknown> | null {
  try {
    const file = join(workflowRoot, '.workflow', 'state.json');
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function snapshotSignature(snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return 'null';
  const execution = (snapshot.execution ?? {}) as Record<string, unknown>;
  return [
    snapshot.current_phase ?? '',
    snapshot.phase_status ?? '',
    snapshot.status ?? '',
    execution.tasks_completed ?? '',
    execution.tasks_total ?? '',
    snapshot.verification_status ?? '',
    snapshot.review_verdict ?? '',
    snapshot.uat_status ?? '',
    snapshot.phases_completed ?? '',
    snapshot.phases_total ?? '',
  ].join('|');
}

function isTerminalProjectState(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;
  const phasesTotal = Number(snapshot.phases_total ?? 0);
  const phasesCompleted = Number(snapshot.phases_completed ?? 0);
  const allPhasesDone = phasesTotal > 0 && phasesCompleted >= phasesTotal;
  if (!allPhasesDone) return false;
  if (hasPendingWork(snapshot)) return false;
  const phaseStatus = String(snapshot.phase_status ?? '').trim().toLowerCase();
  const projectStatus = String(snapshot.status ?? '').trim().toLowerCase();
  return phaseStatus === 'completed' || projectStatus === 'completed';
}

function normalizePhaseStatus(snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return '';
  return String(snapshot.phase_status ?? '').trim().toLowerCase();
}

type ProjectGateReport = {
  terminal: boolean;
  pending: boolean;
  reasons: string[];
  phase_status: string;
  project_status: string;
  phases_completed: number;
  phases_total: number;
  tasks_completed: number;
  tasks_total: number;
  verification_status: string;
  review_verdict: string;
  uat_status: string;
};

function evaluateProjectGate(snapshot: Record<string, unknown> | null): ProjectGateReport {
  if (!snapshot) {
    return {
      terminal: false,
      pending: true,
      reasons: ['state_missing'],
      phase_status: '',
      project_status: '',
      phases_completed: 0,
      phases_total: 0,
      tasks_completed: 0,
      tasks_total: 0,
      verification_status: '',
      review_verdict: '',
      uat_status: '',
    };
  }

  const execution = (snapshot.execution ?? {}) as Record<string, unknown>;
  const tasksCompleted = Number(execution.tasks_completed ?? 0);
  const tasksTotal = Number(execution.tasks_total ?? 0);
  const phasesCompleted = Number(snapshot.phases_completed ?? 0);
  const phasesTotal = Number(snapshot.phases_total ?? 0);
  const phaseStatus = String(snapshot.phase_status ?? '').trim().toLowerCase();
  const projectStatus = String(snapshot.status ?? '').trim().toLowerCase();
  const verificationStatus = String(snapshot.verification_status ?? '').trim().toLowerCase();
  const reviewVerdict = String(snapshot.review_verdict ?? '').trim().toUpperCase();
  const uatStatus = String(snapshot.uat_status ?? '').trim().toLowerCase();

  const reasons: string[] = [];
  if (tasksTotal > 0 && tasksCompleted < tasksTotal) reasons.push('tasks_incomplete');
  if (phasesTotal > 0 && phasesCompleted < phasesTotal) reasons.push('phases_incomplete');
  if (ACTIVE_PROGRESS_PHASES.has(phaseStatus)) reasons.push('phase_in_progress');
  if (projectStatus && projectStatus !== 'completed' && projectStatus !== 'failed') reasons.push('project_not_terminal');
  if (verificationStatus === 'pending' || verificationStatus === 'failed') reasons.push('verification_not_done');
  if (verificationStatus === 'passed' && reviewVerdict.length === 0) reasons.push('review_missing');
  if (reviewVerdict === 'BLOCK') reasons.push('review_blocked');
  if (uatStatus === 'pending' || uatStatus === 'failed') reasons.push('uat_not_done');

  const allPhasesDone = phasesTotal > 0 && phasesCompleted >= phasesTotal;
  const statusCompleted = phaseStatus === 'completed' || projectStatus === 'completed';
  const pending = reasons.length > 0;
  const terminal = allPhasesDone && statusCompleted && !pending;

  return {
    terminal,
    pending,
    reasons,
    phase_status: phaseStatus,
    project_status: projectStatus,
    phases_completed: phasesCompleted,
    phases_total: phasesTotal,
    tasks_completed: tasksCompleted,
    tasks_total: tasksTotal,
    verification_status: verificationStatus,
    review_verdict: reviewVerdict,
    uat_status: uatStatus,
  };
}

function hasPendingWork(snapshot: Record<string, unknown> | null): boolean {
  return evaluateProjectGate(snapshot).pending;
}

type AutonomousRuntimeState = {
  updated_at: string;
  cycle: number;
  max_cycles: number;
  max_session_retries: number;
  session_retries: number;
  no_progress_cycles: number;
  auto_expand_count: number;
  state_status: string;
  phase_status: string;
  project_signature: string;
  reason: string;
};

function persistAutonomousRuntime(workflowRoot: string, state: AutonomousRuntimeState): void {
  try {
    const dir = join(workflowRoot, '.workflow', '.maestro-coordinate');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'autonomous-state.json'), JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // non-blocking
  }
}

function persistChainLintReport(workflowRoot: string, payload: {
  updated_at: string;
  error: string;
  chain?: string;
  intent?: string;
}): void {
  try {
    const dir = join(workflowRoot, '.workflow', '.maestro-coordinate');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'chain-lint-report.json'), JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // non-blocking
  }
}

async function runDegradeSequence(params: {
  walker: GraphWalker;
  router: IntentRouter;
  workflowRoot: string;
  tool: string;
  autoMode: boolean;
}): Promise<{ state: Awaited<ReturnType<GraphWalker['start']>>; reason: string }> {
  const debugGraph = params.router.resolve('debug', undefined);
  let state = await params.walker.start(debugGraph, 'debug', {
    tool: params.tool,
    autoMode: params.autoMode,
    workflowRoot: params.workflowRoot,
    inputs: { description: 'auto-degrade:debug' },
  });
  if (state.status === 'completed') {
    return { state, reason: 'degraded_to_debug' };
  }

  const planGraph = params.router.resolve('plan', undefined);
  state = await params.walker.start(planGraph, 'plan', {
    tool: params.tool,
    autoMode: params.autoMode,
    workflowRoot: params.workflowRoot,
    inputs: { description: 'auto-degrade:plan-refresh' },
  });
  if (state.status === 'completed') {
    return { state, reason: 'degraded_to_plan' };
  }
  return { state, reason: 'degrade_failed' };
}

async function runAutonomousCycles(params: {
  walker: GraphWalker;
  router: IntentRouter;
  workflowRoot: string;
  tool: string;
  autoMode: boolean;
  maxCycles: number;
  maxSessionRetries: number;
  initialState: Awaited<ReturnType<GraphWalker['start']>>;
}): Promise<Awaited<ReturnType<GraphWalker['start']>>> {
  let state = params.initialState;
  let cycle = 1;
  let sessionRetries = 0;
  let noProgressCycles = 0;
  let autoExpandCount = 0;
  let maxCycles = params.maxCycles;
  let recoveryRestarts = 0;
  const maxRecoveryRestarts = 2;
  const baseNoProgressLimit = 2;
  const activeNoProgressLimit = 4;
  const maxAutoExpands = 3;
  const autoExpandStep = 10;
  let degradeAttempts = 0;
  const maxDegradeAttempts = 2;
  let previousSignature = snapshotSignature(readProjectSnapshot(params.workflowRoot));
  persistAutonomousRuntime(params.workflowRoot, {
    updated_at: new Date().toISOString(),
    cycle,
    max_cycles: maxCycles,
    max_session_retries: params.maxSessionRetries,
    session_retries: sessionRetries,
    no_progress_cycles: noProgressCycles,
    auto_expand_count: autoExpandCount,
    state_status: state.status,
    phase_status: normalizePhaseStatus(readProjectSnapshot(params.workflowRoot)),
    project_signature: previousSignature,
    reason: 'started',
  });

  while (cycle < maxCycles) {
    if ((state.recovery?.consecutive_failures ?? 0) >= 3 && degradeAttempts < maxDegradeAttempts) {
      const degraded = await runDegradeSequence({
        walker: params.walker,
        router: params.router,
        workflowRoot: params.workflowRoot,
        tool: params.tool,
        autoMode: params.autoMode,
      });
      state = degraded.state;
      degradeAttempts += 1;
      persistAutonomousRuntime(params.workflowRoot, {
        updated_at: new Date().toISOString(),
        cycle,
        max_cycles: maxCycles,
        max_session_retries: params.maxSessionRetries,
        session_retries: sessionRetries,
        no_progress_cycles: noProgressCycles,
        auto_expand_count: autoExpandCount,
        state_status: state.status,
        phase_status: normalizePhaseStatus(readProjectSnapshot(params.workflowRoot)),
        project_signature: previousSignature,
        reason: degraded.reason,
      });
      continue;
    }

    if (state.status === 'failed') {
      if (!params.autoMode) break;
      if (sessionRetries < params.maxSessionRetries) {
        sessionRetries += 1;
        state = await params.walker.resume(state.session_id);
      } else if (recoveryRestarts < maxRecoveryRestarts) {
        recoveryRestarts += 1;
        sessionRetries = 0;
        const graphId = params.router.resolve('continue', undefined);
        state = await params.walker.start(graphId, 'continue', {
          tool: params.tool,
          autoMode: params.autoMode,
          workflowRoot: params.workflowRoot,
          inputs: { description: 'continue' },
        });
        cycle += 1;
      } else {
        persistAutonomousRuntime(params.workflowRoot, {
          updated_at: new Date().toISOString(),
          cycle,
          max_cycles: maxCycles,
          max_session_retries: params.maxSessionRetries,
          session_retries: sessionRetries,
          no_progress_cycles: noProgressCycles,
          auto_expand_count: autoExpandCount,
          state_status: state.status,
          phase_status: normalizePhaseStatus(readProjectSnapshot(params.workflowRoot)),
          project_signature: previousSignature,
          reason: 'failed_recovery_budget_exhausted',
        });
        break;
      }
      persistAutonomousRuntime(params.workflowRoot, {
        updated_at: new Date().toISOString(),
        cycle,
        max_cycles: maxCycles,
        max_session_retries: params.maxSessionRetries,
        session_retries: sessionRetries,
        no_progress_cycles: noProgressCycles,
        auto_expand_count: autoExpandCount,
        state_status: state.status,
        phase_status: normalizePhaseStatus(readProjectSnapshot(params.workflowRoot)),
        project_signature: previousSignature,
        reason: 'recovered_from_failure',
      });
      continue;
    }

    if (state.status !== 'completed') break;

    const snapshot = readProjectSnapshot(params.workflowRoot);
    if (isTerminalProjectState(snapshot)) break;
    if (!hasPendingWork(snapshot)) break;

    const signature = snapshotSignature(snapshot);
    const phaseStatus = normalizePhaseStatus(snapshot);
    const activeProgress = ACTIVE_PROGRESS_PHASES.has(phaseStatus);
    if (signature === previousSignature) {
      noProgressCycles += 1;
      const limit = activeProgress ? activeNoProgressLimit : baseNoProgressLimit;
      if (noProgressCycles >= limit) {
        const nearLimit = (maxCycles - cycle) <= 1;
        if (activeProgress && nearLimit && autoExpandCount < maxAutoExpands) {
          maxCycles += autoExpandStep;
          autoExpandCount += 1;
          noProgressCycles = 0;
        } else {
          if (params.autoMode && degradeAttempts < maxDegradeAttempts) {
            const degraded = await runDegradeSequence({
              walker: params.walker,
              router: params.router,
              workflowRoot: params.workflowRoot,
              tool: params.tool,
              autoMode: params.autoMode,
            });
            state = degraded.state;
            degradeAttempts += 1;
            noProgressCycles = 0;
            persistAutonomousRuntime(params.workflowRoot, {
              updated_at: new Date().toISOString(),
              cycle,
              max_cycles: maxCycles,
              max_session_retries: params.maxSessionRetries,
              session_retries: sessionRetries,
              no_progress_cycles: noProgressCycles,
              auto_expand_count: autoExpandCount,
              state_status: state.status,
              phase_status: phaseStatus,
              project_signature: signature,
              reason: `${degraded.reason}_after_stall`,
            });
            continue;
          }
          persistAutonomousRuntime(params.workflowRoot, {
            updated_at: new Date().toISOString(),
            cycle,
            max_cycles: maxCycles,
            max_session_retries: params.maxSessionRetries,
            session_retries: sessionRetries,
            no_progress_cycles: noProgressCycles,
            auto_expand_count: autoExpandCount,
            state_status: state.status,
            phase_status: phaseStatus,
            project_signature: signature,
            reason: 'stalled_no_progress',
          });
          break;
        }
      }
    } else {
      noProgressCycles = 0;
      sessionRetries = 0;
    }
    previousSignature = signature;

    const graphId = params.router.resolve('continue', undefined);
    state = await params.walker.start(graphId, 'continue', {
      tool: params.tool,
      autoMode: params.autoMode,
      workflowRoot: params.workflowRoot,
      inputs: { description: 'continue' },
    });
    cycle += 1;
    persistAutonomousRuntime(params.workflowRoot, {
      updated_at: new Date().toISOString(),
      cycle,
      max_cycles: maxCycles,
      max_session_retries: params.maxSessionRetries,
      session_retries: sessionRetries,
      no_progress_cycles: noProgressCycles,
      auto_expand_count: autoExpandCount,
      state_status: state.status,
      phase_status: phaseStatus,
      project_signature: signature,
      reason: 'continue_cycle',
    });
  }
  persistAutonomousRuntime(params.workflowRoot, {
    updated_at: new Date().toISOString(),
    cycle,
    max_cycles: maxCycles,
    max_session_retries: params.maxSessionRetries,
    session_retries: sessionRetries,
    no_progress_cycles: noProgressCycles,
    auto_expand_count: autoExpandCount,
    state_status: state.status,
    phase_status: normalizePhaseStatus(readProjectSnapshot(params.workflowRoot)),
    project_signature: previousSignature,
    reason: state.status,
  });
  return state;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCoordinateCommand(program: Command): void {
  const coord = program
    .command('coordinate')
    .alias('coord')
    .description('Graph-based workflow coordinator');

  // -------------------------------------------------------------------------
  // maestro coordinate list
  // -------------------------------------------------------------------------
  coord
    .command('list')
    .description('List all available chain graphs')
    .action(async () => {
      const workflowRoot = resolve(process.cwd());
      const { chainsRoot } = resolvePaths(workflowRoot);
      const loader = new GraphLoader(chainsRoot);
      const graphs = loader.listAll();

      console.log('\n  ID'.padEnd(30) + 'Name'.padEnd(22) + 'Cmds'.padEnd(6) + 'Description');
      console.log('  ' + '─'.repeat(80));
      for (const graphId of graphs) {
        try {
          const g = await loader.load(graphId);
          const cmdCount = Object.values(g.nodes).filter(n => n.type === 'command').length;
          const desc = g.description ?? '';
          console.log(
            '  ' + graphId.padEnd(28) + (g.name ?? '').padEnd(22) +
            String(cmdCount).padEnd(6) + desc.slice(0, 50),
          );
        } catch { /* skip invalid */ }
      }
      console.log('');
    });

  // -------------------------------------------------------------------------
  // maestro coordinate start — execute first step, then pause (step mode)
  // -------------------------------------------------------------------------
  coord
    .command('start [intent...]')
    .description('Start a new session in step mode — executes first command, then pauses')
    .option('--chain <name>', 'Force specific chain graph')
    .option('--tool <tool>', 'Agent tool to use', 'codex')
    .option('-y, --yes', 'Auto mode — inject auto-confirm flags')
    .option('--parallel', 'Enable parallel execution for fork/join nodes')
    .option('--backend <type>', 'Adapter backend: direct (default) or terminal (tmux/wezterm)')
    .action(async (intentWords: string[], opts: { chain?: string; tool: string; yes?: boolean; parallel?: boolean; backend?: string }) => {
      const intent = intentWords.join(' ');
      const workflowRoot = resolve(process.cwd());
      const { walker, router } = await createWalker(workflowRoot, { parallel: opts.parallel, backend: opts.backend });

      try {
        const graphId = router.resolve(intent, opts.chain);
        console.error(`[coordinate] Graph: ${graphId}`);

        const state = await walker.start(graphId, intent, {
          tool: opts.tool,
          autoMode: opts.yes ?? false,
          stepMode: true,
          workflowRoot,
          inputs: { description: intent },
        });

        printState(state);
        process.exit(state.status === 'completed' || state.status === 'step_paused' ? 0 : 1);
      } catch (err) {
        if (err instanceof GraphValidationError) {
          persistChainLintReport(workflowRoot, {
            updated_at: new Date().toISOString(),
            error: err.message,
            chain: opts.chain,
            intent,
          });
          if (opts.yes) {
            try {
              const degraded = await runDegradeSequence({
                walker,
                router,
                workflowRoot,
                tool: opts.tool,
                autoMode: true,
              });
              printState(degraded.state);
              process.exit(degraded.state.status === 'completed' ? 0 : 1);
            } catch (degradeErr) {
              console.error(`[coordinate] Degrade failed after lint error: ${degradeErr instanceof Error ? degradeErr.message : String(degradeErr)}`);
            }
          }
        }
        console.error(`[coordinate] Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // -------------------------------------------------------------------------
  // maestro coordinate next — continue step-paused session by one step
  // -------------------------------------------------------------------------
  coord
    .command('next [sessionId]')
    .description('Execute next step of a paused session')
    .action(async (sessionId: string | undefined) => {
      const workflowRoot = resolve(process.cwd());
      const { walker } = await createWalker(workflowRoot);

      try {
        const state = await walker.next(sessionId);
        printState(state);
        process.exit(state.status === 'completed' || state.status === 'step_paused' ? 0 : 1);
      } catch (err) {
        console.error(`[coordinate] Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // -------------------------------------------------------------------------
  // maestro coordinate status — show current session state
  // -------------------------------------------------------------------------
  coord
    .command('status [sessionId]')
    .description('Show current session state')
    .action(async (sessionId: string | undefined) => {
      const workflowRoot = resolve(process.cwd());
      const { walker } = await createWalker(workflowRoot);

      try {
        const state = walker.getState(sessionId);
        printState(state);
      } catch (err) {
        console.error(`[coordinate] Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // -------------------------------------------------------------------------
  // maestro coordinate gate — deterministic pending/terminal gate from state
  // -------------------------------------------------------------------------
  coord
    .command('gate')
    .description('Evaluate project completion gate from .workflow/state.json')
    .option('--json', 'Output full gate report as JSON')
    .action((opts: { json?: boolean }) => {
      const workflowRoot = resolve(process.cwd());
      const snapshot = readProjectSnapshot(workflowRoot);
      const report = evaluateProjectGate(snapshot);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        const line = report.terminal
          ? '[coordinate:gate] terminal'
          : `[coordinate:gate] pending (${report.reasons.join(', ') || 'unknown'})`;
        console.log(line);
      }

      process.exit(report.terminal ? 0 : 2);
    });

  // -------------------------------------------------------------------------
  // maestro coordinate run — autonomous full run (default behavior)
  // -------------------------------------------------------------------------
  coord
    .command('run [intent...]', { isDefault: true })
    .description('Autonomous full run — walk entire graph to completion')
    .option('-y, --yes', 'Auto mode — skip confirmations')
    .option('-c, --continue [sessionId]', 'Resume session')
    .option('--chain <name>', 'Force specific chain graph')
    .option('--tool <tool>', 'Agent tool to use', 'codex')
    .option('--dry-run', 'Show graph traversal plan without executing')
    .option('--parallel', 'Enable parallel execution for fork/join nodes')
    .option('--backend <type>', 'Adapter backend: direct (default) or terminal (tmux/wezterm)')
    .option('--max-cycles <n>', 'Maximum autonomous cycles in -y mode', '12')
    .option('--max-session-retries <n>', 'Maximum resume retries after failure in -y mode', '2')
    .action(async (intentWords: string[], opts: {
      yes?: boolean;
      continue?: string | true;
      chain?: string;
      tool: string;
      dryRun?: boolean;
      parallel?: boolean;
      backend?: string;
      maxCycles?: string;
      maxSessionRetries?: string;
    }) => {
      const intent = intentWords.join(' ');
      const workflowRoot = resolve(process.cwd());
      const { walker, router } = await createWalker(workflowRoot, { parallel: opts.parallel, backend: opts.backend });

      try {
        let state;

        if (opts.continue) {
          const sessionId = typeof opts.continue === 'string' ? opts.continue : undefined;
          console.error(`[coordinate] Resuming session${sessionId ? `: ${sessionId}` : ''}...`);
          state = await walker.resume(sessionId);
        } else {
          const graphId = router.resolve(intent, opts.chain);
          console.error(`[coordinate] Graph: ${graphId}`);
          console.error(`[coordinate] Intent: ${intent || '(none)'}`);
          if (opts.dryRun) console.error('[coordinate] Dry-run mode');

          state = await walker.start(graphId, intent, {
            tool: opts.tool,
            autoMode: opts.yes ?? false,
            dryRun: opts.dryRun,
            workflowRoot,
            inputs: { description: intent },
          });
        }

        if (opts.yes && !opts.dryRun) {
          const maxCycles = Number(opts.maxCycles ?? '12');
          const maxSessionRetries = Number(opts.maxSessionRetries ?? '2');
          state = await runAutonomousCycles({
            walker,
            router,
            workflowRoot,
            tool: opts.tool,
            autoMode: true,
            maxCycles: Number.isFinite(maxCycles) ? Math.max(1, maxCycles) : 12,
            maxSessionRetries: Number.isFinite(maxSessionRetries) ? Math.max(0, maxSessionRetries) : 2,
            initialState: state,
          });
        }

        printState(state);
        process.exit(state.status === 'completed' ? 0 : 1);
      } catch (err) {
        if (err instanceof GraphValidationError) {
          persistChainLintReport(workflowRoot, {
            updated_at: new Date().toISOString(),
            error: err.message,
            chain: opts.chain,
            intent,
          });
          if (opts.yes && !opts.dryRun) {
            try {
              const degraded = await runDegradeSequence({
                walker,
                router,
                workflowRoot,
                tool: opts.tool,
                autoMode: true,
              });
              printState(degraded.state);
              process.exit(degraded.state.status === 'completed' ? 0 : 1);
            } catch (degradeErr) {
              console.error(`[coordinate] Degrade failed after lint error: ${degradeErr instanceof Error ? degradeErr.message : String(degradeErr)}`);
            }
          }
        }
        console.error(`[coordinate] Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
