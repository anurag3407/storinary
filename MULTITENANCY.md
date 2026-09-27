# Multitenant authentication and isolation

Storinary uses Better Auth for users, verified email sessions, and organizations. An organization is a tenant. Assets, videos, API keys, collections, metadata, presets, webhooks, transforms, and delivery analytics are scoped to the active organization at the Prisma query boundary.

## Required configuration

1. Set `BETTER_AUTH_SECRET` to at least 32 random bytes.
2. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.
3. Set `NEXT_PUBLIC_APP_URL` to the exact public HTTPS origin.
4. Apply migrations before starting the app:
   - SQLite: `npx prisma migrate deploy --schema prisma/schema.prisma`
   - PostgreSQL: `npx prisma migrate deploy --schema prisma/postgres/schema.prisma`
5. Generate the Prisma client with the matching schema.

Existing application data is migrated into a reserved `legacy` organization. No new user receives that organization automatically. Object keys created after this migration include the organization slug (for example, `acme/2026/09/hero-id.webp`), preventing one tenant from overwriting another tenant's object.

Public delivery is available at `/api/serve/<organization-slug>/<storage-key>`. Signed delivery binds the complete tenant-prefixed path to its HMAC token. Organization switching uses Better Auth's server-validated active organization; API keys resolve their organization from the key record.
