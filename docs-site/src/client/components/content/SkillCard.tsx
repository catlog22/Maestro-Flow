import { useI18nContext } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// SkillCard -- Skill summary card with role badges and click navigation
// ---------------------------------------------------------------------------

export interface SkillCardProps {
  name: string;
  path: string;
  category: string;
  description: string;
  roles?: string[];
  phases?: string[];
  onClick?: () => void;
  href?: string;
}

export function SkillCard({ name, category, description, roles = [], phases = [], onClick, href }: SkillCardProps) {
  const { t } = useI18nContext();

  const cardContent = (
    <div
      role="article"
      tabIndex={0}
      aria-label={`${name}: ${description}`}
      className={[
        'rounded-[var(--radius-default)] border border-border bg-bg-card/60 px-[var(--spacing-4)] py-[var(--spacing-3)]',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-notion)]',
        'hover:bg-bg-card hover:-translate-y-px hover:shadow-sm hover:border-border-secondary',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'active:scale-[0.98] active:duration-[var(--duration-fast)]',
        'cursor-pointer',
      ].join(' ')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Row 1: Name + category badge */}
      <div className="flex items-center justify-between gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
        <div className="flex items-center gap-[var(--spacing-2)]">
          <h3 className="text-[length:var(--font-size-base)] font-[var(--font-weight-semibold)] text-text-primary">
            {name}
          </h3>
          <CategoryBadge category={category} />
        </div>
        <span className="text-text-tertiary transition-transform duration-[var(--duration-fast)] group-hover:translate-x-px">
          &#8594;
        </span>
      </div>

      {/* Row 2: Description */}
      <p className="text-[length:var(--font-size-sm)] text-text-secondary leading-snug line-clamp-2 mb-[var(--spacing-2)]">
        {description}
      </p>

      {/* Row 3: Roles or phases badges */}
      <div className="flex items-center gap-[var(--spacing-1)] flex-wrap">
        {roles.length > 0 && (
          <>
            {roles.slice(0, 3).map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
            {roles.length > 3 && (
              <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
                +{roles.length - 3} {t('content.roles')}
              </span>
            )}
          </>
        )}
        {phases.length > 0 && roles.length === 0 && (
          <>
            {phases.slice(0, 2).map((phase) => (
              <PhaseBadge key={phase} phase={phase} />
            ))}
            {phases.length > 2 && (
              <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
                +{phases.length - 2} {t('content.phases')}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block group">
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pipeline: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    spec: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    quality: { bg: 'bg-green-500/10', text: 'text-green-500' },
    manage: { bg: 'bg-gray-500/10', text: 'text-gray-500' },
    maestro: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
    team: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
    cli: { bg: 'bg-slate-500/10', text: 'text-slate-500' },
    brainstorm: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
    workflow: { bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
    ddd: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
    issue: { bg: 'bg-red-500/10', text: 'text-red-500' },
    paper: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
    scholar: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
    context: { bg: 'bg-teal-500/10', text: 'text-teal-500' },
    data: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
    experiment: { bg: 'bg-lime-500/10', text: 'text-lime-500' },
    'ui-design': { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-500' },
    session: { bg: 'bg-sky-500/10', text: 'text-sky-500' },
  };

  const style = colors[category] ?? { bg: 'bg-bg-secondary', text: 'text-text-secondary' };

  return (
    <span
      className={[
        'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
        'px-[var(--spacing-1-5)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)]',
        'capitalize',
        style.bg,
        style.text,
      ].join(' ')}
    >
      {category}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={[
        'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
        'px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)]',
        'bg-indigo-500/10 text-indigo-500',
        'capitalize',
      ].join(' ')}
    >
      {role}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span
      className={[
        'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
        'px-[var(--spacing-1)] py-[var(--spacing-0-5)] rounded-[var(--radius-sm)]',
        'bg-cyan-500/10 text-cyan-500',
      ].join(' ')}
    >
      {phase}
    </span>
  );
}
