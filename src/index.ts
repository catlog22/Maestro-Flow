export { ToolRegistry } from './core/tool-registry.js';
export { ExtensionLoader } from './core/extension-loader.js';
export { loadConfig, saveConfig } from './config/index.js';
export { paths } from './config/paths.js';
export {
  createManifest,
  addFile,
  addDir,
  saveManifest,
  findManifest,
  getAllManifests,
  deleteManifest,
  cleanManifestFiles,
} from './core/manifest.js';
export type { Manifest, ManifestEntry } from './core/manifest.js';
export {
  migrateAndInject,
  injectContent,
  injectDocFile,
  removeContent,
  removeAllSections,
  hasSection,
  hasAnyMarkers,
} from './core/tag-injector.js';
export type { MigrateResult, MigrateAction, CopyStats } from './core/tag-injector.js';
export { COMPONENT_DEFS } from './core/component-defs.js';
export type { ComponentDef } from './core/component-defs.js';
export type * from './types/index.js';
