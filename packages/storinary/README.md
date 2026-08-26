# @storinary/sdk

Typed browser and Node-compatible JavaScript SDK for a self-hosted Storinary API.
It provides Cloudinary-style resource operations, upload presets, and browser-safe
HMAC request signing.

## Install

```bash
npm install github:anurag3407/storinary-cloud#packages/storinary
```

The package is also published to npm on every merged version change:

```bash
npm install @storinary/sdk
```

For local development inside this monorepo:

```bash
npm install
npm run build --workspace @storinary/sdk
```

## Client setup

```ts
import { createStorinaryClient } from '@storinary/sdk';

const storinary = createStorinaryClient({
  baseUrl: 'https://media.example.com',
  apiKey: process.env.STORINARY_API_KEY,
});
```

Never embed `apiKey` in public client-side code. For browsers, sign metadata on
your backend or proxy uploads through it.

## Upload and manage media

```ts
const image = await storinary.uploadImage({
  file,
  folder: '/website',
  tags: 'hero,launch',
  altText: 'Product hero',
});

const video = await storinary.uploadVideo({
  file,
  folder: '/website/videos',
  renditions: true,
});

const page = await storinary.listMedia({
  limit: 50,
  folder: '/website',
  resourceType: 'all',
});

await storinary.getResource(image.id!, { resourceType: 'image' });
await storinary.updateMetadata(video.id!, { altText: 'Launch video' }, {
  resourceType: 'video',
});
await storinary.destroy(video.id!, { resourceType: 'video' });
```

With optional server-side vision configured, generate bounded tags, alt text,
and moderation scores. A `write` key is required:

```ts
await storinary.analyzeImage(image.id!, { caption: true, moderation: true });
await storinary.analyzeVideo(video.id!, { replaceMetadata: false });
```

`uploadImage` returns normalized fields such as `id` and `publicUrl`, while also
preserving Storinary and Cloudinary-compatible response fields.

## Transformations

Build a delivery URL using the same server-side parameters exposed by the API:

```ts
const transformed = storinary.transformUrl(image.storagePath!, {
  width: 800,
  height: 600,
  fit: 'cover',
  format: 'webp',
  quality: 'auto',
  dpr: 'auto',
});
```

Supported options include resize, crop, aspect ratio, background, rotation,
effects, brightness, contrast, gamma, named transformations (`t`), text overlays,
and tracked image overlays.

## Signed uploads

Generate the timestamp and signature server-side, then send them to the browser
with the non-secret metadata only. The signature covers sorted string parameters
excluding `file`, `api_key`, `timestamp`, and `api_signature`.

```ts
import { createUploadSignature } from '@storinary/sdk';

const signed = await createUploadSignature(process.env.STORINARY_API_SECRET!, {
  folder: '/website',
});
```

Pass those values with an upload request when your backend can safely inject them:

```ts
await storinary.uploadImage({
  file,
  folder: '/website',
  apiKey: injectedApiKey,
  timestamp: signed.timestamp,
  signature: signed.signature,
});
```

For public browser bundles, proxy uploads through your backend instead of
embedding either the key or secret.

## Structured metadata

Define reusable DAM fields once, then set them through the v1 media API:

```ts
await storinary.createMetadataField({
  externalId: 'campaign',
  label: 'Campaign',
  type: 'enum',
  allowedValues: ['spring', 'fall'],
});

const fields = await storinary.listMetadataFields();
await fetch(`${baseUrl}/v1/media/${image.id}?resource_type=image`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.STORINARY_API_KEY!,
  },
  body: JSON.stringify({ metadata: { campaign: 'spring' } }),
});

// Filter by one or more fields.
const results = await fetch(`${baseUrl}/v1/media?resource_type=all&metadata=campaign:spring`);
```

Supported field types are `string`, `integer`, `boolean`, and `enum`. Values are
validated against their definition, returned as a `metadata` object, and can be
filtered with repeated or encoded `metadata=<field>:<value>` parameters.

## Collections

Collections are dashboard-managed, cross-folder groupings. The unified media API
can filter mixed image and video results by membership:

```ts
const launchAssets = await storinary.listMedia({
  resourceType: 'all',
  collectionId: 'collection-id',
});
```

The SDK also wraps collection creation and asset membership updates. Pass a
scoped write-capable key when the client itself is not authorized to manage
collections:

```ts
const launch = await storinary.createCollection({ name: 'Launch' });
await storinary.addToCollection(launch.id, {
  imageIds: ['image-id'],
  videoIds: ['video-id'],
});
await storinary.listCollections();
await storinary.removeFromCollection(launch.id, { imageIds: ['image-id'] });
```

## Errors

API failures throw `StorinaryApiError`, including its HTTP status and the first
nested upload error when available.

```ts
import { StorinaryApiError } from '@storinary/sdk';

try {
  await storinary.uploadImage({ file });
} catch (error) {
  if (error instanceof StorinaryApiError) console.error(error.status, error.message);
  throw error;
}
```
