const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function getInitials(name) {
  if (!name) return '?';
  // Drop parenthesized labels like "(Roster)" so they don't leak into the
  // initials. "David Yifrach (Roster)" reads as ["David", "Yifrach"] = "DY".
  const parts = name.trim().split(/\s+/).filter(p => !p.startsWith('('));
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ src, name, size = 'md', color = '#1A73E8' }) {
  const classes = `rounded-full flex items-center justify-center font-semibold text-white overflow-hidden flex-shrink-0 ${sizeMap[size] || sizeMap.md}`;

  if (src) {
    return (
      <div className={classes}>
        <img src={src} alt={name || 'avatar'} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={classes} style={{ backgroundColor: color }}>
      {getInitials(name)}
    </div>
  );
}
