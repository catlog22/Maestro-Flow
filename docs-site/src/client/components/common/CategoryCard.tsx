import { useI18nContext } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// CategoryCard -- Category landing card with icon, name, and command count
// ---------------------------------------------------------------------------

export interface CategoryCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  count: number;
  onClick?: () => void;
  href?: string;
}

export function CategoryCard({ name, description, icon, color, count, onClick, href }: CategoryCardProps) {
  const colorStyle = getColorStyle(color);

  const cardContent = (
    <div
      role="article"
      tabIndex={0}
      aria-label={`${name}: ${description}. ${count} commands`}
      className={[
        'rounded-[var(--radius-lg)] border border-border bg-bg-card/80 px-[var(--spacing-5)] py-[var(--spacing-4)]',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-notion)]',
        'hover:bg-bg-card hover:-translate-y-1 hover:shadow-md hover:border-border-secondary',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'active:scale-[0.98] active:duration-[var(--duration-fast)]',
        'cursor-pointer group',
      ].join(' ')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Row 1: Icon + name + count */}
      <div className="flex items-center justify-between mb-[var(--spacing-3)]">
        <div className="flex items-center gap-[var(--spacing-3)]">
          <div
            className={[
              'w-10 h-10 rounded-[var(--radius-default)] flex items-center justify-center',
              'transition-transform duration-[var(--duration-normal)] group-hover:scale-110',
              colorStyle.bg,
            ].join(' ')}
            aria-hidden="true"
          >
            <span className={colorStyle.text}>
              {getIconSvg(icon)}
            </span>
          </div>
          <div>
            <h3 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary">
              {name}
            </h3>
            <p className="text-[length:var(--font-size-xs)] text-text-tertiary">
              {count} {count === 1 ? 'command' : 'commands'}
            </p>
          </div>
        </div>
        <span
          className={[
            'text-text-tertiary transition-transform duration-[var(--duration-fast)]',
            'group-hover:translate-x-1 group-hover:text-text-secondary',
          ].join(' ')}
          aria-hidden="true"
        >
          &#8594;
        </span>
      </div>

      {/* Row 2: Description */}
      <p className="text-[length:var(--font-size-sm)] text-text-secondary leading-snug line-clamp-2">
        {description}
      </p>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColorStyle(color: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-500' },
    gray: { bg: 'bg-gray-500/10', text: 'text-gray-500' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-500' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-500' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
    lime: { bg: 'bg-lime-500/10', text: 'text-lime-500' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-500' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-500' },
  };

  return colors[color] ?? { bg: 'bg-bg-secondary', text: 'text-text-secondary' };
}

function getIconSvg(icon: string): string {
  const icons: Record<string, string> = {
    'git-branch': '&#128193;', // Branch icon
    'file-text': '&#128196;', // Document icon
    'check-circle': '&#10004;', // Check icon
    'settings': '&#9881;', // Gear icon
    'cpu': '&#128187;', // Computer icon
    'users': '&#128101;', // Users icon
    'terminal': '&#8962;', // Terminal icon
    'lightbulb': '&#128161;', // Lightbulb icon
    'workflow': '&#8635;', // Workflow icon
    'book': '&#128214;', // Book icon
    'issue': '&#9888;', // Warning icon
    'file-document': '&#128196;', // Document icon
    'graduation-cap': '&#127891;', // Graduation cap icon
    'database': '&#128736;', // Database icon
    'chart-bar': '#128466;', // Chart icon
    'flask': '#127795;', // Flask icon
    'palette': '&#127912;', // Palette icon
    'session': '#128474;', // Session icon
  };

  return icons[icon] ?? '#10067'; // Default circle icon
}
