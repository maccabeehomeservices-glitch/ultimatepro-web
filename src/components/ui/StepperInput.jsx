export default function StepperInput({ value, onChange, min = 0, max, step = 1 }) {
  function decrement() {
    const next = value - step;
    if (min !== undefined && next < min) return;
    onChange(next);
  }

  function increment() {
    const next = value + step;
    if (max !== undefined && next > max) return;
    onChange(next);
  }

  return (
    <div className="inline-flex items-center border border-hairline rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={decrement}
        disabled={min !== undefined && value <= min}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg font-medium text-ink hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center text-base font-semibold text-ink border-x border-hairline px-2">
        {value}
      </div>
      <button
        type="button"
        onClick={increment}
        disabled={max !== undefined && value >= max}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg font-medium text-ink hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}
