export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  format: string;
}

interface Mp4SampleEntry {
  width: number;
  height: number;
}

function readUint32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

function boxSize(buffer: Buffer, offset: number): number {
  const size = readUint32(buffer, offset);
  if (size === 1 && offset + 16 <= buffer.length) {
    const largeSize = buffer.readBigUInt64BE(offset + 8);
    return largeSize > BigInt(Number.MAX_SAFE_INTEGER) ? 0 : Number(largeSize);
  }
  return size;
}

function findBox(buffer: Buffer, type: string, start = 0, end = buffer.length): number {
  let offset = start;
  while (offset + 8 <= end) {
    const size = boxSize(buffer, offset);
    const currentType = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    if (size < 8 || offset + size > end) return -1;
    if (currentType === type) return offset;
    offset += size;
  }
  return -1;
}

function parseMp4Duration(buffer: Buffer): number {
  const moovOffset = findBox(buffer, 'moov');
  if (moovOffset < 0) return 0;
  const moovSize = boxSize(buffer, moovOffset);
  let offset = moovOffset + 8;
  let guard = 0;
  let mvhdOffset = -1;
  const moovEnd = moovOffset + moovSize;
  while (offset + 8 <= moovEnd) {
    if (buffer.subarray(offset + 4, offset + 8).toString('latin1') === 'mvhd') {
      mvhdOffset = offset;
      break;
    }
    const childSize = boxSize(buffer, offset);
    if (childSize < 8) return 0;
    offset += childSize;
    guard += 1;
    if (guard > 1000) return 0;
  }
  if (mvhdOffset < 0) return 0;

  const version = buffer[mvhdOffset + 8];
  const timescale = version === 1 ? readUint32(buffer, mvhdOffset + 36) : readUint32(buffer, mvhdOffset + 20);
  const duration = version === 1
    ? Number(buffer.readBigUInt64BE(mvhdOffset + 24))
    : readUint32(buffer, mvhdOffset + 24);
  return timescale > 0 ? duration / timescale : 0;
}

export async function getVideoMetadata(
  buffer: Buffer,
  mimeType: string
): Promise<VideoMetadata> {
  const format = mimeType.includes('webm')
    ? 'webm'
    : mimeType.includes('mp4') || mimeType.includes('quicktime')
      ? 'mp4'
      : 'unknown';

  if (!['mp4', 'webm'].includes(format)) {
    throw new Error(`Unsupported video container: ${mimeType || 'unknown'} (MP4 or WebM required)`);
  }

  if (format === 'mp4') {
    const duration = parseMp4Duration(buffer);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Unable to read MP4 metadata');
    }
    const dimensions = parseMp4Dimensions(buffer);
    return { width: dimensions.width, height: dimensions.height, duration, format };
  }

  throw new Error('WebM metadata extraction is not supported yet');
}

function parseMp4Dimensions(buffer: Buffer): Mp4SampleEntry {
  const moovOffset = findBox(buffer, 'moov');
  if (moovOffset < 0) return { width: 0, height: 0 };

  const moovEnd = moovOffset + boxSize(buffer, moovOffset);
  let offset = moovOffset + 8;
  while (offset + 8 <= moovEnd) {
    if (buffer.subarray(offset + 4, offset + 8).toString('latin1') === 'trak') {
      const dimensions = findVideoTrackDimensions(buffer, offset + 8, offset + boxSize(buffer, offset));
      if (dimensions) return dimensions;
    }
    const size = boxSize(buffer, offset);
    if (size < 8) break;
    offset += size;
  }
  return { width: 0, height: 0 };
}

function findVideoTrackDimensions(buffer: Buffer, start: number, end: number): Mp4SampleEntry | null {
  let offset = start;
  while (offset + 8 <= end) {
    if (buffer.subarray(offset + 4, offset + 8).toString('latin1') === 'mdia') {
      const mdiaStart = offset + 8;
      const mdiaEnd = offset + boxSize(buffer, offset);
      const hdlrOffset = findBox(buffer, 'hdlr', mdiaStart, mdiaEnd);
      if (hdlrOffset >= 0 && buffer.subarray(hdlrOffset + 16, hdlrOffset + 20).toString('latin1') === 'vide') {
        const stsdOffset = findBox(buffer, 'stsd', mdiaStart, mdiaEnd);
        if (stsdOffset >= 0) {
          const widthOffset = stsdOffset + 8 + 78;
          const heightOffset = widthOffset + 2;
          if (heightOffset + 2 <= end) {
            return { width: buffer.readUInt16BE(widthOffset), height: buffer.readUInt16BE(heightOffset) };
          }
        }
      }
    }
    const size = boxSize(buffer, offset);
    if (size < 8) break;
    offset += size;
  }
  return null;
}
