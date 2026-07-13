// ── P3.1b — Input (tokens) ────────────────────────────────────────────────────
// card fill · hairline border · ink text · muted label + placeholder · blue focus
// ring · radius 11 · min-h 44. Error state keeps status-red.
export default function Input({
  label,
  error,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  name,
  disabled = false,
  autoComplete,
  onFocus,
  onBlur,
  readOnly,
}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-[12px] font-medium text-muted mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        onFocus={onFocus}
        onBlur={onBlur}
        readOnly={readOnly}
        className={`w-full rounded-[11px] border px-3 py-2.5 min-h-[44px] text-ink placeholder-muted bg-card transition-colors focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed ${error ? 'border-[#DC2626]' : 'border-hairline'}`}
      />
      {error && <p className="mt-1 text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}
