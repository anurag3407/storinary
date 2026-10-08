import type { Metadata } from 'next';
import { ImageDetailClient } from '@/components/image-detail/ImageDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: 'Image Detail — Storinary',
    description: `View and transform image ${id}. Generate CDN links for your website.`,
  };
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ImageDetailClient id={id} />;
}
