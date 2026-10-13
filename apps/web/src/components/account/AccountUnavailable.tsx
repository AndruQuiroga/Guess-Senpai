"use client";

export function AccountUnavailable() {
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-lg border border-line bg-panel p-8 text-paper">
      <h1 className="text-2xl font-semibold">Account data is unavailable</h1>
      <p className="text-sm text-muted">
        We couldn&apos;t connect to load your account. This does not change your
        sign-in status or local puzzle progress.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg border border-line-strong bg-panel-raised px-4 py-2 text-sm font-semibold hover:bg-panel-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Retry
      </button>
    </section>
  );
}
