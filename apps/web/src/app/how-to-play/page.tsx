import { PanelSection } from "../../components/PanelSection";

export const metadata = {
  title: "How to Play — GuessSenpai",
};

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-display font-semibold tracking-tight text-[#f4f0e7] sm:text-5xl">
          How to Play
        </h1>
        <p className="text-lg leading-relaxed text-[#c1c2bd]">
          GuessSenpai delivers daily anime challenges, with an optional opening
          mode when clips are available. Each puzzle has its own rules, and the
          new Character Silhouette mode asks you to lock in both the featured
          anime and the highlighted character before the spotlights turn on.
        </p>
      </header>

      <div className="space-y-8">
        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
              Anidle
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200">
              Metadata speedrun
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-[#c1c2bd] marker:text-brand-300">
            <li>
              Submit an anime title guess to receive metadata comparisons.
            </li>
            <li>
              Feedback compares genres, release year, episode count, popularity,
              and other available fields.
            </li>
            <li>
              Progressively revealed synopsis hints provide additional clues.
            </li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
              Poster Zoomed
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200">
              Reveal the key art
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-[#c1c2bd] marker:text-brand-300">
            <li>
              Three rounds progressively zoom the poster out—from a tight crop
              to the full key art.
            </li>
            <li>
              Each new round unlocks additional context like genres, format, and
              release metadata.
            </li>
            <li>
              Submit both the anime title and its release season or year to
              secure the clear.
            </li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
              Redacted Synopsis
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200">
              Decode the story
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-[#c1c2bd] marker:text-brand-300">
            <li>
              Synonyms and titles are obscured with{" "}
              <span className="font-mono text-brand-100">[REDACTED]</span>.
            </li>
            <li>Each round unmasks additional tokens to guide your guess.</li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
              Character Silhouette
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200">
              Dual-guess spotlight
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-[#c1c2bd] marker:text-brand-300">
            <li>Four silhouettes from the same anime appear in each round.</li>
            <li>
              Submit both the anime title and the character&apos;s name to clear
              a card.
            </li>
            <li>
              Correct anime guesses without the right character keep the card
              locked until you nail both answers.
            </li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-[#f4f0e7]">
              Guess the Opening
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-200">
              Name that tune
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-[#c1c2bd] marker:text-brand-300">
            <li>
              This optional mode appears when playable opening clips are
              available.
            </li>
            <li>Use the available clip and clues to identify its anime.</li>
          </ul>
        </PanelSection>
      </div>

      <p className="text-sm leading-relaxed text-neutral-400">
        Tip: use{" "}
        <kbd className="rounded border border-[#484b4d] bg-[#242628] px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-[#c1c2bd]">
          Ctrl
        </kbd>
        /
        <kbd className="rounded border border-[#484b4d] bg-[#242628] px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-[#c1c2bd]">
          ⌘
        </kbd>{" "}
        +{" "}
        <kbd className="rounded border border-[#484b4d] bg-[#242628] px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-[#c1c2bd]">
          Backspace
        </kbd>{" "}
        to clear your current guess field quickly.
      </p>
    </div>
  );
}
