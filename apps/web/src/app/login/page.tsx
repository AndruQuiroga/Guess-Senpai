"use client";

import { PanelSection } from "../../components/PanelSection";

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
      <PanelSection innerClassName="space-y-8 text-[#c1c2bd]">
        <header className="space-y-3">
          <h1 className="text-3xl font-display font-semibold tracking-tight text-[#f4f0e7] sm:text-4xl">
            Connect AniList
          </h1>
          <p className="text-base leading-relaxed">
            Link your AniList account to personalise puzzle selection and sync
            supported progress across devices.
          </p>
        </header>
        <div className="space-y-3">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-6 py-3 text-base font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            onClick={handleConnect}
          >
            Continue with AniList
          </button>
          <p className="text-xs leading-relaxed text-neutral-400">
            You&apos;ll be redirected to AniList to approve access. You can
            disconnect anytime from your AniList settings.
          </p>
        </div>
      </PanelSection>
    </div>
  );
}
