# Upload audiobooks to Cloudflare R2 (no S3 experience needed)

R2 speaks the **S3 protocol**. You don’t need to learn the S3 API — you only need a **CLI tool** (AWS CLI) that knows that protocol. On Windows, you install it once, point it at R2 with your credentials, then run one or two commands to upload.

---

## 1. Install AWS CLI on Windows

- **Option A:** In PowerShell (Run as Administrator):  
  `winget install Amazon.AWSCLI`
- **Option B:** [Download the MSI](https://awscli.amazonaws.com/AWSCLIV2.msi), run it, then close and reopen PowerShell.

Check it’s installed:

```powershell
aws --version
```

You should see something like `aws-cli/2.x.x`.

---

## 2. Get your R2 credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2**.
2. **Account ID:** In the R2 page or the dashboard URL you’ll see something like `https://dash.cloudflare.com/xxxxxxxx`. The `xxxxxxxx` part is your **Account ID**. Copy it.
3. Create an API token: **R2 → Manage R2 API Tokens → Create API token**.  
   Give it a name, set **Object Read & Write** (you need Write for uploads). Copy:
   - **Access Key ID**
   - **Secret Access Key**
4. Note your **bucket name** (e.g. `audibly`). If you haven’t created a bucket yet, create one in R2 first.

You’ll need: **Account ID**, **Access Key ID**, **Secret Access Key**, **bucket name**.

---

## 3. Tell the CLI to use R2 (not real AWS)

The AWS CLI is built for Amazon, but R2 uses the same protocol with a **different endpoint**. You configure that with a **named profile** so you never touch real AWS.

In PowerShell, run (replace the placeholders with your real values):

```powershell
aws configure set aws_access_key_id "YOUR_R2_ACCESS_KEY_ID" --profile r2
aws configure set aws_secret_access_key "YOUR_R2_SECRET_ACCESS_KEY" --profile r2
aws configure set region "auto" --profile r2
```

There is no “endpoint” in `aws configure`; you pass the endpoint in **every** upload command (see below). That way the CLI talks to R2, not to Amazon.

---

## 4. Upload a single large file (>300 MB)

Use this when one audiobook file is too big for the R2 dashboard:

```powershell
aws s3 cp "C:\Path\To\Your\Audiobook.m4b" s3://YOUR_BUCKET_NAME/audiobooks/YourAudiobook.m4b --endpoint-url "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com" --profile r2
```

Replace:

- `C:\Path\To\Your\Audiobook.m4b` → full path to your file on your PC  
- `YOUR_BUCKET_NAME` → your R2 bucket (e.g. `audibly`)  
- `audiobooks/` → optional prefix; the app uses `R2_PREFIX` (e.g. `audiobooks/`) to list files  
- `YourAudiobook.m4b` → name of the file in R2  
- `YOUR_ACCOUNT_ID` → your Cloudflare Account ID (e.g. `a1b2c3d4e5f6...`)

Example:

```powershell
aws s3 cp "D:\Audiobooks\Project Hail Mary.m4b" s3://audibly/audiobooks/ProjectHailMary.m4b --endpoint-url "https://a1b2c3d4e5f67890.r2.cloudflarestorage.com" --profile r2
```

---

## 5. Upload a whole folder (all audiobooks)

This uploads every file from a folder (and subfolders) into the bucket. No 300 MB limit.

```powershell
aws s3 cp "D:\Projects\Audiobook Liberation App\Audiobooks" s3://audiobooks/ --recursive --endpoint-url "https://cf6c849adf24611a9275492e4e226a8d.r2.cloudflarestorage.com" --profile r2
```

Replace:

- `D:\Audiobooks` → folder on your PC that contains your .m4b / .mp3 files  
- `YOUR_BUCKET_NAME` → e.g. `audibly`  
- `YOUR_ACCOUNT_ID` → your Cloudflare Account ID  

The app expects `.m4b` and `.mp3` under the prefix you set in `R2_PREFIX` (e.g. `audiobooks/`). So uploading to `s3://audibly/audiobooks/` and setting `R2_PREFIX=audiobooks/` in the web app is correct.

---

## 6. Optional: PowerShell script (no retyping endpoint)

Use the script in this folder: **`docs/upload-to-r2.ps1`**.

1. Open `docs/upload-to-r2.ps1` and set at the top: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET` (and `R2_PREFIX` if you use something other than `audiobooks/`).
2. In PowerShell, from the repo root:

```powershell
.\docs\upload-to-r2.ps1 "D:\Audiobooks"
```

Replace `D:\Audiobooks` with the path to the folder that contains your .m4b / .mp3 files. The script uses the AWS CLI; install it (step 1) first.

---

## Optional: metadata and cover (Audible-style UI)

To get **cover art**, **chapters**, and **title/author** in the web app without parsing every file, you can add sidecar files in each audiobook folder:

- **`metadata.json`** (or `Metadata.json`, `book.json`, `info.json`) — title, author, description, duration, and chapter list (times in **seconds**):

```json
{
  "title": "Book Title",
  "author": "Author Name",
  "description": "Optional full book description for the details page.",
  "duration": 50400,
  "series": "Series Name",
  "genre": "Fiction",
  "curatorNote": "This reframed how I think about incentives.",
  "sections": ["recommended-starting-points", "foundational-works"],
  "tags": ["big-ideas", "practical"],
  "seriesNote": "Read books 1-3, skip 4. This gets good after book 2.",
  "chapters": [
    { "index": 0, "title": "Chapter 1", "startTime": 0, "endTime": 3600 },
    { "index": 1, "title": "Chapter 2", "startTime": 3600, "endTime": 7200 }
  ]
}
```

  - `title`, `author`, `chapters` are used for display and navigation.
  - `description` (optional) is shown on the audiobook details page.
  - `duration` (optional) is total length in seconds; if omitted and `chapters` exist, it is derived from the last chapter's `endTime`.
  - `series` (optional) is the series name (e.g. "Harry Potter", "Book 1").
  - `genre` (optional) is the genre (e.g. "Fiction", "Self-Help").
  - `curatorNote` (optional) is a 1–2 line personal note shown on cards and the details page (e.g. "Dense, but worth it.").
  - `sections` (optional) is an array of curated section IDs. Canonical values: `recommended-starting-points`, `foundational-works`, `if-you-only-read-one`, `personal-favorites`. Books appear in those Browse carousels.
  - `tags` (optional) is an array of intellectual dimension tags. Canonical values: `big-ideas`, `contrarian`, `practical`, `historical`, `speculative`, `systems-level`. Used for "Ways of thinking" filters.
  - `seriesNote` (optional) is reading path guidance when the book is part of a series (e.g. "Read books 1-3, skip 4. This gets good after book 2.").

- **`cover.jpg`** or **`cover.png`** — cover image (e.g. extracted from the .m4b or custom art).

Upload them into the same folder as the .m4b/.mp3 (e.g. `audiobooks/MyBook/metadata.json`, `audiobooks/MyBook/cover.jpg`). If you don’t add these, the app will try to read cover and chapters from the first audio file (slower, but works for many .m4b files).

---

## Quick reference

| What you need | Where |
|---------------|--------|
| Account ID | Cloudflare dashboard URL or R2 overview |
| Access Key ID + Secret | R2 → Manage R2 API Tokens → Create API token |
| Bucket name | R2 → bucket list |
| Endpoint | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |

**One folder upload (fill in and run):**

```powershell
aws s3 cp "C:\YOUR\AUDIOBOOK\FOLDER" s3://BUCKET_NAME/audiobooks/ --recursive --endpoint-url "https://ACCOUNT_ID.r2.cloudflarestorage.com" --profile r2
```
