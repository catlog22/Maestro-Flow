// ---------------------------------------------------------------------------
// ObservabilityService -- cross-component event timeline
// Subscribes to commander/coordinate/execution events, writes timeline.jsonl
// ---------------------------------------------------------------------------

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { SSEEvent } from '../../shared/types.js';
import type { DashboardEventBus } from '../state/event-bus.js';

// ---------------------------------------------------------------------------
// Timeline entry shape persisted to JSONL
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  timestamp: string;
  source: 'commander' | 'coordinator' | 'execution';
  event: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Event prefixes we subscribe to and their source labels
// ---------------------------------------------------------------------------

const EVENT_PREFIXES: Array<{ prefix: string; source: TimelineEntry['source'] }> = [
  { prefix: 'commander:', source: 'commander' },
  { prefix: 'coordinate:', source: 'coordinator' },
  { prefix: 'execution:', source: 'execution' },
];

// All concrete event names we subscribe to
const SUBSCRIBED_EVENTS = [
  // Commander events
  'commander:status',
  'commander:decision',
  'commander:config',
  'commander:assess_metrics',
  'commander:error',
  // Coordinator events
  'coordinate:status',
  'coordinate:step',
  'coordinate:analysis',
  'coordinate:clarification_needed',
  'coordinate:analyze_metrics',
  'coordinate:error',
  // Execution events
  'execution:started',
  'execution:completed',
  'execution:failed',
  'execution:scheduler_status',
] as const;

// ---------------------------------------------------------------------------
// ObservabilityService
// ---------------------------------------------------------------------------

export class ObservabilityService {
  private readonly timelinePath: string;
  private readonly listener: (event: SSEEvent) => void;
  private initPromise: Promise<unknown> | null = null;

  constructor(
    private readonly eventBus: DashboardEventBus,
    private readonly workflowRoot: string,
  ) {
    this.timelinePath = join(workflowRoot, '.workflow', 'timeline.jsonl');

    this.listener = (event: SSEEvent) => {
      void this.handleEvent(event);
    };

    // Subscribe to all tracked events
    for (const eventName of SUBSCRIBED_EVENTS) {
      this.eventBus.on(eventName as any, this.listener);
    }
  }

  // -------------------------------------------------------------------------
  // Ensure output directory exists (once)
  // -------------------------------------------------------------------------

  private async ensureDir(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = mkdir(join(this.workflowRoot, '.workflow'), { recursive: true });
    }
    await this.initPromise;
  }

  // -------------------------------------------------------------------------
  // Event handler -- classify source and append to JSONL
  // -------------------------------------------------------------------------

  private async handleEvent(event: SSEEvent): Promise<void> {
    const source = this.classifySource(event.type);
    if (!source) return;

    const entry: TimelineEntry = {
      timestamp: event.timestamp ?? new Date().toISOString(),
      source,
      event: event.type,
      payload: event.data,
    };

    try {
      await this.ensureDir();
      await appendFile(this.timelinePath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Observability] Failed to write timeline entry: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Source classification from event type prefix
  // -------------------------------------------------------------------------

  private classifySource(eventType: string): TimelineEntry['source'] | null {
    for (const { prefix, source } of EVENT_PREFIXES) {
      if (eventType.startsWith(prefix)) return source;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  destroy(): void {
    for (const eventName of SUBSCRIBED_EVENTS) {
      this.eventBus.off(eventName as any, this.listener);
    }
  }
}
