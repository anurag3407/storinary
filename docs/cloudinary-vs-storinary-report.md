# Cloudinary vs. Storinary — Detailed Comparison Report

> **Date:** August 2026 · **Subject:** Cloudinary (managed cloud media platform) vs. Storinary (self-hosted, open-source Cloudinary alternative built with Next.js + Supabase Storage)
>
> **Sources:** Cloudinary official pricing/docs (researched August 2026), Supabase official limits (researched August 2026), and the Storinary implementation plan (`plan.md`) + actual codebase in this repository.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Each Product Is](#2-what-each-product-is)
3. [Feature-by-Feature Comparison](#3-feature-by-feature-comparison)
4. [Free Tier Deep Dive](#4-free-tier-deep-dive)
5. [Paid Plans & Cost Scaling](#5-paid-plans--cost-scaling)
6. [Architecture & Technical Comparison](#6-architecture--technical-comparison)
7. [AI Capabilities](#7-ai-capabilities)
8. [Delivery & Performance](#8-delivery--performance)
9. [Security, Privacy & Data Ownership](#9-security-privacy--data-ownership)
10. [Operational Burden & Reliability](#10-operational-burden--reliability)
11. [When to Choose Which](#11-when-to-choose-which)
12. [Bottom Line](#12-bottom-line)

---

## 1. Executive Summary

| | **Cloudinary** | **Storinary** |
|---|---|---|
| **Model** | Managed SaaS / PaaS (cloud) | Self-hosted, open source (you deploy it) |
| **Storage backend** | Cloudinary's own managed storage | Supabase Storage (1 GB free) |
| **Image processing** | Cloud-side (credit-metered) | `sharp` on your own server (free, unlimited) |
| **Free tier cost** | $0 — 25 credits/month (~25 GB storage *or* ~25 GB bandwidth *or* 25k transformations, shared pool) | $0 — Supabase free tier: 1 GB storage, ~10 GB egress/mo, unlimited transforms |
| **Credit card required** | No | No |
| **Video support** | Full (transcoding, ABR/HLS/DASH, player) | ❌ Images only (no video) |
| **AI background removal** | Cloud AI, counts against credits | Client-side WASM (`@imgly/background-removal`), runs in browser, unlimited & free |
| **Best for** | Teams needing managed, feature-rich media CDN with video, AI, and global CDN — with a budget | Developers who want a free, self-hosted, no-lock-in image CDN and are OK running their own infra |

**One-paragraph verdict:** Cloudinary is the industry-standard *managed* media platform — extremely powerful, feature-complete (images, video, AI, DAM, SDKs, global CDN), but every operation is metered via a credit system, and meaningful scale requires a paid plan starting at **$89–99/month**. Storinary is a *self-hosted* alternative that covers the core image workflow Cloudinary is best known for (bulk upload, on-the-fly resize/format/quality transforms, link generation, gallery/DAM-lite, background removal) using free components: Supabase Storage + Vercel free hosting + `sharp`. Its free tier is effectively **unlimited transformations** — a key advantage — at the cost of you managing infrastructure, having no video support, and a smaller storage pool (1 GB).

---

## 2. What Each Product Is

### Cloudinary
- A **cloud-based media management platform** founded in 2012. Developers upload images/videos once, then deliver transformed, optimized assets on the fly via URLs (`https://res.cloudinary.com/{cloud}/{transform}/{asset}`).
- Provides: image & video transformations, global CDN delivery, digital asset management (DAM), AI features (background removal, auto-tagging, generative edits), programmatic workflows (MediaFlows), webhooks, and official SDKs for 8+ backend and 8+ frontend languages.
- Pricing model: **shared-credit metering**. 1 credit ≈ 1,000 transformations, **or** 1 GB of managed storage, **or** 1 GB of delivered bandwidth (or 500 SD / 250 HD video processing seconds).

### Storinary
- A **self-hosted image management platform** ("a free, self-hosted Cloudinary alternative") built in this repository with:
  - **Next.js 15** (App Router, TypeScript) — web app + API routes
  - **Supabase Storage** — object storage with a basic CDN (public bucket → CDN URLs)
  - **Prisma + SQLite** — local metadata database (zero external DB dependencies)
  - **sharp** — server-side image processing (resize, format conversion, quality)
  - **@imgly/background-removal** — client-side AI background removal (WASM + ONNX, runs in the browser)
- Deploys free on Vercel (or self-hosted Node.js), storing assets in your own Supabase account.
- Feature set (from plan + codebase): bulk upload with progress, client-side WebP pre-compression, client-side background removal, on-the-fly resize/format/quality transforms via `/api/serve/...?w=&h=&fmt=&q=&fit=`, multi-format link generator (Direct/HTML/Markdown/CSS/JSON), searchable/filterable/paginated gallery with bulk actions, image detail page with metadata + interactive transform controls, dashboard with stats, folder organization, and settings.

---

## 3. Feature-by-Feature Comparison

### 3.1 Image Transformations

| Capability | Cloudinary | Storinary |
|---|---|---|
| Resize / scale | ✅ Extensive: `scale`, `fill`, `fit`, `limit`, `pad`, `crop` + **content-aware gravity** (`g_face`, `g_auto`, `g_custom`) | ✅ Core set: resize via `w`/`h` with `fit` modes (`cover`, `contain`, `fill`, `inside`, `outside`) |
| Format conversion | ✅ WebP, AVIF, JPEG, PNG, GIF, + animated formats; **auto-format `f_auto`** (serves best format per browser) | ✅ `fmt=webp/avif/jpeg/png` via URL (`/api/serve/...?fmt=webp`) |
| Quality optimization | ✅ `q_80` manual + **`q_auto`** (perceptual/visual quality auto-tuning) | ✅ `q=` (1–100) manual only |
| Smart cropping (faces/objects) | ✅ AI gravity cropping | ❌ Manual fit modes only |
| Overlays / text / watermarks | ✅ Text & image overlays, watermarks, effects, filters, rounding, shadows | ❌ Not implemented |
| Progressive / interlaced | ✅ Progressive JPEG, interlaced PNG, LQIP placeholders | ✅ Progressive JPEG (`mozjpeg`, `progressive: true`); no LQIP |
| Video transformations | ✅ Full (trim, transcode, overlays, ABR) | ❌ N/A |

**Takeaway:** Cloudinary wins decisively on transform *breadth* and intelligence. Storinary covers the ~80% use case (resize + format + quality) that most product teams actually need, using identical URL-query-syntax concepts.

### 3.2 Upload & Asset Management

| Capability | Cloudinary | Storinary |
|---|---|---|
| Bulk upload | ✅ API + widgets | ✅ Drag-and-drop / paste / file picker, queue with per-file progress bars |
| Pre-upload optimization | ✅ Server-side (auto-optimization on delivery) | ✅ **Client-side WebP compression before upload** (Canvas API) — saves storage & bandwidth |
| Folder organization | ✅ Folders, tags, collections | ✅ Folders (path prefixes) + tags (comma-separated) |
| Search | ✅ Full-text + structured metadata + AI contextual search | ✅ Search by name/tags/alt-text, folder filter, sort, pagination |
| Bulk actions | ✅ API + DAM UI | ✅ Bulk select, bulk delete, bulk copy links (Ctrl+A / Delete / Esc shortcuts) |
| Link generation | ✅ SDK URL builders + many formats | ✅ One-click Direct / HTML / Markdown / CSS / JSON export |
| Versioning / history | ✅ Asset versions | ❌ None |
| Media library UI | ✅ Full DAM web app + widgets | ✅ Neobrutalism dashboard, gallery, detail pages (built for single-user) |
| Alt-text / metadata editing | ✅ Rich structured metadata | ✅ Inline editing of tags, alt text, folder on detail page |

### 3.3 API & Developer Experience

| Capability | Cloudinary | Storinary |
|---|---|---|
| REST API | ✅ Upload/Admin/Provisioning APIs | ✅ REST routes (`/api/upload`, `/api/images`, `/api/serve/...`, `/api/stats`, `/api/reset`) |
| SDKs | ✅ Node, Python, PHP, Java, Ruby, .NET, Go, Dart + React/Vue/Angular/Next.js/Nuxt/Svelte/Astro/Solid/Flutter | ❌ None (plain REST + URLs; web app included) |
| Framework components | ✅ `<CldImage>`, `<CldVideoPlayer>`, Upload Widget, Product Gallery, Media Editor | ✅ Built-in Next.js components instead (ImageCard, DropZone, TransformPanel…) |
| Webhooks | ✅ Rich webhook events | ❌ None |
| Workflow automation | ✅ PowerFlows / EasyFlows visual builders | ❌ None |
| Rate limits (free) | ⚠️ ~500 hourly Admin API requests | ✅ No imposed rate limits (your server) |

### 3.4 Video

| Capability | Cloudinary | Storinary |
|---|---|---|
| Video upload/transcode | ✅ MP4, WebM, on-the-fly encoding | ❌ |
| Adaptive Bitrate Streaming | ✅ HLS & MPEG-DASH (`sp_auto`) | ❌ |
| Video player | ✅ Cloudinary Video Player (playlists, analytics, monetization, shoppable) | ❌ |

**Storinary is strictly an image platform.** If video is in scope, Cloudinary (or another provider) is required.

---

## 4. Free Tier Deep Dive

### 4.1 Cloudinary Free Tier ("Free" plan, 2024–2026)

| Item | Value |
|---|---|
| **Monthly credits** | **25 credits** (shared pool) |
| **Storage** | up to 25 GB managed storage (consumes credits) |
| **Bandwidth** | up to 25 GB delivered bandwidth (consumes credits) |
| **Transformations** | up to 25,000 (consumes credits) |
| **Video processing** | ~12,500 SD or ~6,250 HD seconds (consumes credits) |
| **Credit card** | ❌ Not required |
| **Time limit** | No trial expiry |
| **Overage behavior** | Soft limits: warning emails at ~90%, account **disabled** if consistently over, **assets permanently deleted after 30 days** of unresolved over-limit status |
| **Rate limits** | ~500 hourly Admin API requests |
| **Ads/watermarks on media** | ❌ None (media stays clean) |

> ⚠️ **Important:** The 25 credits are **shared** — 25 GB of storage *or* 25 GB of bandwidth *or* 25k transforms, or any mix. Because 1 GB of bandwidth costs 1 credit, bandwidth-heavy sites burn credits fast.

### 4.2 Storinary Free Tier (Supabase Free + Vercel Free)

| Item | Value |
|---|---|
| **Storage** | **1 GB** Supabase Storage (free) |
| **Bandwidth / egress** | **~10 GB/month** (5 GB standard egress + 5 GB cached CDN egress) |
| **Database** | 500 MB PostgreSQL (Supabase) — but Storinary uses local **SQLite** (effectively free, unlimited within host disk) |
| **Transformations** | **Unlimited** — `sharp` runs on your own server/host; not metered |
| **Background removal** | **Unlimited** — runs client-side in the browser (WASM); no API key, no metering |
| **Credit card** | ❌ Not required |
| **Time limit** | No trial expiry |
| **Inactivity behavior** | Supabase free projects **auto-pause after 7 days of inactivity** (one-click unpause, data preserved) |
| **Hosting** | Vercel free tier (or self-hosted Node.js) — Hobby plan is free |
| **Overage behavior** | Supabase: throttled/read-only or upgrade prompt at limits; data preserved (no forced deletion) |

### 4.3 Free Tier Head-to-Head

| Metric | Cloudinary Free | Storinary (Supabase/Vercel free) | Winner |
|---|---|---|---|
| Storage | ~25 GB equivalent | 1 GB | **Cloudinary** (25×) |
| Bandwidth | ~25 GB/mo equivalent | ~10 GB/mo | **Cloudinary** (2.5×) |
| Transformations | 25,000/mo | **Unlimited** | **Storinary** |
| Background removal | Credit-metered (AI) | **Unlimited, client-side, private** | **Storinary** |
| Rate limits | ~500/hr Admin API | **None** | **Storinary** |
| Credit card | No | No | Tie |
| Data retention safety | Assets deleted after 30 days over-limit | Paused, data preserved | **Storinary** |
| Video | ✅ limited | ❌ | Cloudinary |

> **Effective capacity note:** Storinary compresses images to WebP **before upload**, so 1 GB stores roughly **3,000–5,000 optimized images** (per the implementation plan's estimate). Bandwidth is also saved because clients fetch smaller WebP files. This narrows the storage gap in practice for image-only workloads.

---

## 5. Paid Plans & Cost Scaling

### Cloudinary Paid Plans

| Plan | Monthly price (annual billing) | Monthly price (monthly billing) | Credits/mo | Highlights |
|---|---|---|---|---|
| **Free** | $0 | $0 | 25 | Core features |
| **Plus** | $89 | $99 | 225 | 3 seats, 2 sub-accounts, S3 backup, auto-tagging search, expedited support |
| **Advanced** | $224 | $249 | 600 | 5 seats, 3 sub-accounts, custom CNAME + SSL, advanced auth |
| **Enterprise** | Custom (sales) | — | Custom | Multi-CDN, SLAs, CSM, custom invoicing |

**Typical real-world cost:** A small startup doing ~50k transformations + a few GB of bandwidth per month typically needs **Plus or Advanced ($89–$249/mo)**.

### Storinary Cost Profile
- **Software license:** $0 (self-hosted, open source)
- **Hosting:** Vercel Hobby free (or ~$20/mo Pro if you need more) — or any Node host
- **Storage/bandwidth:** Supabase free (or Pro at **$25/mo** for 100 GB storage, 250 GB egress, Smart CDN, up to 5 projects)
- **Image processing:** Free (your own CPU — the only real cost is your hosting CPU/edge budget)
- **Database:** SQLite, free

**Realistic ceiling:** Storinary stays at **$0/month** well beyond Cloudinary's free tier, and even the "growth" path (Supabase Pro $25 + Vercel Pro $20) is still far cheaper than Cloudinary's Plus ($89+).

| | Cloudinary (scaling) | Storinary (scaling) |
|---|---|---|
| Entry cost | $0 (25 credits) | $0 |
| Small production | ~$89–99/mo (Plus) | ~$0 (free tiers) |
| Growing production | ~$224–249/mo (Advanced) | ~$45/mo (Supabase Pro + Vercel Pro) |
| Enterprise | Custom ($thousands/mo) | Self-hosted on your own infra |

---

## 6. Architecture & Technical Comparison

| Aspect | Cloudinary | Storinary |
|---|---|---|
| Processing location | Cloud-side (Cloudinary servers) | Your server (`sharp`) + client browser (compression, bg removal) |
| Transform syntax | `https://res.cloudinary.com/{cloud}/image/upload/w_800,f_auto/{asset}` | `https://yourhost/api/serve/{path}?w=800&fmt=auto` (or `/api/images/:id/transform`) |
| Transform caching | Cloudinary CDN edge caching | HTTP `Cache-Control: public, max-age=31536000, immutable` → CDN/browser caches |
| Storage | Cloudinary managed + optional S3 backup (paid) | Supabase Storage (yours), S3-compatible |
| Database | Cloudinary metadata + optional DAM | Prisma + SQLite (metadata in your DB) |
| Authentication | Cloud accounts, API keys, seats/roles (paid) | None built-in (single-user self-hosted tool); API key middleware possible |
| Frontend | SDKs + widgets (drop-in) | Full included React app (dashboard, gallery, upload, settings) |
| Tech stack (yours) | API/SDK integration only | Next.js 15, TypeScript, CSS Modules (neobrutalism), sharp, Prisma, Supabase |

**Key architectural insight:** Cloudinary centralizes *everything* in its cloud and meters it. Storinary pushes work to *your* infrastructure: **client-side pre-compression** (save storage), **client-side background removal** (save AI cost), and **server-side sharp transforms** (unmetered). This inversion of cost is the core of why Storinary's free tier can offer unlimited transformations.

---

## 7. AI Capabilities

| AI Feature | Cloudinary | Storinary |
|---|---|---|
| Background removal | ✅ Cloud AI (`e_background_removal`) — metered | ✅ **Client-side** WASM (`@imgly/background-removal`, `isnet` model) — free, unlimited, runs offline per-user |
| Background replacement / generative fill | ✅ | ❌ |
| Auto-tagging / image captioning | ✅ | ❌ |
| Smart crop / object-aware gravity | ✅ | ❌ |
| Generative text-to-image / object removal | ✅ | ❌ |
| Content moderation (NSFW) | ✅ (via partners) | ❌ |
| **Privacy angle** | Images leave your infra for AI processing | **Images never leave the browser** for bg removal |

**Takeaway:** Cloudinary has far broader AI. But Storinary's single AI feature (background removal) is architecturally clever — it's free, unlimited, and privacy-preserving, since the model runs locally in the browser with zero server cost and zero image exfiltration.

---

## 8. Delivery & Performance

| Aspect | Cloudinary | Storinary |
|---|---|---|
| CDN | Tier-1 global CDN (Akamai, Fastly), edge caching, responsive delivery | Supabase basic CDN (1-hour cache headers) on free tier; Smart CDN (60s purge) on Pro |
| Global edge coverage | Excellent, mature | Good (Supabase CDN), but not same class |
| Transform first-byte latency | Sometimes queued/on-the-fly for complex transforms | First request processes server-side; cached afterward (immutable headers) |
| Image optimization on delivery | `f_auto` + `q_auto` automatic | Manual `fmt`/`q` (client compression already reduces payloads) |
| Core Web Vitals tooling | LQIP, progressive loading, responsive placeholders | Progressive JPEG, lazy loading; no LQIP |

---

## 9. Security, Privacy & Data Ownership

| Aspect | Cloudinary | Storinary |
|---|---|---|
| Where your data lives | Cloudinary's cloud (US/EU regions) | **Your Supabase account** (you control the project/region) |
| Ownership | You retain rights, but data is hosted by a vendor | Fully yours — delete the project and everything is gone |
| Vendor lock-in | Transform URLs and API surface tie you to Cloudinary | None — plain URLs + your own infra; migrate storage anytime |
| Privacy of AI | Background removal sends images to Cloudinary | Background removal runs in-browser (images never leave the user's device) |
| Security model | Managed (SSO/roles on paid plans) | No auth built-in; secured by self-hosting + optional middleware |
| Compliance | Enterprise compliance features on Enterprise plan | You manage compliance yourself |

---

## 10. Operational Burden & Reliability

| Aspect | Cloudinary | Storinary |
|---|---|---|
| Setup effort | Sign up, get API keys, integrate SDK (~hours) | Clone/deploy app, create Supabase project + bucket, set env vars (~30–60 min) |
| Maintenance | None (managed) | You: updates, security patches, monitoring, scaling |
| Uptime SLA | Enterprise: SLAs; free: best effort | Your responsibility (Vercel/Supabase both have strong uptime, but you own the stack) |
| Scaling | Effortless (their problem) | You handle hosting limits (Vercel function limits, CPU for sharp) |
| Failure modes | Account disable if over credits; 30-day deletion | Supabase auto-pause after 7 days inactivity; host limits |
| Monitoring/analytics | Built-in media analytics | None built-in |

---

## 11. When to Choose Which

### Choose **Cloudinary** if…
- You need **video** (transcoding, ABR streaming, player).
- You need **advanced AI** (generative editing, smart cropping, auto-tagging, moderation).
- You want a **fully managed** platform with zero infra maintenance and a global tier-1 CDN.
- You need **SDKs/widgets** in many languages and a rich DAM for a **team** (seats, roles, collaboration).
- You have a budget (free tier only suits demos/hobby projects; production typically $89+/mo).
- You want **automatic optimization** (`f_auto`, `q_auto`) and don't want to manage transforms.

### Choose **Storinary** if…
- You want a **$0** self-hosted image CDN with **unlimited transformations** and **unlimited background removal**.
- Your workload is **images only** (no video).
- You're a developer comfortable with Next.js and running your own infra (Vercel free + Supabase free).
- You value **data ownership / no vendor lock-in** and **privacy** (client-side background removal).
- You want a **batteries-included web app** (dashboard, gallery, link generator) rather than integrating an SDK.
- You have modest storage needs (~1 GB free; scales with Supabase Pro at $25/mo).

---

## 12. Bottom Line

- **Cloudinary is the more powerful product** — vastly broader (video, AI, DAM, SDKs, global CDN, automation) and a better fit for teams and production workloads with a budget. Its free tier (25 credits/mo) is generous for experimentation but restrictive for real traffic due to shared bandwidth/transformation metering and the 30-day deletion risk.
- **Storinary is the more cost-effective alternative for image-only workloads.** It inverts the cost model: unlimited transforms and AI via client/server-side processing on free infrastructure. Trade-offs: 1 GB storage, ~10 GB egress, no video, no team features, and you own the ops.
- **The honest recommendation:** For hobby projects, MVPs, internal tools, and image-only sites — Storinary's effective free tier (unlimited transforms) can outperform Cloudinary's metered 25 credits. For video, enterprise DAM, AI-heavy pipelines, or teams that don't want to manage infrastructure — Cloudinary is the standard choice at its price point.

---

*Report generated from Cloudinary & Supabase public pricing/docs and the Storinary plan.md + codebase. Figures for Cloudinary/Supabase are as published and subject to change; verify current limits on their pricing pages before committing to either.*
