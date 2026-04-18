import { memo, useState, useCallback, useRef, type DragEvent } from 'react';

// ---------------------------------------------------------------------------
// DropZoneOverlay -- 5-region drop zone for tab drag-to-split
// ---------------------------------------------------------------------------
// - 5 zones: center (no split), left, right, top, bottom
// - Each edge zone covers 0-25% of its axis
// - Center zone covers the inner 50% area (no split)
// - Visual indicator shows translucent highlight on active zone
// - Only activates after 10px drag distance from origin
// ---------------------------------------------------------------------------

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom' | null;

interface DropZoneOverlayProps {
  /** Called when a tab is dropped on a zone */
  onDrop: (zone: DropZone) => void;
  /** Whether the overlay is visible */
  visible: boolean;
}

/** Zone styles for visual feedback */
const ZONE_STYLES: Record<Exclude<DropZone, null>, string> = {
  center: 'bg-accent-blue/10 border-accent-blue/30',
  left: 'bg-accent-blue/15 border-l-2 border-accent-blue/50',
  right: 'bg-accent-blue/15 border-r-2 border-accent-blue/50',
  top: 'bg-accent-blue/15 border-t-2 border-accent-blue/50',
  bottom: 'bg-accent-blue/15 border-b-2 border-accent-blue/50',
};

/** Zone labels for accessibility */
const ZONE_LABELS: Record<Exclude<DropZone, null>, string> = {
  center: 'Move to group',
  left: 'Split left',
  right: 'Split right',
  top: 'Split up',
  bottom: 'Split down',
};

export const DropZoneOverlay = memo(function DropZoneOverlay({ onDrop, visible }: DropZoneOverlayProps) {
  const [activeZone, setActiveZone] = useState<DropZone>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculateZone = useCallback((clientX: number, clientY: number): DropZone => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 'center';

    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    const edgeThreshold = 0.25;

    // Check edges first (priority over center)
    if (relX < edgeThreshold) return 'left';
    if (relX > 1 - edgeThreshold) return 'right';
    if (relY < edgeThreshold) return 'top';
    if (relY > 1 - edgeThreshold) return 'bottom';

    return 'center';
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setActiveZone(calculateZone(e.clientX, e.clientY));
  }, [calculateZone]);

  const handleDragLeave = useCallback(() => {
    setActiveZone(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zone = calculateZone(e.clientX, e.clientY);
    setActiveZone(null);
    onDrop(zone);
  }, [calculateZone, onDrop]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full overlay with zone regions */}
      <div className="relative w-full h-full">
        {/* Left zone */}
        <ZoneRegion
          zone="left"
          activeZone={activeZone}
          className="absolute left-0 top-0 bottom-0 w-[25%]"
        />
        {/* Right zone */}
        <ZoneRegion
          zone="right"
          activeZone={activeZone}
          className="absolute right-0 top-0 bottom-0 w-[25%]"
        />
        {/* Top zone */}
        <ZoneRegion
          zone="top"
          activeZone={activeZone}
          className="absolute left-[25%] right-[25%] top-0 h-[25%]"
        />
        {/* Bottom zone */}
        <ZoneRegion
          zone="bottom"
          activeZone={activeZone}
          className="absolute left-[25%] right-[25%] bottom-0 h-[25%]"
        />
        {/* Center zone */}
        <ZoneRegion
          zone="center"
          activeZone={activeZone}
          className="absolute left-[25%] right-[25%] top-[25%] bottom-[25%]"
        />
      </div>
    </div>
  );
});

/** Individual zone region with visual feedback */
function ZoneRegion({
  zone,
  activeZone,
  className,
}: {
  zone: Exclude<DropZone, null>;
  activeZone: DropZone;
  className: string;
}) {
  const isActive = activeZone === zone;

  return (
    <div
      className={`${className} transition-all duration-150 ${
        isActive ? ZONE_STYLES[zone] : 'border border-transparent'
      }`}
      aria-label={ZONE_LABELS[zone]}
    >
      {isActive && (
        <div className="flex items-center justify-center h-full">
          <span className="text-[length:var(--font-size-xs)] text-accent-blue font-[var(--font-weight-medium)] bg-bg-primary/80 px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]">
            {ZONE_LABELS[zone]}
          </span>
        </div>
      )}
    </div>
  );
}
