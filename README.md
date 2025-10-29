# GuessSenpai

GuessSenpai is a glassy, modern web experience for daily anime guessing challenges powered by AniList and AnimeThemes. Players test their knowledge across multiple game modes, track streaks, and share results in style.

---

## ✨ Features

- **Daily curated puzzles** sourced from AniList, balanced across four core rounds with deterministic selection and personalization for signed-in players.
- **Game modes**
  - **Anidle** – progressive textual hints (genres, stats, score) with redaction-aware unmasking.
  - **Poster Zoomed** – three escalating zoom rounds that demand the anime title and its release season/year.
  - **Redacted Synopsis** – masked descriptions that uncloak over rounds.
  - **Character Silhouette** – dual-guess showdowns that demand both the anime title and the featured character to clear each card.
  - **Guess the Opening** – optional OP/ED audio clips fetched from AnimeThemes.
- **AniList account management** – secure OAuth login, Redis-backed sessions, and logout/me endpoints.
- **Streak tracking & sharing** – local streak persistence, Web Share API support, and downloadable OG share cards.
- **Responsive glassmorphism UI** – Tailwind-driven design with aurora backdrops, rounded surfaces, and keyboard shortcuts.

---

## 🧱 Tech Stack

| Layer     | Stack | Notes |
|-----------|-------|-------|
| Backend   | FastAPI, HTTPX, Pydantic, Redis (optional) | GraphQL client for AniList, AnimeThemes integration, puzzle caching |
| Frontend  | Next.js App Router, React 18, Tailwind CSS | Server-side data fetch with client-side persistence |
| Infra     | Docker Compose (API, Web, Redis) | Multi-stage builds, hot reload mounts |

---

## 🚀 Getting Started

### 1. Clone & Configure
```bash
git clone <repo-url> guesssenpai
cd guesssenpai
cp .env.example .env
```
Fill in AniList OAuth credentials (`ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET`, `ANILIST_REDIRECT_URI`). Set `ANIMETHEMES_ENABLED=true` if you want the OP round active.

### 2. Run with Docker
```bash
docker compose up --build
```
Services:
- API → `http://localhost:8000`
- Web → `http://localhost:3000`
- Redis → `redis://localhost:6379`
Make sure `.env` sets `API_BASE_URL=http://api:8000` for server-side fetches inside Docker and
`NEXT_PUBLIC_API_BASE=http://localhost:8000` (or another browser-accessible host) for client-side calls.

### 3. Local Development

**Backend**
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd apps/web
npm install
npm run dev
```
Set `API_BASE_URL=http://localhost:8000` (server-side fetch) and `NEXT_PUBLIC_API_BASE=http://localhost:8000` (client) when running outside Docker.

---

## 🧩 Architecture Highlights

- **Puzzle Engine** (`apps/api/src/app/puzzles/engine.py`)
  - Pulls and caches popular AniList media daily.
  - Personalizes selection using AniList lists while avoiding recent repeats.
  - Hydrates game payloads, redacts descriptions, and optionally attaches AnimeThemes clips.
- **Session & OAuth**
  - AniList Authorization Code flow with state validation.
  - Signed session tokens stored server-side to protect AniList access tokens.
- **Frontend Experience**
  - Data fetched server-side, hydrated into responsive components with puzzle-specific progress context.
  - LocalStorage persistence prevents replaying solved puzzles and supports streak tracking.
  - Glassmorphism design with aurora gradients, subtle motion, and accessible focus treatments.

---

## ✅ MVP Checklist

- [x] Daily puzzle generation with caching & personalization.
- [x] AniList OAuth login and session persistence.
- [x] AnimeThemes OP clip integration (feature flag).
- [x] Modern glass-effect UI with streaks, sharing, and keyboard flows.
- [x] Redis-backed session storage with `/auth/anilist/me` + logout.
- [ ] Automated frontend testing (Playwright / unit tests).
- [ ] Production observability (metrics, Sentry).

---

## 🧭 Long-Term Goals

1. **Player Accounts & Leaderboards**
   - Persist streaks server-side, add competitive leaderboards, highlight perfect runs.
2. **Expanded Game Modes**
   - Introduce “Voice Snippet”, “Emoji Synopsis”, or manga-specific rounds.
3. **Social & Shareability**
   - Rich OpenGraph cards, direct sharing to Discord/Twitter, puzzle discussion threads.
4. **Localization & Accessibility**
   - Support multiple languages, alternate title sets, and audio transcripts.
5. **Mobile App & PWA**
   - Offline caching, push notifications for daily drops.
6. **Advanced Personalization**
   - Bias toward user watchlists, collaborative modes, difficulty scaling.
7. **Analytics & Insights**
   - Opt-in analytics, puzzle performance dashboards, content rotation metrics.

---

## 🤝 Contributing
1. Fork & branch (`feature/your-feature`).
2. Align with repo guidelines in `AGENTS.md`.
3. Update docs/tests when relevant.
4. Submit a pull request with context & screenshots for UI changes.

---

## 📄 License
MIT License © GuessSenpai contributors.

Enjoy the daily challenge — 和 guess wisely! 🎮✨
