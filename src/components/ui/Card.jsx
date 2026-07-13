// ── P3.1b — Card ──────────────────────────────────────────────────────────────
// card fill · 0.5px hairline border · radius 11 (shadow removed per spec — the
// hairline replaces it). METRIC cards add a 2px brass top edge with square top
// corners + rounded bottom (pass `metric`). Flips with prefers-color-scheme via
// the card/hairline tokens.
export default function Card({ children, className = '', onClick, metric = false }) {
  const shape = metric
    ? 'border-[0.5px] border-hairline border-t-2 border-t-brass-border rounded-b-[11px] rounded-t-none'
    : 'border-[0.5px] border-hairline rounded-[11px]';
  return (
    <div
      onClick={onClick}
      className={`bg-card p-4 ${shape} ${onClick ? 'cursor-pointer transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
