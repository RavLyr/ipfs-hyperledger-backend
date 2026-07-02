import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/AppError';
import { sha256Hex } from '../../utils/hash';

export type RegisterIssuerInput = {
  readonly issuerId: string;
  readonly organizationName: string;
  readonly departmentName: string;
  readonly mspId: string;
};

export type IssueCertificateInput = {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly studentIdHash: string;
  readonly issuerId: string;
  readonly certificateType: string;
  readonly title: string;
  readonly ipfsCid: string;
  readonly issuedAt: string;
  readonly expiredAt: string;
};

export type VerifyCertificateInput = {
  readonly certificateId: string;
  readonly ipfsCid: string;
};

export type RevokeCertificateInput = {
  readonly certificateId: string;
  readonly reasonHash: string;
  readonly revokedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredString(source: Record<string, unknown>, field: string): string {
  const value = readNonEmptyString(source, field);

  if (!value) {
    throw validationError({ body: { [field]: 'Required non-empty string' } });
  }

  return value;
}

function readHashedValue(source: Record<string, unknown>, hashField: string, rawField: string): string | undefined {
  const hash = readNonEmptyString(source, hashField);

  if (hash) {
    return hash;
  }

  const rawValue = readNonEmptyString(source, rawField);

  return rawValue ? sha256Hex(rawValue) : undefined;
}

function validationError(details: unknown): AppError {
  return new AppError('Validation failed', 400, details);
}

function parseIdParam(params: unknown, field: string): string {
  if (!isRecord(params)) {
    throw validationError({ params: { [field]: 'Required non-empty string' } });
  }

  const value = readNonEmptyString(params, field);

  if (!value) {
    throw validationError({ params: { [field]: 'Required non-empty string' } });
  }

  return value;
}

export function parseIssuerIdParams(params: unknown): string {
  return parseIdParam(params, 'issuerId');
}

export function parseCertificateIdParams(params: unknown): string {
  return parseIdParam(params, 'certificateId');
}

export function parseRegisterIssuerBody(body: unknown): RegisterIssuerInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  return {
    issuerId: readRequiredString(body, 'issuerId'),
    organizationName: readRequiredString(body, 'organizationName'),
    departmentName: readRequiredString(body, 'departmentName'),
    mspId: readRequiredString(body, 'mspId')
  };
}

export function parseIssueCertificateBody(body: unknown): IssueCertificateInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const studentIdHash = readHashedValue(body, 'studentIdHash', 'studentId');

  if (!studentIdHash) {
    throw validationError({
      body: {
        studentIdHash: 'Required non-empty string, or provide studentId so backend can hash it',
      }
    });
  }

  return {
    certificateId: readNonEmptyString(body, 'certificateId') ?? randomUUID(),
    certificateNumber: readRequiredString(body, 'certificateNumber'),
    studentIdHash,
    issuerId: readRequiredString(body, 'issuerId'),
    certificateType: readRequiredString(body, 'certificateType'),
    title: readRequiredString(body, 'degreeTitle'),
    ipfsCid: readRequiredString(body, 'ipfsCid'),
    issuedAt: readRequiredString(body, 'issuedAt'),
    expiredAt: readNonEmptyString(body, 'expiredAt') ?? ''
  };
}

export function parseVerifyCertificateBody(params: unknown, body: unknown): VerifyCertificateInput {
  const certificateId = parseCertificateIdParams(params);
  const source = isRecord(body) ? body : {};
  const ipfsCid = readNonEmptyString(source, 'ipfsCid') ?? '';

  return { certificateId, ipfsCid };
}

export function parseRevokeCertificateBody(params: unknown, body: unknown): RevokeCertificateInput {
  const certificateId = parseCertificateIdParams(params);

  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const reasonHash = readHashedValue(body, 'reasonHash', 'reason');

  if (!reasonHash) {
    throw validationError({
      body: {
        reasonHash: 'Required non-empty string, or provide reason so backend can hash it'
      }
    });
  }

  return {
    certificateId,
    reasonHash,
    revokedAt: readNonEmptyString(body, 'revokedAt') ?? new Date().toISOString()
  };
}

export type CertificateStatus = "VALID" | "REVOKED";

export interface Certificate {
  id: number;
  certificateId: string;
  certificateNumber: string;
  issuerId: string;
  certificateType: string;
  degreeTitle: string;
  studentId: string;
  studentName: string;
  organizationName: string;

  studyProgram: string;
  educationLevel: string;
  graduationDate: string | null;

  ipfsCid: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  ledger_tx_id: string;
  status: CertificateStatus;
  issuedAt: string;
  created_at: string;
  updated_at: string;
}

export interface CertificateTextInput {
  certificateId: string;
  certificateNumber: string;
  issuerId: string;
  organizationName: string;
  departmentName: string;
  mspId: string;
  certificateType: string;
  degreeTitle: string;
  studentId: string;
  studentName: string;

  studyProgram: string;
  educationLevel: string;
  graduationDate: string;
  issuedAt: string;
}

export interface CreateCertificateInput extends CertificateTextInput {

  ipfsCid: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  ledger_tx_id: string;
  status: CertificateStatus;
}
export type RegisterInput = {
  readonly issuerId: string;
  readonly organizationName: string;
  readonly departmentName: string;
  readonly mspId: string;
  readonly username: string;
  readonly email: string;
  readonly passwordRaw: string;
};

export function parseRegisterBody(body: unknown): RegisterInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }
  return {
    issuerId: readRequiredString(body, 'issuerId'),
    organizationName: readRequiredString(body, 'organizationName'),
    departmentName: readRequiredString(body, 'departmentName'),
    mspId: readRequiredString(body, 'mspId'),
    username: readRequiredString(body, 'username'),
    email: readRequiredString(body, 'email'),
    passwordRaw: readRequiredString(body, 'password'),
  };
}

export type LoginInput = {
  readonly identifier: string;
  readonly password: string;
};

export function parseLoginBody(body: unknown): LoginInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }
  return {
    identifier: readRequiredString(body, 'identifier'),
    password: readRequiredString(body, 'password'),
  };
}
