import Image from "next/image";
import Link from "next/link";

import type { GameDirectoryEntry } from "../config/games";
import type { GameStatus } from "../utils/gameAction";
import { StatusMark } from "./nav/StatusMark";

/**
 * One playable mode as a compact tile: square art on the left, title, tagline
 * and today's status on the right. Shared by Today and the Games list.
 */
export function GameTile({
  game,
  status,
}: {
  game: GameDirectoryEntry;
  status: GameStatus | null;
}) {
  const art = game.preview.media?.type === "image" ? game.preview.media : null;
  return (
    <Link
      href={`/games/${game.slug}`}
      className="panel group flex w-full flex-row items-center gap-4 p-3 no-underline transition hover:border-line-strong hover:bg-hover"
    >
      {art ? (
        <span className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md bg-ink sm:w-28">
          <Image
            src={art.src}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
          />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-xl font-bold leading-tight text-paper">
          {game.title}
        </span>
        <span className="text-base text-muted">{game.tagline}</span>
        {status ? <StatusMark status={status} className="mt-1" /> : null}
      </span>
    </Link>
  );
}
