"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function LoginPage() {
  const handleConnect = () => {
    const redirectTarget = `${window.location.origin}/`;
    const url = new URL(`${API_BASE}/auth/anilist/login`);
    url.searchParams.set("redirect_to", redirectTarget);
    window.location.href = url.toString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Connect AniList</h1>
      <p className="text-neutral-300">
        Link your AniList account to personalise puzzle selection and track your streak across devices.
      </p>
      <button
        type="button"
        className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
        onClick={handleConnect}
      >
        Continue with AniList
      </button>
    </div>
  );
}
