"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-6 h-6 text-sunset"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-snow">
          Something went wrong
        </h1>
        <p className="text-ice/40 text-sm mt-2 max-w-sm mx-auto">
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={reset}
          className="mt-6 px-6 py-2.5 rounded-lg bg-powder text-navy text-sm font-semibold hover:bg-powder/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
