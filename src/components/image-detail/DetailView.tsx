'use client';

import { useState } from 'react';
import type {
  GeneratedLinks,
  ImageRecord,
  ImageVersionRecord,
  TransformParams,
} from '@/types';
import { ImageMeta } from './ImageMeta';
import { ImagePreview } from './ImagePreview';
import { LinkGenerator } from './LinkGenerator';
import { TransformPanel } from './TransformPanel';
import styles from '../../app/images/[id]/detail.module.css';

interface DetailViewProps {
  image: ImageRecord;
  links: GeneratedLinks;
  versions: ImageVersionRecord[];
}

function buildQuery(params: TransformParams): string {
  const q = new URLSearchParams();
  if (params.w) q.set('w', String(params.w));
  if (params.h) q.set('h', String(params.h));
  if (params.q) q.set('q', String(params.q));
  if (params.fmt) q.set('fmt', params.fmt);
  if (params.fit) q.set('fit', params.fit);
  if (params.g) q.set('g', params.g);
  if (params.ar) q.set('ar', params.ar);
  if (params.b) q.set('b', params.b);
  if (typeof params.a === 'number') q.set('a', String(params.a));
  for (const effect of params.e ?? []) {
    if (effect.grayscale) q.append('e', 'grayscale');
    else if (effect.sepia !== undefined) q.append('e', `sepia:${effect.sepia}`);
    else if (effect.blur !== undefined) q.append('e', `blur:${effect.blur}`);
    else if (effect.sharpen !== undefined) q.append('e', `sharpen:${effect.sharpen}`);
    else if (effect.saturation !== undefined) {
      q.append('e', `saturation:${Math.round(effect.saturation * 100)}`);
    }
  }
  if (params.dpr) q.set('dpr', String(params.dpr));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function DetailView({ image, links, versions }: DetailViewProps) {
  const [transformedSrc, setTransformedSrc] = useState<string | undefined>(
    undefined
  );
  const [transformParams, setTransformParams] = useState<TransformParams>({});
  const handleTransformChange = (params: TransformParams) => {
    setTransformParams(params);
    if (Object.keys(params).length === 0) {
      setTransformedSrc(undefined);
    } else {
      const query = buildQuery(params).replace(/^\?/, '');
      const search = new URLSearchParams(query);
      setTransformedSrc(
        links.transformUrl && search.get('token')
          ? links.transformUrl
          : `/api/images/${image.id}/transform${buildQuery(params)}`
      );
    }
  };

  return (
    <div className={styles.detailLayout}>
      <div className={styles.previewColumn}>
        <ImagePreview image={image} transformedSrc={transformedSrc} />
      </div>
      <div className={styles.infoColumn}>
        <ImageMeta image={image} versions={versions} />
        <TransformPanel image={image} onTransformChange={handleTransformChange} />
        <LinkGenerator links={links} transformParams={transformParams} />
      </div>
    </div>
  );
}
