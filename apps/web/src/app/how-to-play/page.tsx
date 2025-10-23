export const metadata = {
  title: "How to Play — GuessSenpai",
};

export default function HowToPlayPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">How to Play</h1>
      <p className="text-neutral-300">
        GuessSenpai serves three daily anime challenges using data from AniList and AnimeThemes. Each puzzle has
        three rounds of progressively revealing hints. Try to identify the show before all clues are exposed.
      </p>
      <section className="rounded-3xl bg-neutral-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Anidle</h2>
        <ul className="list-disc space-y-2 pl-5 text-neutral-300">
          <li>Type your guess; press Enter to submit.</li>
          <li>Each incorrect guess unlocks another round of hints.</li>
          <li>Hints include genres, release year, episode count, and popularity.</li>
        </ul>
      </section>
      <section className="rounded-3xl bg-neutral-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Poster Zoomed</h2>
        <ul className="list-disc space-y-2 pl-5 text-neutral-300">
          <li>The poster starts heavily cropped; reveal more to zoom out.</li>
          <li>Extra hints add genres, year, and format details.</li>
          <li>Mark it solved once you&apos;re confident in your answer.</li>
        </ul>
      </section>
      <section className="rounded-3xl bg-neutral-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Redacted Synopsis</h2>
        <ul className="list-disc space-y-2 pl-5 text-neutral-300">
          <li>Synonyms and titles are obscured with <span className="font-mono">[REDACTED]</span>.</li>
          <li>Each round unmasks additional tokens to guide your guess.</li>
        </ul>
      </section>
      <section className="rounded-3xl bg-neutral-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Guess the Opening</h2>
        <ul className="list-disc space-y-2 pl-5 text-neutral-300">
          <li>Listen to a short OP/ED clip sourced from AnimeThemes.moe.</li>
          <li>Hints reveal the season, artist, and song title across rounds.</li>
        </ul>
      </section>
      <p className="text-neutral-400 text-sm">
        Tip: use <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Backspace</kbd> to clear your current guess field quickly.
      </p>
    </div>
  );
}
