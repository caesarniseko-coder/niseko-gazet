export default function FeedLoading() {
  return (
    <div className="feed-scroll">
      {[0, 1, 2].map((i) => (
        <div key={i} className="feed-card flex items-center justify-center">
          <div className="absolute inset-0 bg-navy-light" />
          <div className="relative z-10 w-full max-w-md px-6 space-y-4">
            <div className="h-4 w-20 rounded shimmer" />
            <div className="h-8 w-full rounded shimmer" />
            <div className="h-8 w-3/4 rounded shimmer" />
            <div className="h-4 w-full rounded shimmer mt-6" />
            <div className="h-4 w-5/6 rounded shimmer" />
            <div className="h-4 w-2/3 rounded shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
