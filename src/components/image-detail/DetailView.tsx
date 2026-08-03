'use client';

import { useState } from 'react';
import type { GeneratedLinks, ImageRecord, TransformParams } from '@/types';
import { ImageMeta } from './ImageMeta';
import { ImagePreview } from './ImagePreview';
import { LinkGenerator } from './LinkGenerator';
import { TransformPanel } from './TransformPanel';
import styles from '../../app/images/[id]/detail.module.css';

interface DetailViewProps {
  image: ImageRecord;
  links: GeneratedLinks;
}

function buildQuery(params: TransformParams): string {
  const q = new URLSearchParams();
  if (params.w) q.set('w', String(params.w));
  if (params.h) q.set('h', String(params.h));
  if (params.q) q.set('q', String(params.q));
  if (params.fmt) q.set('fmt', params.fmt);
  if (params.fit) q.set('fit', params.fit);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function DetailView({ image, links }: DetailViewProps) {
  const [transformedSrc, setTransformedSrc] = useState<string | undefined>(
    undefined
  );
  const [transformParams, setTransformParams] = useState<TransformParams>({});

  const handleTransformChange = (params: TransformParams) => {
    setTransformParams(params);
    if (Object.keys(params).length === 0) {
      setTransformedSrc(undefined);
    } else {
      setTransformedSrc(`/api/images/${image.id}/transform${buildQuery(params)}`);
    }
  };

  return (
    <div className={styles.detailLayout}>
      <div className={styles.previewColumn}>
        <ImagePreview image={image} transformedSrc={transformedSrc} />
      </div>
      <div className={styles.infoColumn}>
        <ImageMeta image={image} />
        <TransformPanel image={image} onTransformChange={handleTransformChange} />
        <LinkGenerator image={image} links={links} transformParams={transformParams} />
      </div>
    </div>
  );
}
