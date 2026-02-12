export default function FieldNoteLoading() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div className="h-8 w-56 rounded shimmer" />

      <div className="glass-panel rounded-xl p-8 space-y-6">
        {["Who", "What", "When", "Where", "Why", "How"].map((label) => (
          <div key={label} className="space-y-2">
            <div className="h-4 w-20 rounded shimmer" />
            <div className="h-10 w-full rounded shimmer" />
          </div>
        ))}

        <div className="pt-4">
          <div className="h-12 w-48 rounded-lg shimmer" />
        </div>
      </div>
    </div>
  );
}
