import type { Metadata } from "next";

import { UnlimitedAnidlePage } from "../../../../components/puzzle-pages/UnlimitedAnidlePage";

export const metadata: Metadata = {
  title: "Unlimited Anidle",
  description:
    "Practice Anidle with a fresh random anime every round. Not part of the daily streak or score.",
};

export default function UnlimitedAnidleRoute() {
  return <UnlimitedAnidlePage />;
}
