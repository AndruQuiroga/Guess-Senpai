import { GlassSection } from "../../components/GlassSection";

export const metadata = {
  title: "How to Play — GuessSenpai",
};

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-display font-semibold tracking-tight text-white sm:text-5xl">How to Play</h1>
        <p className="text-lg leading-relaxed text-neutral-200">
          GuessSenpai serves three daily anime challenges using data from AniList and AnimeThemes. Each puzzle unfolds
          across three rounds of progressively revealing hints—see how quickly you can identify the show before every
          clue is revealed.
        </p>
      </header>

      <div className="space-y-8">
        <GlassSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-white">Anidle</h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200/80">Metadata speedrun</p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-neutral-200 marker:text-brand-300">
            <li>Type your guess and press Enter to submit.</li>
            <li>Each incorrect guess unlocks another round of hints.</li>
            <li>Hints include genres, release year, episode count, and popularity.</li>
          </ul>
        </GlassSection>

        <GlassSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-white">Poster Zoomed</h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200/80">Reveal the key art</p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-neutral-200 marker:text-brand-300">
            <li>The poster starts heavily cropped; reveal more to zoom out.</li>
            <li>Extra hints add genres, year, and format details.</li>
            <li>Mark it solved once you&apos;re confident in your answer.</li>
          </ul>
        </GlassSection>

        <GlassSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-white">Redacted Synopsis</h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200/80">Decode the story</p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-neutral-200 marker:text-brand-300">
            <li>
              Synonyms and titles are obscured with <span className="font-mono text-brand-100">[REDACTED]</span>.
            </li>
            <li>Each round unmasks additional tokens to guide your guess.</li>
          </ul>
        </GlassSection>

        <GlassSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-white">Guess the Opening</h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200/80">Name that tune</p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-neutral-200 marker:text-brand-300">
            <li>Listen to a short OP/ED clip sourced from AnimeThemes.moe.</li>
            <li>Hints reveal the season, artist, and song title across rounds.</li>
          </ul>
        </GlassSection>
      </div>

      <p className="text-sm leading-relaxed text-neutral-400">
        Tip: use <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-neutral-200">Ctrl</kbd>
        /<kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-neutral-200">⌘</kbd>{" "}
        + <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-neutral-200">Backspace</kbd>{" "}
        to clear your current guess field quickly.
      </p>
    </div>
  );
}
