import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Clean surrounding quotes if present
  let cleanUrl = url.trim();
  if (
    (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) ||
    (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))
  ) {
    cleanUrl = cleanUrl.slice(1, -1).trim();
  }

  // If using Supabase Pooler (pooler.supabase.com), optimize for serverless execution:
  // 1. Switch port 5432 (Session Mode max 15 clients) to 6543 (Transaction Mode)
  // 2. Ensure pgbouncer=true & connection_limit=1 are attached
  if (cleanUrl.includes('pooler.supabase.com')) {
    let optUrl = cleanUrl.replace(':5432/', ':6543/');
    if (!optUrl.includes('pgbouncer=true')) {
      optUrl += (optUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    if (!optUrl.includes('connection_limit=')) {
      optUrl += (optUrl.includes('?') ? '&' : '?') + 'connection_limit=1';
    }
    return optUrl;
  }

  return cleanUrl;
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
