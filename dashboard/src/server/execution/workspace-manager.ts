// ---------------------------------------------------------------------------
// WorkspaceManager — per-issue workspace isolation via git worktree
// ---------------------------------------------------------------------------

import { execFile } from 'node:child_process';
import { mkdir, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceConfig {
  /** Root directory for worktrees. Defaults to .worktrees/ in project root */
  root?: string;
  /** Whether to use git worktree (true) or just a subdirectory (false) */
  useWorktree: boolean;
  /** Base branch for worktree creation. Defaults to current HEAD */
  baseBranch?: string;
  /** Auto-cleanup completed worktrees */
  autoCleanup: boolean;
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  useWorktree: true,
  autoCleanup: true,
};

export interface WorkspaceInfo {
  issueId: string;
  path: string;
  branch?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// WorkspaceManager
// ---------------------------------------------------------------------------

export class WorkspaceManager {
  private readonly activeWorkspaces = new Map<string, WorkspaceInfo>();
  private readonly config: WorkspaceConfig;
  private readonly projectRoot: string;
  private readonly worktreeRoot: string;

  constructor(projectRoot: string, config?: Partial<WorkspaceConfig>) {
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
    this.projectRoot = resolve(projectRoot);
    this.worktreeRoot = resolve(this.config.root ?? join(projectRoot, '.worktrees'));
  }

  /**
   * Create an isolated workspace for an issue.
   * Uses git worktree for full isolation with shared .git objects.
   */
  async createForIssue(issueId: string): Promise<WorkspaceInfo> {
    // Return existing workspace if already created
    const existing = this.activeWorkspaces.get(issueId);
    if (existing) {
      try {
        await access(existing.path);
        return existing;
      } catch {
        // Path gone, recreate
        this.activeWorkspaces.delete(issueId);
      }
    }

    const safeName = this.safeIdentifier(issueId);
    const workspacePath = join(this.worktreeRoot, safeName);

    await mkdir(this.worktreeRoot, { recursive: true });

    let info: WorkspaceInfo;

    if (this.config.useWorktree) {
      info = await this.createWorktree(issueId, safeName, workspacePath);
    } else {
      info = await this.createDirectory(issueId, workspacePath);
    }

    this.activeWorkspaces.set(issueId, info);
    return info;
  }

  /**
   * Remove workspace after issue completion.
   */
  async removeForIssue(issueId: string): Promise<void> {
    const info = this.activeWorkspaces.get(issueId);
    if (!info) return;

    try {
      if (this.config.useWorktree && info.branch) {
        // Remove git worktree
        await execFileAsync('git', ['worktree', 'remove', '--force', info.path], {
          cwd: this.projectRoot,
        });
        // Delete the branch — tolerate "not found" but warn on other errors
        await execFileAsync('git', ['branch', '-D', info.branch], {
          cwd: this.projectRoot,
        }).catch((err: unknown) => {
          const stderr = (err as { stderr?: string }).stderr ?? '';
          if (!stderr.includes('not found')) {
            console.warn(`[Workspace] Failed to delete branch ${info.branch}:`, stderr);
          }
        });
      } else {
        await rm(info.path, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`[Workspace] Failed to remove workspace for ${issueId}:`, err);
    }

    this.activeWorkspaces.delete(issueId);
  }

  /**
   * Get workspace path for an issue, or undefined if not created.
   */
  getWorkspacePath(issueId: string): string | undefined {
    return this.activeWorkspaces.get(issueId)?.path;
  }

  /**
   * List all active workspaces.
   */
  listActive(): WorkspaceInfo[] {
    return Array.from(this.activeWorkspaces.values());
  }

  /**
   * Clean up all active workspaces (shutdown).
   */
  async destroy(): Promise<void> {
    if (!this.config.autoCleanup) return;

    const issueIds = Array.from(this.activeWorkspaces.keys());
    await Promise.allSettled(issueIds.map((id) => this.removeForIssue(id)));
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async createWorktree(
    issueId: string,
    safeName: string,
    workspacePath: string,
  ): Promise<WorkspaceInfo> {
    const branch = `issue/${safeName}`;
    const baseBranch = this.config.baseBranch ?? 'HEAD';

    // Ensure no stale worktree at this path
    try {
      await access(workspacePath);
      await execFileAsync('git', ['worktree', 'remove', '--force', workspacePath], {
        cwd: this.projectRoot,
      }).catch(() => {});
    } catch {
      // Path doesn't exist, clean
    }

    // Delete stale branch if exists
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: this.projectRoot,
    }).catch(() => {});

    // Create worktree with new branch
    await execFileAsync(
      'git',
      ['worktree', 'add', '-b', branch, workspacePath, baseBranch],
      { cwd: this.projectRoot },
    );

    return {
      issueId,
      path: workspacePath,
      branch,
      createdAt: new Date().toISOString(),
    };
  }

  private async createDirectory(
    issueId: string,
    workspacePath: string,
  ): Promise<WorkspaceInfo> {
    await mkdir(workspacePath, { recursive: true });
    return {
      issueId,
      path: workspacePath,
      createdAt: new Date().toISOString(),
    };
  }

  /** Convert issue ID to filesystem-safe identifier */
  private safeIdentifier(issueId: string): string {
    return issueId
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }
}
