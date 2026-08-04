<p align="center">
  <img src="public/logo.png" alt="Storinary logo" width="240" />
</p>

# 🟨 Storinary — Self-Hosted Image CDN

<p align="center">
  <em>A free, self-hosted <a href="https://cloudinary.com">Cloudinary</a> alternative. Own your images, transform them on the fly, and never get your account deleted.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License: GPL-3.0" /></a>
  <a href="https://github.com/anurag3407/storinary-cloud/actions/workflows/ci.yml"><img src="https://github.com/anurag3407/storinary-cloud/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tests-284%20passing-brightgreen" alt="284 tests passing" />
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript strict" />
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome" /></a>
</p>

---

**Storinary** is a self-hosted image management and delivery platform: bulk upload, transform, and serve images from **Supabase Storage** with a fast, neobrutalism-styled dashboard — **no credit card, no per-image pricing, no vendor lock-in**.

Built for the exact problem Cloudinary users hit on the free tier: your account gets disabled for overages and **your assets get deleted**. With Storinary, images live in **your** Supabase bucket, transforms run on **your** server and in **your** browser, and nothing is metered.

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
| **Client-side AI background removal** | `@imgly/background-removal` (WASM) runs entirely in the browser — no API key, no server cost, **unlimited** |
| **Client-side pre-compression** | Images are compressed to WebP in the browser before upload, slashing storage usage |
| **On-the-fly transforms** | URL-based resize / crop / format / quality: `/api/serve/img.webp?w=800&h=600&fit=cover&q=80&fmt=webp` |
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
| **Transformations** | Rich: chaining, effects, overlays, video, `f_auto`/`q_auto` | Core set: resize / fit / format / quality (extensible — it's your code) |
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
- **Prisma + SQLite** — metadata database (swap to Postgres for serverless)
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
```

> **Create the bucket**: Supabase Dashboard → Storage → New bucket → name it `storinary` (or your `SUPABASE_BUCKET_NAME`) → **Public bucket: ON**.

### 3. Initialize the database

```bash
npx prisma migrate dev --name init
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload your first image. 🎉

## ⚙️ Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | SQLite file (dev) or Postgres connection string (production) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Secret key** (server-side only — never expose to the client) |
| `SUPABASE_BUCKET_NAME` | ✅ | Storage bucket name (must exist & be **public**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Public/publishable key (new format: `sb_publishable_…`) |
| `NEXT_PUBLIC_APP_URL` | ⚠️ | Public app URL — used for generated links & server fetches (set it in production) |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | — | Max upload size in MB (default `10`) |
| `NEXT_PUBLIC_ALLOWED_FORMATS` | — | Comma-separated allowed MIME types |
| `STORINARY_ADMIN_PASSWORD` | — | Set to enable admin login + API protection |
| `STORINARY_TRANSFORM_CACHE_ENTRIES` | — | LRU cache entry limit (default `50`) |
| `STORINARY_TRANSFORM_CACHE_MB` | — | LRU cache byte budget in MB (default `64`) |

## 🧭 Usage Guide

### Upload
1. Go to **Upload** → drag & drop, browse, or **paste** images.
2. Tune options: **Compress to WebP** (quality / max width), **Remove Background**, target **Folder**, **Tags**.
3. Hit **Upload All** — watch each file go `Pending → Compressing → Removing BG → Uploading → Done`.
4. Copy the finished links (URL / HTML / Markdown / All formats) straight into your site.

### Gallery
Search (300ms debounce), filter by folder, sort by date/size/name, paginate. Keyboard: `Ctrl/Cmd+A` select page, `Delete` confirm-delete, `Esc` deselect. Bulk copy URLs or bulk delete.

### Detail & Transform
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
GET /api/serve/<storage-path>?w=<width>&h=<height>&fit=<fit>&q=<quality>&fmt=<format>
```

| Param | Values | Default | Description |
| --- | --- | --- | --- |
| `w` | 1 – 8192 | original | Output width (px) |
| `h` | 1 – 8192 | original | Output height (px) |
| `q` | 1 – 100 | `80` | Compression quality |
| `fmt` | `jpeg` `webp` `avif` `png` | original | Output format (WebP = great default) |
| `fit` | `cover` `contain` `fill` `inside` `outside` | `inside` | Resize fit mode (`cover` crops) |

**Examples**

```
# 800px-wide WebP thumbnail at 70% quality
/api/serve/2026/08/photo.webp?w=800&q=70&fmt=webp

# 1200×630 social card (crop to fit)
/api/serve/2026/08/photo.webp?w=1200&h=630&fit=cover&fmt=webp

# Square avatar
/api/serve/2026/08/photo.webp?w=150&h=150&fit=cover
```

Transformed results are cached in memory (LRU) and sent with `Cache-Control: public, max-age=31536000, immutable` + `CDN-Cache-Control`, so CDN/browser caches absorb repeat requests.

## 🔌 API Reference

| Route | Method | Description |
| --- | --- | --- |
| `/api/upload` | `POST` | Multipart upload (fields: `file`, `folder`, `tags`, `compressed`, `bgRemoved`) |
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

## 🔒 Security

- **Admin auth** — with `STORINARY_ADMIN_PASSWORD` set, every API except the public CDN surface (`/api/serve`, `/transform`) and auth endpoints requires a session cookie; app pages redirect to `/login`. Sessions are stateless HMAC tokens (7-day expiry).
- **Rate limiting** — middleware enforces per-IP limits on serve/transform/uploads/deletes/reset/login.
- **SVG hardening** — SVGs containing scripts/event handlers (including XML-entity-encoded variants) are rejected at upload; raw SVGs are served with `Content-Disposition: attachment` + a sandbox CSP.
- **Secret hygiene** — `SUPABASE_SERVICE_ROLE_KEY` never enters the client bundle (no `NEXT_PUBLIC_` prefix); `.env` is gitignored.
- **Safe defaults** — transform params are clamped (w/h ≤ 8192, q ≤ 100), uploads are validated by MIME type and size on both client and server.

## 🧪 Testing

```bash
npm test            # run all 284 tests once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Coverage areas: lib utilities, upload/gallery/image-detail components, all hooks, all API routes (mocked prisma/storage), and middleware (rate limiting + auth via real `NextRequest`).

## ☁️ Deployment

### Vercel (serverless)
SQLite does not persist on serverless functions. **Switch the Prisma datasource to Postgres** (Supabase Postgres or [Neon](https://neon.tech)):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```bash
npx prisma migrate deploy
```

The storage/transform architecture is otherwise serverless-friendly (all routes run on the Node runtime).

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

- [ ] **Postgres migration docs** — first-class serverless deployment guide
- [ ] **Eager transforms** — pre-generate derivatives at upload for zero first-hit latency
- [ ] **Signed URLs** — gated/private image delivery
- [ ] **Folder management UI** — create / rename / move folders in the gallery
- [ ] **Orphan cleanup** — scan the bucket and delete files with no DB record
- [ ] **Real upload progress** — byte-level progress via XHR, not simulated
- [ ] **Retry failed uploads** — one-click re-upload of errored items
- [ ] **Collections** — cross-folder virtual groupings
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
