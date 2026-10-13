import Link from "next/link";

/**
 * Friendly page for a mode that exists in the directory but is not playable
 * (unreleased, or the optional daily mode is not enabled today). Server-safe.
 */
export function GameUnavailable({ title }: { title: string }) {
  return (
    <section className="panel mx-auto flex max-w-xl flex-col items-start gap-4 p-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
        {title} isn&apos;t available yet
      </h1>
      <p className="text-base text-muted">
        This mode isn&apos;t playable right now. Pick another puzzle from the
        menu or head back to today&apos;s list.
      </p>
      <Link href="/" className="button button-primary">
        Back to Today
      </Link>
    </section>
  );
}

export default GameUnavailable;
