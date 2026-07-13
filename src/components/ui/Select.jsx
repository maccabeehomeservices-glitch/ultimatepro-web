import { ChevronDown } from 'lucide-react';

export default function Select({
  label,
  value,
  onChange,
  options = [],
  error,
  disabled = false,
  placeholder,
  className = '',
  name,
}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-ink mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-ink appearance-none pr-10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent disabled:bg-background disabled:cursor-not-allowed ${error ? 'border-red-400 bg-red-50' : 'border-hairline bg-card'}`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
