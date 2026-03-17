import { useState } from 'react';
import { useI18n } from '@/client/i18n/index.js';
import { searchInventory, type SearchResult } from '@/client/routes/route-config.js';
import { CompactSearchInput } from '@/client/components/navigation/index.js';

// ---------------------------------------------------------------------------
// SearchPage — dedicated search results page
// ---------------------------------------------------------------------------

export default function SearchPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim().length >= 2) {
      const searchResults = searchInventory(searchQuery);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search header */}
      <div className="mb-[var(--spacing-6)]">
        <h1 className="text-[length:var(--font-size-2xl)] font-[var(--font-weight-bold)] text-text-primary mb-[var(--spacing-4)]">
          {t('nav.search')}
        </h1>
        <CompactSearchInput onSearch={handleSearch} />
      </div>

      {/* Results count */}
      {query && results.length > 0 && (
        <p className="text-[length:var(--font-size-sm)] text-text-tertiary mb-[var(--spacing-4)]">
          {t('search.results_count', { count: results.length })}
        </p>
      )}

      {/* No results */}
      {query && results.length === 0 && (
        <div className="text-center py-[var(--spacing-8)]">
          <p className="text-[length:var(--font-size-base)] text-text-secondary">
            {t('search.no_results')}
          </p>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-[var(--spacing-3)]">
          {results.map((result, index) => (
            <SearchResultItem key={`${result.type}-${result.slug}-${index}`} result={result} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!query && (
        <div className="text-center py-[var(--spacing-8)]">
          <svg
            className="w-16 h-16 text-text-tertiary mx-auto mb-[var(--spacing-4)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h2 className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-2)]">
            Search Maestro Documentation
          </h2>
          <p className="text-[length:var(--font-size-base)] text-text-secondary max-w-md mx-auto">
            Enter a search term to find commands, Claude skills, and Codex skills.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchResultItem — individual search result
// ---------------------------------------------------------------------------

interface SearchResultItemProps {
  result: SearchResult;
}

function SearchResultItem({ result }: SearchResultItemProps) {
  const getTypeLabel = (type: SearchResult['type']): string => {
    switch (type) {
      case 'command':
        return 'Command';
      case 'claude_skill':
        return 'Claude Skill';
      case 'codex_skill':
        return 'Codex Skill';
    }
  };

  const getTypeColor = (type: SearchResult['type']): string => {
    switch (type) {
      case 'command':
        return 'text-accent-blue';
      case 'claude_skill':
        return 'text-accent-purple';
      case 'codex_skill':
        return 'text-accent-orange';
    }
  };

  const href =
    result.type === 'command'
      ? `/${result.category}/${result.slug}`
      : result.type === 'claude_skill'
        ? `/skills/${result.slug}`
        : `/codex/${result.slug}`;

  return (
    <a
      href={href}
      className={[
        'block p-[var(--spacing-3)] rounded-[var(--radius-default)]',
        'bg-bg-secondary border border-border',
        'transition-all duration-[var(--duration-fast)]',
        'hover:bg-bg-hover hover:border-border-focused',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-[var(--spacing-3)]">
        {/* Type badge */}
        <span
          className={[
            'shrink-0 px-2 py-0.5 text-[length:var(--font-size-xs)]',
            'font-[var(--font-weight-medium)] rounded-sm uppercase',
            'bg-bg-primary',
            getTypeColor(result.type),
          ].join(' ')}
        >
          {getTypeLabel(result.type)}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[var(--spacing-2)] mb-1">
            <h3 className="text-[length:var(--font-size-base)] font-[var(--font-weight-medium)] text-text-primary">
              {result.name}
            </h3>
            <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
              {result.category}
            </span>
          </div>
          <p className="text-[length:var(--font-size-sm)] text-text-secondary line-clamp-2">
            {result.description}
          </p>
        </div>
      </div>
    </a>
  );
}
