export function CardSkeleton({ count = 4, cols = 4 }) {
  const colsMap = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 6: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' };
  return (
    <div className={`grid gap-4 ${colsMap[cols] || colsMap[4]}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 sm:p-6 animate-pulse">
          <div className="h-3 bg-white/10 rounded w-24 mb-3" />
          <div className="h-6 bg-white/10 rounded w-16 mb-2" />
          <div className="h-3 bg-white/10 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-2">
      <div className="flex gap-4 mb-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-white/10 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-white/5 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse p-4 sm:p-6 glass-card">
      <div className="h-3 bg-white/10 rounded w-24 mb-6" />
      <div className="flex items-end gap-2 h-32">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 bg-white/5 rounded-t" style={{ height: `${30 + Math.random() * 70}%` }} />
        ))}
      </div>
    </div>
  );
}
