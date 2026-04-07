export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-gray-100">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}
      {title && <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>}
      {description && <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
