import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from '@inkjs/ui';
import { MCP_TOOLS } from '../install-backend.js';

// ---------------------------------------------------------------------------
// McpConfig -- MCP tools configuration panel
// ---------------------------------------------------------------------------

interface McpConfigProps {
  enabled: boolean;
  tools: string[];
  projectRoot: string;
  mode: string;
  onEnableChange: (v: boolean) => void;
  onToolsChange: (tools: string[]) => void;
  onRootChange: (root: string) => void;
}

export function McpConfig({
  enabled,
  tools,
  projectRoot,
  mode,
  onEnableChange,
  onToolsChange,
  onRootChange,
}: McpConfigProps) {
  const [editingRoot, setEditingRoot] = useState(false);
  const [rootInput, setRootInput] = useState(projectRoot);

  const toggleTool = useCallback(
    (index: number) => {
      if (index < 0 || index >= MCP_TOOLS.length) return;
      const toolName = MCP_TOOLS[index];
      if (tools.includes(toolName)) {
        onToolsChange(tools.filter((t) => t !== toolName));
      } else {
        onToolsChange([...tools, toolName]);
      }
    },
    [tools, onToolsChange],
  );

  useInput(
    (input, key) => {
      if (editingRoot) return; // TextInput captures input when active

      // y/Y to enable, n/N to disable
      if (input === 'y' || input === 'Y') {
        onEnableChange(true);
        return;
      }
      if (input === 'n' || input === 'N') {
        onEnableChange(false);
        return;
      }

      // Number keys 1-6 to toggle tools
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= MCP_TOOLS.length) {
        toggleTool(num - 1);
        return;
      }

      // 'r' to edit project root
      if (input === 'r' || input === 'R') {
        setEditingRoot(true);
        return;
      }
    },
  );

  // Handle root input submission
  const handleRootSubmit = useCallback(
    (value: string) => {
      onRootChange(value);
      setEditingRoot(false);
    },
    [onRootChange],
  );

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        MCP Server Configuration
      </Text>

      <Box marginTop={1}>
        <Text>
          Enable MCP server?{' '}
        </Text>
        <Text color={enabled ? 'green' : 'yellow'} bold>
          {enabled ? '[Yes]' : '[No]'}
        </Text>
        <Text dimColor> [y/n]</Text>
      </Box>

      {enabled && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Tools (press 1-{MCP_TOOLS.length} to toggle):</Text>
          <Box flexDirection="column" marginTop={1}>
            {MCP_TOOLS.map((tool, i) => {
              const checked = tools.includes(tool);
              return (
                <Box key={tool}>
                  <Text color={checked ? 'cyan' : 'gray'}>
                    [{i + 1}] {checked ? '[x]' : '[ ]'} {tool}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              {tools.length} of {MCP_TOOLS.length} tools enabled
            </Text>
          </Box>

          {mode === 'project' && (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                Project root:{' '}
                {editingRoot ? (
                  <TextInput
                    placeholder={projectRoot || process.cwd()}
                    defaultValue={projectRoot}
                    onSubmit={handleRootSubmit}
                    onChange={setRootInput}
                  />
                ) : (
                  <Text color="cyan">{projectRoot || '(default)'}</Text>
                )}
              </Text>
              {!editingRoot && (
                <Text dimColor>Press [r] to edit</Text>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
