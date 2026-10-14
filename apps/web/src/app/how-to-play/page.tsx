import { PanelSection } from "../../components/PanelSection";

export const metadata = {
  title: "How to Play — GuessSenpai",
};

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-display font-semibold tracking-tight text-paper sm:text-5xl">
          How to Play
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          GuessSenpai delivers daily anime challenges, with an optional opening
          mode when clips are available. Each puzzle has its own rules, and most
          play an Easy, Medium and Hard round with points.
        </p>
      </header>

      <div className="space-y-8">
        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
              Anidle
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-signal-text">
              Metadata speedrun
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
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
            <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
              Poster Zoomed
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-signal-text">
              Reveal the key art
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
            <li>
              Three different anime, with Easy, Medium and Hard determined by
              popularity. Each starts with a cropped poster.
            </li>
            <li>
              Optional clues zoom out or reveal genres for a points cost. The
              full poster appears after submitting.
            </li>
            <li>
              The title earns 600 points. With the correct anime: a release year
              one off earns 50, exact year 100, exact year and
              Winter/Spring/Summer/Fall 200 total. Numbered season adds another
              200 when available.
            </li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <h2 className="text-2xl font-display font-semibold text-paper">
            Poster Modified
          </h2>
          <p className="text-base leading-relaxed text-muted">
            A separate daily mode with spotlit, mosaic and shuffled-tile
            posters: one of each in a shuffled daily order. Difficulty follows
            anime popularity, independently of the effect. Each round uses a
            different anime, with the same 600 title points and optional bonuses
            as Poster Zoomed. Buy a clearer image or genres for a points cost.
          </p>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
              Redacted Synopsis
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-signal-text">
              Decode the story
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
            <li>
              Synonyms and titles are obscured with{" "}
              <span className="font-mono text-paper">[REDACTED]</span>.
            </li>
            <li>Each round unmasks additional tokens to guide your guess.</li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
              Guess the Character
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-signal-text">
              Name the lineup
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
            <li>
              Each round shows four hidden characters, each from a different
              anime.
            </li>
            <li>
              Fill in every character&apos;s name and anime, then check them all
              at once. Each card shows its own result.
            </li>
            <li>
              Every round uses popular characters: Easy is a blurred full-colour
              zoom, Medium a black-and-white close-up, Hard a full-colour
              mosaic. Buy a clearer view of a card for a points cost.
            </li>
          </ul>
        </PanelSection>

        <PanelSection innerClassName="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
              Guess the Opening
            </h2>
            <p className="text-sm uppercase tracking-[0.24em] text-signal-text">
              Name that tune
            </p>
          </div>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
            <li>
              This optional mode appears when playable opening clips are
              available.
            </li>
            <li>
              Name the anime for 1,000 points. With the correct anime: release
              year one off earns 50, exact year 100, exact year and release
              season 200 total. Numbered season adds another 200 when available,
              for up to 1,400 per round.
            </li>
          </ul>
        </PanelSection>

        <PanelSection
          id="daily-score"
          className="scroll-mt-20"
          innerClassName="space-y-4"
        >
          <h2 className="text-2xl font-display font-semibold tracking-tight text-paper">
            Daily score
          </h2>
          <ul className="list-disc space-y-3 pl-6 text-base leading-relaxed text-muted marker:text-signal-text">
            <li>
              Most daily modes are worth up to 3,000 points. Guess the Opening
              can earn up to 4,200 with bonuses. The maximum reflects the
              metadata available for your rounds; older saved scores are kept.
            </li>
            <li>
              Every round takes one answer; hints you choose to take come off
              that round. Bonus fields are optional and earn points only with a
              correct anime answer.
            </li>
            <li>
              Anidle: solving on guess 1 earns 3,000, and each extra guess costs
              a twentieth of that.
            </li>
            <li>
              Unsolved or out-of-guesses modes score 0. The score is computed on
              your device for fun and is not a ranking.
            </li>
          </ul>
        </PanelSection>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        Tip: use{" "}
        <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-muted">
          Ctrl
        </kbd>
        /
        <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-muted">
          ⌘
        </kbd>{" "}
        +{" "}
        <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 text-[0.7rem] uppercase tracking-[0.2em] text-muted">
          Backspace
        </kbd>{" "}
        to clear your current guess field quickly.
      </p>
    </div>
  );
}
