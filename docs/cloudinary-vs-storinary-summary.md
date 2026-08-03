# Cloudinary vs. Storinary — Summary

> Quick-reference version of the full report (`docs/cloudinary-vs-storinary-report.md`). Figures current as of August 2026.

## TL;DR

| | **Cloudinary** | **Storinary** |
|---|---|---|
| What it is | Managed cloud media platform (SaaS) | Self-hosted, open-source image CDN |
| Free tier | $0 · 25 credits/mo (~25 GB storage *or* ~25 GB bandwidth *or* 25k transforms — **shared pool**) | $0 · 1 GB Supabase storage, ~10 GB egress/mo, **unlimited transforms** |
| Credit card | No | No |
| Transformations | Metered (credits) | **Unlimited** (sharp on your server) |
| Background removal | Cloud AI (metered) | Client-side WASM (free, unlimited, private) |
| Video | ✅ Full (ABR, HLS/DASH, player) | ❌ Images only |
| Teams/SDKs/DAM | ✅ Rich (8+ SDKs, seats, roles) | ❌ Single-user, web app included |
| Cost to scale | Plus $89–99/mo, Advanced $224–249/mo | ~$0, or Supabase Pro $25/mo |
| Maintenance | None (managed) | You own it |
| Best for | Video, AI-heavy, teams, managed CDN | Image-only sites, devs, $0 budgets, privacy |

---

## Feature Comparison at a Glance

| Feature | Cloudinary | Storinary |
|---|---|---|
| Resize / crop / fit | ✅ Extensive + AI smart-crop | ✅ Core (`w`,`h`,`fit` cover/contain/fill/inside/outside) |
| Format conversion | ✅ WebP/AVIF/JPEG/PNG + `f_auto` | ✅ WebP/AVIF/JPEG/PNG via `?fmt=` |
| Quality control | ✅ `q_auto` + manual | ✅ Manual `?q=` (1–100) |
| Bulk upload | ✅ API/widgets | ✅ Drag/drop/paste + progress bars |
| Pre-upload compression | ❌ (server-side delivery opt.) | ✅ Client-side WebP (saves storage) |
| Link generator | ✅ SDK builders | ✅ Direct/HTML/Markdown/CSS/JSON copy |
| Gallery / DAM-lite | ✅ Full DAM | ✅ Search/filter/sort/paginate/bulk actions |
| Folders & tags | ✅ | ✅ |
| Inline metadata editing | ✅ | ✅ (tags, alt text, folder) |
| Video streaming | ✅ HLS/DASH + player | ❌ |
| AI edits / auto-tag / moderation | ✅ | ❌ (bg removal only) |
| Webhooks / workflows | ✅ | ❌ |
| SDKs / widgets | ✅ 16+ | ❌ (app included) |

---

## Free Tier Head-to-Head

| Metric | Cloudinary Free | Storinary Free | Winner |
|---|---|---|---|
| Storage | ~25 GB equiv. | 1 GB | Cloudinary |
| Bandwidth | ~25 GB/mo equiv. | ~10 GB/mo | Cloudinary |
| Transformations | 25,000/mo | **Unlimited** | Storinary |
| Background removal | Metered | **Unlimited** | Storinary |
| Rate limits | ~500/hr Admin API | None | Storinary |
| Overage risk | Disabled + assets **deleted after 30 days** | Paused, data preserved | Storinary |
| Credit card | No | No | Tie |

> **Note on 1 GB:** Storinary compresses to WebP before upload → ~3,000–5,000 images fit in 1 GB, narrowing the gap for image-only use.

---

## Cost Scaling

| Stage | Cloudinary | Storinary |
|---|---|---|
| Start | $0 (25 credits) | $0 |
| Small production | Plus ~$89–99/mo | ~$0 (free tiers) |
| Growing | Advanced ~$224–249/mo | ~$45/mo (Supabase Pro $25 + Vercel Pro $20) |
| Enterprise | Custom (thousands/mo) | Your own infra |

---

## Architecture (why Storinary is free at scale)

- **Cloudinary:** everything processed & metered in their cloud.
- **Storinary:** cost pushed to free layers —
  - Client-side **WebP pre-compression** → less storage/bandwidth
  - Client-side **WASM background removal** → no AI cost, images never leave the browser
  - Server-side **sharp transforms** → unlimited, unmetered
  - Supabase Storage + Vercel free hosting + SQLite DB → $0 stack

---

## Decision Guide

**Pick Cloudinary** when: you need video, advanced AI, team collaboration/DAM, SDKs, a fully managed global CDN, or have a production budget.

**Pick Storinary** when: images-only, want $0 unlimited transforms + background removal, value self-hosting / data ownership / privacy, or are a developer comfortable running your own infra.

---

*Full analysis with sources: see `docs/cloudinary-vs-storinary-report.md`.*
