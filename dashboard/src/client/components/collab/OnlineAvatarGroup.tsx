import { useEffect, useState } from 'react';
import { useCollabStore } from '@/client/store/collab-store.js';
import { COLLAB_STATUS_COLORS } from '@/shared/collab-types.js';
import type { CollabPresence } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// OnlineAvatarGroup — compact avatar cluster for the TopBar
// Self-bootstraps: checks preflight once, then polls presence if team enabled
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 4;
const AVATAR_SIZE = 32;
const OVERLAP_MARGIN = -8;
const PRESENCE_POLL_MS = 60_000; // refresh every 60s

const STATUS_DOT_COLORS: Record<CollabPresence['status'], string> = COLLAB_STATUS_COLORS;

export function OnlineAvatarGroup() {
  const presence = useCollabStore((s) => s.presence);
  const fetchPreflight = useCollabStore((s) => s.fetchPreflight);
  const fetchPresence = useCollabStore((s) => s.fetchPresence);
  const disableCollab = useCollabStore((s) => s.disableCollab);

  const [teamEnabled, setTeamEnabled] = useState<boolean | null>(null); // null = unknown
  const [showMenu, setShowMenu] = useState(false);

  // Bootstrap: check if team mode is active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPreflight();
      if (cancelled) return;
      const enabled = result?.exists ?? false;
      setTeamEnabled(enabled);
      if (enabled) void fetchPresence();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll presence when team is active
  useEffect(() => {
    if (!teamEnabled) return;
    const id = setInterval(() => { void fetchPresence(); }, PRESENCE_POLL_MS);
    return () => clearInterval(id);
  }, [teamEnabled, fetchPresence]);

  // Not enabled or still loading
  if (!teamEnabled || presence.length === 0) return null;

  const visible = presence.slice(0, MAX_VISIBLE);
  const remaining = presence.length - MAX_VISIBLE;

  async function handleDisable() {
    setShowMenu(false);
    const result = await disableCollab();
    if (result.success) {
      setTeamEnabled(false);
    }
  }

  return (
    <div className="relative flex items-center flex-shrink-0">
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="flex items-center cursor-pointer"
        role="group"
        aria-label="Online members"
      >
        {visible.map((member, i) => (
          <div
            key={member.uid}
            title={`${member.name} — ${member.status}`}
            className="relative rounded-full border-2 border-bg-secondary"
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              marginLeft: i === 0 ? 0 : OVERLAP_MARGIN,
              backgroundColor: '#6b7280',
              zIndex: visible.length - i,
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold select-none">
              {member.name.charAt(0).toUpperCase()}
            </span>
            <span
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-[1.5px] border-bg-secondary"
              style={{ backgroundColor: STATUS_DOT_COLORS[member.status] }}
            />
          </div>
        ))}
        {remaining > 0 && (
          <div
            className="relative flex items-center justify-center rounded-full border-2 border-bg-secondary bg-bg-hover"
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              marginLeft: OVERLAP_MARGIN,
              zIndex: 0,
            }}
          >
            <span className="text-text-secondary text-[9px] font-semibold">+{remaining}</span>
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-[var(--radius-md,6px)] border border-border bg-bg-primary shadow-lg py-1">
            {/* Members list */}
            <div className="px-3 py-1.5 text-[10px] text-text-quaternary uppercase tracking-wider">
              Team ({presence.length})
            </div>
            {presence.map((m) => (
              <div key={m.uid} className="flex items-center gap-2 px-3 py-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_DOT_COLORS[m.status] }}
                />
                <span className="text-[length:var(--font-size-xs)] text-text-primary truncate">{m.name}</span>
                <span className="text-[10px] text-text-quaternary ml-auto">{m.status}</span>
              </div>
            ))}
            {/* Divider */}
            <div className="h-px bg-border my-1" />
            {/* Disable button */}
            <button
              type="button"
              onClick={handleDisable}
              className="w-full text-left px-3 py-1.5 text-[length:var(--font-size-xs)] text-accent-red hover:bg-bg-hover transition-colors"
            >
              Disable Team Mode
            </button>
          </div>
        </>
      )}
    </div>
  );
}
