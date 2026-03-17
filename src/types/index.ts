export interface MaestroConfig {
  version: string;
  extensions: ExtensionConfig[];
  mcp: McpConfig;
  workflows: WorkflowConfig;
}

export interface ExtensionConfig {
  name: string;
  enabled: boolean;
  path: string;
  config?: Record<string, unknown>;
}

export interface McpConfig {
  port: number;
  host: string;
  enabledTools: string[];
}

export interface WorkflowConfig {
  templatesDir: string;
  workflowsDir: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface Extension {
  name: string;
  version: string;
  tools?: Tool[];
  activate: (ctx: ExtensionContext) => Promise<void>;
  deactivate?: () => Promise<void>;
}

export interface ExtensionContext {
  registerTool: (tool: Tool) => void;
  config: Record<string, unknown>;
  log: (msg: string) => void;
}
