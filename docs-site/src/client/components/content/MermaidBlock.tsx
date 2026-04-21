import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// ---------------------------------------------------------------------------
// MermaidBlock -- renders mermaid diagram code as SVG
// Theme-aware with clear visual hierarchy
// ---------------------------------------------------------------------------

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      // Node fill — warm white matching site card bg
      mainBkg: '#FFFFFF',
      // Node border — visible warm gray
      primaryBorderColor: '#D1CEC8',
      // Text inside nodes — dark, high contrast
      primaryTextColor: '#2D2A26',
      // Edge/arrow lines
      lineColor: '#A09D97',
      // Edge label background
      edgeLabelBackground: '#FAF8F5',
      // Cluster background & border
      clusterBkg: 'rgba(243,240,234,0.5)',
      clusterBorder: '#D1CEC8',
      // Secondary nodes
      secondaryColor: '#F3F0EA',
      secondaryBorderColor: '#D1CEC8',
      secondaryTextColor: '#2D2A26',
      // Tertiary
      tertiaryColor: '#ECEAE4',
      tertiaryBorderColor: '#D1CEC8',
      tertiaryTextColor: '#2D2A26',
      // Line thickness
      lineWidth: '1.5px',
      // Font
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
    },
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
  });
  mermaidInitialized = true;
}

interface MermaidBlockProps {
  chart: string;
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    initMermaid();

    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;

    mermaid
      .render(id, chart)
      .then(({ svg: result }) => {
        if (!cancelled) {
          setSvg(result);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid render error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="bg-bg-code rounded-[var(--radius-lg)] p-[var(--spacing-4)] my-[var(--spacing-4)] text-red-400 text-[length:var(--font-size-sm)] font-mono overflow-x-auto">
        <p className="mb-2 font-semibold">Mermaid render error:</p>
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="bg-bg-code rounded-[var(--radius-lg)] p-[var(--spacing-4)] my-[var(--spacing-4)] text-text-placeholder text-[length:var(--font-size-sm)]">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram bg-bg-code rounded-[var(--radius-lg)] p-[var(--spacing-5)] my-[var(--spacing-4)] overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
