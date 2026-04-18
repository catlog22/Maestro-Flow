import type { ComponentType, ReactNode } from 'react';
import {
  FileText,
  FileJson,
  FileType,
  FileCode2,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Database,
  FileSymlink,
  Folder,
  FolderOpen,
  File,
  type LucideProps,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// FileIcon -- maps file extension to appropriate icon for 20+ formats
// ---------------------------------------------------------------------------

export interface FileIconProps {
  /** File extension including dot (e.g. '.ts', '.json') */
  extension?: string;
  /** Full filename -- used as fallback if extension is missing */
  filename?: string;
  /** Icon size in pixels (default 14) */
  size?: number;
  /** Whether the folder is expanded */
  isExpanded?: boolean;
  /** Whether this represents a directory */
  isDirectory?: boolean;
}

/** Icon map: extension -> icon component. Covers 20+ formats. */
const EXTENSION_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  // Languages
  '.ts': FileCode2,
  '.tsx': FileCode2,
  '.js': FileCode2,
  '.jsx': FileCode2,
  '.mjs': FileCode2,
  '.cjs': FileCode2,
  '.py': FileCode2,
  '.rs': FileCode2,
  '.go': FileCode2,
  '.java': FileCode2,
  '.rb': FileCode2,
  '.php': FileCode2,
  '.swift': FileCode2,
  '.kt': FileCode2,
  '.c': FileCode2,
  '.cpp': FileCode2,
  '.h': FileCode2,

  // Data & Config
  '.json': FileJson,
  '.jsonl': Database,
  '.ndjson': Database,
  '.yaml': FileType,
  '.yml': FileType,
  '.toml': FileType,
  '.xml': FileType,
  '.csv': Database,
  '.ini': FileType,
  '.conf': FileType,

  // Documentation
  '.md': FileText,
  '.mdx': FileText,
  '.txt': FileText,
  '.rst': FileText,
  '.adoc': FileText,
  '.pdf': FileText,

  // Web
  '.html': FileCode2,
  '.htm': FileCode2,
  '.css': FileCode2,
  '.scss': FileCode2,
  '.less': FileCode2,
  '.svg': FileImage,

  // Shell & Scripts
  '.sh': FileCode2,
  '.bash': FileCode2,
  '.zsh': FileCode2,
  '.fish': FileCode2,
  '.ps1': FileCode2,
  '.bat': FileCode2,
  '.cmd': FileCode2,

  // Media
  '.png': FileImage,
  '.jpg': FileImage,
  '.jpeg': FileImage,
  '.gif': FileImage,
  '.webp': FileImage,
  '.ico': FileImage,
  '.bmp': FileImage,
  '.mp4': FileVideo,
  '.mov': FileVideo,
  '.avi': FileVideo,
  '.webm': FileVideo,
  '.mp3': FileAudio,
  '.wav': FileAudio,
  '.ogg': FileAudio,
  '.flac': FileAudio,

  // Archives
  '.zip': FileArchive,
  '.tar': FileArchive,
  '.gz': FileArchive,
  '.rar': FileArchive,
  '.7z': FileArchive,

  // Database
  '.sql': Database,
  '.db': Database,
  '.sqlite': Database,

  // Lock & env
  '.lock': FileSymlink,
  '.env': FileSymlink,
};

/** Special filenames that get unique icons */
const SPECIAL_FILE_ICONS: Record<string, ComponentType<LucideProps>> = {
  '.gitignore': FileSymlink,
  '.gitattributes': FileSymlink,
  '.eslintrc': FileType,
  '.prettierrc': FileType,
  'tsconfig.json': FileType,
  'package.json': FileJson,
  'package-lock.json': FileSymlink,
  'dockerfile': FileArchive,
  'makefile': FileCode2,
  'license': FileText,
  'license.md': FileText,
};

/** Resolve the extension from filename */
function resolveExtension(filename?: string, extension?: string): string {
  if (extension) return extension.startsWith('.') ? extension : `.${extension}`;
  if (filename && filename.includes('.')) {
    return filename.slice(filename.lastIndexOf('.')).toLowerCase();
  }
  return '';
}

export function FileIcon({
  extension,
  filename,
  size = 14,
  isExpanded,
  isDirectory,
}: FileIconProps): ReactNode {
  // Directory icon
  if (isDirectory) {
    const FolderComponent = isExpanded ? FolderOpen : Folder;
    return (
      <FolderComponent
        size={size}
        strokeWidth={1.8}
        style={{ color: 'var(--color-accent-yellow)' }}
      />
    );
  }

  // Check special filenames first
  const lowerName = (filename ?? '').toLowerCase();
  if (SPECIAL_FILE_ICONS[lowerName]) {
    const SpecialIcon = SPECIAL_FILE_ICONS[lowerName];
    return <SpecialIcon size={size} strokeWidth={1.8} />;
  }

  // Extension lookup
  const ext = resolveExtension(filename, extension);
  const IconComponent = EXTENSION_ICON_MAP[ext] ?? File;

  return <IconComponent size={size} strokeWidth={1.8} />;
}
