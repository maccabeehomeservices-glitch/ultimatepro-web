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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-gray-900 appearance-none pr-10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
