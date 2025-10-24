import GamesDirectorySection from "./GamesDirectorySection";

export const metadata = {
  title: "Games — GuessSenpai",
};

export default function GamesHubPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4 text-center sm:space-y-5">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-200/80">Choose your challenge</p>
        <h1 className="text-4xl font-display font-semibold tracking-tight text-white sm:text-5xl">
          Discover GuessSenpai games
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-neutral-200">
          Browse every puzzle we&apos;ve shipped (and the ones currently in the lab). Play any available title right away,
          and keep an eye out for upcoming releases as we expand the GuessSenpai arcade.
        </p>
      </header>

      <GamesDirectorySection />
    </div>
  );
}
