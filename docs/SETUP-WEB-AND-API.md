# Audibly Web Setup (Vercel + Cloudflare R2)

**No Azure, no credit card.** Auth via Supabase. Audiobook files live in **Cloudflare R2** (S3-compatible; free tier, no card required). The whole app (frontend + API) runs on **Vercel**. End users download audiobooks into the app (IndexedDB) on their device and listen offline.

---

## Why can’t I just connect my OneDrive folder?

OneDrive is **in the cloud** — there’s no “folder path” the app can open. The only way for an app to read your OneDrive files is to use **Microsoft’s API (Microsoft Graph)**. To do that you need an **Azure app registration** (client ID, secret, etc.). Creating an Azure account often requires a credit card in many regions, even for free tier, so if you can’t sign up for Azure you can’t use Graph and the app can’t read OneDrive directly.

**What you can do instead:**

1. **Sync OneDrive to a PC and run the API there** — Install the OneDrive desktop app, sync the folder with your audiobooks. Run **Audibly.Api** on that PC with `LocalStorage:RootPath` set to that synced folder. Expose the API with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free). In Vercel set `NEXT_PUBLIC_API_URL` to the tunnel URL. Your OneDrive stays the source; the “connection” is “sync to this PC + API reads the local folder.”
2. **Use R2 (or another storage)** — Upload/copy your audiobooks to Cloudflare R2 (or similar) and use the built-in API on Vercel (no separate server).
3. **If you ever get an Azure app registration** — We can add a “Connect OneDrive” flow: you sign in with Microsoft once in the app, we store a refresh token, and the API reads your OneDrive via Graph. No syncing, no copying files. The only blocker today is having that app registration.

---

## 1. Supabase (auth only)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy **Project URL**, and either:
   - **anon key** (legacy JWT), or  
   - **publishable key** (`sb_publishable_...`) — Supabase’s new key type; use in place of anon with no code changes.
   Also copy **JWT Secret** (required for API route auth; verifies user sign-in tokens).
3. **Authentication → Providers**: enable Email (and optionally Google).
4. Create a user (Authentication → Users → Add user) for testing.
5. **SQL Editor** → run `docs/supabase-schema.sql` (user progress table).

**Supabase new API keys (2025+):** Supabase now offers a **publishable key** (`sb_publishable_...`) that replaces the anon key. You can use either the legacy anon key or the new publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the app works with both. The **JWT Secret** is still required for API route auth (verifying user sign-in tokens). This app does not use the service_role / secret key.

---

## 2. Cloudflare R2 (audiobook files)

R2 is S3-compatible storage. **No credit card** required to sign up for Cloudflare.

1. Sign up at [cloudflare.com](https://cloudflare.com) and go to **R2** in the dashboard.
2. Create a **bucket** (e.g. `audibly`).
3. **R2 → Manage R2 API Tokens** → Create API token with **Object Read** (and **Object Write** if you upload via CLI). Copy **Access Key ID** and **Secret Access Key**.
4. Note your **Account ID** (in the R2 or dashboard URL).
5. **Upload your .m4b audiobooks** into the bucket:
   - **Files under 300 MB:** In the R2 dashboard you can drag-and-drop or “select from computer.”
   - **Files over 300 MB:** The dashboard does not allow uploads over 300 MB. Use the **S3 Compatibility API** (no Workers needed):

     **Using AWS CLI (works with R2’s S3 endpoint):**

     1. Install [AWS CLI](https://aws.amazon.com/cli/) and run `aws configure` (or set env vars below).
     2. Create a profile or set env for R2:
        - `AWS_ACCESS_KEY_ID` = your R2 Access Key ID  
        - `AWS_SECRET_ACCESS_KEY` = your R2 Secret Access Key  
        - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
     3. Upload a single large file:
        ```bash
        aws s3 cp "C:\path\to\MyBook.m4b" s3://audibly/audiobooks/MyBook.m4b --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
        ```
     4. Upload a whole folder (all .m4b/.mp3):
        ```bash
        aws s3 cp "D:\Audiobooks" s3://audibly/audiobooks/ --recursive --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
        ```
        Replace `D:\Audiobooks` with the path where your audiobooks live, `audibly` with your bucket name, and `YOUR_ACCOUNT_ID` with your Cloudflare account ID.

     No file size limit when using the S3 API; your 115 GB of audiobooks can be uploaded this way.

The app lists all `.m4b` and `.mp3` keys in the bucket (optionally under `R2_PREFIX`). Single files become one audiobook; keys under a common prefix (e.g. `audiobooks/BookName/part1.m4b`, `part2.m4b`) become one audiobook with multiple parts.

**R2 cost:** Free tier = 10 GB/month storage. Above that, **$0.015/GB/month** (no egress fee). Example: **~115 GB ≈ $1.58/month** storage. If you want to avoid that, use the **self-hosted API** option below instead of R2.

---

## 3. audibly-web (Next.js) — runs on Vercel

1. **Env** (local and Vercel):

```bash
cd audibly-web
cp .env.local.example .env.local
```

Edit `.env.local` (use the same names in Vercel → Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (legacy) or publishable key (`sb_publishable_...`) |
| `SUPABASE_JWT_SECRET` | Supabase JWT Secret (Project Settings → API); used to verify user JWTs in API routes |
| `SUPABASE_JWT_ISSUER` | `https://YOUR_PROJECT_REF.supabase.co/auth/v1` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | R2 bucket name (e.g. `audibly`) |
| `R2_PREFIX` | Optional prefix (e.g. `audiobooks/`) |
| `R2_JURISDICTION` | If your bucket is in EU jurisdiction, set to `eu` |

Leave **`NEXT_PUBLIC_API_URL`** empty so the app uses the built-in API routes on the same origin.

**If `/api/audiobooks` returns 401:** Ensure `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_ISSUER` are set in `.env.local` and match your Supabase project (Project Settings → API). The JWT Secret is the one used to verify user sign-in tokens (not the anon/publishable key). Restart the dev server after changing env.

**If catalog fails with "Unauthorized" (R2 401):** R2 rejected your credentials. 1) Create a **new** API token in Cloudflare R2 → Manage R2 API Tokens (Object Read). 2) If your bucket is in **EU jurisdiction**, add `R2_JURISDICTION=eu` to `.env.local`. 3) Ensure no extra spaces in credential values. Restart the dev server.

2. **Run locally:**

```bash
npm install
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000). Sign in → **Library** (catalog from R2) → **Play** → **Download for offline** (stored in IndexedDB on the user’s device).

---

## 4. Deploy to Vercel

1. Push the repo to GitHub/GitLab/Bitbucket and **import** the project in [Vercel](https://vercel.com).
2. Set **Root Directory** to `audibly-web` (if the repo root is the whole solution).
3. Add the same **environment variables** as in section 3 (no `NEXT_PUBLIC_API_URL` needed).
4. Deploy. The API runs as Next.js API routes on Vercel; no separate .NET server.

---

## 5. Offline and “protected” downloads

- **Download for offline**: The app fetches audio via a short-lived presigned R2 URL and saves it in **IndexedDB** (keyed by user + audiobook). Nothing is written to the device’s file manager.
- **Playback**: Playback uses a **blob URL** from IndexedDB so the file stays inside the app. When offline, only downloaded titles are available.

---

## 6. PWA and offline UI

- Service worker caches the app shell and pages so the UI loads offline after the first visit.
- Only audiobooks the user has **Download for offline** are playable offline.
- Optional: add `audibly-web/public/icon-192.png` and `icon-512.png` for a custom install icon.

---

## Avoiding cloud storage cost: self-host the API (Audibly.Api)

If you have **~115 GB** (or any size) on a machine you control and don’t want to pay R2, run the **.NET API** there and point the Vercel app at it. **No cloud storage fee** — files stay on your disk.

1. **Where to run the API** (pick one):
   - **Your PC/NAS** — Run `Audibly.Api` on the machine that has the audiobook folder. Expose it to the internet with [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free) or similar, so you get a public HTTPS URL without opening ports.
   - **A VPS** — Rent a small server with a large disk (e.g. 100–200 GB). Copy your audiobooks there and run `Audibly.Api` with `LocalStorage:RootPath` set to that folder. Often **~$10–20/month** for 100–200 GB, no per-GB storage fee like R2.

2. **Config (Audibly.Api)**  
   In `appsettings.json` (or env): set **Supabase** (JWT Issuer + Secret), **LocalStorage:RootPath** = full path to the audiobook folder on that machine, and **Cors:AllowedOrigins** = your Vercel URL (e.g. `https://your-app.vercel.app`).

3. **Frontend (Vercel)**  
   In Vercel env, set **`NEXT_PUBLIC_API_URL`** = the public URL of your API (e.g. `https://audibly-api.yourdomain.com`). Leave **R2** env vars empty/unset so the app uses the external API. Deploy.

Result: **Vercel** serves the Next.js app; **your server** serves catalog + stream from the local folder. Users still download into the app (IndexedDB) and listen offline; you pay $0 for file storage (or only the VPS, if you use one).
