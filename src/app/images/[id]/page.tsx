import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { DetailView } from '@/components/image-detail/DetailView';
import { getImageDetail } from '@/lib/image-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getImageDetail(id);
  const name = data ? data.image.originalName : 'Image';
  return {
    title: name,
    description: `View and transform ${name}. Generate CDN links for your website.`,
  };
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getImageDetail(id);

  if (!data) notFound();

  return (
    <>
      <Header
        title={data.image.originalName}
        description={`${data.image.width} × ${data.image.height} px · ${data.image.format.toUpperCase()}`}
      />
      <DetailView image={data.image} links={data.links} versions={data.versions} />
    </>
  );
}
