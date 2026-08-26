/**
 * Client-side background removal using @imgly/background-removal.
 * Runs entirely in the browser via WASM + ONNX Runtime.
 *
 * USAGE:
 *   const { removeBg } = await import('@/lib/bg-removal');
 *   const resultBlob = await removeBg(file, onProgress);
 *
 * DO NOT import this file in server components or API routes.
 */

export type BgRemovalProgress = {
  key: string;
  current: number;
  total: number;
};

/**
 * Remove background from an image file.
 * Returns a PNG Blob with transparent background.
 *
 * @param imageSource - File, Blob, or URL string
 * @param onProgress - Optional progress callback (for model download tracking)
 * @returns PNG Blob with background removed
 */
export async function removeBg(
  imageSource: File | Blob | string,
  onProgress?: (progress: BgRemovalProgress) => void
): Promise<Blob> {
  // Dynamic import to avoid SSR issues
  const { removeBackground } = await import('@imgly/background-removal');

  const blob = await removeBackground(imageSource, {
    model: 'isnet', // Balance between speed and quality
    progress: onProgress
      ? (key: string, current: number, total: number) => {
          onProgress({ key, current, total });
        }
      : undefined,
  });

  return blob;
}

export async function createSubjectMask(
  imageSource: File | Blob | string,
  onProgress?: (progress: BgRemovalProgress) => void
): Promise<Blob> {
  const { segmentForeground } = await import('@imgly/background-removal');
  return segmentForeground(imageSource, {
    model: 'isnet',
    output: { format: 'image/x-alpha8' },
    progress: onProgress
      ? (key, current, total) => onProgress({ key, current, total })
      : undefined,
  });
}

export type ContentSafetyResult = {
  safe: boolean;
  score: number;
  threshold: number;
};

export async function analyzeSubjectMask(
  mask: Blob,
  threshold = 0.82
): Promise<ContentSafetyResult> {
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) {
    throw new Error('Moderation threshold must be between 0.5 and 1');
  }

  const bitmap = await createImageBitmap(mask);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas unavailable for moderation');

    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let visiblePixels = 0;
    let totalPixels = 0;
    for (let index = 3; index < data.length; index += 4) {
      totalPixels += 1;
      if (data[index] > 24) visiblePixels += 1;
    }

    const coverage = totalPixels ? visiblePixels / totalPixels : 0;
    return {
      safe: coverage <= threshold,
      score: Number(coverage.toFixed(4)),
      threshold,
    };
  } finally {
    bitmap.close();
  }
}
