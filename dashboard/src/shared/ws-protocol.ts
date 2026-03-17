// ---------------------------------------------------------------------------
// WebSocket protocol types — server/client message contracts
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentProcess, NormalizedEntry, ApprovalRequest, AgentStatusPayload, AgentStoppedPayload } from './agent-types.js';

// ---------------------------------------------------------------------------
// WS event types — discriminator values for server messages
// ---------------------------------------------------------------------------

/** All WebSocket event type discriminators */
export type WsEventType =
  // Agent lifecycle events
  | 'agent:spawned'
  | 'agent:entry'
  | 'agent:approval'
  | 'agent:status'
  | 'agent:stopped'
  // Board events (mirrored from SSE for WS clients)
  | 'board:full'
  | 'phase:updated'
  | 'task:updated'
  | 'scratch:updated'
  | 'project:updated'
  | 'watcher:error'
  | 'heartbeat'
  | 'connected';

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

/** Envelope for all server-to-client WebSocket messages */
export interface WsServerMessage<T = unknown> {
  type: WsEventType;
  data: T;
  timestamp: string;
}

// Typed server message helpers (for narrowing by event type)
export type WsAgentSpawnedMessage = WsServerMessage<AgentProcess>;
export type WsAgentEntryMessage = WsServerMessage<NormalizedEntry>;
export type WsAgentApprovalMessage = WsServerMessage<ApprovalRequest>;
export type WsAgentStatusMessage = WsServerMessage<AgentStatusPayload>;
export type WsAgentStoppedMessage = WsServerMessage<AgentStoppedPayload>;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

/** Discriminated union of all client-to-server WS actions */
export type WsClientMessage =
  | WsClientSpawnMessage
  | WsClientStopMessage
  | WsClientMessageMessage
  | WsClientApproveMessage
  | WsClientCliBridgeSpawnMessage
  | WsClientCliBridgeEntryMessage
  | WsClientCliBridgeStoppedMessage;

export interface WsClientSpawnMessage {
  action: 'spawn';
  config: AgentConfig;
}

export interface WsClientStopMessage {
  action: 'stop';
  processId: string;
}

export interface WsClientMessageMessage {
  action: 'message';
  processId: string;
  content: string;
}

export interface WsClientApproveMessage {
  action: 'approve';
  processId: string;
  requestId: string;
  allow: boolean;
}

// ---------------------------------------------------------------------------
// CLI Bridge client messages (CLI process → Dashboard)
// ---------------------------------------------------------------------------

export interface WsClientCliBridgeSpawnMessage {
  action: 'cli:spawned';
  process: AgentProcess;
}

export interface WsClientCliBridgeEntryMessage {
  action: 'cli:entry';
  entry: NormalizedEntry;
}

export interface WsClientCliBridgeStoppedMessage {
  action: 'cli:stopped';
  processId: string;
}

// ---------------------------------------------------------------------------
// WS endpoint
// ---------------------------------------------------------------------------

export const WS_ENDPOINT = '/ws';
