// ---------------------------------------------------------------------------
// commandMetadata — Structured bilingual metadata for commands and skills
// Sourced from commands-zh-CN.json, independent of the i18n string system
// ---------------------------------------------------------------------------

import rawData from '../i18n/locales/commands-zh-CN.json';

export interface CommandMetadata {
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  workflow?: string;
  workflow_zh?: string;
  prev_commands?: string[];
  next_commands?: string[];
  flags?: string[];
}

export interface SkillMetadata {
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  workflow?: string;
  workflow_zh?: string;
  roles?: string[];
  phases_zh?: string[];
}

const commandsMap = rawData.commands as Record<string, CommandMetadata>;
const skillsMap = rawData.skills as Record<string, SkillMetadata>;

export function getCommandMetadata(commandName: string): CommandMetadata | null {
  return commandsMap[commandName] ?? null;
}

export function getSkillMetadata(skillName: string): SkillMetadata | null {
  return skillsMap[skillName] ?? null;
}
