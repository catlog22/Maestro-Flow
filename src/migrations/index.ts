/**
 * migrations/index.ts — Auto-registration of all migration scripts.
 *
 * Each migration file in this directory exports a default MigrationDef.
 * Import this module to register all migrations with the global registry.
 *
 * To add a new migration:
 *   1. Create src/migrations/v{FROM}-to-v{TO}.ts exporting default MigrationDef
 *   2. Import it below
 *   3. The registry auto-chains: from → to → from → to ...
 */

import { registry } from '../utils/migration-registry.js';

// --- Register all migrations in version order ---

import v1ToV2 from './v1-to-v2.js';
registry.register(v1ToV2);

// Future migrations:
// import v2ToV3 from './v2-to-v3.js';
// registry.register(v2ToV3);

export { registry };
