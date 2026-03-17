import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { paths } from './paths.js';
import type { MaestroConfig } from '../types/index.js';

const DEFAULT_CONFIG: MaestroConfig = {
  version: '0.1.0',
  extensions: [],
  mcp: {
    port: 3600,
    host: 'localhost',
    enabledTools: ['all'],
  },
  workflows: {
    templatesDir: 'templates',
    workflowsDir: 'workflows',
  },
};

export function loadConfig(): MaestroConfig {
  if (!existsSync(paths.config)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(paths.config, 'utf-8');
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: MaestroConfig): void {
  paths.ensure(paths.home);
  writeFileSync(paths.config, JSON.stringify(config, null, 2));
}
