import { useCallback, type ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  FileInput,
  SplitSquareHorizontal,
  Copy,
  FolderInput,
  Pencil,
  Trash2,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import type { FileNode } from '@/client/hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// FileContextMenu -- Radix UI ContextMenu with 8 operations
// ---------------------------------------------------------------------------
// Context menu items:
//   Open, Open to Side, (separator), Copy Path, Copy Relative Path,
//   (separator), Rename, Delete, (separator), New File, New Folder (dir only)
// ---------------------------------------------------------------------------

export interface FileContextMenuProps {
  node: FileNode;
  children: ReactNode;
  onAction: (action: ContextMenuAction, node: FileNode) => void;
}

export type ContextMenuAction =
  | 'open'
  | 'openToSide'
  | 'copyPath'
  | 'copyRelativePath'
  | 'rename'
  | 'delete'
  | 'newFile'
  | 'newFolder';

/** Copy text to clipboard */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export function FileContextMenu({ node, children, onAction }: FileContextMenuProps) {
  const isDir = node.type === 'directory';

  const handleAction = useCallback(
    (action: ContextMenuAction) => {
      // Handle copy actions inline
      if (action === 'copyPath') {
        copyToClipboard(node.path);
        return;
      }
      if (action === 'copyRelativePath') {
        // Relative path = just the node path from workspace root
        copyToClipboard(node.path);
        return;
      }
      onAction(action, node);
    },
    [node, onAction],
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={[
            'min-w-[180px] z-50 rounded-[var(--radius-md)] p-[var(--spacing-1)]',
            'bg-bg-elevated border border-border-divider',
            'shadow-[var(--shadow-lg)] animate-in fade-in-0 zoom-in-95',
          ].join(' ')}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Open */}
          <MenuLinkItem
            icon={<FileInput size={14} />}
            label="Open"
            shortcut=""
            disabled={isDir}
            onSelect={() => handleAction('open')}
          />

          {/* Open to Side */}
          <MenuLinkItem
            icon={<SplitSquareHorizontal size={14} />}
            label="Open to Side"
            shortcut=""
            disabled={isDir}
            onSelect={() => handleAction('openToSide')}
          />

          <ContextMenu.Separator className="h-px bg-border-divider my-[var(--spacing-0-5)] mx-[var(--spacing-1)]" />

          {/* Copy Path */}
          <MenuLinkItem
            icon={<Copy size={14} />}
            label="Copy Path"
            shortcut=""
            onSelect={() => handleAction('copyPath')}
          />

          {/* Copy Relative Path */}
          <MenuLinkItem
            icon={<FolderInput size={14} />}
            label="Copy Relative Path"
            shortcut=""
            onSelect={() => handleAction('copyRelativePath')}
          />

          <ContextMenu.Separator className="h-px bg-border-divider my-[var(--spacing-0-5)] mx-[var(--spacing-1)]" />

          {/* Rename */}
          <MenuLinkItem
            icon={<Pencil size={14} />}
            label="Rename"
            shortcut="F2"
            onSelect={() => handleAction('rename')}
          />

          {/* Delete */}
          <MenuLinkItem
            icon={<Trash2 size={14} />}
            label="Delete"
            shortcut="Del"
            destructive
            onSelect={() => handleAction('delete')}
          />

          {/* New File / New Folder -- only for directories */}
          {isDir && (
            <>
              <ContextMenu.Separator className="h-px bg-border-divider my-[var(--spacing-0-5)] mx-[var(--spacing-1)]" />
              <MenuLinkItem
                icon={<FilePlus size={14} />}
                label="New File"
                shortcut=""
                onSelect={() => handleAction('newFile')}
              />
              <MenuLinkItem
                icon={<FolderPlus size={14} />}
                label="New Folder"
                shortcut=""
                onSelect={() => handleAction('newFolder')}
              />
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// ---------------------------------------------------------------------------
// MenuLinkItem -- styled context menu item
// ---------------------------------------------------------------------------

interface MenuLinkItemProps {
  icon: ReactNode;
  label: string;
  shortcut: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function MenuLinkItem({ icon, label, shortcut, destructive, disabled, onSelect }: MenuLinkItemProps) {
  return (
    <ContextMenu.Item
      className={[
        'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1)]',
        'text-[length:var(--font-size-sm)] rounded-[var(--radius-sm)] cursor-pointer',
        'outline-none transition-colors',
        disabled
          ? 'text-text-tertiary pointer-events-none'
          : destructive
            ? 'text-[var(--color-accent-red)] focus:bg-[var(--color-tint-blocked)]'
            : 'text-text-primary focus:bg-bg-hover',
      ].join(' ')}
      disabled={disabled}
      onSelect={onSelect}
    >
      <span className="shrink-0 text-text-tertiary">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-text-tertiary text-[length:var(--font-size-xs)] font-mono">
          {shortcut}
        </span>
      )}
    </ContextMenu.Item>
  );
}
