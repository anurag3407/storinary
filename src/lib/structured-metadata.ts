export const METADATA_FIELD_TYPES = ['string', 'integer', 'boolean', 'enum'] as const;

export type MetadataFieldType = (typeof METADATA_FIELD_TYPES)[number];

export type MetadataFieldRecord = {
  id: string;
  externalId: string;
  label: string;
  type: MetadataFieldType;
  required: boolean;
  allowedValues: string[];
  active: boolean;
};

type MetadataFieldInput = {
  externalId?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  allowedValues?: unknown;
  active?: unknown;
};

function text(value: unknown, maxLength: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function parseMetadataField(input: MetadataFieldInput) {
  const externalId = text(input.externalId, 64)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const label = text(input.label, 120);
  const type = typeof input.type === 'string' ? input.type : '';

  if (!externalId) throw new Error('A metadata field external ID is required');
  if (!label) throw new Error('A metadata field label is required');
  if (!METADATA_FIELD_TYPES.includes(type as MetadataFieldType)) {
    throw new Error(`Metadata field type must be one of: ${METADATA_FIELD_TYPES.join(', ')}`);
  }

  let allowedValues = '';
  if (type === 'enum') {
    const values = Array.isArray(input.allowedValues)
      ? input.allowedValues.flatMap((value) =>
          Array.isArray(value) ? value : [value]
        )
      : String(input.allowedValues ?? '').split(',');
    allowedValues = [...new Set(
      values
        .map((value) => text(value, 120))
        .filter(Boolean),
    )].join('|');
    if (!allowedValues) throw new Error('Enum fields require at least one allowed value');
  }

  return {
    externalId,
    label,
    type,
    required: input.required === true,
    allowedValues,
    active: input.active !== false,
  };
}

export function serializeMetadataField(field: {
  id?: string;
  externalId: string;
  label: string;
  type: string;
  required: boolean;
  allowedValues: string;
  active: boolean;
}) {
  return {
    ...(field.id !== undefined ? { id: field.id } : {}),
    externalId: field.externalId,
    label: field.label,
    type: field.type,
    required: field.required,
    allowedValues: field.allowedValues ? field.allowedValues.split('|') : [],
    active: field.active,
  };
}

export function validateMetadataValue(
  field: { type: string; required: boolean; allowedValues: string },
  value: unknown
) {
  if (value === null || value === undefined || value === '') {
    if (field.required) throw new Error(`Metadata field ${field.type} is required`);
    return '';
  }

  switch (field.type) {
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error('Boolean metadata must be true or false');
      return String(value);
    case 'integer': {
      const parsed = typeof value === 'number'
        ? value
        : Number.parseInt(String(value), 10);
      if (!Number.isInteger(parsed)) throw new Error('Integer metadata must be a whole number');
      return String(Math.max(-2_147_483_648, Math.min(2_147_483_647, parsed)));
    }
    default:
      break;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Metadata value must be text');
  }
  const normalized = String(value).trim().replace(/\s+/g, ' ').slice(0, 1000);
  if (!normalized && field.required) throw new Error('Required metadata cannot be empty');
  if (field.type === 'enum') {
    const allowed = field.allowedValues.split('|');
    if (!allowed.includes(normalized)) throw new Error('Metadata value is not in the allowed list');
  }
  return normalized;
}

export function serializeMetadata(values: Array<{
  field: { externalId: string };
  value: string;
}>) {
  return Object.fromEntries(values.map((entry) => [entry.field.externalId, entry.value]));
}
