# 🟨 Storinary — Self-Hosted Image CDN

A free, self-hosted [Cloudinary](https://cloudinary.com) alternative. Bulk upload, transform, and serve images from **Supabase Storage** with a neobrutalism dashboard — no credit card, no per-image pricing, no vendor lock-in.

> Compare Storinary vs. Cloudinary in depth: [`docs/cloudinary-vs-storinary-report.md`](docs/cloudinary-vs-storinary-report.md)

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **Bulk upload** | Drag & drop or file picker, concurrent queue with live progress |
| **Client-side AI background removal** | `@imgly/background-removal` (WASM) — runs in the browser, no API key, no server cost |
| **Client-side pre-compression** | Images compressed to WebP in the browser before upload to save storage |
| **On-the-fly transforms** | URL-based resize / crop / format / quality: `/api/serve/img.webp?w=800&h=600&fit=cover&q=80&fmt=webp` |
| **Link generator** | One-click copy: Direct URL, HTML `<img>`, Markdown, CSS, JSON bulk export |
| **Gallery** | Search, folder filter, pagination, bulk select / delete / copy |
| **Image detail** | Full preview with zoom, metadata, interactive transform controls |
| **Dashboard** | Storage stats, format distribution, recent uploads, quick actions |
| **Settings** | Connection test, default upload options, Supabase setup guide, danger zone |
| **Admin auth** *(optional)* | Set `STORINARY_ADMIN_PASSWORD` to protect uploads, the library, and settings behind a login |

## 🧱 Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Supabase Storage** — object storage + CDN URLs
- **Prisma + SQLite** — metadata database
- **sharp** — server-side image processing
- **@imgly/background-removal** — client-side background removal (WASM)
- **Vitest + Testing Library** — 284 unit/integration tests
- Vanilla CSS Modules (neobrutalism design system)

## 🚀 Quickstart

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials (see the in-app **Settings → Supabase Setup Instructions** for step-by-step setup):

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
SUPABASE_BUCKET_NAME="storinary"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAX_FILE_SIZE_MB="10"
NEXT_PUBLIC_ALLOWED_FORMATS="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
# Optional: enable admin login
STORINARY_ADMIN_PASSWORD="a-strong-password"
```

### 3. Initialize the database

```bash
npx prisma migrate dev --name init
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 🔒 Security Notes

- **Admin auth**: when `STORINARY_ADMIN_PASSWORD` is set, every API except the public CDN surface (`/api/serve`, `/transform`) and the auth endpoints requires a session cookie, and app pages redirect to `/login`. Leave it unset for open dev mode. Sessions are stateless HMAC tokens valid for 7 days — signing out only clears the cookie (a stolen token stays valid until expiry).
- **Rate limiting**: middleware limits abuse of expensive endpoints (serve/transform/uploads/reset/login) per IP.
- **SVG uploads**: SVGs containing scripts or event handlers are rejected at upload; raw SVGs are served with `Content-Disposition: attachment` + a sandbox CSP to prevent stored XSS.
- **Transform caching**: repeated transforms are served from an in-memory LRU cache with immutable `Cache-Control` + `CDN-Cache-Control` headers.

## 🧪 Testing

```bash
npm test            # run all tests once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## 📜 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm test` | Run the test suite |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## ☁️ Deployment Notes

- **Vercel / serverless**: SQLite does not persist on serverless. Switch the Prisma datasource to Postgres (Supabase Postgres or Neon) — update `DATABASE_URL` and run `npx prisma migrate deploy`. The storage/transform architecture is otherwise serverless-friendly (Node runtime routes).
- **Self-hosted (VPS/Docker)**: keep SQLite, set `NEXT_PUBLIC_APP_URL` to your public URL, and run `npm run build && npm start`.
- **Multi-instance scaling**: the in-memory rate limiter and transform cache are per-instance. For horizontal scaling, move them to a shared store (e.g., Redis).
- **CI**: a GitHub Actions workflow runs typecheck, lint, tests, and build on every push (`/.github/workflows/ci.yml`).

## 📁 Project Structure

```
src/
├── app/            # Pages (dashboard, upload, gallery, images/[id], settings, login) + API routes
├── components/     # layout, ui, upload, gallery, image-detail, dashboard
├── hooks/          # useUpload, useImages, useToast, useClipboard
├── lib/            # storage, image-processing, auth, rate-limit, transform-cache, svg-security, utils
├── middleware.ts   # rate limiting + session auth
└── types/          # Shared TypeScript types
```

## 📄 License

Private / self-hosted project.
