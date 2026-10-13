import { notFound } from "next/navigation";

import AnidleFixtureClient, { type FixtureState } from "./AnidleFixtureClient";

const STATES: FixtureState[] = ["empty", "progress", "solved", "exhausted"];

export default function AnidleFixturePage({
  searchParams,
}: {
  searchParams?: { state?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const requested = STATES.find((state) => state === searchParams?.state);
  return <AnidleFixtureClient state={requested ?? "empty"} />;
}
