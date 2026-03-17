import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Check from 'lucide-react/dist/esm/icons/check.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import { useSpecsStore, type SpecType } from '@/client/store/specs-store.js';
import { cn } from '@/client/lib/utils.js';

// ---------------------------------------------------------------------------
// SpecAddDialog -- modal for adding a new spec entry
// ---------------------------------------------------------------------------

interface SpecAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_CHIPS: {
  value: SpecType;
  label: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
}[] = [
  { value: 'bug', label: 'Bug', activeBg: 'var(--color-tint-blocked)', activeText: '#C46555', activeBorder: '#C46555' },
  { value: 'pattern', label: 'Pattern', activeBg: 'var(--color-tint-exploring)', activeText: '#5B8DB8', activeBorder: '#5B8DB8' },
  { value: 'decision', label: 'Decision', activeBg: 'var(--color-tint-planning)', activeText: '#9178B5', activeBorder: '#9178B5' },
  { value: 'rule', label: 'Rule', activeBg: 'var(--color-tint-completed)', activeText: '#5A9E78', activeBorder: '#5A9E78' },
];

export function SpecAddDialog({ open, onOpenChange }: SpecAddDialogProps) {
  const addEntry = useSpecsStore((s) => s.addEntry);
  const files = useSpecsStore((s) => s.files);

  const [type, setType] = useState<SpecType>('bug');
  const [content, setContent] = useState('');
  const [targetFile, setTargetFile] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setType('bug');
      setContent('');
      setTargetFile('');
    }
  }, [open]);

  // Set default target file when files load
  useEffect(() => {
    if (files.length > 0 && !targetFile) {
      setTargetFile(files[0].path);
    }
  }, [files, targetFile]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    await addEntry(type, content.trim(), targetFile);
    setSubmitting(false);
    onOpenChange(false);
  }, [type, content, targetFile, addEntry, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[480px] max-w-[95vw] max-h-[80vh]',
            'rounded-[16px] border border-border bg-bg-card shadow-lg',
            'flex flex-col overflow-hidden',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-divider shrink-0">
            <Dialog.Title className="text-[16px] font-bold text-text-primary">
              New Spec Entry
            </Dialog.Title>
            <Dialog.Close
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-[8px]',
                'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
                'transition-colors border-none bg-transparent cursor-pointer',
              )}
              aria-label="Close"
            >
              <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Dialog.Close>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Type selector */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.04em] mb-[6px]">
                Type
              </label>
              <div className="flex gap-2">
                {TYPE_CHIPS.map((chip) => {
                  const active = type === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setType(chip.value)}
                      className={cn(
                        'flex-1 py-[10px] rounded-[10px] border-[1.5px] bg-bg-card cursor-pointer',
                        'text-center text-[11px] font-semibold font-sans transition-all',
                      )}
                      style={
                        active
                          ? { borderColor: chip.activeBorder, color: chip.activeText, background: chip.activeBg, fontWeight: 700 }
                          : { borderColor: 'var(--color-border, #E8E5DE)', color: 'var(--color-text-tertiary, #A09D97)' }
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content textarea */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.04em] mb-[6px]">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe the bug, pattern, decision, or rule..."
                rows={5}
                className={cn(
                  'w-full min-h-[120px] px-[14px] py-[10px] rounded-[8px]',
                  'border border-border bg-bg-primary text-[13px] text-text-primary',
                  'font-sans leading-[1.6] resize-y outline-none',
                  'focus:border-[#9178B5] transition-colors',
                  'placeholder:text-text-quaternary',
                )}
              />
              <div className="text-[11px] text-text-quaternary mt-1">
                Supports markdown. Will be timestamped automatically.
              </div>
            </div>

            {/* Target file selector */}
            {files.length > 0 && (
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-text-tertiary uppercase tracking-[0.04em] mb-[6px]">
                  Target File
                </label>
                <select
                  value={targetFile}
                  onChange={(e) => setTargetFile(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-[8px] border border-border',
                    'bg-bg-primary text-[12px] text-text-primary font-sans',
                    'outline-none cursor-pointer',
                    'focus:border-[#9178B5] transition-colors',
                  )}
                >
                  {files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name} ({f.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview box */}
            {targetFile && (
              <div className="bg-bg-primary rounded-[10px] px-4 py-[14px] border border-border-divider">
                <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-quaternary mb-2">
                  Will write to
                </div>
                <div className="flex items-center gap-[6px] px-[10px] py-[6px] rounded-[6px] bg-bg-card border border-border-divider text-[11px] font-mono text-text-secondary">
                  <FileText size={12} strokeWidth={1.8} className="text-text-tertiary" />
                  <span className="text-text-primary font-semibold">{targetFile}</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-divider shrink-0">
            <Dialog.Close
              className={cn(
                'px-4 py-2 rounded-[8px] border border-border bg-bg-card',
                'text-[12px] font-semibold text-text-secondary cursor-pointer font-sans',
                'hover:border-text-tertiary hover:text-text-primary transition-all',
              )}
            >
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={!content.trim() || submitting}
              onClick={() => void handleSubmit()}
              className={cn(
                'flex items-center gap-[6px] px-[14px] py-2 rounded-[8px] border-none',
                'bg-text-primary text-white text-[12px] font-semibold cursor-pointer font-sans',
                'hover:bg-[#1A1816] hover:-translate-y-px hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none',
              )}
            >
              <Check size={14} strokeWidth={2} />
              {submitting ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
