import type { NormalizedEntry } from '@/shared/agent-types.js';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolUseCard } from './ToolUseCard.js';
import { FileChangeCard } from './FileChangeCard.js';
import { CommandExec } from './CommandExec.js';
import { ApprovalCard } from './ApprovalCard.js';
import { ApprovalResponse } from './ApprovalResponse.js';
import { ErrorDisplay } from './ErrorEntry.js';
import { StatusChange } from './StatusChange.js';
import { TokenUsage } from './TokenUsage.js';

// ---------------------------------------------------------------------------
// EntryRenderer -- dispatches NormalizedEntry.type to the correct component
// ---------------------------------------------------------------------------

export function EntryRenderer({ entry }: { entry: NormalizedEntry }) {
  switch (entry.type) {
    case 'user_message':
      return <UserMessage entry={entry} />;
    case 'assistant_message':
      return <AssistantMessage entry={entry} />;
    case 'thinking':
      return <ThinkingBlock entry={entry} />;
    case 'tool_use':
      return <ToolUseCard entry={entry} />;
    case 'file_change':
      return <FileChangeCard entry={entry} />;
    case 'command_exec':
      return <CommandExec entry={entry} />;
    case 'approval_request':
      return <ApprovalCard entry={entry} />;
    case 'approval_response':
      return <ApprovalResponse entry={entry} />;
    case 'error':
      return <ErrorDisplay entry={entry} />;
    case 'status_change':
      return <StatusChange entry={entry} />;
    case 'token_usage':
      return <TokenUsage entry={entry} />;
    default:
      return null;
  }
}
