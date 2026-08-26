import { describe, expect, it } from 'vitest';
import {
  parseMetadataField,
  serializeMetadataField,
  validateMetadataValue,
} from './structured-metadata';

describe('structured metadata', () => {
  it('normalizes field definitions and enum values', () => {
    const parsed = parseMetadataField({
      externalId: ' Campaign Code ',
      label: '  Campaign   Code  ',
      type: 'enum',
      allowedValues: ['Spring ', '', 'spring', 'Fall', 42] as unknown as string[],
      required: true,
    });

    expect(parsed).toEqual({
      externalId: 'campaign_code',
      label: 'Campaign Code',
      type: 'enum',
      required: true,
      allowedValues: 'Spring|spring|Fall|42',
      active: true,
    });
    expect(serializeMetadataField(parsed).allowedValues).toEqual([
      'Spring', 'spring', 'Fall', '42',
    ]);
  });

  it('validates typed values and required fields', () => {
    const integerField = { type: 'integer', required: false, allowedValues: '' };
    const booleanField = { type: 'boolean', required: true, allowedValues: '' };
    const enumField = { type: 'enum', required: false, allowedValues: 'spring|fall' };

    expect(validateMetadataValue(integerField, 4.0)).toBe('4');
    expect(validateMetadataValue(booleanField, false)).toBe('false');
    expect(validateMetadataValue(enumField, 'spring')).toBe('spring');
    expect(() => validateMetadataValue(integerField, 1.5)).toThrow('whole number');
    expect(() => validateMetadataValue(booleanField, null)).toThrow('required');
    expect(() => validateMetadataValue(enumField, 'summer')).toThrow('allowed list');
  });
});
