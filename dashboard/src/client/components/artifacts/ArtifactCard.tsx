import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import FileJson from 'lucide-react/dist/esm/icons/file-json.js';
import Database from 'lucide-react/dist/esm/icons/database.js';

// ---------------------------------------------------------------------------
// ArtifactCard -- gallery card for a single artifact file
// ---------------------------------------------------------------------------

interface ArtifactCardProps {
  name: string;
  path: string;
  type: string;
  isSelected: boolean;
  onClick: () => void;
}

/** Extension to display type mapping */
function getFileType(name: string): string {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.json': return 'json';
    case '.md': return 'md';
    case '.ndjson': return 'jsonl';
    default: return ext.replace('.', '') || 'file';
  }
}

/** Type-based icon, tint background, and badge colors */
function getTypeStyle(fileType: string) {
  switch (fileType) {
    case 'json':
      return {
        Icon: FileJson,
        tintBg: 'rgba(184,149,64,0.10)',
        iconColor: 'var(--color-accent-yellow)',
        badgeBg: 'rgba(184,149,64,0.12)',
        badgeColor: 'var(--color-accent-yellow)',
      };
    case 'md':
      return {
        Icon: FileText,
        tintBg: 'rgba(91,141,184,0.10)',
        iconColor: 'var(--color-accent-blue)',
        badgeBg: 'rgba(91,141,184,0.12)',
        badgeColor: 'var(--color-accent-blue)',
      };
    case 'jsonl':
      return {
        Icon: Database,
        tintBg: 'rgba(200,134,58,0.10)',
        iconColor: 'var(--color-accent-orange, #C8863A)',
        badgeBg: 'rgba(200,134,58,0.12)',
        badgeColor: 'var(--color-accent-orange, #C8863A)',
      };
    default:
      return {
        Icon: FileText,
        tintBg: 'rgba(160,157,151,0.10)',
        iconColor: 'var(--color-text-tertiary)',
        badgeBg: 'rgba(160,157,151,0.12)',
        badgeColor: 'var(--color-text-tertiary)',
      };
  }
}

export function ArtifactCard({ name, path, isSelected, onClick }: ArtifactCardProps) {
  const fileType = getFileType(name);
  const style = getTypeStyle(fileType);
  const { Icon } = style;

  // Extract parent directory for footer
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'bg-bg-card border rounded-[var(--radius-lg)] p-[14px_16px] cursor-pointer text-left w-full',
        'transition-all duration-[180ms] ease-[var(--ease-spring)]',
        'flex flex-col gap-[var(--spacing-2)]',
        'hover:-translate-y-[2px] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        isSelected
          ? 'border-accent-purple shadow-[0_0_0_2px_rgba(145,120,181,0.2)]'
          : 'border-border-divider hover:border-border',
      ].join(' ')}
    >
      {/* Top: icon + name + type badge */}
      <div className="flex items-center gap-[var(--spacing-2)]">
        <div
          className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
          style={{ background: style.tintBg, color: style.iconColor }}
        >
          <Icon size={16} strokeWidth={1.8} />
        </div>
        <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary flex-1 truncate">
          {name}
        </span>
        <span
          className="text-[9px] font-[var(--font-weight-semibold)] px-[5px] py-[1px] rounded-[var(--radius-sm)] uppercase font-mono shrink-0"
          style={{ background: style.badgeBg, color: style.badgeColor }}
        >
          {fileType}
        </span>
      </div>

      {/* Preview placeholder */}
      <div className="text-[length:var(--font-size-xs)] text-text-tertiary leading-[1.5] line-clamp-3 min-h-[48px]">
        {path}
      </div>

      {/* Footer */}
      {dir && (
        <div className="flex items-center gap-[var(--spacing-1-5)] pt-[var(--spacing-1)] border-t border-border-divider">
          <span className="text-[10px] text-text-placeholder font-mono truncate">{dir}</span>
        </div>
      )}
    </button>
  );
}
