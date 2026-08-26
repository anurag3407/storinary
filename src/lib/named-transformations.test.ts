import { describe, expect, it } from 'vitest';
import { parseNamedTransformation, validateNamedTransformationParams } from './named-transformations';

describe('named transformations', () => {
  it('normalizes names and serializes allowed parameters', () => {
    const parsed = parseNamedTransformation({
      name: 'Hero Card',
      params: { w: '640', h: '360', fit: 'cover', bogus: 'x' },
      active: false,
    });

    expect(parsed).toEqual({
      name: 'hero_card',
      params: 'w=640&h=360&fit=cover',
      active: false,
    });
    expect(validateNamedTransformationParams(parsed.params)).toBe(true);
  });

  it('rejects invalid names and empty transforms', () => {
    expect(() => parseNamedTransformation({ name: '   ', params: { w: '10' } })).toThrow();
    expect(() => parseNamedTransformation({ name: 'valid', params: { bogus: 'x' } })).toThrow();
  });

  it('requires a resulting transformation', () => {
    expect(validateNamedTransformationParams('bogus=yes')).toBe(false);
    expect(validateNamedTransformationParams('w=100')).toBe(true);
  });

  it('supports tonal named transforms', () => {
    const parsed = parseNamedTransformation({
      name: 'Punchy',
      params: { brightness: '1.25', contrast: '1.35', gamma: '1.1', bogus: 'x' },
    });

    expect(parsed.params).toBe('brightness=1.25&contrast=1.35&gamma=1.1');
    expect(validateNamedTransformationParams(parsed.params)).toBe(true);
  });

  it('allows reusable text overlays', () => {
    const parsed = parseNamedTransformation({
      name: 'watermarked',
      params: { w: '640', text: 'Sample', bogus: 'x' },
    });

    expect(parsed.params).toBe('w=640&text=Sample');
    expect(validateNamedTransformationParams(parsed.params)).toBe(true);
  });
});
