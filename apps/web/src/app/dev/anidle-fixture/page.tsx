import { notFound } from "next/navigation";

import AnidleFixtureClient from "./AnidleFixtureClient";

export default function AnidleFixturePage({
  searchParams,
}: {
  searchParams?: { state?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return <AnidleFixtureClient solved={searchParams?.state === "solved"} />;
}
