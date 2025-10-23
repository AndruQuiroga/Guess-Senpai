"use client";

import { GlassSection } from "../../components/GlassSection";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function LoginPage() {
  const handleConnect = () => {
    const redirectTarget = `${window.location.origin}/`;
    const url = new URL(`${API_BASE}/auth/anilist/login`);
    url.searchParams.set("redirect_to", redirectTarget);
    window.location.href = url.toString();
  };

  return (
    <div className="mx-auto max-w-lg">
      <GlassSection innerClassName="space-y-8 text-neutral-200">
        <header className="space-y-3">
          <h1 className="text-3xl font-display font-semibold tracking-tight text-white sm:text-4xl">Connect AniList</h1>
          <p className="text-base leading-relaxed">
            Link your AniList account to personalise puzzle selection, sync your streak across devices, and earn bonus
            rewards as new modes arrive.
          </p>
        </header>
        <div className="space-y-3">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 px-6 py-3 text-base font-semibold text-white shadow-glow transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            onClick={handleConnect}
          >
            Continue with AniList
          </button>
          <p className="text-xs leading-relaxed text-neutral-400">
            You&apos;ll be redirected to AniList to approve access. You can disconnect anytime from your AniList settings.
          </p>
        </div>
      </GlassSection>
    </div>
  );
}
