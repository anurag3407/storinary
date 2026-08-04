# Contributing to Storinary

First off — thanks for taking the time to contribute! 🎉

Storinary is a free, self-hosted Cloudinary alternative. The project is young and friendly, and every bit of help counts: bug reports, feature ideas, docs, design, and code.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [How to help](#how-to-help)
- [Project setup](#project-setup)
- [Development workflow](#development-workflow)
- [Code style](#code-style)
- [Testing](#testing)
- [Commit guidelines](#commit-guidelines)
- [Pull request process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to help

- **Report a bug** — open an issue with steps to reproduce, expected vs. actual behavior, and your environment (browser, OS, Node version).
- **Suggest a feature** — open an issue describing the problem you're solving, not just the feature. Include example URLs/screenshots if useful.
- **Write docs** — README, wiki, comments, or example snippets. Docs PRs are very welcome.
- **Fix a bug or add a feature** — check the [Roadmap](README.md#roadmap) and open issues; comment on an issue you want to take so others know it's claimed.

## Project setup

Prerequisites:

- **Node.js 20+** and npm
- A [Supabase](https://supabase.com) project with a **public storage bucket** (see the in-app **Settings → Supabase Setup Instructions**)

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your Supabase credentials
cp .env.example .env

# 3. Create the SQLite database
npx prisma migrate dev --name init

# 4. Run the dev server
npm run dev
```

Open http://localhost:3000.

> **Note:** the app uses a Supabase service-role key server-side. Never commit `.env` — it's already gitignored.

## Development workflow

1. Fork the repo and create a feature branch:

   ```bash
   git checkout -b feat/your-feature
   ```

2. Make your changes. Keep them focused — one logical change per PR.
3. Run the checks below; everything must pass.
4. Commit with a clear message (see guidelines).
5. Push and open a pull request against `main`. Reference the issue you're fixing (e.g. `Fixes #12`).

## Code style

- **TypeScript strict** — the project runs `tsc --noEmit` in CI; new code must type-check cleanly.
- **No new dependencies without discussion** — the project deliberately stays lean. If you need a package, explain why in the PR.
- **CSS Modules + design tokens** — use the neobrutalism tokens from `globals.css` (`--nb-*` variables); no Tailwind, no inline styles for layout.
- **Client vs. server** — API routes and anything touching Supabase/Prisma/sharp must be server-side (`export const runtime = 'nodejs'`). Browser-only code (bg removal, canvas compression) stays in `lib/` marked as client-only and is imported dynamically.

## Testing

Every change that touches logic should come with tests. The suite is Vitest + Testing Library:

```bash
npm test            # run all tests once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build (also runs lint + type checks)
```

API route tests mock `@/lib/prisma` and `@/lib/storage` with `vi.hoisted()`. Keep that pattern. Run only the tests you touched while iterating:

```bash
npx vitest run src/lib/transform-cache.test.ts
```

## Commit guidelines

- Use conventional-ish prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Keep the subject under ~72 chars; explain *why* in the body when it's not obvious.

```bash
git commit -m "feat: add eager transform presets to the transform panel"
```

## Pull request process

1. Ensure your branch is up to date with `main`.
2. CI runs typecheck, lint, tests, and the production build on every PR — make sure the checks are green.
3. A maintainer will review; expect feedback. Don't take it personally — it's how we keep the codebase clean.
4. Once approved, it gets merged and you're officially a contributor. 🚀
