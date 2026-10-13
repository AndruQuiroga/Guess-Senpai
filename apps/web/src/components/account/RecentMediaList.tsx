/* eslint-disable @next/next/no-img-element */
import { PanelSection } from "../PanelSection";

interface MediaTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

export interface RecentMedia {
  id: number;
  title: MediaTitle;
  coverImage?: string | null;
}

interface RecentMediaListProps {
  items: RecentMedia[];
}

function resolveTitle(title: MediaTitle): string {
  return (
    title.userPreferred ||
    title.english ||
    title.romaji ||
    title.native ||
    "Unknown title"
  );
}

export function RecentMediaList({ items }: RecentMediaListProps) {
  return (
    <PanelSection innerClassName="space-y-4" className="h-full">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-brand-200">
          Recent puzzles
        </p>
        <h2 className="text-lg font-semibold text-[#f4f0e7]">
          Recently featured titles
        </h2>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-[#c1c2bd]">
          Play a few rounds to start building your personal anime timeline.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-[#484b4d] bg-[#242628] p-3 text-sm text-[#c1c2bd] transition hover:border-[#ff7658]"
            >
              <div className="h-16 w-12 overflow-hidden rounded-lg border border-[#484b4d] bg-[#171819]">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={resolveTitle(item.title)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[0.65rem] uppercase tracking-wide text-neutral-400">
                    No art
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-[#f4f0e7]">
                  {resolveTitle(item.title)}
                </p>
                <p className="text-xs text-neutral-400">AniList #{item.id}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
