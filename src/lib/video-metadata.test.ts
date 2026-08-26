// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getVideoMetadata } from './video-metadata';
import * as videoRenditions from './video-renditions';

function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function fullBox(type: string, versionAndFlags: Buffer, payload: Buffer): Buffer {
  return box(type, Buffer.concat([versionAndFlags, payload]));
}

function videoTrackBox(): Buffer {
  const hdlr = fullBox(
    'hdlr',
    Buffer.alloc(4),
    Buffer.concat([Buffer.alloc(4), Buffer.from('vide'), Buffer.alloc(12)])
  );
  const avc1Body = Buffer.concat([
    Buffer.alloc(6),
    Buffer.from([0, 1]),
      Buffer.alloc(16),
    Buffer.from([0, 2]),
    Buffer.from([0, 3]),
      Buffer.alloc(14),
    Buffer.alloc(78 - 40),
  ]);
  const visualSample = fullBox('avc1', Buffer.alloc(6), avc1Body);
  const stsd = fullBox('stsd', Buffer.alloc(4), Buffer.concat([Buffer.from([0,0,0,1]), visualSample]));
  const stbl = box('stbl', stsd);
  const minf = box('minf', stbl);
  const mdia = box('mdia', Buffer.concat([hdlr, minf]));
  return box('trak', mdia);
}

describe('video metadata', () => {
  it('parses MP4 movie header duration', async () => {
    const versionAndFlags = Buffer.alloc(4);
    const creationTime = Buffer.alloc(4);
    const modificationTime = Buffer.alloc(4);
    const timescale = Buffer.alloc(4);
    timescale.writeUInt32BE(1000);
    const duration = Buffer.alloc(4);
    duration.writeUInt32BE(4500);
    const mvhdBox = box('mvhd', Buffer.concat([
      versionAndFlags,
      creationTime,
      modificationTime,
      timescale,
      duration,
      Buffer.alloc(78),
    ]));
    const mvhdPayload = mvhdBox.subarray(8);
    const moovBox = box('moov', box('mvhd', mvhdPayload));
    const buffer = Buffer.concat([box('ftyp', Buffer.from('isom')), moovBox]);

    await expect(getVideoMetadata(buffer, 'video/mp4')).resolves.toMatchObject({
      duration: 4.5,
      format: 'mp4',
    });
  });

  it('rejects unsupported containers', async () => {
    await expect(getVideoMetadata(Buffer.from('x'), 'video/x-msvideo')).rejects.toThrow(
      /Unsupported video container/
    );
  });

  it('rejects truncated MP4 metadata', async () => {
    await expect(getVideoMetadata(Buffer.from('not mp4'), 'video/mp4')).rejects.toThrow(
      'Unable to read MP4 metadata'
    );
  });

  it('parses MP4 track dimensions', async () => {
    const mvhdPayload = Buffer.concat([
      Buffer.alloc(12),
      Buffer.from([0, 0, 3, 232]),
      Buffer.from([0, 0, 17, 148]),
      Buffer.alloc(76),
    ]);
    const buffer = Buffer.concat([
      box('ftyp', Buffer.from('isom')),
      box('moov', Buffer.concat([box('mvhd', mvhdPayload), videoTrackBox()])),
    ]);

    await expect(getVideoMetadata(buffer, 'video/mp4')).resolves.toMatchObject({
      width: 2,
      height: 3,
      duration: 4.5,
    });
  });

  it('extracts WebM metadata with FFprobe', async () => {
    vi.spyOn(videoRenditions, 'getVideoMetadataWithFfprobe').mockResolvedValue({
      width: 640,
      height: 360,
      duration: 2.5,
    });

    await expect(getVideoMetadata(Buffer.from('webm'), 'video/webm')).resolves.toEqual({
      width: 640,
      height: 360,
      duration: 2.5,
      format: 'webm',
    });
  });
});
