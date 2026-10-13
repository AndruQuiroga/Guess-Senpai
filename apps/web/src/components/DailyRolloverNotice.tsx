"use client";

import { useEffect, useState } from "react";

export function DailyRolloverNotice({ date }: { date: string }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const check = () =>
      setExpired(date < new Date().toISOString().slice(0, 10));
    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [date]);
  if (!expired) return null;
  return (
    <div
      role="status"
      className="panel flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <p>A new daily is ready. You can finish this puzzle first.</p>
      <button
        className="button button-primary"
        onClick={() => window.location.reload()}
      >
        Load new daily
      </button>
    </div>
  );
}
