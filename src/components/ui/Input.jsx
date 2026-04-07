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
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
        className={`w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
