import { useI18n } from '@/client/i18n/index.js';
import type { Category } from '@/client/routes/route-config.js';
import { getCategoryIcon } from '@/client/utils/categoryIcons.js';

// ---------------------------------------------------------------------------
// LandingPage — home page with category cards
// ---------------------------------------------------------------------------

interface LandingPageProps {
  categories: Category[];
}

export default function LandingPage({ categories }: LandingPageProps) {
  const { t } = useI18n();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero section */}
      <div className="mb-[var(--spacing-8)] text-center">
        <h1 className="text-[length:var(--font-size-3xl)] font-[var(--font-weight-bold)] text-text-primary mb-[var(--spacing-3)]">
          Maestro Documentation
        </h1>
        <p className="text-[length:var(--font-size-lg)] text-text-secondary max-w-2xl mx-auto">
          {t('landing.description')}
        </p>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-4)]">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryCard — individual category card
// ---------------------------------------------------------------------------

interface CategoryCardProps {
  category: Category;
}

function CategoryCard({ category }: CategoryCardProps) {
  return (
    <a
      href={`/${category.id}`}
      className={[
        'block p-[var(--spacing-4)] rounded-[var(--radius-lg)]',
        'bg-bg-secondary border border-border',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'hover:shadow-[var(--shadow-card)] hover:border-border-focused',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
      ].join(' ')}
    >
      {/* Category icon/name */}
      <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-2)]">
        <span className="text-[length:var(--font-size-xl)]">
          {getCategoryIcon(category.id)}
        </span>
        <h3 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary">
          {category.name}
        </h3>
      </div>

      {/* Description */}
      <p className="text-[length:var(--font-size-sm)] text-text-secondary line-clamp-2">
        {category.description}
      </p>
    </a>
  );
}
