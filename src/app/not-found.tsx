import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-navy flex items-center justify-center px-4">
      <div className="text-center">
        <p className="font-display text-8xl font-bold text-powder/20">404</p>
        <h1 className="font-display text-2xl font-bold text-snow mt-4">
          Lost in the powder
        </h1>
        <p className="text-ice/40 text-sm mt-2 max-w-sm mx-auto">
          The page you&apos;re looking for has drifted away like fresh snow.
        </p>
        <Link
          href="/feed"
          className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-powder text-navy text-sm font-semibold hover:bg-powder/90 transition-colors"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  );
}
