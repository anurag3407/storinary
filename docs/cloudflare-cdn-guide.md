# Cloudinary-Grade Global Edge CDN with Cloudinary Alternative (Storinary) & Cloudflare

This guide explains how to put **Cloudflare's free Global Edge CDN** in front of Storinary to match or exceed Cloudinary's multi-CDN delivery performance for **$0**.

---

## ❓ Frequently Asked Question

> **"Do I need to add Cloudflare to every website that uses my Storinary image links?"**

**No! You only configure Cloudflare once on your Storinary domain/subdomain.**

Any external website, mobile app, client project, or e-commerce store can embed your image links without any Cloudflare configuration on their end.

### How It Works

```
                        1. Visits website
  [ User's Browser ] ─────────────────────────▶ [ Any Website / Mobile App ]
         │                                       (Shopify, WordPress, Next.js, etc.)
         │                                               │
         │ 2. Embeds standard <img src="https://media.yourdomain.com/api/serve/..." />
         │
         ▼ 3. Browser fetches image directly from media.yourdomain.com
┌────────────────────────────────────────────────────────┐
│             Cloudflare Global Edge CDN                 │
│              (media.yourdomain.com)                    │
└────────────────────────────────────────────────────────┘
         │
         ├──────▶ Cache HIT (99% of requests)
         │        └─▶ Returns cached image from nearest Edge PoP in <15ms
         │            ($0 bandwidth, 0 server load)
         │
         └──────▶ Cache MISS (First request for this specific transform)
                  └─▶ Forwards request to Storinary Server
                             │
                             ▼
                  ┌──────────────────────┐
                  │   Storinary Server   │ (Processes image once via Sharp)
                  └──────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Storage (B2/Supabase)│
                  └──────────────────────┘
```

When a visitor loads a page containing your image, their browser contacts **`media.yourdomain.com` directly**. Because that domain is proxied by Cloudflare:
1. Cloudflare's closest edge server (out of 300+ worldwide) handles the request.
2. If already cached, it is delivered instantly from edge memory/disk without touching your Storinary server.
3. If it's the first time that transformation is requested, Storinary transforms it once, Cloudflare caches it at the edge, and all future visitors receive the cached copy.

---

## 🚀 5-Minute Setup Guide

### Step 1: Point a Subdomain to Storinary with Cloudflare Proxy

1. Open your **Cloudflare Dashboard** and select your domain (e.g. `yourdomain.com`).
2. Navigate to **DNS → Records** and click **Add Record**.
3. Create a CNAME record:
   - **Type:** `CNAME`
   - **Name:** `media` (or `cdn`, `images`)
   - **Target:** Your Storinary deployment URL (e.g. `your-app.vercel.app` or your VPS hostname / `A` record IP)
   - **Proxy status:** **Proxied (Orange Cloud ON)** 🟠
   - **TTL:** Auto
4. Click **Save**.

---

### Step 2: Configure the Cloudflare Cache Rule

By default, Cloudflare treats URLs with query parameters or `/api/*` endpoints conservatively. Configure a **Cache Rule** to aggressively cache transformed images:

1. In Cloudflare, go to **Caching → Cache Rules**.
2. Click **Create Rule**.
3. Configure the rule settings:
   - **Rule name:** `Cache Storinary Image Transformations`
   - **When incoming requests match...** Select **Custom filter expression**:
     - **Field:** `URI Path`
     - **Operator:** `starts with`
     - **Value:** `/api/serve/`
4. Under **Then... (Cache settings)**:
   - **Cache eligibility:** Select **Eligible for cache**
   - **Edge TTL:** Select **Ignore cache-control header and use this TTL** → `1 month` (or `Respect origin headers`, since Storinary sends `max-age=31536000, immutable`)
   - **Browser TTL:** `Respect origin headers` (or `1 month`)
5. Under **Cache Key** (Optional / Advanced Settings):
   - Ensure **Query string** is set to **Include all query string parameters** (so `?w=400` and `?w=800` are cached as separate files).
6. Click **Deploy**.

---

### Step 3: Enable Free Tiered Caching

Cloudflare's **Tiered Cache** utilizes its regional data center hubs to maximize cache hit rates, meaning a cache hit in Singapore can satisfy a cache request in Tokyo without querying your origin server.

1. In Cloudflare, go to **Caching → Tiered Cache**.
2. Turn **Tiered Cache** to **Enabled**.
3. Select **Argo Tiered Cache (Free topology)**.

---

### Step 4: Update Storinary Environment Variables

Ensure your Storinary instance recognizes its new public CDN domain for generated links:

In your `.env` file or deployment settings (e.g. on Vercel):

```env
# Point this to your Cloudflare-proxied media domain
NEXT_PUBLIC_APP_URL="https://media.yourdomain.com"
```

Now, when copying links from the Storinary dashboard (Direct, HTML, Markdown, CSS, JSON), they will use your Cloudflare edge domain.

---

### Step 5: (Bonus) 100% Free Egress with Backblaze B2

If you use **Backblaze B2** as your Storinary storage backend:
1. Backblaze and Cloudflare are founding partners of the **Bandwidth Alliance**.
2. Egress from Backblaze B2 through Cloudflare is **$0 (100% waived)**.
3. You get **10 GB of free storage** with Backblaze and completely free, unlimited bandwidth through Cloudflare.

---

## 🔍 How to Verify It's Working

Run a `curl` command against one of your transformed images:

```bash
curl -I "https://media.yourdomain.com/api/serve/sample.webp?w=500"
```

Look for the `cf-cache-status` header in the response:

* **First request (Cache Miss):**
  ```http
  cf-cache-status: MISS
  ```
  *(Your Storinary server processed the image and sent it to Cloudflare).*

* **Second request (Cache Hit):**
  ```http
  cf-cache-status: HIT
  age: 12
  ```
  *(Cloudflare served the image directly from the edge PoP in <15ms. Your Storinary server was not contacted).*

---

## 🔄 How to Invalidate / Purge Cache

If you update an existing image or change your watermark:

1. In Cloudflare, go to **Caching → Configuration**.
2. Click **Purge Cache**.
3. Choose:
   - **Purge Everything:** Clears the entire edge cache.
   - **Custom Purge:** Enter the specific image URL(s) to invalidate only those assets.
