import { AppError } from '../../errors/AppError';

export type CreateAssetInput = {
  readonly id: string;
  readonly color: string;
  readonly size: number;
  readonly owner: string;
  readonly appraisedValue: number;
};

export type UpdateAssetInput = Omit<CreateAssetInput, 'id'>;

export type TransferAssetInput = {
  readonly newOwner: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNonNegativeInteger(source: Record<string, unknown>, field: string): number | undefined {
  const value = source[field];
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function validationError(details: unknown): AppError {
  return new AppError('Validation failed', 400, details);
}

export function parseAssetIdParams(params: unknown): string {
  if (!isRecord(params)) {
    throw validationError({ params: { id: 'Required non-empty string' } });
  }

  const id = readNonEmptyString(params, 'id');

  if (!id) {
    throw validationError({ params: { id: 'Required non-empty string' } });
  }

  return id;
}

export function parseCreateAssetBody(body: unknown): CreateAssetInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const id = readNonEmptyString(body, 'id');
  const color = readNonEmptyString(body, 'color');
  const size = readNonNegativeInteger(body, 'size');
  const owner = readNonEmptyString(body, 'owner');
  const appraisedValue = readNonNegativeInteger(body, 'appraisedValue');

  if (!id || !color || size === undefined || !owner || appraisedValue === undefined) {
    throw validationError({
      body: {
        id: 'Required non-empty string',
        color: 'Required non-empty string',
        size: 'Required non-negative integer',
        owner: 'Required non-empty string',
        appraisedValue: 'Required non-negative integer'
      }
    });
  }

  return {
    id,
    color,
    size,
    owner,
    appraisedValue
  };
}

export function parseUpdateAssetBody(body: unknown): UpdateAssetInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const color = readNonEmptyString(body, 'color');
  const size = readNonNegativeInteger(body, 'size');
  const owner = readNonEmptyString(body, 'owner');
  const appraisedValue = readNonNegativeInteger(body, 'appraisedValue');

  if (!color || size === undefined || !owner || appraisedValue === undefined) {
    throw validationError({
      body: {
        color: 'Required non-empty string',
        size: 'Required non-negative integer',
        owner: 'Required non-empty string',
        appraisedValue: 'Required non-negative integer'
      }
    });
  }

  return {
    color,
    size,
    owner,
    appraisedValue
  };
}

export function parseTransferAssetBody(body: unknown): TransferAssetInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const newOwner = readNonEmptyString(body, 'newOwner');

  if (!newOwner) {
    throw validationError({
      body: {
        newOwner: 'Required non-empty string'
      }
    });
  }

  return { newOwner };
}
