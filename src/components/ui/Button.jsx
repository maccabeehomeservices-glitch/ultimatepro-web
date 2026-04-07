import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary: 'bg-[#1A73E8] text-white hover:bg-blue-700 disabled:bg-blue-300',
  outlined: 'border border-[#1A73E8] text-[#1A73E8] bg-transparent hover:bg-blue-50 disabled:opacity-50',
  danger: 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:opacity-50',
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm min-h-[44px]',
  md: 'px-4 py-2.5 text-base min-h-[44px]',
  lg: 'px-6 py-3 text-lg min-h-[44px]',
};

export default function Button({
  variant = 'primary',
  size = 'md',
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
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:ring-offset-1 disabled:cursor-not-allowed ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
