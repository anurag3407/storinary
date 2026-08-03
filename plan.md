# STORINARY — Complete Implementation Plan

> **Purpose**: This document is the single source of truth for building Storinary, a free, self-hosted Cloudinary alternative. Every architectural decision has been pre-made. Follow each phase sequentially. Do NOT deviate from the specifications below.

---

## Table of Contents

1. [Overview & Features](#1-overview--features)
2. [Architecture Decisions (Pre-Made)](#2-architecture-decisions-pre-made)
3. [Tech Stack (Exact Versions)](#3-tech-stack-exact-versions)
4. [Environment Variables](#4-environment-variables)
5. [Complete Directory Structure](#5-complete-directory-structure)
6. [Database Schema (Prisma)](#6-database-schema-prisma)
7. [TypeScript Types & Interfaces](#7-typescript-types--interfaces)
8. [Neobrutalism Design System (CSS)](#8-neobrutalism-design-system-css)
9. [Phase 1: Project Initialization](#phase-1-project-initialization)
10. [Phase 2: Core Libraries Setup](#phase-2-core-libraries-setup)
11. [Phase 3: Design System & Global Styles](#phase-3-design-system--global-styles)
12. [Phase 4: Layout Components](#phase-4-layout-components)
13. [Phase 5: Reusable UI Components](#phase-5-reusable-ui-components)
14. [Phase 6: API Routes](#phase-6-api-routes)
15. [Phase 7: Upload Feature](#phase-7-upload-feature)
16. [Phase 8: Gallery Feature](#phase-8-gallery-feature)
17. [Phase 9: Image Detail & Transformations](#phase-9-image-detail--transformations)
18. [Phase 10: Dashboard Page](#phase-10-dashboard-page)
19. [Phase 11: Settings Page](#phase-11-settings-page)
20. [Phase 12: Polish, Responsive, & Testing](#phase-12-polish-responsive--testing)

---

## 1. Overview & Features

**Storinary** is a self-hosted image management platform that replaces Cloudinary. It stores images in Supabase Storage (free tier: 1 GB storage, 2 GB bandwidth/month, **no credit card required**) and provides a premium neobrutalism-styled dashboard for managing, transforming, and serving images.

### Core Features (in implementation order)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Bulk Upload** | Drag-and-drop or file picker for uploading multiple images simultaneously with concurrent upload progress bars |
| 2 | **Client-Side Background Removal** | Optional per-image toggle to remove background using AI (WASM-based, runs in browser, no API key needed) |
| 3 | **Client-Side Pre-Compression** | Automatically compress images to WebP in the browser before upload using Canvas API to save storage |
| 4 | **On-the-Fly Resize** | URL-based image resizing: `/api/serve/image.webp?w=800&h=600&fit=cover` |
| 5 | **On-the-Fly Format Conversion** | Convert between formats via URL: `?fmt=webp`, `?fmt=avif`, `?fmt=jpeg`, `?fmt=png` |
| 6 | **On-the-Fly Quality Optimization** | Adjust quality via URL: `?q=80` (1–100 scale) |
| 7 | **Multi-Format Link Generator** | One-click copy for Direct URL, HTML `<img>`, Markdown, CSS `background-image`, and JSON bulk export |
| 8 | **Image Gallery** | Searchable, filterable grid with pagination. Supports bulk select, bulk delete, and bulk link copy |
| 9 | **Image Detail Page** | Full-size preview with metadata display, interactive transformation controls, and link generator |
| 10 | **Dashboard** | Overview with storage stats, total images, recent uploads, and quick-action buttons |
| 11 | **Folder Organization** | Organize images into folders within Supabase Storage using path prefixes |
| 12 | **Settings Page** | Configure Supabase credentials, public URL base, and default upload options |

---

## 2. Architecture Decisions (Pre-Made)

> **IMPORTANT**: These decisions are FINAL. Do not change them.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | Next.js 15 (App Router) | Best React framework, free Vercel hosting, API routes built-in |
| **Language** | TypeScript (strict mode) | Type safety prevents bugs |
| **Styling** | Vanilla CSS with CSS Modules | No Tailwind. Neobrutalism needs custom CSS. CSS Modules for scoping |
| **Global Styles** | `globals.css` with CSS custom properties | Design tokens as CSS variables |
| **Database** | Prisma ORM + SQLite | Zero external dependencies, single file DB, easy to set up |
| **Storage** | Supabase Storage via `@supabase/supabase-js` | 1 GB free, no credit card required, built-in CDN |
| **Image Processing (Server)** | `sharp` | Fastest Node.js image processor for resize/format/optimize |
| **Background Removal (Client)** | `@imgly/background-removal` | Runs entirely in browser via WASM, no API keys, no server cost |
| **Fonts** | Archivo Black (headings) + Inter (body) from Google Fonts | Perfect neobrutalism typography pairing |
| **State Management** | React `useState` + `useReducer` + custom hooks | No Redux/Zustand needed for this scale |
| **Authentication** | None (self-hosted tool) | Single-user tool, optionally add API key middleware later |
| **Deployment** | Vercel (free tier) or self-hosted Node.js | Next.js native support on Vercel |
| **Supabase Public Access** | Public bucket with auto-generated CDN URLs | Supabase provides public URLs out of the box |
| **Image Naming in Storage** | `{year}/{month}/{sanitized-name}-{8-char-id}.{ext}` | Organized by date, collision-safe |
| **Transform Caching** | HTTP cache headers (`Cache-Control: public, max-age=31536000`) | CDN/browser caches transformed images, no need for storage-side transform cache |
| **Directory convention** | Use `src/` directory | Standard Next.js convention with App Router |

---

## 3. Tech Stack (Exact Versions)

### package.json Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "sharp": "^0.33.0",
    "@imgly/background-removal": "^1.7.0",
    "mime-types": "^2.1.35",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/mime-types": "^2.1.4",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

### Package Purpose Reference

| Package | Purpose | Used In |
|---------|---------|---------|
| `@supabase/supabase-js` | Supabase Storage client for upload, download, delete, list operations | `src/lib/storage.ts`, API routes |
| `sharp` | Server-side resize, format conversion, optimization, metadata extraction | `src/lib/image-processing.ts`, API routes |
| `@imgly/background-removal` | Client-side AI background removal (WASM + ONNX) | `src/lib/bg-removal.ts`, Upload components |
| `mime-types` | Map file extensions to MIME types | `src/lib/utils.ts` |
| `nanoid` | Generate short unique IDs for image filenames | `src/lib/utils.ts` |
| `@prisma/client` | Database ORM for image metadata | `src/lib/prisma.ts`, API routes |

---

## 4. Environment Variables

### `.env` file (create at project root)

```env
# ─── Database ───────────────────────────────────────────────
DATABASE_URL="file:./dev.db"

# ─── Supabase ───────────────────────────────────────────────
# Get from: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# ─── Storage Bucket ─────────────────────────────────────────
# Name of the Supabase Storage bucket (created in Supabase Dashboard → Storage)
SUPABASE_BUCKET_NAME="storinary"

# ─── App Settings ───────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_MAX_FILE_SIZE_MB="10"
NEXT_PUBLIC_ALLOWED_FORMATS="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
```

### `.env.example` file (same content with placeholder values — commit this to git)

---

## 5. Complete Directory Structure

> **Follow this EXACTLY. Create every file and directory listed below.**

```
storinary/
├── .env                                    # Environment variables (DO NOT commit)
├── .env.example                            # Template (commit this)
├── .gitignore                              # Git ignore rules
├── next.config.ts                          # Next.js configuration
├── package.json                            # Dependencies
├── tsconfig.json                           # TypeScript config
├── prisma/
│   └── schema.prisma                       # Database schema
│
├── public/
│   └── placeholder.svg                     # Empty state placeholder image
│
└── src/
    ├── app/
    │   ├── globals.css                     # Global styles + design tokens
    │   ├── layout.tsx                      # Root layout (sidebar + header wrapper)
    │   ├── page.tsx                        # Dashboard page (route: /)
    │   │
    │   ├── upload/
    │   │   ├── page.tsx                    # Upload page (route: /upload)
    │   │   └── upload.module.css           # Upload page styles
    │   │
    │   ├── gallery/
    │   │   ├── page.tsx                    # Gallery page (route: /gallery)
    │   │   └── gallery.module.css          # Gallery page styles
    │   │
    │   ├── images/
    │   │   └── [id]/
    │   │       ├── page.tsx                # Image detail page (route: /images/:id)
    │   │       └── detail.module.css       # Detail page styles
    │   │
    │   ├── settings/
    │   │   ├── page.tsx                    # Settings page (route: /settings)
    │   │   └── settings.module.css         # Settings page styles
    │   │
    │   └── api/
    │       ├── upload/
    │       │   └── route.ts                # POST /api/upload — bulk upload handler
    │       │
    │       ├── images/
    │       │   ├── route.ts                # GET /api/images — list images
    │       │   │                           # DELETE /api/images — bulk delete
    │       │   └── [id]/
    │       │       ├── route.ts            # GET /api/images/:id — get single image
    │       │       │                       # DELETE /api/images/:id — delete single image
    │       │       └── transform/
    │       │           └── route.ts        # GET /api/images/:id/transform — get transformed image
    │       │
    │       ├── serve/
    │       │   └── [...path]/
    │       │       └── route.ts            # GET /api/serve/* — serve image with on-the-fly transforms
    │       │
    │       └── stats/
    │           └── route.ts                # GET /api/stats — dashboard statistics
    │
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx                 # Navigation sidebar
    │   │   ├── Sidebar.module.css
    │   │   ├── Header.tsx                  # Page header with breadcrumbs
    │   │   └── Header.module.css
    │   │
    │   ├── upload/
    │   │   ├── DropZone.tsx                # Drag & drop upload area
    │   │   ├── DropZone.module.css
    │   │   ├── UploadQueue.tsx             # List of files being uploaded with progress
    │   │   ├── UploadQueue.module.css
    │   │   ├── UploadItem.tsx              # Single file in upload queue
    │   │   ├── UploadItem.module.css
    │   │   ├── UploadSettings.tsx          # Upload options (compression, bg removal toggle)
    │   │   └── UploadSettings.module.css
    │   │
    │   ├── gallery/
    │   │   ├── ImageGrid.tsx               # Gallery grid view
    │   │   ├── ImageGrid.module.css
    │   │   ├── ImageCard.tsx               # Individual image card in gallery
    │   │   ├── ImageCard.module.css
    │   │   ├── GalleryToolbar.tsx          # Search, filter, view toggle, bulk actions
    │   │   ├── GalleryToolbar.module.css
    │   │   ├── Pagination.tsx              # Page navigation controls
    │   │   └── Pagination.module.css
    │   │
    │   ├── image-detail/
    │   │   ├── ImagePreview.tsx            # Large image preview with zoom
    │   │   ├── ImagePreview.module.css
    │   │   ├── ImageMeta.tsx               # Metadata display table
    │   │   ├── ImageMeta.module.css
    │   │   ├── TransformPanel.tsx          # Interactive transformation controls
    │   │   ├── TransformPanel.module.css
    │   │   ├── LinkGenerator.tsx           # Multi-format link copy panel
    │   │   └── LinkGenerator.module.css
    │   │
    │   ├── dashboard/
    │   │   ├── StatCard.tsx                # Dashboard stat card (total images, storage, etc.)
    │   │   ├── StatCard.module.css
    │   │   ├── RecentUploads.tsx           # Recent uploads list/grid
    │   │   ├── RecentUploads.module.css
    │   │   ├── QuickActions.tsx            # Quick action buttons
    │   │   └── QuickActions.module.css
    │   │
    │   └── ui/
    │       ├── Button.tsx                  # Reusable neobrutalism button
    │       ├── Button.module.css
    │       ├── Modal.tsx                   # Reusable modal dialog
    │       ├── Modal.module.css
    │       ├── Badge.tsx                   # Status badge
    │       ├── Badge.module.css
    │       ├── Toast.tsx                   # Notification toast
    │       ├── Toast.module.css
    │       ├── ToastProvider.tsx           # Toast context provider
    │       ├── Spinner.tsx                 # Loading spinner
    │       ├── Spinner.module.css
    │       ├── EmptyState.tsx              # Empty state placeholder
    │       ├── EmptyState.module.css
    │       ├── ProgressBar.tsx             # Upload progress bar
    │       └── ProgressBar.module.css
    │
    ├── lib/
    │   ├── prisma.ts                       # Prisma client singleton
    │   ├── storage.ts                      # Supabase Storage client + helper functions
    │   ├── image-processing.ts             # Sharp-based image transformation utilities
    │   ├── bg-removal.ts                   # Background removal wrapper (client-side)
    │   ├── upload-helpers.ts               # Client-side compression + file validation
    │   └── utils.ts                        # General utilities (ID generation, formatting, etc.)
    │
    ├── hooks/
    │   ├── useUpload.ts                    # Upload state machine hook
    │   ├── useImages.ts                    # Image list fetching + pagination hook
    │   ├── useToast.ts                     # Toast notification hook
    │   └── useClipboard.ts                 # Copy-to-clipboard hook
    │
    └── types/
        └── index.ts                        # All TypeScript types and interfaces
```

---

## 6. Database Schema (Prisma)

### File: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Image {
  id              String   @id @default(cuid())
  
  // ── File Info ──────────────────────────────────
  originalName    String                // Original filename from user (e.g., "photo.jpg")
  storagePath     String   @unique      // Supabase Storage path (e.g., "2024/08/photo-abc12345.webp")
  publicUrl       String                // Full public URL (e.g., "https://<ref>.supabase.co/storage/v1/object/public/storinary/2024/08/photo-abc12345.webp")
  
  // ── Image Metadata ─────────────────────────────
  width           Int                   // Width in pixels
  height          Int                   // Height in pixels
  fileSize        Int                   // Size in bytes
  format          String                // "jpeg", "png", "webp", "avif", "gif", "svg"
  mimeType        String                // "image/jpeg", "image/png", etc.
  
  // ── Organization ───────────────────────────────
  folder          String   @default("/")  // Virtual folder path (e.g., "/products", "/blog")
  tags            String   @default("")   // Comma-separated tags (e.g., "hero,banner,product")
  altText         String   @default("")   // Alt text for accessibility
  
  // ── Processing Flags ───────────────────────────
  bgRemoved       Boolean  @default(false) // Was background removal applied?
  compressed      Boolean  @default(false) // Was client-side compression applied?
  
  // ── Timestamps ─────────────────────────────────
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // ── Indexes ────────────────────────────────────
  @@index([folder])
  @@index([createdAt])
  @@index([originalName])
}
```

### Migration Command (run after creating schema)

```bash
npx prisma migrate dev --name init
```

---

## 7. TypeScript Types & Interfaces

### File: `src/types/index.ts`

```typescript
// ════════════════════════════════════════════════════════════
// DATABASE TYPES (mirrors Prisma model, used in API responses)
// ════════════════════════════════════════════════════════════

export interface ImageRecord {
  id: string;
  originalName: string;
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
  folder: string;
  tags: string;
  altText: string;
  bgRemoved: boolean;
  compressed: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ════════════════════════════════════════════════════════════
// API REQUEST / RESPONSE TYPES
// ════════════════════════════════════════════════════════════

// POST /api/upload — Request is FormData, not JSON
// FormData fields:
//   - files: File[] (multiple files)
//   - folder: string (optional, default "/")
//   - tags: string (optional, comma-separated)
//   - bgRemoved: "true" | "false" (per file, sent as bgRemoved_0, bgRemoved_1, etc.)
//   - compressed: "true" | "false"

export interface UploadResponse {
  success: boolean;
  images: ImageRecord[];
  errors: Array<{ filename: string; error: string }>;
}

// GET /api/images?page=1&limit=20&search=hello&folder=/products&sort=createdAt&order=desc
export interface ImagesListParams {
  page: number;      // 1-indexed
  limit: number;     // items per page (default 20, max 100)
  search?: string;   // search by originalName or tags
  folder?: string;   // filter by folder
  sort: 'createdAt' | 'fileSize' | 'originalName'; // sort field
  order: 'asc' | 'desc'; // sort direction
}

export interface ImagesListResponse {
  images: ImageRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /api/images/:id
export interface ImageDetailResponse {
  image: ImageRecord;
  links: GeneratedLinks;
}

// DELETE /api/images — bulk delete
export interface BulkDeleteRequest {
  ids: string[];
}

export interface BulkDeleteResponse {
  success: boolean;
  deleted: number;
  errors: Array<{ id: string; error: string }>;
}

// GET /api/serve/[...path]?w=800&h=600&q=80&fmt=webp&fit=cover
export interface TransformParams {
  w?: number;     // width (pixels)
  h?: number;     // height (pixels)
  q?: number;     // quality (1-100, default 80)
  fmt?: 'jpeg' | 'webp' | 'avif' | 'png'; // output format
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'; // resize fit mode
}

// GET /api/stats
export interface StatsResponse {
  totalImages: number;
  totalStorageBytes: number;
  totalStorageFormatted: string; // e.g., "1.2 GB"
  imagesByFormat: Record<string, number>; // e.g., { "webp": 500, "jpeg": 300 }
  imagesByFolder: Record<string, number>; // e.g., { "/": 200, "/products": 100 }
  recentUploads: ImageRecord[]; // last 10 uploads
  uploadsThisMonth: number;
}

// ════════════════════════════════════════════════════════════
// LINK GENERATION TYPES
// ════════════════════════════════════════════════════════════

export interface GeneratedLinks {
  direct: string;           // https://cdn.example.com/2024/08/photo.webp
  html: string;             // <img src="..." alt="..." />
  markdown: string;         // ![alt](url)
  css: string;              // background-image: url('...');
  transformBase: string;    // /api/serve/2024/08/photo.webp (append ?w=800&fmt=webp etc.)
}

// ════════════════════════════════════════════════════════════
// CLIENT-SIDE UPLOAD TYPES
// ════════════════════════════════════════════════════════════

export type UploadItemStatus = 'pending' | 'compressing' | 'removing-bg' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;                // nanoid for client-side tracking
  file: File;                // Original file object
  processedBlob?: Blob;      // After compression / bg removal
  previewUrl: string;        // Object URL for thumbnail preview
  status: UploadItemStatus;
  progress: number;          // 0-100 upload progress
  error?: string;            // Error message if failed
  result?: ImageRecord;      // Server response after successful upload
  options: {
    removeBg: boolean;
    compress: boolean;
    folder: string;
    tags: string;
  };
}

export interface UploadState {
  items: UploadItem[];
  globalOptions: {
    removeBg: boolean;        // Default bg removal toggle
    compress: boolean;        // Default compression toggle
    quality: number;          // Compression quality (1-100, default 80)
    maxWidth: number;         // Max width for compression (default 2048)
    folder: string;           // Target folder (default "/")
    tags: string;             // Default tags
  };
  isUploading: boolean;
  completedCount: number;
  errorCount: number;
}

// ════════════════════════════════════════════════════════════
// COMPONENT PROP TYPES
// ════════════════════════════════════════════════════════════

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'info' | 'warning';
}

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ms, default 4000
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string; // CSS variable name, e.g., "var(--nb-yellow)"
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

---

## 8. Neobrutalism Design System (CSS)

### Design Principles (follow strictly)

1. **Borders**: Always `3px solid #000000` — never thinner, never colored, never rounded beyond `8px`
2. **Shadows**: Hard shadows ONLY — `Xpx Ypx 0px 0px #000` — blur is ALWAYS `0px`
3. **Colors**: Flat, saturated, NO gradients — use the exact palette below
4. **Typography**: Archivo Black for headings, Inter for body. Bold weights. Uppercase for labels/buttons
5. **Hover Effect**: Translate up-left (`-2px, -2px`) + grow shadow
6. **Active/Press Effect**: Translate down-right (`4px, 4px`) + collapse shadow to `0`
7. **Transitions**: Always `0.15s ease` — fast, snappy
8. **Spacing**: Generous padding (16–24px inside cards, 12–16px inside inputs)

### Complete Color Palette (exact hex values)

```css
:root {
  /* ── Neutrals ─────────────────────────── */
  --nb-black: #000000;
  --nb-white: #FFFFFF;
  --nb-bg: #F0EDE6;           /* Warm off-white page background */
  --nb-bg-dark: #1A1A2E;      /* Dark mode background (future) */
  
  /* ── Primary Accents ──────────────────── */
  --nb-yellow: #FFDE59;        /* Primary accent — buttons, highlights, stat cards */
  --nb-blue: #00BFFF;          /* Secondary accent — links, focus states, info */
  --nb-pink: #FF6B6B;          /* Danger / delete / error states */
  --nb-green: #3EB489;         /* Success / upload complete states */
  
  /* ── Supporting Colors ────────────────── */
  --nb-purple: #A855F7;        /* Tags, badges, special highlights */
  --nb-orange: #FF914D;        /* Warnings, attention states */
  --nb-mint: #7FDBCA;          /* Alternative card backgrounds */
  --nb-lavender: #C4B5FD;      /* Alternative card backgrounds */
  
  /* ── Semantic Aliases ─────────────────── */
  --nb-primary: var(--nb-yellow);
  --nb-secondary: var(--nb-blue);
  --nb-success: var(--nb-green);
  --nb-danger: var(--nb-pink);
  --nb-warning: var(--nb-orange);
  --nb-info: var(--nb-blue);
}
```

### Typography Tokens

```css
:root {
  --nb-font-heading: 'Archivo Black', 'Impact', sans-serif;
  --nb-font-body: 'Inter', 'Segoe UI', sans-serif;
  --nb-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --nb-text-xs: 0.75rem;    /* 12px */
  --nb-text-sm: 0.875rem;   /* 14px */
  --nb-text-base: 1rem;     /* 16px */
  --nb-text-lg: 1.125rem;   /* 18px */
  --nb-text-xl: 1.25rem;    /* 20px */
  --nb-text-2xl: 1.5rem;    /* 24px */
  --nb-text-3xl: 1.875rem;  /* 30px */
  --nb-text-4xl: 2.25rem;   /* 36px */
}
```

### Spacing Tokens

```css
:root {
  --nb-space-1: 4px;
  --nb-space-2: 8px;
  --nb-space-3: 12px;
  --nb-space-4: 16px;
  --nb-space-5: 20px;
  --nb-space-6: 24px;
  --nb-space-8: 32px;
  --nb-space-10: 40px;
  --nb-space-12: 48px;
  --nb-space-16: 64px;
}
```

### Border & Shadow Tokens

```css
:root {
  --nb-border-width: 3px;
  --nb-border: var(--nb-border-width) solid var(--nb-black);
  --nb-radius: 8px;
  
  --nb-shadow-sm: 2px 2px 0px 0px var(--nb-black);
  --nb-shadow-md: 4px 4px 0px 0px var(--nb-black);
  --nb-shadow-lg: 6px 6px 0px 0px var(--nb-black);
  --nb-shadow-xl: 8px 8px 0px 0px var(--nb-black);
  --nb-shadow-none: 0px 0px 0px 0px var(--nb-black);
  
  --nb-transition: all 0.15s ease;
}
```

### Global Reset & Base Styles (include in `globals.css`)

```css
/* ── Reset ─────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--nb-font-body);
  background-color: var(--nb-bg);
  color: var(--nb-black);
  line-height: 1.6;
  min-height: 100vh;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--nb-font-heading);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

a {
  color: var(--nb-blue);
  text-decoration: none;
  font-weight: 600;
  border-bottom: 2px solid var(--nb-blue);
  transition: var(--nb-transition);
}

a:hover {
  background-color: var(--nb-blue);
  color: var(--nb-white);
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

code {
  font-family: var(--nb-font-mono);
  font-size: var(--nb-text-sm);
  background: var(--nb-yellow);
  padding: 2px 6px;
  border: 2px solid var(--nb-black);
  border-radius: 2px;
}
```

### Neobrutalism Component CSS Reference

#### Buttons

```css
.nb-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-family: var(--nb-font-body);
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--nb-yellow);
  color: var(--nb-black);
  border: var(--nb-border);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow-lg);
  cursor: pointer;
  transition: var(--nb-transition);
  user-select: none;
}

.nb-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--nb-shadow-xl);
}

.nb-btn:active {
  transform: translate(4px, 4px);
  box-shadow: var(--nb-shadow-none);
}
```

#### Cards

```css
.nb-card {
  background-color: var(--nb-white);
  border: var(--nb-border);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow-lg);
  padding: 24px;
  transition: var(--nb-transition);
}

.nb-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--nb-shadow-xl);
}
```

#### Inputs

```css
.nb-input {
  width: 100%;
  padding: 12px 16px;
  font-family: var(--nb-font-body);
  font-size: 16px;
  background-color: var(--nb-white);
  color: var(--nb-black);
  border: var(--nb-border);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow-md);
  outline: none;
  transition: var(--nb-transition);
}

.nb-input:focus {
  box-shadow: var(--nb-shadow-lg);
  border-color: var(--nb-blue);
}
```

#### Modals

```css
.nb-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.nb-modal {
  background-color: var(--nb-white);
  border: 4px solid var(--nb-black);
  border-radius: var(--nb-radius);
  box-shadow: 10px 10px 0px 0px var(--nb-black);
  padding: 32px;
  max-width: 480px;
  width: 100%;
  animation: nb-modal-in 0.2s ease-out;
}

@keyframes nb-modal-in {
  from { opacity: 0; transform: translateY(-10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

#### Tables

```css
.nb-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: var(--nb-border);
  border-radius: var(--nb-radius);
  box-shadow: var(--nb-shadow-lg);
  overflow: hidden;
}

.nb-table th {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: left;
  padding: 12px 16px;
  background: var(--nb-yellow);
  border-bottom: var(--nb-border);
}

.nb-table td {
  font-size: 14px;
  padding: 12px 16px;
  border-bottom: 2px solid var(--nb-black);
}

.nb-table tr:last-child td { border-bottom: none; }
.nb-table tr:hover td { background-color: #FFF9DB; }
```

#### Badges

```css
.nb-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--nb-yellow);
  color: var(--nb-black);
  border: 2px solid var(--nb-black);
  border-radius: 2px;
  box-shadow: var(--nb-shadow-sm);
}
```

### Layout CSS (add to `globals.css`)

```css
/* ── App Layout ────────────────────────────── */
.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 260px; /* Sidebar width */
  min-height: 100vh;
}

.app-content {
  flex: 1;
  padding: var(--nb-space-8);
  max-width: 1400px;
  width: 100%;
}

@media (max-width: 768px) {
  .app-main { margin-left: 0; }
  .app-content { padding: var(--nb-space-4); }
}
```

### Utility Classes (add to `globals.css`)

```css
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-uppercase { text-transform: uppercase; letter-spacing: 0.5px; }

/* ── Custom Scrollbar ──────────────────────── */
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--nb-bg); border-left: var(--nb-border); }
::-webkit-scrollbar-thumb { background: var(--nb-black); border: 2px solid var(--nb-bg); }
::-webkit-scrollbar-thumb:hover { background: #333; }

/* ── Selection ─────────────────────────────── */
::selection { background: var(--nb-yellow); color: var(--nb-black); }
```

### Google Fonts Import (for `src/app/layout.tsx` via `next/font/google`)

```typescript
import { Archivo_Black, Inter } from 'next/font/google';

const archivoBlack = Archivo_Black({
  weight: '400', // Archivo Black only has one weight
  subsets: ['latin'],
  variable: '--nb-font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--nb-font-body',
  display: 'swap',
});

// Apply to <html> tag:
// <html lang="en" className={`${archivoBlack.variable} ${inter.variable}`}>
```

---

## Phase 1: Project Initialization

### Step 1.1: Create Next.js Project

```bash
npx -y create-next-app@latest ./ --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --turbopack
```

> **NOTE**: Run this inside the `/Users/jarvis/storinary` directory. The `./` creates the project in the current directory. `--no-tailwind` ensures no Tailwind is installed. If the `--no-tailwind` flag does not exist, decline Tailwind when prompted.

### Step 1.2: Install Dependencies

```bash
npm install @prisma/client @supabase/supabase-js sharp @imgly/background-removal mime-types nanoid
```

```bash
npm install -D prisma @types/mime-types
```

### Step 1.3: Initialize Prisma

```bash
npx prisma init --datasource-provider sqlite
```

### Step 1.4: Create `.env` file

Create `.env` at project root with the content from [Section 4](#4-environment-variables).

### Step 1.5: Configure `next.config.ts`

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  
  // Required for large uploads via server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  
  // Exclude @imgly/background-removal from server-side bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@imgly/background-removal');
    }
    return config;
  },
};

export default nextConfig;
```

### Step 1.6: Update `.gitignore`

Add to `.gitignore`:

```
# Database
prisma/dev.db
prisma/dev.db-journal

# Environment
.env
.env.local
```

### Step 1.7: Create Prisma Schema

Copy the schema from [Section 6](#6-database-schema-prisma) into `prisma/schema.prisma`.

### Step 1.8: Run Initial Migration

```bash
npx prisma migrate dev --name init
```

### Step 1.9: Verify Setup

```bash
npm run dev
```

Open `http://localhost:3000` — you should see the default Next.js page. Kill the dev server.

---

## Phase 2: Core Libraries Setup

### Step 2.1: Create Prisma Singleton

**File: `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Step 2.2: Create Supabase Storage Client

**File: `src/lib/storage.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client Singleton ──────────────────────────────
// Use the service role key on the server for full storage access.
// The anon key is for client-side (limited permissions).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKET = process.env.SUPABASE_BUCKET_NAME || 'storinary';

// ── Helper Functions ───────────────────────────────────────

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the storage path.
 */
export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType,
      upsert: true, // overwrite if exists
    });
  
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return key;
}

/**
 * Download a file from Supabase Storage.
 * Returns the file as a Buffer.
 */
export async function getFromStorage(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(key);
  
  if (error || !data) throw new Error(`Download failed: ${error?.message || 'No data'}`);
  
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  };
}

/**
 * Delete a single file from Supabase Storage.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([key]);
  
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Delete multiple files from Supabase Storage.
 * Supabase supports bulk delete natively.
 */
export async function bulkDeleteFromStorage(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(keys);
  
  if (error) throw new Error(`Bulk delete failed: ${error.message}`);
}

/**
 * List objects in Supabase Storage with optional folder path and pagination.
 */
export async function listStorageObjects(
  folder?: string,
  limit: number = 1000,
  offset: number = 0
): Promise<{
  objects: Array<{ key: string; size: number; lastModified: Date }>;
}> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder || '', {
      limit,
      offset,
      sortBy: { column: 'created_at', order: 'desc' },
    });
  
  if (error) throw new Error(`List failed: ${error.message}`);
  
  return {
    objects: (data || []).map((obj) => ({
      key: folder ? `${folder}/${obj.name}` : obj.name,
      size: obj.metadata?.size || 0,
      lastModified: new Date(obj.updated_at || obj.created_at),
    })),
  };
}

/**
 * Construct the public URL for a Supabase Storage object.
 * Requires the bucket to be set to "Public" in Supabase Dashboard.
 */
export function getPublicUrl(key: string): string {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(key);
  
  return data.publicUrl;
}

/**
 * Generate the storage path for an upload.
 * Format: {year}/{month}/{sanitized-name}-{shortId}.{ext}
 */
export function generateStorageKey(
  originalName: string,
  shortId: string,
  format: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Sanitize filename: lowercase, replace spaces/special chars with hyphens
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')        // collapse multiple hyphens
    .replace(/^-|-$/g, '')      // trim leading/trailing hyphens
    .substring(0, 50);          // limit length
  
  return `${year}/${month}/${baseName}-${shortId}.${format}`;
}

export { supabase, BUCKET };
```

### Step 2.3: Create Image Processing Utilities

**File: `src/lib/image-processing.ts`**

```typescript
import sharp from 'sharp';
import type { TransformParams } from '@/types';

/**
 * Extract metadata from an image buffer.
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: buffer.length,
  };
}

/**
 * Apply transformations to an image buffer.
 * 
 * @param buffer - Source image buffer
 * @param params - Transformation parameters from URL query string
 * @returns Transformed image buffer and its content type
 */
export async function transformImage(
  buffer: Buffer,
  params: TransformParams
): Promise<{ buffer: Buffer; contentType: string; format: string }> {
  let pipeline = sharp(buffer);
  
  // ── Resize ───────────────────────────────────────────
  if (params.w || params.h) {
    pipeline = pipeline.resize({
      width: params.w || undefined,
      height: params.h || undefined,
      fit: params.fit || 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    });
  }
  
  // ── Format Conversion + Quality ──────────────────────
  const quality = params.q || 80;
  const outputFormat = params.fmt || 'webp';
  
  switch (outputFormat) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true, progressive: true });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 4 });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality, effort: 4 });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality });
      break;
    default:
      pipeline = pipeline.webp({ quality, effort: 4 });
  }
  
  const resultBuffer = await pipeline.toBuffer();
  
  const contentTypeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
    png: 'image/png',
  };
  
  return {
    buffer: resultBuffer,
    contentType: contentTypeMap[outputFormat] || 'image/webp',
    format: outputFormat,
  };
}

/**
 * Optimize an image for upload (server-side fallback if client didn't compress).
 * Strips metadata, auto-orients, converts to WebP.
 */
export async function optimizeForUpload(
  buffer: Buffer,
  maxWidth: number = 4096
): Promise<{ buffer: Buffer; format: string; contentType: string }> {
  const metadata = await sharp(buffer).metadata();
  let pipeline = sharp(buffer).rotate(); // auto-orient based on EXIF
  
  // Resize if wider than maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  
  const resultBuffer = await pipeline
    .webp({ quality: 85, effort: 4 })
    .toBuffer();
  
  return {
    buffer: resultBuffer,
    format: 'webp',
    contentType: 'image/webp',
  };
}
```

### Step 2.4: Create Client-Side Background Removal Wrapper

**File: `src/lib/bg-removal.ts`**

> **IMPORTANT**: This file runs ONLY in the browser. It must be dynamically imported. Never import at top level in server components.

```typescript
/**
 * Client-side background removal using @imgly/background-removal.
 * Runs entirely in the browser via WASM + ONNX Runtime.
 * 
 * USAGE:
 *   const { removeBg } = await import('@/lib/bg-removal');
 *   const resultBlob = await removeBg(file, onProgress);
 * 
 * DO NOT import this file in server components or API routes.
 */

export type BgRemovalProgress = {
  key: string;
  current: number;
  total: number;
};

/**
 * Remove background from an image file.
 * Returns a PNG Blob with transparent background.
 * 
 * @param imageSource - File, Blob, or URL string
 * @param onProgress - Optional progress callback (for model download tracking)
 * @returns PNG Blob with background removed
 */
export async function removeBg(
  imageSource: File | Blob | string,
  onProgress?: (progress: BgRemovalProgress) => void
): Promise<Blob> {
  // Dynamic import to avoid SSR issues
  const { removeBackground } = await import('@imgly/background-removal');
  
  const blob = await removeBackground(imageSource, {
    model: 'medium',  // Balance between speed and quality
    progress: onProgress
      ? (key: string, current: number, total: number) => {
          onProgress({ key, current, total });
        }
      : undefined,
  });
  
  return blob;
}
```

### Step 2.5: Create Client-Side Upload Helpers

**File: `src/lib/upload-helpers.ts`**

> **IMPORTANT**: This file runs ONLY in the browser.

```typescript
/**
 * Client-side image compression using the Canvas API.
 * Converts any image to WebP at specified quality.
 * Runs in the browser — do NOT import on the server.
 */

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

const MAX_FILE_SIZE = (parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024;

/**
 * Validate a file for upload.
 * Returns null if valid, error message string if invalid.
 */
export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported format: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF, SVG`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    return `File too large: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Max: ${maxMB} MB`;
  }
  return null;
}

/**
 * Compress an image file to WebP using the Canvas API.
 * 
 * @param file - Source image file
 * @param maxWidth - Maximum width in pixels (maintains aspect ratio)
 * @param quality - WebP quality (0.0 to 1.0, default 0.8)
 * @returns Compressed WebP Blob
 */
export async function compressImage(
  file: File,
  maxWidth: number = 2048,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // SVGs don't need compression
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      
      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/webp',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Create a thumbnail preview URL for a file.
 * Returns an object URL that must be revoked when done.
 */
export function createPreviewUrl(file: File | Blob): string {
  return URL.createObjectURL(file);
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a date to relative time string (e.g., "2 hours ago").
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
```

### Step 2.6: Create General Utilities

**File: `src/lib/utils.ts`**

```typescript
import { nanoid } from 'nanoid';
import type { GeneratedLinks } from '@/types';

/**
 * Generate a short unique ID (8 characters).
 */
export function generateShortId(): string {
  return nanoid(8);
}

/**
 * Generate all link formats for an image.
 */
export function generateLinks(
  publicUrl: string,
  storagePath: string,
  altText: string,
  appUrl: string
): GeneratedLinks {
  const transformBase = `${appUrl}/api/serve/${storagePath}`;
  
  return {
    direct: publicUrl,
    html: `<img src="${publicUrl}" alt="${altText || 'image'}" loading="lazy" />`,
    markdown: `![${altText || 'image'}](${publicUrl})`,
    css: `background-image: url('${publicUrl}');`,
    transformBase,
  };
}

/**
 * Parse transform query parameters from URL search params.
 */
export function parseTransformParams(searchParams: URLSearchParams): {
  w?: number;
  h?: number;
  q?: number;
  fmt?: 'jpeg' | 'webp' | 'avif' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
} {
  const params: Record<string, unknown> = {};
  
  const w = searchParams.get('w');
  if (w) params.w = Math.min(Math.max(parseInt(w, 10), 1), 8192);
  
  const h = searchParams.get('h');
  if (h) params.h = Math.min(Math.max(parseInt(h, 10), 1), 8192);
  
  const q = searchParams.get('q');
  if (q) params.q = Math.min(Math.max(parseInt(q, 10), 1), 100);
  
  const fmt = searchParams.get('fmt');
  if (fmt && ['jpeg', 'webp', 'avif', 'png'].includes(fmt)) {
    params.fmt = fmt;
  }
  
  const fit = searchParams.get('fit');
  if (fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
    params.fit = fit;
  }
  
  return params;
}

/**
 * Get MIME type from file extension.
 */
export function getMimeType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
```

### Step 2.7: Create TypeScript Types File

Copy the contents from [Section 7](#7-typescript-types--interfaces) into `src/types/index.ts`.

---

## Phase 3: Design System & Global Styles

### Step 3.1: Create `src/app/globals.css`

This file contains ALL design tokens from [Section 8](#8-neobrutalism-design-system-css) plus the global reset. Combine all the CSS variable blocks (colors, typography, spacing, borders, shadows), the global reset, and the utility classes into a single file.

**Structure of `globals.css` (assemble in this order):**

1. `:root` with ALL CSS custom properties (colors, typography, spacing, borders, shadows)
2. CSS Reset (`*`, `html`, `body`, headings, `a`, `img`, `code`)
3. App Layout styles (`.app-layout`, `.app-main`, `.app-content`)
4. Utility classes (`.visually-hidden`, `.truncate`, `.text-center`, etc.)
5. Scrollbar styling
6. Selection styling (`::selection`)

### Step 3.2: Create Root Layout

**File: `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import { Archivo_Black, Inter } from 'next/font/google';
import './globals.css';

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--nb-font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--nb-font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Storinary — Self-Hosted Image CDN',
  description: 'Free, self-hosted Cloudinary alternative. Bulk upload, transform, and serve images from Supabase Storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${inter.variable}`}>
      <body>
        {/* ToastProvider wraps the entire app — built in Phase 5 */}
        {/* <ToastProvider> */}
          <div className="app-layout">
            {/* Sidebar — built in Phase 4 */}
            {/* <Sidebar /> */}
            <main className="app-main">
              <div className="app-content">
                {children}
              </div>
            </main>
          </div>
        {/* </ToastProvider> */}
      </body>
    </html>
  );
}
```

> **After building the Sidebar (Phase 4) and ToastProvider (Phase 5), uncomment them in `layout.tsx`.**

---

## Phase 4: Layout Components

### Step 4.1: Sidebar Component

**File: `src/components/layout/Sidebar.tsx`** + **`Sidebar.module.css`**

- **Directive**: `'use client'`
- **Width**: Fixed 260px, full height, `position: fixed`, `left: 0`, `top: 0`
- **Background**: `var(--nb-white)` with right border `var(--nb-border)`
- **Logo area**: Top section with app name "STORINARY" in `var(--nb-font-heading)`, `var(--nb-text-2xl)`. Background: `var(--nb-yellow)`. Padding: `20px`. Full width within sidebar. Border-bottom: `var(--nb-border)`.
- **Navigation links**: Vertical list with emoji icons, using `next/link`:

```typescript
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/upload', label: 'Upload', icon: '⬆️' },
  { href: '/gallery', label: 'Gallery', icon: '🖼️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];
```

- **Active state detection**: Use `usePathname()` from `next/navigation`. Active when `pathname === item.href` (exact match for `/`, startsWith for others).
- **Active link style**: `background: var(--nb-yellow)`, `border: var(--nb-border)`, `box-shadow: var(--nb-shadow-sm)`, `font-weight: 700`
- **Hover style**: `background: var(--nb-bg)`, `transform: translate(-1px, -1px)`
- **Nav link style**: `padding: 12px 20px`, `display: flex`, `align-items: center`, `gap: 12px`, `font-size: var(--nb-text-base)`, `font-weight: 600`, `border-bottom: 2px solid var(--nb-black)`, `transition: var(--nb-transition)`
- **Bottom section**: Storage indicator showing "X.X / 10 GB" with a progress bar. Fetch from `/api/stats`. Padding: `20px`. Border-top: `var(--nb-border)`.
- **Mobile behavior**: Hidden below 768px. Shown via state toggle with overlay backdrop when hamburger is clicked.
- **Z-index**: `z-index: 100`

### Step 4.2: Header Component

**File: `src/components/layout/Header.tsx`** + **`Header.module.css`**

- **Props**: `title: string`, `description?: string`, `actions?: React.ReactNode`
- **Layout**: `display: flex`, `justify-content: space-between`, `align-items: flex-start`
- **Left side**: `<h1>` with `font-family: var(--nb-font-heading)`, `font-size: var(--nb-text-3xl)`. Below it: `<p>` with `font-size: var(--nb-text-base)`, `color: #666`, `margin-top: 4px`
- **Right side**: `actions` slot — renders any ReactNode (buttons, etc.)
- **Bottom**: `border-bottom: var(--nb-border)`, `padding-bottom: var(--nb-space-6)`, `margin-bottom: var(--nb-space-8)`
- **Mobile**: Stack vertically, actions below title. Includes hamburger button (visible only `< 768px`) that toggles sidebar.

### Step 4.3: Update Root Layout

After building Sidebar and Header, uncomment them in `src/app/layout.tsx`.

---

## Phase 5: Reusable UI Components

Build these components in order. Each has a `.tsx` file and a `.module.css` file in `src/components/ui/`.

### Step 5.1: Button Component

**File: `src/components/ui/Button.tsx`** + **`Button.module.css`**

- **Props**: Use `ButtonProps` from `@/types`
- **Variants** (CSS classes per variant):
  - `primary`: `bg: var(--nb-yellow)`, `color: var(--nb-black)` — default
  - `secondary`: `bg: var(--nb-white)`, `color: var(--nb-black)`
  - `danger`: `bg: var(--nb-pink)`, `color: var(--nb-white)`
  - `outline`: `bg: transparent`, `color: var(--nb-black)`
  - `ghost`: No border, no shadow, `bg: transparent`. Hover: `bg: var(--nb-bg)`
- **Sizes** (padding, font-size, shadow):
  - `sm`: `padding: 8px 16px`, `font-size: 14px`, `box-shadow: var(--nb-shadow-md)`
  - `md`: `padding: 12px 24px`, `font-size: 16px`, `box-shadow: var(--nb-shadow-lg)` — default
  - `lg`: `padding: 16px 32px`, `font-size: 18px`, `box-shadow: var(--nb-shadow-xl)`
- **Base styles**: `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.5px`, `border: var(--nb-border)`, `border-radius: var(--nb-radius)`, `cursor: pointer`, `transition: var(--nb-transition)`, `user-select: none`, `display: inline-flex`, `align-items: center`, `gap: 8px`
- **Hover**: `transform: translate(-2px, -2px)`, shadow grows one tier
- **Active**: `transform: translate(4px, 4px)`, `box-shadow: var(--nb-shadow-none)`
- **Disabled**: `opacity: 0.5`, `cursor: not-allowed`, `pointer-events: none`
- **Loading**: Show `<Spinner size="sm" />` before children, disable click
- **fullWidth**: `width: 100%`, `justify-content: center`
- **icon**: Render before children inside the flex container

### Step 5.2: Modal Component

**File: `src/components/ui/Modal.tsx`** + **`Modal.module.css`**

- **Directive**: `'use client'`
- **Props**: Use `ModalProps` from `@/types`
- **Render**: Use `createPortal(content, document.body)` — import from `react-dom`
- **Overlay**: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.5)`, `display: flex`, `align-items: center`, `justify-content: center`, `z-index: 1000`, `padding: 20px`
- **Modal box**: `bg: var(--nb-white)`, `border: 4px solid var(--nb-black)`, `border-radius: var(--nb-radius)`, `box-shadow: 10px 10px 0px 0px #000`, `padding: 32px`, `max-width: 480px`, `width: 100%`, `position: relative`
- **Animation**: CSS `@keyframes nb-modal-in` — fade in + slide up + scale
- **Close button**: Absolute top-right, `bg: var(--nb-pink)`, `border: 2px solid #000`, `width: 32px`, `height: 32px`, content "✕", `font-weight: bold`
- **Title**: `font-family: var(--nb-font-heading)`, `font-size: var(--nb-text-2xl)`, `margin-bottom: 12px`
- **Body**: `margin-bottom: 24px`
- **Actions footer**: `display: flex`, `gap: 12px`, `justify-content: flex-end`
- **Close on overlay click**: `onClick` on overlay (not on modal box — use `e.stopPropagation()`)
- **Close on Escape**: `useEffect` with `keydown` event listener for `Escape` key
- **Conditional render**: Return `null` if `!isOpen`

### Step 5.3: Badge Component

**File: `src/components/ui/Badge.tsx`** + **`Badge.module.css`**

- **Props**: Use `BadgeProps` from `@/types`
- **Variant colors**:
  - `default`: `bg: var(--nb-yellow)`
  - `success`: `bg: var(--nb-green)`
  - `danger`: `bg: var(--nb-pink)`, `color: var(--nb-white)`
  - `info`: `bg: var(--nb-blue)`, `color: var(--nb-white)`
  - `warning`: `bg: var(--nb-orange)`
- **Style**: `padding: 4px 12px`, `font-size: 12px`, `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.5px`, `border: 2px solid var(--nb-black)`, `border-radius: 2px`, `box-shadow: var(--nb-shadow-sm)`, `display: inline-flex`, `align-items: center`

### Step 5.4: Toast Component & Provider

**File: `src/components/ui/ToastProvider.tsx`** — Context provider + toast container

- **Directive**: `'use client'`
- **Context**: `ToastContext` with `addToast(toast: Omit<ToastData, 'id'>): void` and `removeToast(id: string): void`
- **State**: `useState<ToastData[]>` array
- **Auto-dismiss**: Each toast has a `setTimeout` that calls `removeToast` after `duration` ms (default 4000)
- **Container**: Fixed `bottom: 24px`, `right: 24px`, `z-index: 2000`, `display: flex`, `flex-direction: column-reverse`, `gap: 12px`

**File: `src/components/ui/Toast.tsx`** — Individual toast

- **Props**: `toast: ToastData`, `onDismiss: (id: string) => void`
- **Variant backgrounds**: success → green, error → pink, info → blue, warning → orange
- **Style**: `border: var(--nb-border)`, `box-shadow: var(--nb-shadow-md)`, `padding: 12px 20px`, `border-radius: var(--nb-radius)`, `min-width: 300px`, `max-width: 420px`, `display: flex`, `justify-content: space-between`, `align-items: center`
- **Animation**: `@keyframes nb-toast-in` — slide in from right. `@keyframes nb-toast-out` — slide out to right.
- **Dismiss button**: "✕" on the right side

**File: `src/hooks/useToast.ts`**

```typescript
import { useContext } from 'react';
import { ToastContext } from '@/components/ui/ToastProvider';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  
  return {
    toast: {
      success: (message: string) => context.addToast({ message, type: 'success' }),
      error: (message: string) => context.addToast({ message, type: 'error' }),
      info: (message: string) => context.addToast({ message, type: 'info' }),
      warning: (message: string) => context.addToast({ message, type: 'warning' }),
    },
  };
}
```

### Step 5.5: ProgressBar Component

**File: `src/components/ui/ProgressBar.tsx`** + **`ProgressBar.module.css`**

- **Props**: `value: number` (0-100), `color?: string`, `size?: 'sm' | 'md'`, `showLabel?: boolean`
- **Container**: `bg: var(--nb-white)`, `border: 2px solid var(--nb-black)`, `border-radius: 4px`, height `12px` (sm) or `20px` (md), `overflow: hidden`
- **Fill div**: `height: 100%`, `bg: var(--nb-green)` (or `color` prop), `transition: width 0.3s ease`, `width: {value}%`, `border-right: 2px solid var(--nb-black)` (if not 100%)
- **Label**: If `showLabel`, render percentage text to the right of the bar

### Step 5.6: Spinner Component

**File: `src/components/ui/Spinner.tsx`** + **`Spinner.module.css`**

- **Props**: `size?: 'sm' | 'md' | 'lg'`
- **Size mapping**: sm → `16px`, md → `24px`, lg → `36px`
- **Style**: A square with `border: 3px solid var(--nb-black)`, but only 2 sides visible (top + right colored, bottom + left transparent). `border-radius: 2px` (keep it angular). `animation: nb-spin 0.8s linear infinite`.
- **Keyframes**: `@keyframes nb-spin { to { transform: rotate(360deg); } }`

### Step 5.7: EmptyState Component

**File: `src/components/ui/EmptyState.tsx`** + **`EmptyState.module.css`**

- **Props**: `icon: string` (emoji), `title: string`, `description: string`, `action?: React.ReactNode`
- **Layout**: Centered flex column, `padding: 60px 20px`, `text-align: center`
- **Icon**: `font-size: 48px`, `margin-bottom: 16px`
- **Title**: `font-family: var(--nb-font-heading)`, `font-size: var(--nb-text-2xl)`, `margin-bottom: 8px`
- **Description**: `font-size: var(--nb-text-base)`, `color: #666`, `margin-bottom: 24px`, `max-width: 400px`
- **Action**: Renders below description (typically a Button)

---

## Phase 6: API Routes

### Step 6.1: Upload API Route

**File: `src/app/api/upload/route.ts`**

**Method**: `POST`

**Request**: `multipart/form-data` containing:
- Multiple files under field name `file` (iterate over `formData.getAll('file')`)
- `folder`: string (default `"/"`)
- `tags`: string (comma-separated)
- `compressed`: `"true"` or `"false"`
- `bgRemoved`: `"true"` or `"false"`

**Processing per file**:
1. Read file from FormData: `const file = ... as File`
2. Validate file type and size
3. Convert to Buffer: `Buffer.from(await file.arrayBuffer())`
4. Extract metadata with `sharp` via `getImageMetadata(buffer)`
5. Determine MIME type from file: `file.type` or fallback to `getMimeType(file.name)`
6. Generate short ID: `generateShortId()`
7. Determine format from metadata (use the `format` returned by `getImageMetadata`)
8. Generate storage key: `generateStorageKey(file.name, shortId, format)`
9. Upload to Supabase Storage: `uploadToStorage(buffer, key, mimeType)`
10. Get public URL: `getPublicUrl(key)`
11. Save to database: `prisma.image.create({ data: { ... } })`
12. Return the created `ImageRecord`

**Response**: `UploadResponse` JSON — `{ success: boolean, images: ImageRecord[], errors: [...] }`

**Error handling**: If an individual file fails, continue with others. Collect errors in an array. Return `200` with both successes and errors.

**Body size**: Use Next.js route segment config to allow large bodies:
```typescript
export const runtime = 'nodejs'; // NOT edge — sharp requires Node.js
// The actual size limit is controlled by next.config.ts serverActions.bodySizeLimit
```

### Step 6.2: List Images API Route

**File: `src/app/api/images/route.ts`**

**Method `GET`**: List images with pagination, search, and filters.

**Query Parameters** (from `request.nextUrl.searchParams`):
- `page`: number, default `1`
- `limit`: number, default `20`, max `100`
- `search`: string, optional
- `folder`: string, optional
- `sort`: `'createdAt'` | `'fileSize'` | `'originalName'`, default `'createdAt'`
- `order`: `'asc'` | `'desc'`, default `'desc'`

**Processing**:
1. Parse and validate all query params with defaults
2. Build Prisma `where` clause:
   ```typescript
   const where: Prisma.ImageWhereInput = {};
   if (search) {
     where.OR = [
       { originalName: { contains: search } },
       { tags: { contains: search } },
       { altText: { contains: search } },
     ];
   }
   if (folder) {
     where.folder = folder;
   }
   ```
3. Query: `prisma.image.findMany({ where, orderBy: { [sort]: order }, skip: (page - 1) * limit, take: limit })`
4. Count: `prisma.image.count({ where })`
5. Return `ImagesListResponse`

**Method `DELETE`**: Bulk delete images.

**Request body**: `BulkDeleteRequest` JSON — `{ ids: string[] }`

**Processing**:
1. Validate `ids` array is not empty and not > 100 items
2. Fetch all images: `prisma.image.findMany({ where: { id: { in: ids } } })`
3. Delete from Supabase Storage: `bulkDeleteFromStorage(images.map(i => i.storagePath))`
4. Delete from DB: `prisma.image.deleteMany({ where: { id: { in: ids } } })`
5. Return `BulkDeleteResponse`

### Step 6.3: Single Image API Route

**File: `src/app/api/images/[id]/route.ts`**

**Method `GET`**: Get single image with generated links.
1. `const { id } = await params;` — **MUST await params in Next.js 15**
2. Find: `prisma.image.findUnique({ where: { id } })`
3. If not found: `return NextResponse.json({ error: 'Not found' }, { status: 404 })`
4. Generate links: `generateLinks(image.publicUrl, image.storagePath, image.altText, process.env.NEXT_PUBLIC_APP_URL!)`
5. Return `ImageDetailResponse`

**Method `DELETE`**: Delete single image.
1. Find image by ID
2. Delete from Supabase Storage: `deleteFromStorage(image.storagePath)`
3. Delete from DB: `prisma.image.delete({ where: { id } })`
4. Return `{ success: true }`

**Method `PATCH`**: Update image metadata (tags, altText, folder).
1. Parse JSON body: `const body = await request.json()`
2. Validate: Only allow updating `tags`, `altText`, `folder` fields
3. Update: `prisma.image.update({ where: { id }, data: { tags: body.tags, altText: body.altText, folder: body.folder } })`
4. Return updated `ImageRecord`

### Step 6.4: Image Transform API Route

**File: `src/app/api/images/[id]/transform/route.ts`**

**Method `GET`**: Apply transforms and return the processed image binary.

**Query params**: `w`, `h`, `q`, `fmt`, `fit` (see `TransformParams` type)

**Processing**:
1. `const { id } = await params;`
2. Find image in DB: `prisma.image.findUnique({ where: { id } })`
3. If not found: return 404
4. Fetch original from Supabase Storage: `getFromStorage(image.storagePath)`
5. Parse transform params: `parseTransformParams(request.nextUrl.searchParams)`
6. If no transform params provided: return original buffer with original content type
7. Apply transforms: `transformImage(buffer, params)`
8. Return the transformed buffer:
   ```typescript
   return new Response(result.buffer, {
     headers: {
       'Content-Type': result.contentType,
       'Cache-Control': 'public, max-age=31536000, immutable',
       'Content-Disposition': 'inline',
     },
   });
   ```

### Step 6.5: Serve API Route (On-the-fly transforms via URL path)

**File: `src/app/api/serve/[...path]/route.ts`**

**Method `GET`**

**URL pattern**: `/api/serve/2024/08/photo-abc12345.webp?w=800&h=600&q=80&fmt=webp&fit=cover`

The `[...path]` catch-all route captures the Supabase Storage path.

**Processing**:
1. Reconstruct storage path: `const { path } = await params; const key = (path as string[]).join('/');`
2. Parse transform params from `request.nextUrl.searchParams`
3. **If NO transform params present**: Redirect to public Supabase URL
   ```typescript
   return NextResponse.redirect(getPublicUrl(key), 301);
   ```
4. **If transform params present**:
   a. Fetch from Supabase Storage: `getFromStorage(key)` — wrapped in try/catch
   b. If object not found: return 404
   c. Apply transforms: `transformImage(buffer, params)`
   d. Return binary response with cache headers:
   ```typescript
   return new Response(result.buffer, {
     headers: {
       'Content-Type': result.contentType,
       'Cache-Control': 'public, max-age=31536000, immutable',
     },
   });
   ```

### Step 6.6: Stats API Route

**File: `src/app/api/stats/route.ts`**

**Method `GET`**:

```typescript
export async function GET() {
  const totalImages = await prisma.image.count();
  
  const storageResult = await prisma.image.aggregate({
    _sum: { fileSize: true },
  });
  const totalStorageBytes = storageResult._sum.fileSize || 0;
  
  const imagesByFormat = await prisma.image.groupBy({
    by: ['format'],
    _count: true,
  });
  
  const imagesByFolder = await prisma.image.groupBy({
    by: ['folder'],
    _count: true,
  });
  
  const recentUploads = await prisma.image.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  
  const uploadsThisMonth = await prisma.image.count({
    where: { createdAt: { gte: firstOfMonth } },
  });
  
  // Format storage to human-readable
  const formatStorage = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };
  
  return NextResponse.json({
    totalImages,
    totalStorageBytes,
    totalStorageFormatted: formatStorage(totalStorageBytes),
    imagesByFormat: Object.fromEntries(
      imagesByFormat.map((g) => [g.format, g._count])
    ),
    imagesByFolder: Object.fromEntries(
      imagesByFolder.map((g) => [g.folder, g._count])
    ),
    recentUploads,
    uploadsThisMonth,
  } satisfies StatsResponse);
}
```

---

## Phase 7: Upload Feature

### Step 7.1: Upload Hook

**File: `src/hooks/useUpload.ts`**

- **Directive**: This is a client-side hook
- **State management**: Use `useReducer` with `UploadState` as state type

**Reducer Actions** (define as a discriminated union type):
- `ADD_FILES` — payload: `File[]` — Creates `UploadItem[]` with `pending` status, generates `nanoid` IDs, creates preview URLs
- `REMOVE_ITEM` — payload: `string` (id) — Removes item, revokes preview URL
- `UPDATE_GLOBAL_OPTIONS` — payload: `Partial<UploadState['globalOptions']>`
- `UPDATE_ITEM_STATUS` — payload: `{ id: string, status: UploadItemStatus }`
- `UPDATE_ITEM_PROGRESS` — payload: `{ id: string, progress: number }`
- `SET_ITEM_RESULT` — payload: `{ id: string, result: ImageRecord }`
- `SET_ITEM_ERROR` — payload: `{ id: string, error: string }`
- `SET_ITEM_BLOB` — payload: `{ id: string, blob: Blob }` — After compression/bg removal
- `CLEAR_COMPLETED` — No payload — Removes done/error items
- `RESET` — No payload — Clears everything
- `SET_UPLOADING` — payload: `boolean`

**Initial State**:
```typescript
const initialState: UploadState = {
  items: [],
  globalOptions: {
    removeBg: false,
    compress: true,
    quality: 80,
    maxWidth: 2048,
    folder: '/',
    tags: '',
  },
  isUploading: false,
  completedCount: 0,
  errorCount: 0,
};
```

**`startUpload` function** (the core logic):

```
Decision: Upload files SEQUENTIALLY (one at a time).

For each item where status === 'pending':
  1. If item.options.compress (or globalOptions.compress):
     - dispatch UPDATE_ITEM_STATUS → 'compressing'
     - const compressedBlob = await compressImage(item.file, globalOptions.maxWidth, globalOptions.quality / 100)
     - dispatch SET_ITEM_BLOB → compressedBlob
  
  2. If item.options.removeBg (or globalOptions.removeBg):
     - dispatch UPDATE_ITEM_STATUS → 'removing-bg'
     - const { removeBg } = await import('@/lib/bg-removal')
     - const bgRemovedBlob = await removeBg(compressedBlob || item.file)
     - dispatch SET_ITEM_BLOB → bgRemovedBlob
  
  3. dispatch UPDATE_ITEM_STATUS → 'uploading'
  
  4. Create FormData:
     - const formData = new FormData()
     - formData.append('file', processedBlob || item.file, item.file.name)
     - formData.append('folder', globalOptions.folder)
     - formData.append('tags', globalOptions.tags)
     - formData.append('compressed', String(item.options.compress || globalOptions.compress))
     - formData.append('bgRemoved', String(item.options.removeBg || globalOptions.removeBg))
  
  5. const response = await fetch('/api/upload', { method: 'POST', body: formData })
  
  6. If response.ok:
     - const data = await response.json()
     - dispatch SET_ITEM_RESULT → data.images[0]
     - dispatch UPDATE_ITEM_STATUS → 'done'
  
  7. If !response.ok:
     - dispatch SET_ITEM_ERROR → error message
     - dispatch UPDATE_ITEM_STATUS → 'error'
```

**Returned API**:
```typescript
{
  state: UploadState;
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  updateGlobalOptions: (options: Partial<UploadState['globalOptions']>) => void;
  startUpload: () => Promise<void>;
  clearCompleted: () => void;
  reset: () => void;
}
```

### Step 7.2: Upload Page

**File: `src/app/upload/page.tsx`** + **`upload.module.css`**

- **Directive**: `'use client'`
- Uses `useUpload()` hook for all state
- Uses `useToast()` for notifications

**Layout** (top to bottom):
1. `<Header title="Upload Images" actions={[Clear All button, Upload All button]}>`
2. `<UploadSettings>` — global options panel
3. `<DropZone>` — drag and drop area
4. `<UploadQueue>` — list of files in queue
5. **Completed Links Panel** — visible only when there are completed uploads. Shows bulk link copy buttons.

**Page-level CSS**: Grid layout with `gap: var(--nb-space-6)`

### Step 7.3: DropZone Component

**File: `src/components/upload/DropZone.tsx`** + **`DropZone.module.css`**

- **Directive**: `'use client'`
- **Props**: `onFilesAdded: (files: File[]) => void`, `disabled?: boolean`
- **State**: `isDragging: boolean` for visual feedback
- **Event handlers**:
  - `onDragOver`: `e.preventDefault()`, `e.stopPropagation()`, set `isDragging = true`
  - `onDragEnter`: `e.preventDefault()`, set `isDragging = true`
  - `onDragLeave`: `e.preventDefault()`, set `isDragging = false` (only if leaving the actual dropzone, not a child)
  - `onDrop`: `e.preventDefault()`, set `isDragging = false`, extract `e.dataTransfer.files`, validate each with `validateFile()`, call `onFilesAdded` with valid files, show toast for rejected files
  - `onClick`: Trigger hidden file input click
- **Hidden file input**: `<input type="file" multiple accept="image/*" ref={inputRef} onChange={handleFileSelect} style={{ display: 'none' }} />`
- **Visual states**:
  - Default: `border: 3px dashed var(--nb-black)`, `bg: var(--nb-white)`, `border-radius: var(--nb-radius)`, `padding: 60px 40px`, `text-align: center`, `cursor: pointer`
  - Dragging: `border: 3px solid var(--nb-black)`, `bg: var(--nb-yellow)`, `transform: scale(1.01)`, `box-shadow: var(--nb-shadow-lg)`
  - Disabled: `opacity: 0.5`, `pointer-events: none`
- **Content**: Large upload icon (📁 emoji, 48px), "Drag & drop images here" (heading font), "or click to browse" (body font), supported formats list, max file size

### Step 7.4: UploadSettings Component

**File: `src/components/upload/UploadSettings.tsx`** + **`UploadSettings.module.css`**

- **Directive**: `'use client'`
- **Props**: `options: UploadState['globalOptions']`, `onChange: (options: Partial<UploadState['globalOptions']>) => void`
- **Style**: Neobrutalism card (`nb-card` pattern), with grid layout for controls
- **Controls** (each with a `<label>` in uppercase):
  1. **Compress toggle**: Custom checkbox — `<label class="nb-checkbox"><input type="checkbox" checked={options.compress} /> Compress to WebP</label>`
  2. **Quality slider**: `<input type="range" min="1" max="100" value={options.quality} />` with value label. Only visible when compress is ON.
  3. **Max Width input**: `<input type="number" value={options.maxWidth} step="128" min="128" max="8192" />` with "px" suffix. Only visible when compress is ON.
  4. **Remove BG toggle**: Custom checkbox — `<label class="nb-checkbox"><input type="checkbox" checked={options.removeBg} /> Remove Background</label>`
  5. **Folder input**: `<input type="text" value={options.folder} />` with "/" prefix
  6. **Tags input**: `<input type="text" value={options.tags} placeholder="comma, separated, tags" />`
- **Layout**: `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 16px`. Stack on mobile.

### Step 7.5: UploadQueue Component

**File: `src/components/upload/UploadQueue.tsx`** + **`UploadQueue.module.css`**

- **Props**: `items: UploadItem[]`, `onRemove: (id: string) => void`
- **Layout**: Vertical flex list with `gap: 12px`
- **Empty state**: If no items, show nothing (DropZone is the visual focus)
- **Header**: If items exist, show count: "N files in queue"
- Renders `<UploadItem>` for each item

### Step 7.6: UploadItem Component

**File: `src/components/upload/UploadItem.tsx`** + **`UploadItem.module.css`**

- **Directive**: `'use client'`
- **Props**: `item: UploadItem`, `onRemove: (id: string) => void`
- **Layout**: Horizontal flex card — `border: var(--nb-border)`, `border-radius: var(--nb-radius)`, `box-shadow: var(--nb-shadow-md)`, `padding: 12px 16px`, `bg: var(--nb-white)`
  - **Left**: Thumbnail `<img>` — `48px × 48px`, `object-fit: cover`, `border: 2px solid var(--nb-black)`, `border-radius: 4px`
  - **Center**: Filename (truncated, max 200px width), file size (`formatBytes`)
  - **Right**: Status display + action buttons
- **Status display** (based on `item.status`):
  - `pending`: `<Badge variant="default">PENDING</Badge>`
  - `compressing`: `<Badge variant="info">COMPRESSING</Badge>` + `<Spinner size="sm" />`
  - `removing-bg`: `<Badge variant="info">REMOVING BG</Badge>` + `<Spinner size="sm" />`
  - `uploading`: `<ProgressBar value={item.progress} size="sm" />`
  - `done`: `<Badge variant="success">DONE</Badge>` + Copy URL button (copies `item.result.publicUrl`)
  - `error`: `<Badge variant="danger">ERROR</Badge>` + error message in small text
- **Remove button**: "✕" button, only visible when status is `pending` or `error`

---

## Phase 8: Gallery Feature

### Step 8.1: Images Hook

**File: `src/hooks/useImages.ts`**

```typescript
// Returns:
{
  images: ImageRecord[];
  pagination: { page: number, limit: number, total: number, totalPages: number };
  isLoading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  filters: ImagesListParams;
  setFilters: (filters: Partial<ImagesListParams>) => void;
  setPage: (page: number) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  refresh: () => void;
  deleteImages: (ids: string[]) => Promise<void>;
}
```

**Implementation details**:
- `useState` for `filters`, `images`, `pagination`, `isLoading`, `error`, `selectedIds` (as `Set<string>`)
- `useEffect` that fetches from `/api/images` whenever `filters` change
- Debounce `search` filter by 300ms using `useRef` + `setTimeout` pattern
- `deleteImages`: Send `DELETE` to `/api/images` with `{ ids }` body, then call `refresh()`
- `refresh`: Re-fetch with current filters

### Step 8.2: Clipboard Hook

**File: `src/hooks/useClipboard.ts`**

```typescript
'use client';

export function useClipboard() {
  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  };
  return { copy };
}
```

### Step 8.3: Gallery Page

**File: `src/app/gallery/page.tsx`** + **`gallery.module.css`**

- **Directive**: `'use client'`
- Uses `useImages()` hook
- Uses `useToast()` for notifications
- Uses `useClipboard()` for URL copying

**Layout** (top to bottom):
1. `<Header title="Gallery" actions={[Bulk Delete button (visible when selected), Copy All Links button (visible when selected)]} />`
2. `<GalleryToolbar>` — search, filter, sort, select all
3. Loading state: Show grid of skeleton cards (8 cards) when `isLoading`
4. Empty state: Show `<EmptyState icon="🖼️" title="No images yet" description="Upload some images to get started" action={Link to /upload} />`
5. `<ImageGrid>` — the image card grid
6. `<Pagination>` — page navigation

### Step 8.4: GalleryToolbar Component

**File: `src/components/gallery/GalleryToolbar.tsx`** + **`GalleryToolbar.module.css`**

- **Directive**: `'use client'`
- **Props**: `filters: ImagesListParams`, `setFilters: (f: Partial<ImagesListParams>) => void`, `selectedCount: number`, `totalCount: number`, `onSelectAll: () => void`, `onDeselectAll: () => void`, `onBulkDelete: () => void`, `onBulkCopy: () => void`
- **Layout**: Neobrutalism card, `display: flex`, `flex-wrap: wrap`, `gap: 12px`, `align-items: center`, `justify-content: space-between`
- **Left side controls**:
  - Search input: `<input className="nb-input" type="text" placeholder="Search images..." value={filters.search} onChange={...} />` — width `280px`
  - Folder dropdown: `<select className="nb-select">` with options from unique folders
  - Sort dropdown: `<select className="nb-select">` — "Date", "Size", "Name"
  - Order toggle: `<Button variant="outline" size="sm" onClick={toggle order}>` — shows ↑ or ↓
- **Right side controls**:
  - Select all checkbox: `<label class="nb-checkbox"><input type="checkbox" /> Select All</label>`
  - Selection info: "{N} selected" `<Badge>`
  - Bulk actions (visible when `selectedCount > 0`):
    - `<Button variant="danger" size="sm">Delete Selected</Button>`
    - `<Button variant="secondary" size="sm">Copy URLs</Button>`
  - Count display: "Showing X-Y of Z" text

### Step 8.5: ImageGrid Component

**File: `src/components/gallery/ImageGrid.tsx`** + **`ImageGrid.module.css`**

- **Props**: `images: ImageRecord[]`, `selectedIds: Set<string>`, `onToggleSelect: (id: string) => void`, `onDelete: (id: string) => void`, `onCopyUrl: (url: string) => void`
- **Layout**: `display: grid`, `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`, `gap: 20px`
- Renders `<ImageCard>` for each image

### Step 8.6: ImageCard Component

**File: `src/components/gallery/ImageCard.tsx`** + **`ImageCard.module.css`**

- **Directive**: `'use client'`
- **Props**: `image: ImageRecord`, `isSelected: boolean`, `onToggleSelect: () => void`, `onDelete: () => void`, `onCopyUrl: () => void`
- **Layout**: Vertical card with neobrutalism style
  - `border: var(--nb-border)`, `border-radius: var(--nb-radius)`, `box-shadow: var(--nb-shadow-lg)`, `bg: var(--nb-white)`, `overflow: hidden`, `transition: var(--nb-transition)`
- **Image section** (top):
  - `<img>` with `aspect-ratio: 1`, `object-fit: cover`, `width: 100%`
  - Selection checkbox: Absolute positioned top-left (8px, 8px), custom styled checkbox, `z-index: 2`
  - Format badge: Absolute positioned top-right (8px, 8px), `<Badge>{image.format.toUpperCase()}</Badge>`
  - `border-bottom: var(--nb-border)` separating image from info
- **Info section** (bottom):
  - `padding: 12px 16px`
  - Filename: Truncated, `font-weight: 600`, `font-size: var(--nb-text-sm)`
  - Meta row: `display: flex`, `justify-content: space-between`, file size + relative date in `color: #666`, `font-size: var(--nb-text-xs)`
- **Actions bar** (very bottom):
  - `border-top: 2px solid var(--nb-black)`, `display: flex`
  - 3 equal-width icon buttons spanning full width:
    - [📋 Copy] — calls `onCopyUrl(image.publicUrl)`
    - [🔗 View] — `<Link href={/images/${image.id}}>` 
    - [🗑️ Delete] — calls `onDelete()` with confirmation
  - Each button: `flex: 1`, `padding: 8px`, `text-align: center`, `cursor: pointer`, `font-size: var(--nb-text-xs)`, `font-weight: 700`, `text-transform: uppercase`, `border-right: 2px solid var(--nb-black)` (last child: no right border)
  - Hover: `bg: var(--nb-bg)`
- **Card hover**: `transform: translate(-2px, -2px)`, `box-shadow: var(--nb-shadow-xl)`
- **Selected state**: `border-color: var(--nb-blue)`, `box-shadow: 0 0 0 3px var(--nb-blue)` (outline effect)
- **Click behavior**: Clicking the card body navigates to `/images/[id]`. Checkbox and action buttons use `e.stopPropagation()`.

### Step 8.7: Pagination Component

**File: `src/components/gallery/Pagination.tsx`** + **`Pagination.module.css`**

- **Props**: Use `PaginationProps` from `@/types`
- **Layout**: `display: flex`, `justify-content: center`, `gap: 8px`, `align-items: center`
- **Page button generation logic**:
  - Always show: page 1, last page, current page, current ± 2
  - Show "..." ellipsis between non-consecutive pages
  - Prev button: `<Button variant="outline" size="sm" disabled={currentPage === 1}>← Prev</Button>`
  - Next button: `<Button variant="outline" size="sm" disabled={currentPage === totalPages}>Next →</Button>`
  - Page number buttons: `<Button variant={page === currentPage ? 'primary' : 'outline'} size="sm" onClick={() => onPageChange(page)}>{page}</Button>`
  - Ellipsis: `<span style={{ padding: '8px' }}>...</span>`
- **Hide entirely**: If `totalPages <= 1`, render nothing

---

## Phase 9: Image Detail & Transformations

### Step 9.1: Image Detail Page

**File: `src/app/images/[id]/page.tsx`** + **`detail.module.css`**

**Architecture**: Use a **Server Component** for initial data fetch, with **Client Components** for interactive parts.

```typescript
// This is a Server Component
import { notFound } from 'next/navigation';
import type { ImageDetailResponse } from '@/types';

export default async function ImageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/images/${id}`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) notFound();
  
  const data: ImageDetailResponse = await response.json();
  
  return (
    <>
      <Header title={data.image.originalName} />
      <div className={styles.detailLayout}>
        <div className={styles.previewColumn}>
          <ImagePreview image={data.image} />
        </div>
        <div className={styles.infoColumn}>
          <ImageMeta image={data.image} />
          <TransformPanel image={data.image} />
          <LinkGenerator image={data.image} links={data.links} />
        </div>
      </div>
    </>
  );
}
```

**Layout CSS** (`detail.module.css`):
- `.detailLayout`: `display: grid`, `grid-template-columns: 3fr 2fr`, `gap: var(--nb-space-8)`, `align-items: start`
- `.previewColumn`: Sticky (`position: sticky`, `top: 32px`)
- `.infoColumn`: Stack of cards with `gap: var(--nb-space-6)`
- Mobile (`< 768px`): Single column, preview on top

### Step 9.2: ImagePreview Component

**File: `src/components/image-detail/ImagePreview.tsx`** + **`ImagePreview.module.css`**

- **Directive**: `'use client'` (needs to react to transform changes)
- **Props**: `image: ImageRecord`, `transformedSrc?: string`
- **Layout**: Neobrutalism card containing the image
- **Image**: `<img>` showing either `transformedSrc` (if transforms are applied) or `image.publicUrl`
- **Background**: Checkerboard pattern CSS for transparent images:
  ```css
  .checkerboard {
    background-image: 
      linear-gradient(45deg, #eee 25%, transparent 25%),
      linear-gradient(-45deg, #eee 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #eee 75%),
      linear-gradient(-45deg, transparent 75%, #eee 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  }
  ```
- **Overlay badges**: Dimensions badge (bottom-left, "W × H") and format badge (bottom-right, "WEBP")
- **Max dimensions**: `max-height: 70vh`, `object-fit: contain`

### Step 9.3: ImageMeta Component

**File: `src/components/image-detail/ImageMeta.tsx`** + **`ImageMeta.module.css`**

- **Directive**: `'use client'` (editable fields)
- **Props**: `image: ImageRecord`
- **Layout**: Neobrutalism card with a table-like layout
- **Rows** (label: value):
  - Filename: `image.originalName`
  - Dimensions: `${image.width} × ${image.height} px`
  - File Size: `formatBytes(image.fileSize)`
  - Format: `<Badge>{image.format.toUpperCase()}</Badge>`
  - Folder: `image.folder` — with edit icon that toggles inline `<input>`
  - Tags: `image.tags` (comma-separated badges) — with edit icon that toggles inline `<input>`
  - Alt Text: `image.altText` — with edit icon that toggles inline `<input>`
  - Uploaded: `formatRelativeTime(image.createdAt)` + full date on hover (title attribute)
  - BG Removed: `<Badge variant={image.bgRemoved ? 'success' : 'default'}>{image.bgRemoved ? 'Yes' : 'No'}</Badge>`
- **Editable fields**: Tags, Alt Text, and Folder have a small pencil icon (✏️) button next to them. Clicking toggles an inline text input. On blur or Enter, sends `PATCH /api/images/[id]` to update.
- **Table styling**: Use the neobrutalism table CSS from the design system section

### Step 9.4: TransformPanel Component

**File: `src/components/image-detail/TransformPanel.tsx`** + **`TransformPanel.module.css`**

- **Directive**: `'use client'`
- **Props**: `image: ImageRecord`, `onTransformChange?: (params: TransformParams) => void`
- **State**: `useState<TransformParams>` for local control values
- **Layout**: Neobrutalism card with title "Transform" (heading font)

**Controls**:
1. **Width**: `<label>Width</label>` + `<input type="number" min="1" max="8192" placeholder="Auto" />` — Shows `image.width` as placeholder
2. **Height**: `<label>Height</label>` + `<input type="number" min="1" max="8192" placeholder="Auto" />` — Shows `image.height` as placeholder
3. **Quality**: `<label>Quality: {q}%</label>` + `<input type="range" min="1" max="100" value={q} />` — Default 80
4. **Format**: `<label>Format</label>` + `<select>`:
   - `<option value="">Original ({image.format})</option>`
   - `<option value="webp">WebP</option>`
   - `<option value="avif">AVIF</option>`
   - `<option value="jpeg">JPEG</option>`
   - `<option value="png">PNG</option>`
5. **Fit Mode**: `<label>Fit</label>` + `<select>`:
   - `<option value="inside">Inside (default)</option>`
   - `<option value="cover">Cover (crop)</option>`
   - `<option value="contain">Contain (letterbox)</option>`
   - `<option value="fill">Fill (stretch)</option>`

**Preset buttons** (row of small buttons):
- "150×150 Thumb" → sets w=150, h=150, fit=cover
- "800×600 Medium" → sets w=800, h=600, fit=inside
- "1920×1080 Full HD" → sets w=1920, h=1080, fit=inside
- "1200×630 Social" → sets w=1200, h=630, fit=cover

**Behavior**:
- When any control changes, debounce 500ms, then call `onTransformChange(params)` which updates the `ImagePreview` src to `/api/images/${image.id}/transform?w=...&h=...&q=...&fmt=...&fit=...`
- **Preview URL construction**: Build URL string from current params, omitting empty/default values
- **Reset button**: `<Button variant="outline" size="sm">Reset</Button>` — clears all params back to defaults

### Step 9.5: LinkGenerator Component

**File: `src/components/image-detail/LinkGenerator.tsx`** + **`LinkGenerator.module.css`**

- **Directive**: `'use client'`
- **Props**: `image: ImageRecord`, `links: GeneratedLinks`, `transformParams?: TransformParams`
- Uses `useClipboard()` hook
- Uses `useToast()` hook

**Layout**: Neobrutalism card with title "Links" (heading font)

**Link rows** (each row has label, code block, copy button):
1. **Direct URL**: `links.direct`
2. **HTML**: `links.html`
3. **Markdown**: `links.markdown`
4. **CSS**: `links.css`
5. **Transform URL** (only if `transformParams` has values): Constructed from `links.transformBase` + query string

**Each row**:
- Label: `<span>` with uppercase, bold, `font-size: var(--nb-text-xs)`
- Code block: `<code>` container with `bg: var(--nb-bg)`, `border: 2px solid var(--nb-black)`, `padding: 8px 12px`, `font-family: var(--nb-font-mono)`, `font-size: var(--nb-text-sm)`, `overflow-x: auto`, `white-space: nowrap`, `display: block`, `border-radius: 4px`
- Copy button: `<Button variant="outline" size="sm" icon="📋">` — positioned to the right of the code block
  - On click: Copy the link text, show toast "Copied!", change button text to "✓ Copied" for 2 seconds (green background), then revert

**Bulk copy**: At the bottom, `<Button variant="primary">Copy All Links</Button>` — copies all link formats as a formatted block:
```
Direct: https://...
HTML: <img src="..." alt="..." />
Markdown: ![alt](url)
CSS: background-image: url('...');
```

---

## Phase 10: Dashboard Page

### Step 10.1: Dashboard Page

**File: `src/app/page.tsx`**

**Architecture**: Server Component that fetches stats and passes to client components.

```typescript
export default async function DashboardPage() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stats`, {
    cache: 'no-store',
  });
  const stats: StatsResponse = await response.json();
  
  return (
    <>
      <Header title="Dashboard" actions={<Link href="/upload"><Button>Quick Upload ⬆️</Button></Link>} />
      
      {/* Stats Row */}
      <div className={styles.statsGrid}>
        <StatCard label="Total Images" value={stats.totalImages.toLocaleString()} icon="📷" color="var(--nb-yellow)" />
        <StatCard label="Storage Used" value={stats.totalStorageFormatted} icon="💾" color="var(--nb-blue)" />
        <StatCard label="This Month" value={stats.uploadsThisMonth} icon="📅" color="var(--nb-mint)" />
        <StatCard label="Folders" value={Object.keys(stats.imagesByFolder).length} icon="📁" color="var(--nb-lavender)" />
      </div>
      
      {/* Format Distribution */}
      <FormatChart data={stats.imagesByFormat} total={stats.totalImages} />
      
      {/* Recent Uploads */}
      <RecentUploads images={stats.recentUploads} />
      
      {/* Quick Actions */}
      <QuickActions />
    </>
  );
}
```

**Page CSS**: `.statsGrid`: `display: grid`, `grid-template-columns: repeat(4, 1fr)`, `gap: var(--nb-space-5)`, `margin-bottom: var(--nb-space-8)`. On mobile: `grid-template-columns: repeat(2, 1fr)`.

### Step 10.2: StatCard Component

**File: `src/components/dashboard/StatCard.tsx`** + **`StatCard.module.css`**

- **Props**: Use `StatCardProps` from `@/types`
- **Style**: Neobrutalism card with `background-color: {color}` prop
  - `border: var(--nb-border)`, `border-radius: var(--nb-radius)`, `box-shadow: var(--nb-shadow-lg)`, `padding: 20px`, `text-align: center`
  - Hover: lift effect
- **Icon**: `font-size: 32px`, `margin-bottom: 8px`
- **Value**: `font-family: var(--nb-font-heading)`, `font-size: var(--nb-text-4xl)`, `line-height: 1`, `margin-bottom: 4px`
- **Label**: `font-size: var(--nb-text-sm)`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 1px`

### Step 10.3: Format Distribution Chart

Build directly in the dashboard page or as a small component. No chart library — use pure CSS bars.

**Layout**: Neobrutalism card with title "Format Distribution"

**For each format in `imagesByFormat`**:
```html
<div class="format-row">
  <span class="format-label">WEBP</span>
  <div class="format-bar-container">
    <div class="format-bar" style="width: 68%; background: var(--nb-blue);"></div>
  </div>
  <span class="format-percent">68%</span>
</div>
```

**Format → Color mapping**:
- `webp` → `var(--nb-blue)`
- `jpeg` → `var(--nb-yellow)`
- `png` → `var(--nb-green)`
- `avif` → `var(--nb-purple)`
- `gif` → `var(--nb-orange)`
- `svg` → `var(--nb-mint)`

**Bar container**: `bg: var(--nb-bg)`, `border: 2px solid var(--nb-black)`, `border-radius: 4px`, `height: 24px`, `flex: 1`
**Bar fill**: `height: 100%`, `transition: width 0.5s ease`

### Step 10.4: RecentUploads Component

**File: `src/components/dashboard/RecentUploads.tsx`** + **`RecentUploads.module.css`**

- **Props**: `images: ImageRecord[]`
- **Layout**: Neobrutalism card with title "Recent Uploads"
- **List**: Each row is a flex container:
  - Thumbnail: `40px × 40px`, `object-fit: cover`, `border: 2px solid var(--nb-black)`, `border-radius: 4px`
  - Filename: Truncated, `font-weight: 600`
  - File size: `formatBytes(image.fileSize)`, `color: #666`
  - Time: `formatRelativeTime(image.createdAt)`, `color: #666`
  - Link arrow: `<Link href={/images/${image.id}}>→</Link>` button
- **Row styling**: `padding: 12px 0`, `border-bottom: 2px solid var(--nb-bg)` (last child: no border)
- **Row hover**: `background: var(--nb-bg)`
- **Empty state**: "No images uploaded yet" with upload button link

### Step 10.5: QuickActions Component

**File: `src/components/dashboard/QuickActions.tsx`** + **`QuickActions.module.css`**

- **Layout**: `display: flex`, `gap: var(--nb-space-5)`, full width
- **Buttons** (each `flex: 1`, large neobrutalism buttons):
  - `<Link href="/upload"><Button variant="primary" size="lg" fullWidth icon="⬆️">Upload Images</Button></Link>`
  - `<Link href="/gallery"><Button variant="secondary" size="lg" fullWidth icon="🖼️">Browse Gallery</Button></Link>`
  - `<Link href="/settings"><Button variant="outline" size="lg" fullWidth icon="⚙️">Settings</Button></Link>`
- **Mobile**: Stack vertically (`flex-direction: column`)

---

## Phase 11: Settings Page

### Step 11.1: Settings Page

**File: `src/app/settings/page.tsx`** + **`settings.module.css`**

- **Directive**: `'use client'`
- Uses `useToast()` hook

**Sections** (each in a neobrutalism card):

#### Section 1: Supabase Connection Status
- **Title**: "Connection Status" (heading font)
- **Status indicator**: Green `<Badge variant="success">CONNECTED</Badge>` or Red `<Badge variant="danger">DISCONNECTED</Badge>`
- **Test Connection button**: `<Button variant="secondary" onClick={testConnection}>Test Connection</Button>`
  - Calls `GET /api/stats`. If successful → show green badge + toast "Connected!". If error → show red badge + toast "Connection failed".
- **Display** (read-only, masked):
  - Supabase URL: `process.env.NEXT_PUBLIC_SUPABASE_URL` value
  - Bucket Name: `process.env.SUPABASE_BUCKET_NAME` value

#### Section 2: Default Upload Settings
- Saved to `localStorage` key `storinary-upload-defaults`
- Controls (same as UploadSettings component):
  - Default compression: on/off toggle
  - Default quality: slider 1-100
  - Default max width: number input
  - Default background removal: on/off
  - Default folder: text input
- **Save button**: `<Button variant="primary" onClick={saveDefaults}>Save Defaults</Button>`

#### Section 3: Supabase Setup Guide
- **Collapsible section** (click to expand/collapse)
- **Title**: "Supabase Setup Instructions" with ▶/▼ toggle
- **Content** (when expanded): Step-by-step numbered instructions for:
  1. Creating a Supabase project
  2. Creating a storage bucket named "storinary"
  3. Setting the bucket to "Public"
  4. Copying Project URL and API keys
  5. Updating `.env` file
- Use neobrutalism-styled ordered list with bold step numbers

#### Section 4: Danger Zone
- **Title**: "Danger Zone" in red, with `border: 3px solid var(--nb-pink)`
- **Delete All Images**: `<Button variant="danger">Delete All Images</Button>`
  - Opens confirmation `<Modal>` with text input requiring user to type "DELETE ALL"
  - On confirm: Calls `DELETE /api/images` with all image IDs, then reloads
- **Reset Database**: `<Button variant="danger">Reset Database</Button>`
  - Opens confirmation modal
  - Deletes all DB records but keeps storage files (useful for re-syncing)

---

## Phase 12: Polish, Responsive, & Testing

### Step 12.1: Responsive Breakpoints

Add these media queries where needed:

```css
/* Mobile: 0 - 768px */
@media (max-width: 768px) { ... }

/* Tablet: 769px - 1024px */
@media (min-width: 769px) and (max-width: 1024px) { ... }

/* Desktop: 1025px+ — default styles */
```

**Key responsive changes**:

1. **Sidebar**: `display: none` on mobile. Toggle with hamburger button. Overlay with backdrop when open.
2. **Image grid**: `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` on mobile (smaller cards)
3. **Dashboard stat cards**: `grid-template-columns: repeat(2, 1fr)` on mobile
4. **Image detail**: Single column stack on mobile (preview on top, info below). Remove `position: sticky`.
5. **Gallery toolbar**: Wrap controls vertically, search input full width
6. **Upload settings**: Single column grid
7. **Quick actions**: Stack vertically
8. **Pagination**: Reduce visible page numbers on mobile (show only current ± 1)

### Step 12.2: Loading States

- **Dashboard**: Pulsing skeleton cards (rectangles with `animation: nb-pulse 1.5s ease-in-out infinite`)
  ```css
  @keyframes nb-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  ```
  Skeleton shape: Same dimensions as real cards, `bg: var(--nb-bg)`, `border: var(--nb-border)`, `border-radius: var(--nb-radius)`
- **Gallery**: Skeleton image cards (same dimensions as real cards)
- **Image detail**: `<Spinner size="lg" />` centered in preview area
- **Upload**: Progress bars during upload, `<Spinner>` during compression/bg removal

### Step 12.3: Error Handling

- **API routes**: All errors return `{ error: string }` with appropriate HTTP status code
- **Client-side**: Wrap every `fetch` in try-catch. Show `toast.error(message)` on failure.
- **Not Found**: Create `src/app/not-found.tsx` with `<EmptyState icon="🔍" title="Page Not Found" />`
- **API Error**: Create `src/app/error.tsx` (client component with `'use client'`) as global error boundary

### Step 12.4: Keyboard Shortcuts

Implement in a `useEffect` in the root layout or relevant pages:

| Key | Action | Page | Implementation |
|-----|--------|------|----------------|
| `Ctrl/Cmd + V` | Paste image from clipboard to upload queue | Upload | Listen for `paste` event, read `clipboardData.items`, find image items, convert to File, add to queue |
| `Ctrl/Cmd + A` | Select all images | Gallery | Call `selectAll()` from `useImages` hook |
| `Delete` | Delete selected images | Gallery | Trigger bulk delete with confirmation modal |
| `Escape` | Close modal / deselect all | Global | Handled by Modal component already + call `deselectAll()` |

### Step 12.5: SEO & Meta Tags

Each page exports `metadata` (for Server Components) or uses `generateMetadata` (for dynamic pages):

```typescript
// Static pages (dashboard, upload, gallery, settings)
export const metadata: Metadata = {
  title: 'Dashboard — Storinary',
  description: 'Overview of your image CDN. View storage stats, recent uploads, and quick actions.',
};

// Dynamic pages (image detail)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Fetch image name for title
  return {
    title: `${imageName} — Storinary`,
    description: `View and transform ${imageName}. Generate CDN links for your website.`,
  };
}
```

### Step 12.6: Final Testing Checklist

```
- [ ] Upload single image → verify appears in gallery with correct URL
- [ ] Upload 10+ images bulk → verify all upload with progress
- [ ] Upload with compression ON → verify WebP output, smaller file size
- [ ] Upload with background removal ON → verify transparent PNG result
- [ ] Copy direct URL → paste in browser → image loads
- [ ] Copy HTML link → paste in HTML file → image renders
- [ ] Copy Markdown link → paste in .md file → renders
- [ ] Copy CSS link → verify valid CSS property
- [ ] Transform URL with ?w=200 → verify resized image returned
- [ ] Transform URL with ?fmt=avif → verify AVIF format returned
- [ ] Transform URL with ?q=10 → verify low quality, small file size
- [ ] Transform URL with ?fit=cover&w=200&h=200 → verify cropped to square
- [ ] Delete single image → verify removed from gallery and Supabase Storage
- [ ] Bulk delete 5 images → verify all removed
- [ ] Search by filename → verify correct results
- [ ] Search by tag → verify correct results
- [ ] Filter by folder → verify filtered results
- [ ] Sort by size → verify order changes
- [ ] Pagination → verify page navigation works
- [ ] Edit tags inline → verify PATCH request works
- [ ] Edit alt text inline → verify saved
- [ ] Dashboard stats → verify correct totals match gallery
- [ ] Dashboard recent uploads → verify shows latest 10
- [ ] Mobile responsive → verify sidebar, grid, forms work on small screen
- [ ] Settings page → test Supabase connection button
- [ ] Settings page → save default upload options to localStorage
- [ ] Keyboard: Ctrl+V paste image in upload page
- [ ] Keyboard: Ctrl+A select all in gallery
- [ ] Keyboard: Escape closes modal
- [ ] Toast notifications appear for all success/error actions
- [ ] Empty states show when no data exists
- [ ] Loading spinners/skeletons show during fetch
```

---

## Supabase Setup Instructions (One-Time Manual Steps)

> These steps must be done manually in the Supabase Dashboard before the app will work.
> **No credit card required.** Sign up with GitHub or email.

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub or email)
2. Click **New Project**
3. Choose your organization (or create one)
4. Project name: `storinary`
5. Database password: Generate a strong password (save it, but you won't need it for storage)
6. Region: Choose the closest to your users
7. Click **Create new project** — wait ~2 minutes for provisioning

### 2. Create a Storage Bucket

1. In your Supabase project, go to **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `storinary`
4. **Toggle "Public bucket" to ON** — this allows direct public URL access to uploaded files
5. File size limit: Leave as default (50 MB) or set to `10 MB`
6. Allowed MIME types: Leave empty (allow all) or enter: `image/jpeg, image/png, image/webp, image/gif, image/avif, image/svg+xml`
7. Click **Create bucket**

### 3. Get API Keys

1. Go to **Project Settings** (gear icon in left sidebar) → **API**
2. Copy the following values:
   - **Project URL** → put in `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → put in `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (click "Reveal") → put in `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **IMPORTANT**: The `service_role` key has full admin access. NEVER expose it to the client/browser. Only use it in server-side API routes.

### 4. Update `.env`

Fill in all values in your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
SUPABASE_BUCKET_NAME="storinary"
```

### 5. Verify Public URL Works

After uploading your first image, the public URL format will be:
```
https://<your-project-ref>.supabase.co/storage/v1/object/public/storinary/2024/08/photo-abc12345.webp
```

Paste this URL in a browser — the image should load directly.

### Free Tier Limits

| Resource | Free Tier |
|----------|----------|
| **Storage** | 1 GB |
| **Bandwidth** | 2 GB / month |
| **Database** | 500 MB |
| **File uploads** | Up to 50 MB per file |
| **Credit Card Required** | **NO** |

---

## Implementation Order Summary

| Phase | What to Build | Est. Files | Depends On |
|-------|--------------|------------|------------|
| 1 | Project init, deps, Prisma, env | 5 | Nothing |
| 2 | Core libs (prisma, supabase storage, sharp, utils) | 7 | Phase 1 |
| 3 | Global CSS + root layout | 2 | Phase 1 |
| 4 | Sidebar + Header components | 4 | Phase 3 |
| 5 | UI components (Button, Modal, Toast, etc.) | 16 | Phase 3 |
| 6 | All API routes | 6 | Phase 2 |
| 7 | Upload feature (page, hook, components) | 10 | Phase 4, 5, 6 |
| 8 | Gallery feature (page, hook, components) | 10 | Phase 4, 5, 6 |
| 9 | Image detail + transforms | 8 | Phase 6, 8 |
| 10 | Dashboard page + components | 6 | Phase 5, 6 |
| 11 | Settings page | 2 | Phase 5 |
| 12 | Polish, responsive, testing | — | All |

**Total unique files**: ~76 files

---

## Key Gotchas & Warnings

> ⚠️ These are common mistakes that MUST be avoided.

1. **Next.js 15 `params` is a Promise**: Always `await params` in route handlers and page components. Write `const { id } = await params;` — NOT `const { id } = params;`

2. **Supabase `service_role` key is secret**: NEVER expose it to the client/browser. Only use it in server-side code (API routes, `src/lib/storage.ts`). Use `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) so Next.js does not bundle it into the client.

3. **Supabase Storage bucket must be "Public"**: When creating the bucket in Supabase Dashboard, toggle "Public bucket" to ON. Without this, `getPublicUrl()` will return a URL that returns 400/403.

4. **Supabase Storage `upload()` needs `contentType`**: Always pass the `contentType` option when uploading. Without it, Supabase may serve the file with `application/octet-stream` Content-Type.

5. **Supabase Storage `upload()` does NOT overwrite by default**: Pass `{ upsert: true }` to overwrite existing files. Without it, uploading to the same path will fail.

6. **`@imgly/background-removal` is client-only**: Never import at the top level of server components or API routes. Always use dynamic `import()`. Exclude from server bundle in `next.config.ts`.

7. **Do NOT set `Content-Type` header when sending FormData via fetch()**: The browser automatically sets the correct `multipart/form-data; boundary=...` header. Setting it manually breaks the multipart boundary.

8. **Prisma Client singleton is required in Next.js**: Without the `globalThis` caching pattern, hot-reloading creates too many database connections and crashes. Always use the singleton from `src/lib/prisma.ts`.

9. **`sharp` cannot run in Edge Runtime**: All image processing must happen in Node.js API routes (default runtime), NOT Edge runtime. Do not add `export const runtime = 'edge'` to routes that use sharp.

10. **`File.arrayBuffer()` returns `ArrayBuffer`, not `Buffer`**: Always convert with `Buffer.from(await file.arrayBuffer())` before passing to sharp or Supabase Storage.

11. **SQLite does not support `@db.Text` or `@db.VarChar`**: Use plain `String` type in Prisma schema. No column type annotations for SQLite.

12. **`nanoid` v5 is ESM-only**: Import as `import { nanoid } from 'nanoid'`. Do not use `require()`.

13. **Supabase free tier: 1 GB storage**: With client-side WebP compression enabled (default), 1 GB fits ~3,000–5,000 images. Monitor usage in Supabase Dashboard → Settings → Usage.

---

*End of Plan. Follow phases 1–12 sequentially. Every architectural decision has been made. Just write the code.*
