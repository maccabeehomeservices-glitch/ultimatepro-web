export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex border-b border-hairline min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? 'border-blue text-blue'
                : 'border-transparent text-muted hover:text-ink hover:border-hairline'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
