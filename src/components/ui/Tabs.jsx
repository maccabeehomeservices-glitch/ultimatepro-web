export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex border-b border-gray-200 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? 'border-[#1A73E8] text-[#1A73E8]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
