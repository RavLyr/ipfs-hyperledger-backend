import { AppError } from '../../errors/AppError';
import type { FabricTransactionMode } from './fabric.types';

export type InvokeFabricBody = {
  readonly functionName: string;
  readonly args?: readonly string[];
  readonly mode?: FabricTransactionMode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown): item is string => typeof item === 'string');
}

function isFabricTransactionMode(value: unknown): value is FabricTransactionMode {
  return value === 'evaluate' || value === 'submit';
}

export function isInvokeFabricBody(value: unknown): value is InvokeFabricBody {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.functionName)) {
    return false;
  }

  if (value.args !== undefined && !isStringArray(value.args)) {
    return false;
  }

  return value.mode === undefined || isFabricTransactionMode(value.mode);
}

export function parseInvokeFabricBody(value: unknown): InvokeFabricBody {
  if (!isInvokeFabricBody(value)) {
    throw new AppError('Validation failed', 400, {
      body: {
        functionName: 'Required non-empty string',
        args: 'Optional array of strings',
        mode: 'Optional value: evaluate or submit'
      }
    });
  }

  return {
    functionName: value.functionName.trim(),
    args: value.args ?? [],
    mode: value.mode ?? 'submit'
  };
}
