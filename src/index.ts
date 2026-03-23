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
export type * from './types/index.js';
