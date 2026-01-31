# Refactor: Web + Mobile Audiobook App (OneDrive, Auth, Offline)

## Current State

- **Audibly** is a WinUI 3 Windows desktop app (MSIX).
- Local SQLite + EF Core for library; local file paths (`.m4b`, `.mp3`) for playback via `Windows.Media.Playback.MediaPlayer`.
- No auth, no cloud storage, no mobile.

## Target State

1. **Optimized web version** that works on mobile (responsive PWA).
2. **OneDrive** as the single source for ~450 audiobooks (your account).
3. **User accounts** via Supabase (or similar) so only authorized users can access the catalog and stream/download.
4. **Download in-app** with protection (no easy cloning/stealing of files).
5. **Offline listening** after download inside the app.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Web / PWA Client (React, Next.js, or similar)                           │
│  - Responsive UI, mobile-first                                           │
│  - Auth (Supabase Auth)                                                  │
│  - Catalog browse, stream, download-for-offline                          │
│  - Playback from stream or from IndexedDB (offline)                      │
│  - Progress sync (Supabase DB)                                           │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    │ HTTPS (JWT / session)
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend API (e.g. .NET 8 / Node)                                        │
│  - Auth: validate Supabase JWT                                           │
│  - Catalog: list audiobooks (from your OneDrive metadata or DB)         │
│  - Streaming: tokenized, short-lived URLs or proxy from OneDrive         │
│  - Download: same as stream but “save for offline” in app storage        │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    │ Microsoft Graph API (app-only or delegated)
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Your OneDrive                                                            │
│  - ~450 audiobooks (.m4b / .mp3)                                         │
│  - Folder structure used for catalog + file access                      │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Desktop WinUI app**: Can remain as-is for local-only use, or be deprecated in favor of the PWA on Windows. Your choice.

---

## 1. Tech Stack Recommendations

| Layer | Option A | Option B |
|-------|----------|----------|
| **Frontend** | Next.js (App Router) + React | Remix or Vite + React |
| **Auth** | Supabase Auth | Supabase Auth |
| **Backend** | .NET 8 Web API (fits existing C#/EF) | Node.js (Express/Fastify) |
| **DB for catalog + progress** | Supabase (Postgres) | Same |
| **Cloud storage** | OneDrive (Microsoft Graph) | Same |
| **Offline storage** | IndexedDB + Service Worker | Same |

Recommendation: **Next.js + Supabase Auth + .NET 8 API + OneDrive**. Reuse your existing C# and domain concepts (Audiobook, Chapter, progress) in the API; frontend is new.

---

## 2. OneDrive Integration

- **Microsoft Graph API** to list and download files from your OneDrive.
- **Auth for Graph**:
  - **Option A (simplest for “my OneDrive”)**: One **Microsoft app registration** with **delegated** permissions (e.g. `Files.Read`, `Files.Read.All`) and **OAuth2** so *you* sign in once; the backend stores refresh tokens and uses them to access your OneDrive on behalf of your app.
  - **Option B**: If you ever need multi-tenant (each user’s OneDrive), each user would connect their own OneDrive via OAuth (different product shape).
- Backend responsibilities:
  - **Index/catalog**: Periodically (or on demand) list your OneDrive folder(s), build list of audiobooks (title, author, cover, file IDs, chapters if available). Store in **Supabase** (or your API DB) for fast listing without hitting Graph on every request.
  - **Streaming / download**: For a given audiobook/file, backend uses Graph to get a **download URL** or stream bytes. Do **not** expose raw OneDrive URLs to the client. Backend should:
    - Verify the user is authenticated (Supabase JWT).
    - Check the user is allowed to access that title (e.g. any logged-in user, or you add “allowed users” in Supabase).
    - Return either a **short-lived URL** (e.g. 15–60 min) or **proxy the bytes** (stream through your API). Prefer short-lived URL from Graph if available to save bandwidth on your server.

---

## 3. User Accounts (Supabase)

- **Supabase Auth**: Email/password, magic link, or OAuth (Google, etc.).
- **Supabase Postgres**:
  - **Users**: Handled by Supabase Auth.
  - **Catalog**: `audiobooks` (id, one_drive_id, title, author, cover_url, duration, etc.); optionally `chapters` per audiobook.
  - **User progress**: `user_audiobook_progress` (user_id, audiobook_id, current_position_ticks, current_file_index, playback_speed, updated_at). Sync from app when online.
- **Row Level Security (RLS)**: So users only read their own progress; catalog can be readable by all authenticated users (or restricted by a “allowed_users” table if you want invite-only).

---

## 4. “Download in-app” and Protection (No Easy Cloning)

- **No direct file download to device filesystem** for end users. “Download” means: **fetch audio through your API and store inside the app’s storage** (browser: IndexedDB; optional native app: secure container).
- **Web (PWA)**:
  - **Streaming**: Request a stream URL or stream-through-API; play with `<audio>` or MSE. URL is short-lived and tied to auth.
  - **Offline**: “Download” = fetch full audio (or chunked) via authenticated API, store in **IndexedDB** (or Cache API). Playback from blob URLs so the file never appears as a normal file on disk. This makes casual copying harder; determined users can still capture from DevTools, but it’s not “right-click save” on a direct link.
- **Optional hardening** (later):
  - Chunked streaming with opaque segment URLs.
  - Optional encryption of chunks (key derived from user/session); decrypt in memory before feeding to audio. Adds complexity; only if you need stronger protection.

---

## 5. Offline Listening

- **PWA**: Service Worker caches app shell and, for “downloaded” titles, stores audio in IndexedDB keyed by `userId + audiobookId`.
- **App logic**:
  - If online: prefer stream from API (or short-lived URL).
  - If offline (or user chose “offline”): play from IndexedDB.
- **Progress**: When back online, sync `user_audiobook_progress` from device to Supabase so progress is consistent across devices.

---

## 6. Implementation Phases

### Phase 1: Backend and catalog

1. **Microsoft app registration** (Azure AD): Create app, get Client ID/Secret (or use client-side flow for delegated), add redirect URIs.
2. **.NET 8 Web API** (new project in solution or repo):
   - Endpoints: `GET /api/audiobooks` (catalog), `GET /api/audiobooks/:id/stream` (or `/:id/download`) returning short-lived URL or proxied stream.
   - Middleware: Validate Supabase JWT (e.g. `NuGet: Supabase` or manual JWT validation).
   - OneDrive: Use **Microsoft.Graph** SDK to list files and get download links; optionally cache catalog in your DB (Supabase or SQL Server).
3. **Supabase**:
   - Create project; enable Auth (email + optional OAuth).
   - Create tables: `audiobooks`, `chapters`, `user_audiobook_progress`; set RLS.
4. **Catalog sync**: One-off or scheduled job that reads your OneDrive folder(s), fills `audiobooks` (and chapters if you parse metadata). You can reuse logic from current app (e.g. chapter parsing) in the API.

### Phase 2: Web frontend (PWA)

1. **Next.js app** (or chosen framework): Responsive, mobile-first UI.
2. **Supabase Auth** in the client: Login/signup, store session; send JWT to your API on every request.
3. **Catalog page**: List audiobooks from your API (or from Supabase if catalog is stored there).
4. **Streaming**: Play from API stream or short-lived URL inside the app (no “Save as” to user’s disk).
5. **Player UI**: Play/pause, seek, speed, progress; on interval or on pause, PATCH progress to API → Supabase.

### Phase 3: Download for offline and PWA

1. **“Download” action**: Call API to get full audio (or chunked); save to IndexedDB (key: user + audiobook).
2. **Service Worker**: Cache app shell; optionally cache API responses for catalog.
3. **Offline playback**: When offline (or user selects “Play offline”), play from IndexedDB via blob URL.
4. **Progress sync**: When online, sync local progress to Supabase; on load, merge server progress with local.

### Phase 4: Polish and optional desktop

1. **PWA install**: manifest, icons, “Add to Home Screen” / “Install app.”
2. **Optional**: Keep or phase out the existing WinUI app; or add a “Open in browser” link from the desktop app to the PWA.

---

## 7. File Structure Suggestion

```
Audiobook-Listener/
├── Audibly.App/              # Existing WinUI app (keep or deprecate)
├── Audibly.Models/            # Reuse for API (Audiobook, Chapter, etc.)
├── Audibly.Repository/       # Existing; optional reuse for local DB
├── Audibly.Api/               # NEW: .NET 8 Web API (OneDrive + Supabase JWT)
├── audibly-web/               # NEW: Next.js PWA (or name of your choice)
│   ├── app/
│   ├── components/
│   ├── lib/                   # Supabase client, API client
│   └── public/
└── docs/
    └── refactor-web-mobile-implementation-plan.md  # this file
```

---

## 8. Security Checklist

- [ ] Never expose OneDrive raw URLs or API keys to the client.
- [ ] Validate Supabase JWT on every API request; use HTTPS only.
- [ ] Prefer short-lived download/stream URLs (e.g. 15–60 min).
- [ ] RLS on Supabase so users only see their progress and allowed catalog.
- [ ] Store Microsoft tokens (refresh/access) only on backend; rotate secrets via Azure/Env.

---

## 9. What Stays Reusable from Current App

- **Audibly.Models**: `Audiobook`, `ChapterInfo`, `SourceFile`-like concepts; adapt for API (e.g. `SourceFile` → OneDrive file ID + URL from backend).
- **Chapter/metadata parsing**: If you have .m4b/.mp3 metadata parsing in `FileImportService` or similar, move that into a shared library or the API for “catalog sync” from OneDrive.
- **Constants**: Playback speed min/max, etc., can be reused in the web app.

---

## 10. Next Steps

1. **Confirm stack**: Next.js + .NET 8 API + Supabase + OneDrive (or adjust).
2. **Azure**: Create app registration for Microsoft Graph; get Client ID and secret.
3. **Supabase**: Create project; Auth + Postgres tables + RLS.
4. **Implement Phase 1**: API with auth + catalog + stream endpoint; then Phase 2 (web UI + playback), then Phase 3 (offline + PWA).

---

## Implementation status

**Done.** Phase 1–3 scaffold completed:

- **Phase 1**: `Audibly.Api` (.NET 8) added with Supabase JWT validation, OneDrive (Microsoft Graph) integration via HTTP, catalog and stream endpoints. `docs/supabase-schema.sql` for user progress (and optional catalog) table. `Audibly.Api` registered in solution; Health (anonymous) and Audiobooks (authorized) controllers.
- **Phase 2**: `audibly-web` (Next.js 14) created with Supabase Auth (sign-in), catalog page calling API with Bearer token, play page with stream URL and HTML5 audio playback.
- **Phase 3**: Setup guide in `docs/SETUP-WEB-AND-API.md`. Offline/PWA and progress sync to Supabase are left for follow-up; stream URLs are short-lived (60 min) and playback is in-browser.

Next steps (when you’re ready): configure Supabase + OneDrive (see SETUP-WEB-AND-API.md), run API and web app, then add offline download (IndexedDB) and progress sync.
