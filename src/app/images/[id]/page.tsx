import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertIcon } from '@/components/ui/icons';
import { DetailView } from '@/components/image-detail/DetailView';
import { getImageDetail } from '@/lib/image-detail';
import type { ImageDetailResponse } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const data = await getImageDetail(id);
    const name = data ? data.image.originalName : 'Image';
    return {
      title: name,
      description: `View and transform ${name}. Generate CDN links for your website.`,
    };
  } catch {
    // Never let a metadata lookup failure mask the page's own error state.
    return { title: 'Image unavailable' };
  }
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { id } = await params;

  let data: ImageDetailResponse | null = null;
  let loadFailed = false;
  try {
    data = await getImageDetail(id);
  } catch {
    loadFailed = true;
  }

  // A genuine miss is a 404; an infrastructure failure gets its own state so a
  // database hiccup never masquerades as "this image doesn't exist".
  if (loadFailed) {
    return (
      <>
        <Header
          title="Image unavailable"
          description="We couldn't load this image right now."
        />
        <EmptyState
          icon={<AlertIcon size={26} />}
          headingLevel={2}
          title="Could not load this image"
          description="The app couldn't reach its database. Your image has not been deleted — try again in a moment, or head back to the gallery."
          action={
            <Link href="/gallery">
              <Button variant="secondary">Back to Gallery</Button>
            </Link>
          }
        />
      </>
    );
  }

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
