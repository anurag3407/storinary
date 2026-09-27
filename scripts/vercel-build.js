#!/usr/bin/env node
const { execSync } = require('child_process');

let dbUrl = process.env.DATABASE_URL || '';

// Clean surrounding quotes if any
if (
  (dbUrl.startsWith('"') && dbUrl.endsWith('"')) ||
  (dbUrl.startsWith("'") && dbUrl.endsWith("'"))
) {
  dbUrl = dbUrl.slice(1, -1).trim();
  process.env.DATABASE_URL = dbUrl;
}

let directUrl = process.env.DIRECT_URL || '';
if (
  (directUrl.startsWith('"') && directUrl.endsWith('"')) ||
  (directUrl.startsWith("'") && directUrl.endsWith("'"))
) {
  directUrl = directUrl.slice(1, -1).trim();
}

if (!directUrl && dbUrl) {
  directUrl = dbUrl;
}

// If using Supabase pooler, direct migrations require port 5432 and no pgbouncer flag
if (directUrl && directUrl.includes('pooler.supabase.com')) {
  directUrl = directUrl.replace(':6543', ':5432').replace(/[?&]pgbouncer=true/g, '');
}
process.env.DIRECT_URL = directUrl;

const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.warn(
    '⚠️ DATABASE_URL is missing or does not start with postgresql:// or postgres://.\n' +
    '   Providing fallback postgres URL for Prisma client generation...'
  );
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
  process.env.DIRECT_URL = process.env.DATABASE_URL;
} else {
  console.log('🚀 Running Prisma database migrations on PostgreSQL...');
  try {
    execSync('npx prisma migrate deploy --schema prisma/postgres/schema.prisma', {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    console.error('⚠️ Database migration warning:', err.message);
  }
}

// Fallback for Better-Auth during build if missing
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = 'storinary-build-time-secret-at-least-32-chars-long';
}

// Fallback for APP_URL on Vercel
if (!process.env.NEXT_PUBLIC_APP_URL && process.env.VERCEL_URL) {
  process.env.NEXT_PUBLIC_APP_URL = `https://${process.env.VERCEL_URL}`;
}

console.log('📦 Generating Prisma Client for PostgreSQL...');
execSync('npx prisma generate --schema prisma/postgres/schema.prisma', {
  stdio: 'inherit',
  env: process.env,
});

console.log('🏗️ Building Next.js application...');
execSync('npx next build', {
  stdio: 'inherit',
  env: process.env,
});
