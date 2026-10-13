export default function DailyLoading() {
  return (
    <main
      className="mx-auto max-w-5xl space-y-6"
      aria-live="polite"
      aria-busy="true"
    >
      <h1 className="text-2xl font-semibold text-white">
        Loading today&apos;s puzzles…
      </h1>
      <div className="h-40 animate-pulse rounded-lg border border-[#484b4d] bg-[#242628]" />
      <div className="h-64 animate-pulse rounded-lg border border-[#484b4d] bg-[#242628]" />
    </main>
  );
}
