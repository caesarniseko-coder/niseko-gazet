export default function ModerationLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-56 rounded shimmer" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full shimmer" />
          <div className="h-8 w-20 rounded-full shimmer" />
          <div className="h-8 w-20 rounded-full shimmer" />
        </div>
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass-panel rounded-lg p-5 flex items-center justify-between"
          >
            <div className="space-y-2 flex-1">
              <div className="h-5 w-2/3 rounded shimmer" />
              <div className="h-4 w-1/3 rounded shimmer" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded shimmer" />
              <div className="h-8 w-20 rounded shimmer" />
              <div className="h-8 w-20 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
