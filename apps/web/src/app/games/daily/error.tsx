"use client";

export default function DailyError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl space-y-4 rounded-lg border border-line bg-panel p-8 text-paper">
      <h1 className="text-2xl font-semibold">
        Today&apos;s puzzles could not load
      </h1>
      <p className="text-sm text-muted">
        Your saved progress on this device remains available. Try loading the
        puzzle again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl border border-line-strong bg-panel-raised px-4 py-2 text-sm font-semibold hover:bg-panel-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Retry
      </button>
    </main>
  );
}
