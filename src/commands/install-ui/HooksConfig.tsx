import React from 'react';
import { Box, Text, useInput } from 'ink';
import {
  HOOK_LEVELS,
  HOOK_LEVEL_DESCRIPTIONS,
  type HookLevel,
} from '../hooks.js';

// ---------------------------------------------------------------------------
// HooksConfig -- Hook level selection panel
// ---------------------------------------------------------------------------

interface HooksConfigProps {
  level: HookLevel;
  onLevelChange: (level: HookLevel) => void;
}

export function HooksConfig({ level, onLevelChange }: HooksConfigProps) {
  useInput(
    (input) => {
      const num = parseInt(input, 10);
      if (!isNaN(num) && num >= 1 && num <= HOOK_LEVELS.length) {
        onLevelChange(HOOK_LEVELS[num - 1]);
      }
    },
  );

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Hooks Configuration
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {HOOK_LEVELS.map((lvl, i) => {
          const isActive = lvl === level;
          const label = lvl.charAt(0).toUpperCase() + lvl.slice(1);
          const desc = HOOK_LEVEL_DESCRIPTIONS[lvl];

          return (
            <Box key={lvl}>
              <Text color={isActive ? 'cyan' : 'gray'}>
                [{i + 1}] {isActive ? '>' : ' '} {label}
              </Text>
              <Text dimColor> -- {desc}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press 1-{HOOK_LEVELS.length} to select hook level</Text>
      </Box>
    </Box>
  );
}
