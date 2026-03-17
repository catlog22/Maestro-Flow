import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { loadConfig } from '../config/index.js';
import { registerBuiltinTools } from '../tools/index.js';

export async function startMcpServer(): Promise<void> {
  const config = loadConfig();
  const registry = new ToolRegistry();
  registerBuiltinTools(registry);

  const server = new Server(
    { name: 'maestro', version: config.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = registry.list();
    const enabled = config.mcp.enabledTools;
    const filtered =
      enabled.includes('all')
        ? tools
        : tools.filter((t) => enabled.includes(t.name));

    return {
      tools: filtered.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    return registry.execute(name, (args ?? {}) as Record<string, unknown>) as any;
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startMcpServer().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
