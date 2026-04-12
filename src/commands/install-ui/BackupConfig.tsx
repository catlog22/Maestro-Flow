import React from 'react';
import { Box, Text, useInput } from 'ink';

// ---------------------------------------------------------------------------
// BackupConfig -- Backup toggle panel
// ---------------------------------------------------------------------------

interface BackupConfigProps {
  doBackup: boolean;
  hasExistingManifest: boolean;
  onToggle: (v: boolean) => void;
}

export function BackupConfig({
  doBackup,
  hasExistingManifest,
  onToggle,
}: BackupConfigProps) {
  useInput(
    (input) => {
      if (input === 'y' || input === 'Y') {
        onToggle(true);
        return;
      }
      if (input === 'n' || input === 'N') {
        onToggle(false);
        return;
      }
    },
  );

  if (!hasExistingManifest) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Backup Configuration
        </Text>
        <Box marginTop={1}>
          <Text dimColor>No existing installation found -- backup not needed.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Backup Configuration
      </Text>

      <Box marginTop={1}>
        <Text>Backup existing installation? </Text>
        <Text color={doBackup ? 'green' : 'yellow'} bold>
          {doBackup ? '[Yes]' : '[No]'}
        </Text>
        <Text dimColor> [y/n]</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          An existing installation was detected. Enabling backup will
          preserve current files before overwriting.
        </Text>
      </Box>
    </Box>
  );
}
