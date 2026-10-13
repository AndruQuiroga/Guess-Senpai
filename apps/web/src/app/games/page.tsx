import GamesDirectorySection from "./GamesDirectorySection";

export const metadata = {
  title: "Games — GuessSenpai",
};

export default function GamesHubPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Games
        </h1>
        <p className="text-sm text-muted">
          Every daily mode available today. Each resets at 00:00 UTC.
        </p>
      </header>
      <GamesDirectorySection />
    </div>
  );
}
