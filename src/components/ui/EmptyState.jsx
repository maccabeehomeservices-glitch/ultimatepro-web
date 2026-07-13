export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-background">
          <Icon size={32} className="text-muted" />
        </div>
      )}
      {title && <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>}
      {description && <p className="text-sm text-muted max-w-xs mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
