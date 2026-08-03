import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { DetailView } from '@/components/image-detail/DetailView';
import type { ImageDetailResponse } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const headersList = await headers();
  const host =
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    'localhost:3000';
  const proto = headersList.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

/** Build fetch options that forward the session cookie (needed for auth). */
async function authedFetchOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();
  return {
    cache: 'no-store' as const,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/images/${id}`, await authedFetchOptions());
  const name = res.ok
    ? ((await res.json()) as ImageDetailResponse).image.originalName
    : 'Image';
  return {
    title: name,
    description: `View and transform ${name}. Generate CDN links for your website.`,
  };
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const base = await getBaseUrl();

  const response = await fetch(`${base}/api/images/${id}`, await authedFetchOptions());

  if (!response.ok) notFound();

  const data: ImageDetailResponse = await response.json();

  return (
    <>
      <Header
        title={data.image.originalName}
        description={`${data.image.width} × ${data.image.height} px · ${data.image.format.toUpperCase()}`}
      />
      <DetailView image={data.image} links={data.links} />
    </>
  );
}
