# Migrating from Cloudinary to Storinary

Storinary is a high-performance, multi-tenant media management platform and drop-in alternative to Cloudinary. It provides native support for Cloudinary's URL transformation semantics, REST uploader APIs, unsigned/signed upload presets, video streaming, and remote asset fetching.

---

## 1. Quick SDK Setup

You can use the official Cloudinary SDKs in any language by pointing the API host and delivery domain to your Storinary instance.

### Node.js (`cloudinary` v2)

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'your-org-slug', // Your Storinary Organization slug
  api_key: 'st_live_...',      // Your Storinary API Key
  api_secret: 'unused',        // Storinary uses bearer / api_key auth
  secure: true,
  api_proxy: 'https://cdn.yourdomain.com', // Optional: your Storinary domain
});

// Upload via REST API
const uploadResult = await cloudinary.uploader.upload('https://example.com/photo.jpg', {
  folder: 'products',
  public_id: 'summer-shoe',
});
console.log(uploadResult.secure_url);
// -> https://cdn.yourdomain.com/your-org-slug/image/upload/products/summer-shoe.jpg

// Generate transformed URLs
const transformedUrl = cloudinary.url('products/summer-shoe', {
  transformation: [
    { width: 500, height: 500, crop: 'fill', gravity: 'auto' },
    { radius: 'max' },
    { fetch_format: 'auto', quality: 'auto' }
  ]
});
console.log(transformedUrl);
// -> https://cdn.yourdomain.com/your-org-slug/image/upload/w_500,h_500,c_fill,g_auto,r_max,f_auto,q_auto/products/summer-shoe.webp
```

### Python (`cloudinary`)

```python
import cloudinary
import cloudinary.uploader
import cloudinary.utils

cloudinary.config(
    cloud_name="your-org-slug",
    api_key="st_live_...",
    api_secret="unused",
    secure=True
)

# Upload an image file or URL
res = cloudinary.uploader.upload(
    "https://example.com/banner.png",
    folder="marketing",
    public_id="hero"
)

# Generate delivery URL
url, _ = cloudinary.utils.cloudinary_url(
    "marketing/hero",
    width=800,
    crop="fit",
    radius=20,
    format="webp"
)
```

---

## 2. URL Transformation Syntax Reference

Storinary parses standard Cloudinary URL paths:

```
https://<domain>/<cloudName>/<resourceType>/upload/<transformations>/<public_id>.<format>
```

### Supported Parameters

| Parameter | Cloudinary Syntax | Example | Description |
| :--- | :--- | :--- | :--- |
| **Width** | `w_<pixels>` | `w_400` | Resize width in pixels |
| **Height** | `h_<pixels>` | `h_300` | Resize height in pixels |
| **Crop Mode** | `c_<mode>` | `c_fill`, `c_fit`, `c_pad`, `c_crop` | Resize strategy (`fill` = cover, `fit` = contain) |
| **Corner Radius** | `r_<pixels>` or `r_max` | `r_16`, `r_max` | Rounds corners or creates circular mask with alpha transparency |
| **Gravity** | `g_<gravity>` | `g_auto`, `g_face`, `g_north` | Crop alignment anchor |
| **Format** | `f_<format>` | `f_auto`, `f_webp`, `f_avif`, `f_png` | Convert image format (`f_auto` uses browser Accept header) |
| **Quality** | `q_<value>` | `q_auto`, `q_80` | Compression quality |
| **Effects** | `e_<effect>` | `e_blur:200`, `e_grayscale`, `e_sharpen` | Visual filters and adjustments |
| **Background** | `b_<color>` | `b_rgb:ffffff`, `b_transparent` | Canvas color for padded transformations |
| **Video Offset** | `so_<seconds>` | `so_0`, `so_5` | Extracts still poster image from video at specified time |

### Chained Transformations
Transformations separated by commas or forward slashes are evaluated in order:
```
https://cdn.yourdomain.com/acme/image/upload/w_600,h_400,c_fill/r_max/f_auto,q_auto/avatars/user-123.png
```

---

## 3. Remote Image Fetching (`image/fetch`)

Directly transform and optimize external third-party images without uploading them first:

```
https://<domain>/<cloudName>/image/fetch/<transformations>/https://remote-site.com/banner.jpg
```

**Features:**
- Protected by built-in SSRF defense (blocking private IP ranges, localhost, and AWS metadata services).
- Responses are cached across in-memory L1 and disk L2 caches.

---

## 4. Cloudinary REST Upload & Destroy APIs

### POST `/api/v1_1/:cloudName/:resourceType/upload`

Accepts multipart form-data or JSON payloads.

#### Parameters:
- `file` *(required)*: Binary file, base64 Data URI (`data:image/png;base64,...`), or remote HTTPS URL.
- `upload_preset` *(optional)*: Name of an unsigned or signed upload preset configured in your Storinary organization.
- `api_key` *(optional if using unsigned preset)*: Storinary API key with `upload` permission.
- `folder` *(optional)*: Target folder path.
- `public_id` *(optional)*: Custom identifier for the asset.
- `tags` *(optional)*: Comma-separated list of tags.

#### Response:
```json
{
  "asset_id": "cly123456789",
  "public_id": "products/summer-shoe",
  "version": 1727420000,
  "version_id": "cly123456789",
  "signature": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  "width": 1200,
  "height": 800,
  "format": "jpg",
  "resource_type": "image",
  "created_at": "2026-09-27T13:00:00.000Z",
  "tags": ["shoes", "summer"],
  "bytes": 245012,
  "type": "upload",
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "url": "http://cdn.yourdomain.com/acme/image/upload/products/summer-shoe.jpg",
  "secure_url": "https://cdn.yourdomain.com/acme/image/upload/products/summer-shoe.jpg",
  "folder": "products",
  "original_filename": "photo"
}
```

### POST `/api/v1_1/:cloudName/:resourceType/destroy`

Permanently deletes an asset and cleans up all generated renditions and cache derivatives.

#### Parameters:
- `public_id` *(required)*: The asset public ID to delete.
- `api_key` *(required)*: Storinary API key with `delete` permission.

#### Response:
```json
{
  "result": "ok"
}
```

---

## 5. Video Streaming & Posters

Storinary supports HTML5 video streaming with byte ranges (HTTP 206 Partial Content):

- **Stream URL**: `https://<domain>/<cloudName>/video/upload/trailers/launch.mp4`
- **Poster Snapshot**: `https://<domain>/<cloudName>/video/upload/so_2/trailers/launch.jpg`
- **HLS Adaptive Streaming**: Renditions generated automatically at 1080p, 720p, 480p, and 360p.

---

## 6. Frontend Drop-in Widget

Embed the self-hosted Storinary upload widget in any HTML page:

```html
<script src="https://cdn.yourdomain.com/storinary-widget.js"></script>
<button id="upload-btn">Upload Images</button>

<script>
  const widget = window.storinary.createUploadWidget({
    cloudName: 'your-org-slug',
    uploadPreset: 'unsigned-web-preset',
    sources: ['local', 'url', 'camera']
  }, (error, result) => {
    if (!error && result && result.event === "success") {
      console.log('Done! Asset URL: ', result.info.secure_url);
    }
  });

  document.getElementById("upload-btn").addEventListener("click", () => {
    widget.open();
  });
</script>
```

---

## 7. Migration Checklist

1. [x] **Create Organization**: Register on Storinary and copy your organization slug (`cloudName`).
2. [x] **Configure Upload Preset**: Under *Settings > Upload Presets*, create an unsigned preset for client uploads or a signed preset for backend services.
3. [x] **Generate API Keys**: Under *Settings > API Keys*, create scoped keys (`read`, `upload`, `delete`).
4. [x] **Update SDK Config**: Point `cloud_name` and API endpoints to your Storinary deployment.
