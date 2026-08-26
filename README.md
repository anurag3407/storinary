<p align="center">
  <img src="public/logo.png" alt="Storinary logo" width="240" />
</p>

# Storinary — Self-Hosted Image CDN

<p align="center">
  <em>A free, self-hosted <a href="https://cloudinary.com">Cloudinary</a> alternative. Own your images, transform them on the fly, and never get your account deleted.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
  <img src="https://img.shields.io/badge/tests-551%20passing-brightgreen" alt="551 tests passing" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript strict" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome" /></a>
</p>

---

**Storinary** is a self-hosted image management and delivery platform: bulk upload, transform, and serve images from **Backblaze B2**, **Appwrite Storage**, or **Supabase Storage** with a fast, neobrutalism-styled dashboard — **no credit card, no per-image pricing, no vendor lock-in**.

Built for the exact problem Cloudinary users hit on the free tier: your account gets disabled for overages and **your assets get deleted**. With Storinary, images live in **your** Backblaze, Appwrite, or Supabase bucket (with full support for 10 GB free B2 storage and the **Appwrite Student Offer / GitHub Student Pack**), transforms run on **your** server and in **your** browser, and nothing is metered.

> 📊 Compare Storinary vs. Cloudinary (features, free tiers, pricing): [`docs/cloudinary-vs-storinary-report.md`](docs/cloudinary-vs-storinary-report.md) · quick summary: [`docs/cloudinary-vs-storinary-summary.md`](docs/cloudinary-vs-storinary-summary.md)

---

## 📦 Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Why Storinary? (vs Cloudinary)](#why-storinary-vs-cloudinary)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Transformations Reference](#transformations-reference)
- [API Reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **Bulk upload** | Drag & drop, file picker, or **paste (Ctrl/Cmd+V)** — concurrent queue with live per-file status |
| **Video ingestion & streaming** | Authenticated MP4/WebM uploads with metadata, range playback, and a video library |
| **Automatic video posters** | FFmpeg extracts a subject frame at upload/import time when no poster capture is supplied; failures fall back gracefully |
| **Optional video renditions** | FFmpeg-backed 360p/720p MP4 variants with copy-ready streaming links; gracefully skipped when FFmpeg is absent |
| **Programmatic API keys** | Hashed, revocable credentials for external sites with Cloudinary-style signed uploads |
| **Video upload presets** | Named image/video policies enforce folders, tags, renditions, and scoped API-key access |
| **Client-side AI background removal** | `@imgly/background-removal` (WASM) runs entirely in the browser — no API key, no server cost, **unlimited** |
| **Local AI moderation** | Optional private subject-mask review blocks tightly cropped explicit subjects before upload; tune thresholds in code |
| **Client-side pre-compression** | Images are compressed to WebP in the browser before upload, slashing storage usage |
| **On-the-fly transforms** | Resize, named crops/gravity, aspect ratio, padding, rotation, effects, DPR, `f_auto`, and `q_auto` |
| **Signed delivery** | Expiring HMAC-protected image and video URLs when `STORINARY_SIGNED_URL_SECRET` is set |
| **Transform caching** | In-memory LRU cache + immutable `Cache-Control` / `CDN-Cache-Control` headers |
| **Link generator** | One-click copy: Direct URL, HTML `<img>`, Markdown, CSS, and JSON |
| **Gallery** | Search (debounced), folder filter, sort, pagination, bulk select / copy / delete, keyboard shortcuts |
| **Image detail** | Full preview with zoom, metadata table with inline editing (tags / alt text / folder) |
| **Dashboard** | Storage stats, format distribution, recent uploads, quick actions |
| **Settings** | Connection test, default upload options, Supabase setup guide, danger zone |
| **Admin auth** *(optional)* | Set `STORINARY_ADMIN_PASSWORD` to protect uploads, the library, and settings behind a login |
| **SVG hardening** | Malicious SVGs (scripts / event handlers) are rejected at upload and served with sandbox headers |
| **Rate limiting** | Per-IP limits on expensive endpoints to prevent abuse |

## 📸 Screenshots

*Coming soon — a dashboard screenshot will be added here. PRs welcome!*

## 🤔 Why Storinary? (vs Cloudinary)

| | ☁️ Cloudinary | 🟨 Storinary |
|---|---|---|
| **Hosting** | Cloud SaaS — your assets live on their servers | **Your** Supabase bucket — you own the data |
| **Pricing** | Free tier = 25 credits/mo; over-limit → account disabled, **assets deleted after 30 days** | Fixed cost of your storage; **transforms & background removal are unlimited** |
| **Background removal** | Server-side AI, metered | **Client-side WASM — free & private** (images never leave the browser) |
| **Transformations** | Rich: chaining, overlays, video pipelines, AI effects | Practical free set: resize / crops / gravity / padding / rotation / effects / DPR / auto optimization (extensible — it's your code) |
| **Vendor lock-in** | Migration = bulk export + re-hosting | Data is in Supabase Storage; serve URLs are plain HTTP |
| **Setup** | Sign up, done | ~15 min self-hosted setup (one-time) |

**Cloudinary wins on** breadth (video pipeline, AI suite, global edge CDN, team approval workflows). **Storinary wins on** ownership, privacy, and a $0 bill that doesn't punish usage.

## 🏗️ Architecture

```
┌─────────────────────────────── Browser ───────────────────────────────┐
│  Upload page           Gallery / Detail          Website <img> tags   │
│  ┌──────────────┐      ┌───────────────┐      ┌──────────────────┐    │
│  │ Canvas WebP  │      │  useImages /  │      │  direct public   │    │
│  │ compression  │      │  useUpload    │      │  URL or served   │    │
│  │ WASM bg-rem  │      │  hooks        │      │  transform URL   │    │
│  └──────┬───────┘      └──────┬────────┘      └────────┬─────────┘    │
└─────────┼─────────────────────┼────────────────────────┼──────────────┘
          │ POST /api/upload    │ GET /api/images…       │ GET /api/serve/…
          ▼                     ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                            Next.js app                                │
│  middleware.ts ── rate limiting + session auth                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ sharp          │  │ Prisma (SQLite) │  │ Supabase Storage     │   │
│  │ transforms     │  │ image metadata  │  │ bucket (CDN URLs)    │   │
│  │ LRU cache      │  │ stats/search    │  │ service-role client  │   │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## 🧱 Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Supabase Storage** — object storage + public CDN URLs
- **Prisma + SQLite (dev) / PostgreSQL (production)** — metadata database
- **sharp** — server-side image processing
- **@imgly/background-removal** — client-side background removal (WASM + ONNX)
- **Vitest + Testing Library** — 284 tests across 46 files
- Vanilla **CSS Modules** with a neobrutalism design system (no Tailwind)

## 🚀 Quickstart

### Prerequisites

- **Node.js 20+** and npm
- A free [Supabase](https://supabase.com) project (no credit card)

### 1. Install

```bash
git clone https://github.com/anurag3407/storinary-cloud.git
cd storinary-cloud
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your Supabase credentials (see the in-app **Settings → Supabase Setup Instructions** for the step-by-step bucket setup):

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."   # new-format public key
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"           # or legacy anon key
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."                    # NEW-format secret key (service role)
SUPABASE_BUCKET_NAME="storinary"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAX_FILE_SIZE_MB="10"
NEXT_PUBLIC_ALLOWED_FORMATS="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
# Optional: enable admin login
STORINARY_ADMIN_PASSWORD="a-strong-password"
# Optional: enable expiring private image/video delivery (falls back to the admin password)
STORINARY_SIGNED_URL_SECRET="another-unique-random-secret"
```

> **Create the bucket**: Supabase Dashboard → Storage → New bucket → name it `storinary` (or your `SUPABASE_BUCKET_NAME`) → **Public bucket: ON**.

### 3. Initialize the database

```bash
npx prisma migrate dev --name init
```

Existing installations should run the new API-key migration:

```bash
npx prisma migrate deploy
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload your first image. 🎉

## ⚙️ Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | SQLite file (dev: `file:./dev.db`) or Postgres connection string (production) |
| `STORAGE_PROVIDER` | — | Optional explicit override (`backblaze`, `appwrite`, or `supabase`). Auto-detected (Backblaze → Appwrite → Supabase) if omitted. |
| **Backblaze B2 Storage** | | *(10 GB Free Object Storage)* |
| `BACKBLAZE_APPLICATION_KEY_ID` | ✅ (Backblaze) | Your Backblaze Key ID |
| `BACKBLAZE_APPLICATION_KEY` | ✅ (Backblaze) | Your Backblaze Application Key with read/write access |
| `BACKBLAZE_BUCKET_NAME` | — | Storage bucket name (default `storinary`, bucket files must be **public**) |
| `BACKBLAZE_BUCKET_ID` | — | Optional bucket ID (auto-resolved if omitted) |
| `NEXT_PUBLIC_BACKBLAZE_CDN_URL` | — | Optional custom CDN / endpoint domain |
| **Appwrite Storage** | | *(Ideal for Appwrite Student Offer / GitHub Student Pack)* |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | ✅ (Appwrite) | Appwrite API endpoint (e.g., `https://cloud.appwrite.io/v1`) |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ✅ (Appwrite) | Your Appwrite project ID |
| `APPWRITE_API_KEY` | ✅ (Appwrite) | Server API Key with `files.read` and `files.write` storage scopes |
| `APPWRITE_BUCKET_ID` | — | Appwrite storage bucket ID (default `storinary`, bucket permissions set to public/read) |
| **Supabase Storage** | | |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ (Supabase) | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ (Supabase) | **Secret key** (server-side only — never expose to the client) |
| `SUPABASE_BUCKET_NAME` | — | Storage bucket name (default `storinary`, must exist & be **public**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Public/publishable key (optional fallback) |
| **General & Security** | | |
| `NEXT_PUBLIC_APP_URL` | ⚠️ | Public app URL — used for generated links & server fetches (set it in production) |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | — | Max upload size in MB (default `10`) |
| `NEXT_PUBLIC_ALLOWED_FORMATS` | — | Comma-separated allowed MIME types |
| `STORINARY_ADMIN_PASSWORD` | — | Set to enable admin login + API protection |
| `STORINARY_SIGNED_URL_SECRET` | — | Enable signed/expiring delivery; unique secret recommended |
| `STORINARY_TRANSFORM_CACHE_ENTRIES` | — | LRU cache entry limit (default `50`) |
| `STORINARY_TRANSFORM_CACHE_MB` | — | LRU cache byte budget in MB (default `64`) |
| **Optional Vision AI** | | *(Any OpenAI-compatible chat/vision provider)* |
| `STORINARY_AI_API_KEY` | — | Enable server-side tagging, captions, and moderation |
| `STORINARY_AI_BASE_URL` | — | Provider API base URL (default `https://api.openai.com/v1`) |
| `STORINARY_AI_MODEL` | — | Vision-capable model (default `gpt-4o-mini`) |
| `STORINARY_AI_ENABLE_TAGS`, `STORINARY_AI_ENABLE_CAPTIONS`, `STORINARY_AI_ENABLE_MODERATION` | — | Default feature switches; requests may narrow them with query flags |

### Programmatic API

Create a key in **Settings → API Keys**, then upload from any website:

```bash
curl -X POST https://your-storinary-domain/api/upload \
  -H "X-API-Key: <stor_live_...>" \
  -F "file=@photo.jpg" \
  -F "folder=/website" \
  -F "tags=hero"
```

For untrusted clients, sign metadata server-side with the same key and send
`timestamp` plus `api_signature`. The signature is HMAC-SHA256 over sorted,
non-file form fields followed by the Unix timestamp. Secrets are SHA-256 hashed
at rest and displayed only once.

### JavaScript SDK

The published `@storinary/sdk` package wraps image/video uploads, Cloudinary-style
v1 media listing, lookup, updates, deletion, browser-safe HMAC signing, and image/video
AI analysis:

```bash
npm install @storinary/sdk
```

```ts
import { createStorinaryClient } from '@storinary/sdk';

const storinary = createStorinaryClient({
  baseUrl: 'https://your-storinary-domain',
  apiKey: process.env.STORINARY_API_KEY,
});

const image = await storinary.uploadImage({ file, folder: '/site', tags: 'hero' });
const media = await storinary.listMedia({ limit: 50, resourceType: 'all' });
await storinary.analyzeImage(image.id!, { moderation: true });
```

Keep the API key server-side. See [`packages/storinary/README.md`](packages/storinary/README.md)
for complete transformation, signed-upload, and error-handling guidance.

### Embeddable Upload Widget

For unsigned upload presets, external sites can use the dependency-free hosted
widget without exposing an API secret:

```html
<div
  class="storinary-widget"
  data-upload-preset="website_unsigned"
  data-folder="/website"
  data-tags="guest"
></div>
<script src="https://your-storinary-domain/storinary-widget.js" async></script>
```

The widget injects an accessible file picker, uploads sequentially, reports
successes and failures inline, and links each returned asset. It supports
`data-endpoint`, `data-accept`, `data-multiple`, `data-max-files`,
`data-upload-target`, `data-label`, plus the metadata fields shown above. Use a
signed preset only with credentials injected by your backend; never publish the
API key or signature in public HTML.

### Video API

Create an API key with the `video-upload` scope, then upload MP4 or WebM files:

```bash
curl -X POST https://your-storinary-domain/api/videos \
  -H "X-API-Key: <stor_live_...>" \
  -F "file=@clip.mp4" \
  -F "upload_preset=website_video" \
  -F "folder=/website/videos" \
  -F "tags=hero,launch"
```

A video preset overrides `folder` and `tags`, rejects image-only presets, and can
force 360p/720p rendition generation with `renditions=true`. Signed video presets
always require credentials carrying the explicit `video-upload` scope; inject
them from your backend or proxy the upload there. Unsigned presets omit only the
signature check—they are not anonymous and still require that scoped key—so do
not publish the credential in browser-accessible HTML. For public websites,
proxying through your backend is the safest integration.

The dependency-free widget also supports videos:

```html
<div
  class="storinary-widget"
  data-upload-preset="website_video"
  data-resource-type="video"
  data-api-key="SERVER_INJECTED_SCOPED_KEY"
></div>
```

The response includes duration and file metadata. When FFmpeg is available, a
poster frame is extracted automatically unless you supply `poster-<filename>`.
Browser-ready playback uses:

```
/api/videos/<id>/stream
```

The endpoint supports HTTP `Range` requests so seeking works without loading the
entire asset into memory.

When private delivery is enabled, fetch fresh playback links from an
authenticated server route with `ttl` (60 seconds to 30 days):

```bash
curl -X PATCH "https://your-storinary-domain/api/videos/VIDEO_ID?ttl=3600" \
  -H "Content-Type: application/json" \
  -d '{"tags":"refresh-links"}'
```

The response includes a `links` object with path-bound `streamUrl`, `posterUrl`,
and per-rendition `renditionUrls`. Tokens expire and are accepted only by the
matching delivery route.

### Read API and Usage Reporting

Create a key with the `read` scope to list images or videos from external
systems. Dashboard sessions continue to work without API credentials:

```bash
curl "https://your-storinary-domain/api/images?limit=20" \
  -H "X-API-Key: <stor_live_...>"
```

### Scoped Media Management API

Use the unified compatibility endpoint to list, inspect, edit, or remove images
and videos. Reads require a `read` key, metadata edits require a separate
`write` key, and deletion requires an explicit `delete` key.

```bash
curl -H "X-API-Key: <stor_live_...>" \
  "https://your-storinary-domain/api/v1/media?resource_type=video&limit=20"

curl -H "X-API-Key: <stor_live_...>" \
  "https://your-storinary-domain/api/v1/media?resource_type=all&collection_id=COLLECTION_ID"

curl -X DELETE -H "X-API-Key: <stor_live_...>" \
  "https://your-storinary-domain/api/v1/media/VIDEO_ID?resource_type=all"
```

Deletion is irreversible and removes originals plus generated video renditions.

Resources include both stable Storinary fields (`publicId`, `resourceType`,
`url`, and `createdAt`) and Cloudinary-compatible aliases (`public_id`,
`secure_url`, `resource_type`, `created_at`, and `bytes`), so lightweight
existing clients can consume responses without renaming every field.

Metadata updates accept `tags`, `altText`, `folder`, and structured DAM fields.
A `write` key cannot upload, read by itself, or destroy media:

```bash
curl -X PATCH -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  -d '{"tags":"summer,sale","altText":"Red backpack","folder":"/campaigns"}' \
"https://your-storinary-domain/api/v1/media/RESOURCE_ID?resource_type=video"
```

External clients can also roll an image or video back to a known version. The
current asset is archived before restoration, so no bytes are lost:

```bash
curl -X PATCH -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  -d '{"restoreVersionId":"VERSION_ID"}' \
  "https://your-storinary-domain/api/v1/media/RESOURCE_ID?resource_type=image"
```

The TypeScript SDK exposes this as `client.restoreVersion(id, {
resourceType, versionId })`.

Admins can define reusable metadata fields (`string`, `integer`, `boolean`, or
`enum`) under `/api/metadata-fields`; values are validated and returned as a
`metadata` object on native media APIs, v1 resources, image details, and video
records. They can be edited directly through `/api/v1/media/:id`, the native
video PATCH endpoint, or the image/video dashboards, and searched through
`metadata=<externalId>:<value>` filters. The SDK exposes field creation/listing:

```ts
await storinary.createMetadataField({
  externalId: 'campaign', label: 'Campaign', type: 'enum',
  allowedValues: ['spring', 'fall'],
});
```

For cleanup and migration jobs, batch destroy accepts up to 100 mixed IDs. It
removes video posters and renditions with each original, reports missing IDs,
and retains any database record whose storage deletion fails:

```bash
curl -X DELETE -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  -d '{"ids":["IMAGE_ID","VIDEO_ID"]}' \
  "https://your-storinary-domain/api/v1/media"
```

Successful uploads, URL imports, and media-list requests are aggregated per key
and UTC day into request, asset, error, and byte counters. Settings → API Keys
shows each active key's usage for the last day, 7, 30, or 90 days. Recorder
failures never fail the underlying media operation.

When signed delivery is enabled, transform links are bound to the same storage
path token as originals. The image-detail API returns `links.transformUrl` for a
requested transform, so clients can copy a fully authorized derivative URL
rather than appending parameters to an original-only signed link. Transform
responses use private no-store caching; public transforms remain CDN-cacheable.

### Remote URL Imports

Dashboard users can import from **Upload Images** and **Videos**. API clients can
also import batches by URL with the `upload` or `video-upload` scope:

```bash
curl -X POST https://your-storinary-domain/api/import/images \
  -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com/photo.jpg"],"folder":"/imports","tags":"remote"}'
```

Use `/api/import/videos?renditions=true` for MP4, WebM, or MOV URLs. Image
batches return `{ success, images, errors }`; video batches return
`{ success, videos, errors }`, with one result entry per source URL. A failed
URL does not abort other URLs in the batch.

Remote imports are server-side fetches, so Storinary only accepts public HTTPS
URLs, validates every DNS answer and redirect against private/link-local ranges,
limits redirects and elapsed time, enforces upload size limits before database
persistence, and scans SVGs using the same safety rules as direct uploads.

### Vision AI

With an optional OpenAI-compatible provider configured, analyze an image to
generate bounded tags and alt text plus a moderation score. The raw insight is
versioned in the database while existing tags are merged; pass
`replace_metadata=true` to replace tags or fill empty alt text intentionally.

```bash
curl -X POST 'https://your-storinary-domain/api/images/<id>/ai?caption=true&moderation=true' \
  -H "X-API-Key: <stor_live_...>" # requires write scope
```

Video analysis uses the stored poster when available, or extracts a representative
frame with FFmpeg, then applies the same bounded tagging, captioning, and
moderation pipeline:

```bash
curl -X POST 'https://your-storinary-domain/api/videos/<id>/ai?replace_metadata=false' \
  -H "X-API-Key: <stor_live_...>"
```

Disable defaults globally by setting a feature variable to `false`. Individual
requests can only turn features off (`tags=false`, `caption=false`,
`moderation=false`); they cannot re-enable a disabled default. The provider
responses are parsed defensively, stored as immutable analysis records linked to
the asset, and API key usage is recorded under the `write` action. Dashboard users
can trigger the same workflow from image details or the video library.

### Folder Management

Use **Gallery → Folders → Manage** to inspect image/video counts, select a
folder filter, rename a virtual path across both media types, or delete an empty
folder. Folder paths are normalized to `/parent/child`; traversal segments are
rejected and root cannot be renamed or deleted. Renaming is metadata-only and
does not move files in object storage.

### Storage Orphan Cleanup

**Settings → Danger Zone → Orphan Cleanup** scans the active provider, compares
every storage object against image paths, video paths, posters, and renditions,
and shows a dry-run result first. Deletion is dashboard-only, capped at 200
objects per request, requires an explicit typed confirmation, and rechecks every
key against current database references immediately before calling storage.

### Delivery Analytics

The dashboard now tracks real delivery requests for images and videos, including
transformed image responses, video renditions, bytes delivered, daily volume, top
assets, and referrer origins. Analytics are dashboard-only; request logs retain
only the referrer origin (not its full URL) and a truncated user agent. Recording
failures never block media delivery.

### Outbound Webhooks

Add a public HTTPS endpoint in **Settings → Outbound Webhooks**. Storinary sends
`image.uploaded`, `image.updated`, `image.deleted`, `video.uploaded`, and
`video.deleted` events with a 5-second timeout and up to three attempts (about
30 seconds, then 5 minutes apart). Destinations must use public DNS-resolvable
HTTPS hosts; loopback and private network addresses are rejected.

```json
{
  "id": "018f...",
  "type": "image.uploaded",
  "createdAt": "2026-08-25T13:15:00.000Z",
  "data": { "image": { "id": "img_123" } }
}
```

Verify the exact raw request body using HMAC-SHA256 over
`<X-Storinary-Timestamp>.<rawBody>`:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const timestamp = request.headers['x-storinary-timestamp'];
const received = request.headers['x-storinary-signature'].replace(/^sha256=/, '');
const expected = createHmac('sha256', process.env.STORINARY_WEBHOOK_SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');

if (!timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
  return response.status(401).end();
}
```

## 🧭 Usage Guide

### Upload
1. Go to **Upload** → drag & drop, browse, or **paste** images.
2. Tune options: **Compress to WebP** (quality / max width), **Remove Background**, target **Folder**, **Tags**.
3. Hit **Upload All** — watch each file go `Pending → Compressing → Removing BG → Uploading → Done`.
4. Copy the finished links (URL / HTML / Markdown / All formats) straight into your site.

### Gallery
Search (300ms debounce), filter by folder, sort by date/size/name, paginate. Keyboard: `Ctrl/Cmd+A` select page, `Delete` confirm-delete, `Esc` deselect. Bulk copy URLs or bulk delete.

### Detail & Transform

### Video renditions

Uploads can request MP4 renditions by sending `renditions=true` to `/api/videos`. With `ffmpeg`
installed, Storinary creates fast-start H.264/AAC 360p and 720p variants, persists their metadata,
and exposes copyable URLs:

```
/api/videos/<id>/stream?rendition=360p
/api/videos/<id>/stream?rendition=720p
```

Rendition files are deleted with the parent video. If FFmpeg is not installed, uploads still succeed;
the request simply has no rendition variants.

Generate or replace variants after upload with a `write`-scoped API key:

```bash
curl -X POST "https://your-storinary-domain/api/videos/VIDEO_ID/renditions?labels=360p,720p" \
  -H "X-API-Key: <stor_live_...>"
```

The route returns `201` when all requested variants are ready, or `207` with per-label errors.
Existing labels are replaced safely, and usage is attributed to the `write` key.

### Adaptive bitrate HLS

Generate an Apple-compatible HLS package after upload using a dashboard session or
`write`-scoped API key:

```bash
curl -X POST "https://your-storinary-domain/api/videos/VIDEO_ID/hls?variants=360p,720p&source=720p" \
  -H "X-API-Key: <stor_live_...>"
```

The route creates 6-second MPEG-TS segments, a master manifest, and one variant
playlist per requested quality. Every file is uploaded explicitly and tracked in
the database, so deleting the video removes the entire package even when object
storage has no directory-listing primitive. Playback uses:

```
/api/videos/<id>/hls/<label>/master.m3u8
```

When signed delivery is enabled, every manifest and segment request must carry a
valid token for that exact path. HLS generation requires FFmpeg.

### MPEG-DASH streaming

Generate an MPEG-DASH package with the same write-scoped authentication model:

```bash
curl -X POST "https://your-storinary-domain/api/videos/VIDEO_ID/dash?variants=360p,720p&source=720p" \
  -H "X-API-Key: <stor_live_...>"
```

DASH output includes one MPD manifest per variant plus tracked initialization and
media segments. Playback uses:

```
/api/videos/<id>/dash/<label>/manifest.mpd
```

Every DASH file is deleted with its parent video, and signed delivery protects
manifests and segments just like HLS. The dashboard automatically prefers an HLS
package and falls back to DASH when only a DASH package exists.

### Video clips

Create a temporary on-demand MP4 clip with a dashboard session or `write`-scoped
key:

```bash
curl -X POST "https://your-storinary-domain/api/videos/VIDEO_ID/clip" \
  -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  --data '{"start": 2.5, "duration": 10, "rendition": "720p"}' \
  --output clip.mp4
```

The body uses seconds and requires exactly one of `duration` or `end`; optional
`rendition`, `format: "webm"`, and `muted: true` controls can also be supplied.
Clips are capped at one hour, returned directly with private no-store headers,
and attributed to API-key usage. FFmpeg is required.

Set `"persist": true` and provide a unique 1–100 character `name` to store a
reusable named derivative:

```bash
curl -X POST "https://your-storinary-domain/api/videos/VIDEO_ID/clip" \
  -H "X-API-Key: <stor_live_...>" \
  -H "Content-Type: application/json" \
  --data '{"persist": true, "name": "intro", "start": 2.5, "duration": 10}'
```

The response returns the clip record and stable delivery URL. List clips with
`GET /api/videos/:id/clip`; delete one by name with
`DELETE /api/videos/:id/clip/:name`. Deleting either the named clip or its parent
video removes stored derivative files.
Click any image → live preview (click to zoom), metadata table with **inline editing** (tags / alt text / folder), and the transform panel with sliders + presets (150×150, 800×600, 1920×1080, 1200×630). Changes preview live and generate a copy-ready **Transform URL**.

### Settings
- **Authentication** — status + sign out (when `STORINARY_ADMIN_PASSWORD` is set)
- **Connection Status** — test connectivity
- **Default Upload Settings** — persist upload defaults in your browser
- **Supabase Setup Instructions** — collapsible 5-step guide
- **Danger Zone** — Delete All Images (type-to-confirm) · Reset Database

## 🪄 Transformations Reference

Serve any image with on-the-fly transforms via the URL:

```
GET /api/serve/<storage-path>?w=<width>&h=<height>&fit=<fit>&g=<gravity>&ar=<ratio>&b=<background>&a=<angle>&e=<effects>&brightness=<scale>&contrast=<scale>&gamma=<value>&dpr=<scale>&q=<quality>&fmt=<format>&text=<overlay>
```

| Param | Values | Default | Description |
| --- | --- | --- | --- |
| `w` | 1 – 8192 | original | Output width (px) |
| `h` | 1 – 8192 | original | Output height (px) |
| `q` | 1 – 100 or `auto` | `80` | Compression quality (`auto` currently maps to quality 80) |
| `fmt` | `jpeg` `webp` `avif` `png` `auto` | original | Output format; `auto` uses optimized WebP |
| `fit` | `cover` `contain` `fill` `inside` `outside` `thumb` `limit` | `inside` | Resize/crop mode; `thumb` crops and `limit` only downscales |
| `g` | `center` `auto` `north` `south` `east` `west` `face` `faces` | `center` | Crop focus; `auto`, `face`, and `faces` use native attention-based smart cropping |
| `ar` | width:height | original | Aspect-ratio target, e.g. `16:9` or `1:1` |
| `b` | CSS color or hex color | transparent | Padding/background used by `contain`/pad-style transforms |
| `a` | -360 – 360 | `0` | Rotation in degrees |
| `e` | comma-separated effects | none | Supported: `grayscale`, `sepia:<0-100>`, `blur:<1-1000>`, `sharpen:<1-100>`, `saturation:<0-200>` |
| `brightness` | 0.1 – 3 | `1` | Brightness multiplier |
| `contrast` | 0.1 – 3 | `1` | Contrast multiplier |
| `gamma` | 0.1 – 3 | `1` | Gamma correction value |
| `dpr` | 0.5 – 4 or `auto` | `1` | Device-pixel ratio multiplier; `auto` uses `2` |
| `text` | Up to 160 visible characters | none | Renders a safe sans-serif overlay. Text is escaped before Pango rendering; HTML/markup and control characters are not interpreted |
| `overlay` | Existing Storinary image ID | none | Composites a tracked image as a watermark/overlay; placement follows `g` |

**Examples**

```
# 800px-wide WebP thumbnail at 70% quality
/api/serve/2026/08/photo.webp?w=800&q=70&fmt=webp

# 1200×630 social card (crop to fit)
/api/serve/2026/08/photo.webp?w=1200&h=630&fit=cover&fmt=webp

# Square avatar
/api/serve/2026/08/photo.webp?w=150&h=150&fit=cover

# Auto-optimized DPR-aware thumbnail with top-focused cropping
/api/serve/2026/08/photo.webp?w=320&fit=thumb&g=north&dpr=auto&q=auto&fmt=auto

# Padded 16:9 card with grayscale effect
/api/serve/2026/08/photo.webp?w=640&h=360&fit=contain&b=white&e=grayscale

# Punchy product shot
/api/serve/2026/08/photo.webp?w=1200&fmt=webp&brightness=1.15&contrast=1.25&gamma=1.05

# Subject-aware 16:9 crop
/api/serve/2026/08/photo.webp?w=1200&h=675&fit=cover&g=auto&fmt=webp

# Bottom-right watermark (gravity controls overlay placement)
/api/serve/2026/08/photo.webp?w=1200&fmt=webp&text=%C2%A9%20Storinary&g=south_east

# Tracked image watermark (no arbitrary remote fetching)
/api/serve/2026/08/photo.webp?w=1200&fmt=webp&overlay=IMAGE_ID&g=south_east
```

Transformed results are cached in memory (LRU) and sent with `Cache-Control: public, max-age=31536000, immutable` + `CDN-Cache-Control`, so CDN/browser caches absorb repeat requests.

Named transformations accept the same parameters, including `text`, so a reusable preset can combine sizing, cropping, and an overlay. Legacy Cloudinary-style image URLs can use a text layer such as
`l_text:Arial_40_Hello%20World`; Storinary maps its font family, size, and decoded text to the native sanitized overlay.

### Private / Signed Delivery

Set `STORINARY_SIGNED_URL_SECRET` to switch asset delivery from public storage URLs
to path-bound, expiring URLs. Image detail exposes a one-hour private link, while
the API accepts `ttl` values from 60 seconds to 30 days. Signed responses use
`private, no-store`, reject missing/invalid tokens before storage access, and do
not expose untokenized public redirects. Video stream URLs are also token-gated;
when enabled, external sites should fetch a fresh link through an authenticated
server route rather than hardcoding it.

## 🔌 API Reference

| Route | Method | Description |
| --- | --- | --- |
| `/api/upload` | `POST` | Multipart upload (fields: `file`, `folder`, `tags`, `compressed`, `bgRemoved`) |
| `/api/videos` | `GET`, `POST` | List videos or upload up to five MP4/WebM/MOV assets; optional `upload_preset` and `renditions=true` |
| `/api/videos/:id/renditions` | `POST` | Generate or replace 360p/720p MP4 renditions after upload; dashboard or `write` API key |
| `/api/videos/:id/hls` | `POST` | Generate an explicit 360p/720p HLS package with master manifest, variant playlists, and tracked segments |
| `/api/videos/:id/dash` | `POST` | Generate an explicit 360p/720p MPEG-DASH package with manifests and tracked initialization/media segments |
| `/api/videos/:id/clip` | `GET`, `POST` | List persistent clips; generate a bounded binary clip, or persist a reusable named MP4/WebM derivative with optional muting |
| `/api/videos/:id/clip/:name` | `DELETE` | Delete a named video clip and its stored file |
| `/api/v1/media` | `GET` | Unified image/video list via `resource_type=image`, `video`, or `all`; supports `limit`, `folder`, `collection_id`, structured-metadata filters, and cursor pagination for a single type |
| `/api/v1/media` | `POST` | Cloudinary-style multipart uploads with `resource_type=image` (default) or `video`; returns `201` or `207` for partial success |
| `/api/v1/media` | `DELETE` | Destroy up to 100 mixed image/video IDs; dashboard or explicit `delete` API key |
| `/api/v1/media/:id` | `GET` | Fetch one image or video by ID (`resource_type=image` default or `video`); dashboard or `read` API key |
| `/api/v1/media/:id` | `PATCH` | Update metadata fields or restore a historical image/video version; dashboard or explicit `write` API key |
| `/api/v1/media/:id` | `DELETE` | Destroy an image/video and its derivatives; dashboard or explicit `delete` API key |
| `/api/collections` | `GET`, `POST` | List cross-folder collections with their assets, or create a named collection |
| `/api/collections/:id` | `PATCH`, `DELETE` | Update membership/metadata, add or remove mixed assets, or delete a collection |
| `/api/images` | `GET` | List with `page`, `limit`, `search`, `folder`, `sort`, `order` |
| `/api/images` | `DELETE` | Bulk delete `{ "ids": [...] }` (max 100) |
| `/api/images/:id` | `GET` | Image detail + generated links |
| `/api/images/:id` | `PATCH` | Update `tags`, `altText`, `folder` |
| `/api/images/:id` | `DELETE` | Delete single image |
| `/api/images/:id/transform` | `GET` | Transformed image binary (same params as serve) |
| `/api/serve/[...path]` | `GET` | CDN-style transforms; 301 → public URL when untransformed |
| `/api/stats` | `GET` | Dashboard stats (totals, formats, folders, recent uploads) |
| `/api/reset` | `DELETE` | Wipe DB records (keeps storage files) — Danger Zone |
| `/api/auth/login` | `POST` | Session login (when `STORINARY_ADMIN_PASSWORD` set) |
| `/api/auth/logout` | `POST` | Clear session |
| `/api/auth/status` | `GET` | Whether auth is enabled |
| `/api/webhooks` | `GET`, `POST` | List or create outbound webhook endpoints |
| `/api/webhooks/:id` | `PATCH`, `DELETE` | Pause/activate, rename, rotate secret, or delete |
| `/api/webhooks/deliveries` | `GET` | Recent delivery history (`endpointId`, `limit`) |
| `/api/import/images` | `POST` | Import up to 10 public HTTPS image URLs (`{ urls, folder, tags }`) |
| `/api/import/videos?renditions=true` | `POST` | Import up to 5 public HTTPS video URLs (`{ urls, folder, tags }`) |
| `/api/folders` | `GET`, `PATCH`, `DELETE` | Dashboard-only virtual-folder list, cross-media rename, and empty-folder delete |
| `/api/storage/orphans` | `GET`, `POST` | Dashboard-only dry-run orphan audit and confirmed batch cleanup |
| `/api/analytics/delivery?days=30` | `GET` | Dashboard-only delivery totals, trends, top assets, and referrers |
| `/api/images/:id?ttl=3600` | `GET` | Detail plus a signed direct URL when private delivery is enabled |

## 🔒 Security

- **Admin auth** — with `STORINARY_ADMIN_PASSWORD` set, every API except the public CDN surface (`/api/serve`, `/transform`) and auth endpoints requires a session cookie; app pages redirect to `/login`. Sessions are stateless HMAC tokens (7-day expiry).
- **Rate limiting** — middleware enforces per-IP limits on serve/transform/uploads/deletes/reset/login.
- **SVG hardening** — SVGs containing scripts/event handlers (including XML-entity-encoded variants) are rejected at upload; raw SVGs are served with `Content-Disposition: attachment` + a sandbox CSP.
- **Secret hygiene** — `SUPABASE_SERVICE_ROLE_KEY` never enters the client bundle (no `NEXT_PUBLIC_` prefix); `.env` is gitignored.
- **Safe defaults** — transform params are clamped (w/h ≤ 8192, q ≤ 100), uploads are validated by MIME type and size on both client and server.
- **Remote import SSRF protection** — URL imports require public HTTPS, reject credentials, re-check every redirect, validate all DNS answers against loopback/private/link-local ranges, and stream within bounded size and time limits.
- **Webhook SSRF protection** — webhook URLs require public HTTPS targets; management routes remain dashboard-session-only even when API keys are enabled.

## ☁️ Migrating from Cloudinary

If your Cloudinary account is being closed (or you simply want to move out), two scripts in [`scripts/`](scripts/) handle the whole migration — no manual downloading needed:

### 1. Backup — get your images onto your own disk first

```bash
# Add CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET to .env
node scripts/backup-cloudinary.mjs
```

Downloads every original image into `cloudinary-backup/` (folder structure preserved) plus a `manifest.json` with all metadata. Safe to re-run — already-downloaded files are skipped.

### 2. Migrate — into Storinary (Supabase Storage + database)

```bash
# Make sure the Prisma client matches your DATABASE_URL first:
#   Postgres: npx prisma generate --schema prisma/postgres/schema.prisma
#   SQLite:   npx prisma generate
node scripts/migrate-from-cloudinary.mjs
```

Uploads every image to your Supabase bucket and creates the database records, **preserving Cloudinary folders, tags, alt text, dimensions and original upload dates**. Idempotent — an interrupted run can simply be re-run. Also writes `cloudinary-backup/mapping.json` (public_id → new URL) to power old-URL redirects. Add `--limit=50` for a test run.

### 3. Keep old Cloudinary URLs working (optional)

The app ships a native Cloudinary-compatible delivery route for images and videos. It understands old URL paths and image transform segments (`w_800,h_600,q_70,f_webp`), resolves the migrated asset, and serves binaries directly—no redirect hop:

```
/api/redirect/image/upload/v1234/products/hero.jpg
/api/redirect/image/upload/w_800,h_600,q_70,f_auto/v1234/products/hero.jpg
/api/redirect/video/upload/v1234/products/demo.mp4?rendition=720p
```

Video paths support HTTP `Range` requests for seeking and can select an existing
Storinary rendition with `rendition=360p` or `rendition=720p`. Unsupported
Cloudinary video transformations are not synthesized on demand; migrated files
and existing renditions are delivered as-is.

To serve your old URLs: point your Cloudinary **custom domain (CNAME)** at this app, then rewrite `/image/upload/:rest*` → `/api/redirect/image/upload/:rest*` (via `next.config.ts` rewrites, Vercel rewrites, or your reverse proxy). Images migrate to the same folder path they had on Cloudinary, so the mapping is 1:1. Note: `res.cloudinary.com` itself can't be taken over — a custom domain is required.

When signed delivery is enabled, native Cloudinary paths require a `token`
signed for their `/api/redirect/...` path and use private no-store caching;
public delivery remains immutable and cacheable.

> ⚠️ **Prisma client gotcha:** the generated client must match `DATABASE_URL`. If you've run the `vercel-build` script (or `prisma generate --schema prisma/postgres/schema.prisma`) locally, the client will expect Postgres — regenerate it with plain `npx prisma generate` to go back to SQLite, or vice versa. A mismatch shows up as a dashboard "stats API unavailable" error.

## 🧪 Testing

```bash
npm test            # run all 551 tests once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Coverage areas: lib utilities, upload/gallery/image-detail components, all hooks, all API routes (mocked prisma/storage), and middleware (rate limiting + auth via real `NextRequest`).

## ☁️ Deployment

### Vercel (serverless)

SQLite doesn't persist on serverless functions, so production deploys use **PostgreSQL**. A ready-made Postgres schema (`prisma/postgres/schema.prisma`) with its own migration history (`prisma/postgres/migrations/`) is included — no manual editing required.

**1. Create a Postgres database** — free options: your existing Supabase project (Dashboard → Database) or [Neon](https://neon.tech). Copy the connection string (`postgresql://user:pass@host:5432/db?sslmode=require`).

**2. Apply the migration once** (from your local machine):

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require" \
  npx prisma migrate deploy --schema prisma/postgres/schema.prisma
```

The committed migration creates the `Image` table. If you change the schema later, create and commit a new migration with `npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <name>`.

> The Postgres schema lives in its own directory (`prisma/postgres/`) with its own `migrations/` folder — Prisma resolves the migration history next to each schema file, so the SQLite and Postgres histories stay separate.

**3. Deploy to Vercel** — import the repo, then set these environment variables (Settings → Environment Variables):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your **Postgres** connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret** key |
| `SUPABASE_BUCKET_NAME` | Your public bucket name (e.g. `storinary`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/publishable key |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
| `STORINARY_ADMIN_PASSWORD` *(optional)* | Enable login protection |

The included `vercel-build` script runs automatically on Vercel: it applies pending Postgres migrations (`prisma migrate deploy` — idempotent), generates the Postgres Prisma client, and builds.

**Serverless notes:**
- All API routes run on the **Node.js runtime** (Next 15 App Router default), so `sharp` and Prisma work unchanged; the middleware runs on the edge and never touches the database.
- The rate limiter and transform LRU cache are **in-memory per instance** — on serverless they reset per cold start. Fine for light traffic; for horizontal scale, swap in a shared store (Redis).

### VPS / Docker (recommended for simplicity)
Keep SQLite, set `NEXT_PUBLIC_APP_URL` to your public URL, and:

```bash
npm run build
npm start
```

### Multi-instance scaling
The rate limiter and transform cache are **in-memory per instance**. For horizontal scaling, move them to a shared store (e.g. Redis).

### CI
`.github/workflows/ci.yml` runs typecheck, lint, tests, and the production build on every push and PR.

## 📁 Project Structure

```
prisma/
├── schema.prisma              # SQLite — local development
├── migrations/                # SQLite migrations
└── postgres/
    ├── schema.prisma          # PostgreSQL — production / serverless (Vercel)
    └── migrations/            # PostgreSQL migrations
src/
├── app/            # Pages (dashboard, upload, gallery, images/[id], settings, login) + API routes
├── components/     # layout, ui, upload, gallery, image-detail, dashboard
├── hooks/          # useUpload, useImages, useToast, useClipboard
├── lib/            # storage, image-processing, auth, rate-limit, transform-cache, svg-security, utils
├── middleware.ts   # rate limiting + session auth
└── types/          # Shared TypeScript types
docs/               # Cloudinary comparison reports
```

## 🗺️ Roadmap

Planned directions — contributions welcome on any of these:

- [x] **Postgres migration path** — ready-made `prisma/postgres/` schema + migrations for Vercel/serverless (see [Deployment](#deployment))
- [x] **Eager transforms** — pre-generate derivatives at upload for zero first-hit latency
- [x] **Signed URLs** — gated/private image and video delivery
- [x] **Folder management** — dashboard folder list, rename, and empty-folder cleanup
- [x] **Orphan cleanup** — scan the bucket and delete files with no DB record
- [x] **Real upload progress** — byte-level progress via XHR, not simulated
- [x] **Retry failed uploads** — one-click re-upload of errored items
- [x] **Collections** — cross-folder virtual groupings
- [x] **Adaptive video streaming** — HLS (.m3u8) & MPEG-DASH (.mpd) adaptive bitrate packaging & on-demand clipping
- [x] **Programmatic API keys & usage analytics** — hashed scoped keys with daily request/byte usage counters
- [x] **Outbound webhooks** — signature-verified event dispatch with automated delivery retries
- [x] **Embeddable upload widget** — standalone drop-in script for third-party websites
- [x] **Asset version rollback** — non-destructive historical version management
- [x] **Custom structured metadata** — user-defined typed DAM fields
- [ ] **Dark mode** — design tokens are already in place (`--nb-bg-dark`)
- [ ] **Docker image** — one-command self-hosted deploy

## 🤝 Contributing

Contributions of all kinds are welcome — code, docs, design, bug reports!

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and code style. This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

**Quick start for devs:**

```bash
npm install
cp .env.example .env   # add Supabase creds
npx prisma migrate dev --name init
npm run dev
```

## 📄 License

[GNU General Public License v3.0](LICENSE) — you are free to use, modify, and distribute this software, provided any derivative works are also released under the GPL-3.0.

---

<p align="center">
  Built with ⚡ and ☕ · Self-hosted forever, never locked in.
</p>
