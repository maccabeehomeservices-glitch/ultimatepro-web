import { Loader2 } from 'lucide-react';

// ── P3.1b/d — the app's button primitive ──────────────────────────────────────
// PEARL inlay: pearlFace face · 2.5px BLUE outer border · 2.5px BRASS inner ring
// (inset shadow) · radius 11 · height >=44 · ink label · brass icon. Stays pearl in
// BOTH modes (fixed pearl-* tokens). Used for primary + secondary CTAs.
//
// P3.1d additions (David-approved):
//  • GHOST variant — light: text + accent, no pearl fill, >=44px target, subtle hover.
//    For tertiary / inline / toolbar actions (Refresh, Copy, + Add, Export…). Still the
//    primitive, so one-system holds. `ghost-danger` / `ghost-muted` for red / neutral ghosts.
//  • STATUS colour on the pearl inlay — the LABEL takes the colour, face + rings unchanged:
//    danger red #DC2626 · success green #16A34A · warning amber #D97706. (Same rule on
//    android AppButton via labelColor.)
const PEARL_SHELL =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 text-[15px] font-medium ' +
  'rounded-[11px] bg-pearl border-[2.5px] border-pearl-blue ' +
  '[box-shadow:inset_0_0_0_2.5px_var(--color-pearl-brass-border)] transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-pearl-blue focus:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const GHOST_SHELL =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-3 text-[15px] font-medium ' +
  'rounded-[11px] transition-colors focus:outline-none focus:ring-2 focus:ring-blue ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

// variant → label/accent classes (appended to the shell)
const labelByVariant = {
  primary:        'text-pearl-ink',
  outlined:       'text-pearl-ink',      // secondary CTA — still pearl
  danger:         'text-[#DC2626]',
  success:        'text-[#16A34A]',
  warning:        'text-[#D97706]',
  ghost:          'text-blue hover:bg-blue-50 active:bg-blue-50',
  'ghost-danger': 'text-[#DC2626] hover:bg-red-50 active:bg-red-50',
  'ghost-muted':  'text-muted hover:bg-hairline active:bg-hairline',
};

const GHOST_VARIANTS = new Set(['ghost', 'ghost-danger', 'ghost-muted']);

export default function Button({
  variant = 'primary',
  size = 'md', // retained for API compat; height is uniform >=44
  loading = false,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const isGhost = GHOST_VARIANTS.has(variant);
  const shell = isGhost ? GHOST_SHELL : PEARL_SHELL;
  const spinner = isGhost ? 'text-blue' : 'text-pearl-brass';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${shell} ${labelByVariant[variant] || labelByVariant.primary} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={18} className={`animate-spin ${spinner}`} />}
      {children}
    </button>
  );
}
