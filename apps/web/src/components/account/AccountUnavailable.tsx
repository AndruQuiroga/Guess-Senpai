"use client";

export function AccountUnavailable() {
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-lg border border-[#484b4d] bg-[#242628] p-8 text-[#f4f0e7]">
      <h1 className="text-2xl font-semibold">Account data is unavailable</h1>
      <p className="text-sm text-[#c1c2bd]">
        We couldn&apos;t connect to load your account. This does not change your
        sign-in status or local puzzle progress.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg border border-[#686b6d] bg-[#2c2f31] px-4 py-2 text-sm font-semibold hover:bg-[#2c2f31] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Retry
      </button>
    </section>
  );
}
