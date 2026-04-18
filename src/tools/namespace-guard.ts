/**
 * Namespace Guard — enforces per-member write isolation (team-lite).
 *
 * Pure function following the evaluate-guards pattern: takes a file path and
 * the current user's uid, returns { allowed, reason? }.
 *
 * Namespace rules:
 *   ALLOWED (own namespace):
 *     .workflow/collab/members/{selfUid}.json
 *     .workflow/collab/specs/{selfUid}/**
 *     .workflow/collab/overlays/{selfUid}-bundle.json
 *   SHARED (writable by any member):
 *     .workflow/collab/activity.jsonl
 *     .workflow/collab/overlays/manifest.json
 *     .workflow/collab/tasks/TASK-*.json
 *     .workflow/collab/tasks/.counter
 *   BLOCKED:
 *     Other members' files in the above namespaces.
 *
 * V1 is advisory — callers log warnings but do not block operations.
 */

import { resolve, normalize, relative, sep } from 'node:path';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NamespaceCheckResult {
  allowed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Shared paths (writable by any team member)
// ---------------------------------------------------------------------------

const SHARED_PATHS = [
  'activity.jsonl',
  join('overlays', 'manifest.json'),
];

// ---------------------------------------------------------------------------
// Core guard
// ---------------------------------------------------------------------------

/**
 * Check if a file path is within the allowed namespace for the given user.
 *
 * @param filePath     Absolute or project-relative path to check.
 * @param selfUid      Current user's uid (e.g. "alice").
 * @param projectRoot  Absolute path to the project root.
 */
export function evaluateNamespaceGuard(
  filePath: string,
  selfUid: string,
  projectRoot: string,
): NamespaceCheckResult {
  // Normalize to a project-relative path using forward slashes for comparison.
  const absPath = resolve(projectRoot, filePath);
  const normalizedAbs = normalize(absPath);
  const normalizedRoot = normalize(projectRoot);

  // Compute relative path from project root.
  const rel = relative(normalizedRoot, normalizedAbs);

  // If the path escapes the project root, it is outside collab scope entirely.
  if (rel.startsWith('..') || resolve(projectRoot, rel) !== normalizedAbs) {
    return { allowed: true }; // Outside collab — not our concern.
  }

  // Normalize separators to forward slash for pattern matching.
  const relFwd = rel.split(sep).join('/');

  // Only guard paths under .workflow/collab/
  const COLLAB_PREFIX = '.workflow/collab/';
  if (!relFwd.startsWith(COLLAB_PREFIX)) {
    return { allowed: true }; // Outside collab namespace — no restriction.
  }

  const collabRel = relFwd.slice(COLLAB_PREFIX.length);

  // --- Shared paths: any member can write ---
  for (const shared of SHARED_PATHS) {
    const sharedFwd = shared.split(sep).join('/');
    if (collabRel === sharedFwd) {
      return { allowed: true };
    }
  }

  // --- Members namespace ---
  if (collabRel.startsWith('members/')) {
    const fileName = collabRel.slice('members/'.length);
    if (fileName === `${selfUid}.json`) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `[NamespaceGuard] Blocked: write to member file "${fileName}" is outside your namespace (${selfUid})`,
    };
  }

  // --- Specs namespace ---
  if (collabRel.startsWith('specs/')) {
    const rest = collabRel.slice('specs/'.length);
    if (rest.startsWith(`${selfUid}/`)) {
      return { allowed: true };
    }
    const otherUid = rest.split('/')[0];
    return {
      allowed: false,
      reason: `[NamespaceGuard] Blocked: write to specs dir "${otherUid}/" is outside your namespace (${selfUid})`,
    };
  }

  // --- Overlays namespace ---
  if (collabRel.startsWith('overlays/')) {
    const fileName = collabRel.slice('overlays/'.length);
    if (fileName === `${selfUid}-bundle.json`) {
      return { allowed: true };
    }
    // Check if it's another member's bundle (pattern: {uid}-bundle.json).
    if (fileName.endsWith('-bundle.json') && fileName !== `${selfUid}-bundle.json`) {
      const otherUid = fileName.slice(0, -'-bundle.json'.length);
      return {
        allowed: false,
        reason: `[NamespaceGuard] Blocked: write to overlay bundle "${otherUid}-bundle.json" is outside your namespace (${selfUid})`,
      };
    }
    // Other overlay files (not a bundle, not manifest) — allow.
    return { allowed: true };
  }

  // --- Tasks namespace (shared writable by any member) ---
  if (collabRel.startsWith('tasks/')) {
    const fileName = collabRel.slice('tasks/'.length);
    if (fileName === '.counter' || /^TASK-\d+\.json$/.test(fileName)) {
      return { allowed: true };
    }
    // Unknown files under tasks/ — allow (finer checks in team-tasks.ts).
    return { allowed: true };
  }

  // Other paths under .workflow/collab/ — allow by default (not namespaced).
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Boundary listing
// ---------------------------------------------------------------------------

/**
 * List all allowed write paths for a user within the collab namespace.
 * Returns project-relative paths using forward slashes.
 */
export function getNamespaceBoundaries(selfUid: string, projectRoot: string): string[] {
  const prefix = '.workflow/collab';
  return [
    `${prefix}/members/${selfUid}.json`,
    `${prefix}/specs/${selfUid}/`,
    `${prefix}/overlays/${selfUid}-bundle.json`,
    // Shared paths
    `${prefix}/activity.jsonl`,
    `${prefix}/overlays/manifest.json`,
    `${prefix}/tasks/`,
  ];
}
