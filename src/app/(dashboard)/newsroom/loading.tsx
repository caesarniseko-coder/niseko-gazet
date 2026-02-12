export default function NewsroomLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded shimmer" />
        <div className="h-10 w-32 rounded shimmer" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Draft", "In Review", "Published"].map((col) => (
          <div key={col} className="space-y-3">
            <div className="h-5 w-24 rounded shimmer" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass-panel rounded-lg p-4 space-y-3"
              >
                <div className="h-5 w-full rounded shimmer" />
                <div className="h-4 w-3/4 rounded shimmer" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full shimmer" />
                  <div className="h-5 w-16 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
