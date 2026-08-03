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
