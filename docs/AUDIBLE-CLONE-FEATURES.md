# Audible-Clone Features: Cover Art, Chapters, Navigation, UX

Goal: Make the web app an Audible-like experience using Audibly’s full .m4b support (embedded cover, chapters, metadata).

## 1. Data sources (aligned with desktop app)

The desktop app uses **ATL** (Audio Tag Library) to read from local .m4b/.mp3:

- **Cover**: `track.EmbeddedPictures.FirstOrDefault()?.PictureData` → saved to disk as CoverImagePath / ThumbnailPath.
- **Chapters**: `track.Chapters` → StartTime, EndTime (ms), Title, Index, ParentSourceFileIndex.
- **Metadata**: Title, Artist (Author), Composer, Description, Duration from `Track(path)`.

On the web, files live in **R2**; we don’t have a local path. So we need one or both of:

- **A) On-demand metadata**  
  Stream the first part of the first file from R2, parse with a Node library (e.g. `music-metadata`), return cover + chapters + title/author/duration. Good for “it just works” without upload changes.

- **B) R2 sidecar files (optional)**  
  When uploading to R2, also upload:
  - `{folder}/cover.jpg` (or .png) — cover image.
  - `{folder}/metadata.json` — `{ "title", "author", "chapters": [ { "index", "title", "startTime", "endTime" } ] }`.  
  Catalog and metadata API prefer sidecar when present; otherwise fall back to on-demand extraction.

## 2. Feature list (Audible-like)

| Feature | Desktop (today) | Web target |
|--------|------------------|------------|
| Cover art | From file, saved to app data | From R2 sidecar `cover.jpg` or embedded via metadata API |
| Chapters | From file (ATL) | From `metadata.json` or metadata API (if parser supports m4b chapters) |
| Chapter list in player | ComboBox, seek on select | List/dropdown, seek to chapter start |
| Progress bar | By chapter/time | Same; show chapter position |
| Playback speed | Slider (e.g. 0.5–2x) | Same |
| Sleep timer | Menu (5/10/15/…/60 min, end of chapter) | Same |
| Back / skip 10s / skip 30s | Yes | Done |
| Prev/next part (multi-file) | Yes | Done |
| Title/author from metadata | Yes | From metadata API or metadata.json |

## 3. Implementation order

1. **Metadata API**  
   - `GET /api/audiobooks/[id]/metadata`  
   - Streams first file (or first N bytes) from R2, runs `music-metadata`, returns:
     - `picture` (base64 or URL to cached cover)
     - `title`, `author`, `duration`
     - `chapters` if the parser provides them for m4b; otherwise `[]`.
   - Optional: also check R2 for `metadata.json` and `cover.jpg` by folder; merge into response.

2. **Catalog enrichment**  
   - When building catalog from R2:
     - For each audiobook folder, check for `cover.jpg` / `cover.png` and `metadata.json`.
     - If present: use for coverUrl and chapters/title/author in catalog entry.
   - If no sidecar: catalog stays as today (folder name as title); metadata API fills in when user opens the book.

3. **Frontend**  
   - **Library**: Use `coverUrl` from catalog or metadata API; fallback to placeholder.  
   - **Player**:  
     - Show cover (same source).  
     - Fetch metadata (if not in catalog) for title/author/cover/chapters.  
     - Chapter list: list/dropdown; on select, seek to `chapter.startTime` (in seconds).  
     - Playback speed control (e.g. 0.5, 1, 1.25, 1.5, 2).  
     - Sleep timer: preset times + “End of chapter”; store end time and pause or fade when reached.

4. **R2 upload / sidecar (optional)**  
   - Document in R2-UPLOAD-GUIDE: optional `metadata.json` and `cover.jpg` per folder.  
   - Optional script: given a local folder of .m4b, use ATL (or ffprobe) to generate `metadata.json` and extract cover to `cover.jpg`, then upload folder + sidecars to R2.

## 4. Technical notes

- **Chapters in m4b**: Often in the same file (e.g. Apple chapter track). `music-metadata` may expose them; if not, `metadata.json` or ffprobe-based extraction at upload time is the fallback.
- **Cover format**: Prefer serving from R2 (`cover.jpg`) via existing proxy/presigned pattern so the client gets a URL; embedded cover from metadata API can be returned as base64 data URL or cached and served via a small asset route.
- **Caching**: Metadata API responses (and extracted cover) should be cached (in-memory or short TTL) to avoid re-streaming the same file on every open.

## 5. Done / not done (to update as you go)

- [x] Metadata API (stream + music-metadata; optional metadata.json/cover.jpg)
- [ ] Catalog enrichment from R2 sidecar (cover.jpg, metadata.json) — metadata is fetched on-demand when opening a book
- [ ] Library: show cover image (optional: fetch metadata when tile in view)
- [x] Player: show cover, chapter list, seek to chapter
- [x] Player: playback speed control (1×, 1.25×, 1.5×, 1.75×, 2×)
- [ ] Player: sleep timer
- [x] Docs: R2 sidecar format (see below)

### Optional R2 sidecar format

Per audiobook folder in R2 you can add:

- **`metadata.json`** — `{ "title": "Book Title", "author": "Author", "chapters": [ { "index": 0, "title": "Chapter 1", "startTime": 0, "endTime": 3600 }, ... ] }`  
  `startTime`/`endTime` in **seconds**.
- **`cover.jpg`** or **`cover.png`** — cover image (extracted from m4b or custom).

If present, the metadata API uses these; otherwise it extracts from the first .m4b/.mp3 (embedded cover + chapters when supported).
