"use client";

import { GameTile } from "../../components/GameTile";
import { useNavGames } from "../../components/nav/useNavGames";
import { useRuntimeGamesDirectory } from "../../hooks/useDailyAvailability";

/** Today's playable modes as a simple list, matching the Today tiles. */
export default function GamesDirectorySection() {
  const games = useRuntimeGamesDirectory();
  const statuses = useNavGames();
  return (
    <ul
      aria-label="Daily games"
      className="grid list-none gap-3 p-0 sm:grid-cols-2"
    >
      {games.map((game) => (
        <li key={game.slug} className="flex">
          <GameTile
            game={game}
            status={
              statuses.find((entry) => entry.slug === game.slug)?.status ?? null
            }
          />
        </li>
      ))}
    </ul>
  );
}
