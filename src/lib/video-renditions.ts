import { execFile as execFileCallback } from 'node:child_process';
import { writeFile, readFile, rm, mkdir, readdir } from 'node:fs/promises';

function execFileAsync(
  file: string,
  args: string[],
  options?: { encoding: 'buffer'; maxBuffer: number }
) {
  return new Promise<{ stdout: Buffer | string; stderr: Buffer | string }>((resolve, reject) => {
    execFileCallback(file, args, options, (error, stdout, stderr) => {
      if (error) {
        (error as NodeJS.ErrnoException & { stderr?: Buffer | string }).stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export const RENDITION_PRESETS = {
  '360p': { width: 640, height: 360, bitrateKbps: 800 },
  '720p': { width: 1280, height: 720, bitrateKbps: 2500 },
} as const;

export const MAX_VIDEO_CLIP_DURATION_SECONDS = 60 * 60;

export const HLS_VARIANT_PRESETS = {
  '360p': { ...RENDITION_PRESETS['360p'], bandwidthKbps: 800 },
  '720p': { ...RENDITION_PRESETS['720p'], bandwidthKbps: 2500 },
} as const;

export type HlsVariantLabel = keyof typeof HLS_VARIANT_PRESETS;

export type HlsVariant = {
  label: HlsVariantLabel;
  playlistPath: string;
  segmentPaths: string[];
  width: number;
  height: number;
  bandwidthKbps: number;
};

export type HlsPackage = {
  masterManifest: string;
  variantPlaylists: string[];
  segments: string[];
  totalFileSize: number;
  variants: HlsVariant[];
  files: Array<{ path: string; buffer: Buffer; contentType: string }>;
};

export type DashVariant = {
  label: HlsVariantLabel;
  playlistPath: string;
  initPath: string;
  mediaSegmentPaths: string[];
  width: number;
  height: number;
  bandwidthKbps: number;
};

export type DashPackage = {
  manifestPath: string;
  filePaths: string[];
  totalFileSize: number;
  variants: DashVariant[];
  files: Array<{ path: string; buffer: Buffer; contentType: string }>;
};

export type RenditionLabel = keyof typeof RENDITION_PRESETS;
export type RenditionResult = {
  buffer: Buffer;
  width: number;
  height: number;
  bitrateKbps: number;
};

export type VideoClipOptions = {
  format?: string;
  muted?: boolean;
};

export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

export async function getVideoMetadataWithFfprobe(
  input: Buffer,
  _format: 'mp4' | 'webm'
): Promise<{ width: number; height: number; duration: number }> {
  void _format;
  const temporaryInput = `/tmp/storinary-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.input`;
  await writeFile(temporaryInput, input);

  try {
    const { stdout, stderr } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:format=duration',
        '-of', 'json', temporaryInput,
      ],
      { encoding: 'buffer', maxBuffer: 1024 * 1024 }
    );
    const output = (Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)).toString('utf8');
    const probe = JSON.parse(output || '{}') as {
      streams?: Array<{ width?: number; height?: number }>;
      format?: { duration?: string };
    };
    const stream = probe.streams?.[0];
    const duration = Number.parseFloat(probe.format?.duration || '');
    const width = Number(stream?.width);
    const height = Number(stream?.height);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(stderr?.toString() || 'Unable to read video duration');
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw new Error('Unable to read video dimensions');
    }
    return { width, height, duration };
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    if (error instanceof SyntaxError) throw new Error('Unable to read FFprobe metadata');
    const message = cause.stderr?.toString().trim()
      || (error instanceof Error ? error.message : 'FFprobe failed');
    throw new Error(message);
  } finally {
    await rm(temporaryInput, { force: true });
  }
}

function parseDimensions(stderr: string, fallbackWidth: number, fallbackHeight: number) {
  const match = /,\s(\d{2,5})x(\d{2,5})[,\s]/.exec(stderr);
  if (!match) return { width: fallbackWidth, height: fallbackHeight };
  return {
    width: Math.max(1, Number.parseInt(match[1], 10)),
    height: Math.max(1, Number.parseInt(match[2], 10)),
  };
}

export async function createVideoRendition(
  input: Buffer,
  label: RenditionLabel
): Promise<RenditionResult> {
  const preset = RENDITION_PRESETS[label];
  const temporaryInput = `/tmp/storinary-${Date.now()}-${Math.random().toString(36).slice(2)}.input`;
  await writeFile(temporaryInput, input);

  try {
    const { stdout, stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error', '-i', temporaryInput,
        '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-maxrate', `${preset.bitrateKbps}k`, '-bufsize', `${preset.bitrateKbps * 2}k`,
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-f', 'mp4', 'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 1024 * 1024 * 512 }
    );

    const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    const diagnostic = stderr?.toString() || '';
    if (output.length === 0) throw new Error(diagnostic || 'FFmpeg produced no output');
    const dimensions = parseDimensions(diagnostic, preset.width, preset.height);
    return { ...dimensions, bitrateKbps: preset.bitrateKbps, buffer: output };
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    const message = cause.stderr?.toString().trim() || cause.message || 'FFmpeg failed';
    throw new Error(`Video rendition failed: ${message}`);
  } finally {
    await rm(temporaryInput, { force: true });
  }
}

export async function createVideoClip(
  input: Buffer,
  startSeconds: number,
  endSeconds: number,
  options: VideoClipOptions = {}
): Promise<Buffer> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const temporaryInput = `/tmp/storinary-clip-${stamp}.input`;
  await writeFile(temporaryInput, input);

  try {
    const format = options.format === 'webm' ? 'webm' : 'mp4';
    const args: string[] = [
      '-hide_banner', '-loglevel', 'error',
      '-ss', startSeconds.toFixed(3), '-i', temporaryInput,
      '-t', (endSeconds - startSeconds).toFixed(3),
      '-c:v', format === 'webm' ? 'libvpx-vp9' : 'libx264',
      ...(format === 'webm' ? ['-crf', '34', '-b:v', '0'] : ['-preset', 'veryfast', '-crf', '23']),
    ];
    if (!options.muted) {
      args.push('-c:a', format === 'webm' ? 'libopus' : 'aac', '-b:a', '128k');
    } else {
      args.push('-an');
    }
    if (format === 'mp4') args.push('-movflags', '+faststart');
    args.push('-f', format, 'pipe:1');
    const { stdout, stderr } = await execFileAsync(
      'ffmpeg',
      args,
      { encoding: 'buffer', maxBuffer: 1024 * 1024 * 512 }
    );

    const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    if (output.length === 0) throw new Error(stderr?.toString() || 'FFmpeg produced no output');
    return output;
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    const message = cause.stderr?.toString().trim() || cause.message || 'FFmpeg failed';
    throw new Error(`Video clipping failed: ${message}`);
  } finally {
    await rm(temporaryInput, { force: true });
  }
}

export async function createVideoHlsPackage(
  input: Buffer,
  videoId: string,
  requestedVariants: Array<HlsVariantLabel> = ['360p', '720p'],
  stampOverride?: string
): Promise<HlsPackage> {
  if (requestedVariants.length === 0) {
    throw new Error('At least one HLS variant is required');
  }
  const stamp = stampOverride || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const temporaryDirectory = `/tmp/storinary-hls-${stamp}`;
  await mkdir(temporaryDirectory, { recursive: true });
  await writeFile(`${temporaryDirectory}/source`, input);

  try {
    const files: Array<{ path: string; buffer: Buffer; contentType: string }> = [];
    let totalFileSize = 0;
    const segments: string[] = [];
    const variants: HlsVariant[] = [];

    for (const label of requestedVariants) {
      const preset = HLS_VARIANT_PRESETS[label];
      const variantPrefix = `${stamp}-${label}`;
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-i', `${temporaryDirectory}/source`,
          '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-maxrate', `${preset.bitrateKbps}k`, '-bufsize', `${preset.bitrateKbps * 2}k`,
          '-c:a', 'aac', '-b:a', '128k',
          '-f', 'hls', '-hls_time', '6', '-hls_list_size', '0',
          '-hls_segment_type', 'mpegts', '-hls_segment_filename', `${temporaryDirectory}/${variantPrefix}-%03d.ts`,
          `${temporaryDirectory}/${variantPrefix}.m3u8`,
        ],
        { encoding: 'buffer', maxBuffer: 1024 * 1024 * 16 }
      );
    }

    const entries = await readdir(temporaryDirectory);
    for (const label of requestedVariants) {
      const preset = HLS_VARIANT_PRESETS[label];
      const variantPrefix = `${stamp}-${label}`;
      const segmentFiles = entries.filter((name) =>
        name.startsWith(`${variantPrefix}-`) && /^\d{3}\.ts$/.test(name.slice(variantPrefix.length + 1))
      ).sort();
      if (segmentFiles.length === 0) throw new Error(`Missing HLS variant: ${label}`);

      const segmentPaths = segmentFiles.map((name) => `videos/hls/${videoId}/${name}`);
      const playlistPath = `videos/hls/${videoId}/${variantPrefix}.m3u8`;
      const playlist = (await readFile(`${temporaryDirectory}/${variantPrefix}.m3u8`)).toString('utf8');

      const variant: HlsVariant = {
        label,
        playlistPath,
        segmentPaths,
        width: preset.width,
        height: preset.height,
        bandwidthKbps: preset.bandwidthKbps,
      };
      variants.push(variant);
      totalFileSize += Buffer.byteLength(playlist);
      files.push({ path: playlistPath, buffer: Buffer.from(playlist), contentType: 'application/vnd.apple.mpegurl' });
      for (const [segmentIndex, name] of segmentFiles.entries()) {
        const segmentBuffer = await readFile(`${temporaryDirectory}/${name}`);
        segments.push(segmentPaths[segmentIndex]);
        files.push({ path: segmentPaths[segmentIndex], buffer: segmentBuffer, contentType: 'video/mp2t' });
        totalFileSize += segmentBuffer.length;
      }
    }

    const masterManifest = `videos/hls/${videoId}/${stamp}-master.m3u8`;
    const masterPlaylist = [
      '#EXTM3U', '#EXT-X-VERSION:3',
      ...variants.flatMap((variant) => [
        `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidthKbps * 1000},RESOLUTION=${variant.width}x${variant.height},NAME="${variant.label}"`,
        variant.playlistPath.split('/').pop(),
      ]),
      '',
    ].join('\n');
    files.push({ path: masterManifest, buffer: Buffer.from(masterPlaylist), contentType: 'application/vnd.apple.mpegurl' });
    totalFileSize += Buffer.byteLength(masterPlaylist);

    return {
      masterManifest,
      variantPlaylists: variants.map((variant) => variant.playlistPath),
      segments,
      totalFileSize,
      variants,
      files,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FFmpeg failed';
    throw new Error(`HLS generation failed: ${message}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function createVideoDashPackage(
  input: Buffer,
  videoId: string,
  requestedVariants: Array<HlsVariantLabel> = ['360p', '720p'],
  stampOverride?: string
): Promise<DashPackage> {
  if (requestedVariants.length === 0) {
    throw new Error('At least one DASH variant is required');
  }

  const stamp = stampOverride || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const temporaryDirectory = `/tmp/storinary-dash-${stamp}`;
  await mkdir(temporaryDirectory, { recursive: true });
  await writeFile(`${temporaryDirectory}/source`, input);

  try {
    const files: Array<{ path: string; buffer: Buffer; contentType: string }> = [];
    const variants: DashVariant[] = [];
    const filePaths: string[] = [];
    let totalFileSize = 0;

    for (const label of requestedVariants) {
      const preset = HLS_VARIANT_PRESETS[label];
      const prefix = `${stamp}-${label}`;
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner', '-loglevel', 'error', '-i', `${temporaryDirectory}/source`,
          '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-maxrate', `${preset.bitrateKbps}k`, '-bufsize', `${preset.bitrateKbps * 2}k`,
          '-c:a', 'aac', '-b:a', '128k',
          '-f', 'dash', '-seg_duration', '6', '-window_size', '0',
          '-use_template', '0', '-use_timeline', '0',
          '-init_seg_name', `${prefix}-init.mp4`,
          '-media_seg_name', `${prefix}-chunk-$Number%03d$.m4s`,
          `${temporaryDirectory}/${prefix}.mpd`,
        ],
        { encoding: 'buffer', maxBuffer: 1024 * 1024 * 16 }
      );

      const entries = await readdir(temporaryDirectory);
      const initFile = `${prefix}-init.mp4`;
      const mediaFiles = entries.filter((name) =>
        name.startsWith(`${prefix}-chunk-`) && name.endsWith('.m4s')
      ).sort();
      const manifestName = `${prefix}.mpd`;
      const playlistBuffer = await readFile(`${temporaryDirectory}/${manifestName}`);
      const playlistPath = `videos/dash/${videoId}/${manifestName}`;

      const segmentPaths = [
        `videos/dash/${videoId}/${initFile}`,
        ...mediaFiles.map((name) => `videos/dash/${videoId}/${name}`),
      ];
      const variant: DashVariant = {
        label,
        playlistPath,
        initPath: segmentPaths[0],
        mediaSegmentPaths: segmentPaths.slice(1),
        width: preset.width,
        height: preset.height,
        bandwidthKbps: preset.bandwidthKbps,
      };
      variants.push(variant);
      filePaths.push(...segmentPaths, playlistPath);
      files.push({ path: playlistPath, buffer: playlistBuffer, contentType: 'application/dash+xml' });
      totalFileSize += playlistBuffer.length;

      for (const path of segmentPaths) {
        const buffer = await readFile(`${temporaryDirectory}/${path.split('/').pop()}`);
        files.push({ path, buffer, contentType: path.endsWith('.mp4') ? 'video/mp4' : 'video/iso.segment' });
        totalFileSize += buffer.length;
      }
    }

    return { manifestPath: variants[0].playlistPath, filePaths, totalFileSize, variants, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FFmpeg failed';
    throw new Error(`DASH generation failed: ${message}`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function createVideoFramePoster(input: Buffer): Promise<Buffer> {
  const temporaryInput = `/tmp/storinary-poster-${Date.now()}-${Math.random().toString(36).slice(2)}.input`;
  await writeFile(temporaryInput, input);

  try {
    const { stdout } = await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error', '-ss', '00:00:01',
        '-i', temporaryInput, '-frames:v', '1',
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',
        '-f', 'image2pipe', '-vcodec', 'webp', 'pipe:1',
      ],
      { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }
    );

    const poster = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
    if (poster.length === 0) throw new Error('FFmpeg produced no poster frame');
    return poster;
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stderr?: Buffer | string };
    const message = cause.stderr?.toString().trim() || cause.message || 'FFmpeg failed';
    throw new Error(`Video poster extraction failed: ${message}`);
  } finally {
    await rm(temporaryInput, { force: true });
  }
}
