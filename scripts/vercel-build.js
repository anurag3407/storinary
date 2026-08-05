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

const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.warn(
    '⚠️ DATABASE_URL is missing or does not start with postgresql:// or postgres://.\n' +
    '   Providing fallback postgres URL for Prisma client generation...'
  );
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
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
