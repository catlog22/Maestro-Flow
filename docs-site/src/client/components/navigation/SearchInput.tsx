import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/client/i18n/index.js';
import { searchInventory, type SearchResult } from '@/client/routes/route-config.js';

// ---------------------------------------------------------------------------
// SearchInput — search input with autocomplete and keyboard shortcuts
// ---------------------------------------------------------------------------

interface SearchInputProps {
  className?: string;
  placeholder?: string;
}

export function SearchInput({ className = '', placeholder }: SearchInputProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const searchResults = searchInventory(query);
      setResults(searchResults.slice(0, 8)); // Limit to 8 results
      setFocusedIndex(-1);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && results[focusedIndex]) {
            selectResult(results[focusedIndex]);
          } else if (results.length > 0) {
            selectResult(results[0]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [results, focusedIndex]
  );

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectResult = (result: SearchResult) => {
    const href =
      result.type === 'command'
        ? `/${result.category}/${result.slug}`
        : result.type === 'claude_skill'
          ? `/skills/${result.slug}`
          : `/codex/${result.slug}`;
    navigate(href);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const getTypeLabel = (type: SearchResult['type']): string => {
    switch (type) {
      case 'command':
        return t('search.type.command');
      case 'claude_skill':
        return t('search.type.claude_skill');
      case 'codex_skill':
        return t('search.type.codex_skill');
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

  return (
    <div className={`relative ${className}`}>
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('topbar.search_placeholder')}
          aria-label={t('topbar.aria_search')}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="search-results"
          aria-activedescendant={focusedIndex >= 0 ? `result-${focusedIndex}` : undefined}
          className={[
            'w-full px-[var(--spacing-2)] py-[var(--spacing-1)] pr-20',
            'text-[length:var(--font-size-sm)]',
            'bg-bg-primary border border-border rounded-[var(--radius-default)]',
            'text-text-primary placeholder:text-text-placeholder',
            'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:border-border-focused focus-visible:shadow-[var(--shadow-focus-ring)]',
            'hover:border-border-focused',
          ].join(' ')}
        />

        {/* Search icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Keyboard shortcut hint */}
        <kbd
          className={[
            'absolute right-2 top-1/2 -translate-y-1/2',
            'px-1.5 py-0.5 text-[length:var(--font-size-xs)]',
            'bg-bg-secondary border border-border rounded',
            'text-text-tertiary font-sans',
            'hidden sm:inline-flex items-center gap-0.5',
          ].join(' ')}
        >
          <span className="text-[10px]">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>
          <span>K</span>
        </kbd>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          id="search-results"
          role="listbox"
          className={[
            'absolute z-50 w-full mt-1 overflow-hidden',
            'bg-bg-secondary border border-border rounded-[var(--radius-default)]',
            'shadow-[var(--shadow-dropdown)]',
          ].join(' ')}
        >
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.slug}`}
              id={`result-${index}`}
              role="option"
              aria-selected={focusedIndex === index}
              onClick={() => selectResult(result)}
              onMouseEnter={() => setFocusedIndex(index)}
              className={[
                'w-full px-[var(--spacing-3)] py-[var(--spacing-2)]',
                'text-left transition-colors duration-[var(--duration-fast)]',
                'focus-visible:outline-none',
                focusedIndex === index
                  ? 'bg-bg-hover'
                  : index === 0
                    ? 'bg-bg-secondary'
                    : 'bg-bg-secondary',
                focusedIndex === index || index === 0 ? 'hover:bg-bg-hover' : '',
                'border-b border-border last:border-b-0',
              ].join(' ')}
            >
              <div className="flex items-start gap-[var(--spacing-2)]">
                {/* Type badge */}
                <span
                  className={[
                    'shrink-0 px-1.5 py-0.5 text-[length:var(--font-size-xs)]',
                    'font-[var(--font-weight-medium)] rounded-sm',
                    'bg-bg-primary',
                    getTypeColor(result.type),
                  ].join(' ')}
                >
                  {getTypeLabel(result.type)}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[var(--spacing-1-5)]">
                    <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary">
                      {result.name}
                    </span>
                    <span className="text-[length:var(--font-size-xs)] text-text-tertiary">
                      {result.category}
                    </span>
                  </div>
                  <p className="text-[length:var(--font-size-xs)] text-text-secondary truncate mt-0.5">
                    {result.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div
          className={[
            'absolute z-50 w-full mt-1 px-[var(--spacing-3)] py-[var(--spacing-2)]',
            'bg-bg-secondary border border-border rounded-[var(--radius-default)]',
            'text-[length:var(--font-size-sm)] text-text-secondary',
          ].join(' ')}
        >
          {t('search.no_results')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompactSearchInput — smaller version for inline use
// ---------------------------------------------------------------------------

interface CompactSearchInputProps {
  onSearch: (query: string) => void;
  className?: string;
}

export function CompactSearchInput({ onSearch, className = '' }: CompactSearchInputProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className={[
            'w-full px-[var(--spacing-2)] py-[var(--spacing-1)] pl-8',
            'text-[length:var(--font-size-sm)]',
            'bg-bg-primary border border-border rounded-[var(--radius-sm)]',
            'text-text-primary placeholder:text-text-placeholder',
            'focus-visible:outline-none focus-visible:border-border-focused',
          ].join(' ')}
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </form>
  );
}
