import { Loader2 } from 'lucide-react';

// ── P3.1b — ONE button: the pearl inlay ───────────────────────────────────────
// pearlFace face · 2.5px BLUE outer border · 2.5px BRASS inner ring flush (inset
// shadow) · radius 11 · height >=44 · ink label (14-16, w500) · brass icon.
// It is a signature element that stays pearl in BOTH light + dark (fixed pearl-*
// tokens, never flips). The `variant`/`size` props are RETAINED so existing call
// sites keep working (law 1 — edit, don't recreate); every variant uses the same
// shell. `danger` tints the label/icon to status-red to preserve the destructive
// signal. (ghost/outlined emphasis + per-call-site icon sizing → unknowns ledger.)
const labelByVariant = {
  primary:  'text-pearl-ink',
  outlined: 'text-pearl-ink',
  ghost:    'text-pearl-ink',
  danger:   'text-[#DC2626]',
};

export default function Button({
  variant = 'primary',
  size = 'md', // retained for API compat; height is uniform >=44 per spec
  loading = false,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 text-[15px] font-medium rounded-[11px] bg-pearl border-[2.5px] border-pearl-blue [box-shadow:inset_0_0_0_2.5px_var(--color-pearl-brass-border)] transition-colors focus:outline-none focus:ring-2 focus:ring-pearl-blue focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${labelByVariant[variant] || labelByVariant.primary} ${className}`}
    >
      {loading && <Loader2 size={18} className="animate-spin text-pearl-brass" />}
      {children}
    </button>
  );
}
