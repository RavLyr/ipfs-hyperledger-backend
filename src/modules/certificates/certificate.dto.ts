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
  readonly documentHash: string;
  readonly ipfsCid: string;
  readonly issuedAt: string;
  readonly expiredAt: string;
};

export type VerifyCertificateInput = {
  readonly certificateId: string;
  readonly documentHash: string;
};

export type RevokeCertificateInput = {
  readonly certificateId: string;
  readonly reasonHash: string;
  readonly revokedAt: string;
};

export type ReissueCertificateInput = {
  readonly oldCertificateId: string;
  readonly newCertificateId: string;
  readonly newCertificateNumber: string;
  readonly newDocumentHash: string;
  readonly newIpfsCid: string;
  readonly reasonHash: string;
  readonly reissuedAt: string;
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

function readDocumentHash(source: Record<string, unknown>, hashField: string, base64Field: string): string | undefined {
  const hash = readNonEmptyString(source, hashField);

  if (hash) {
    return hash;
  }

  const documentBase64 = readNonEmptyString(source, base64Field);

  return documentBase64 ? sha256Hex(Buffer.from(documentBase64, 'base64')) : undefined;
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
  const documentHash = readDocumentHash(body, 'documentHash', 'documentBase64');

  if (!studentIdHash || !documentHash) {
    throw validationError({
      body: {
        studentIdHash: 'Required non-empty string, or provide studentId so backend can hash it',
        documentHash: 'Required non-empty string, or provide documentBase64 so backend can hash it'
      }
    });
  }

  return {
    certificateId: readNonEmptyString(body, 'certificateId') ?? randomUUID(),
    certificateNumber: readRequiredString(body, 'certificateNumber'),
    studentIdHash,
    issuerId: readRequiredString(body, 'issuerId'),
    certificateType: readRequiredString(body, 'certificateType'),
    title: readRequiredString(body, 'title'),
    documentHash,
    ipfsCid: readRequiredString(body, 'ipfsCid'),
    issuedAt: readRequiredString(body, 'issuedAt'),
    expiredAt: readNonEmptyString(body, 'expiredAt') ?? ''
  };
}

export function parseVerifyCertificateBody(params: unknown, body: unknown): VerifyCertificateInput {
  const certificateId = parseCertificateIdParams(params);
  const source = isRecord(body) ? body : {};
  const documentHash = readDocumentHash(source, 'documentHash', 'documentBase64') ?? '';

  return { certificateId, documentHash };
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

export function parseReissueCertificateBody(params: unknown, body: unknown): ReissueCertificateInput {
  const oldCertificateId = parseCertificateIdParams(params);

  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const newDocumentHash = readDocumentHash(body, 'newDocumentHash', 'newDocumentBase64');
  const reasonHash = readHashedValue(body, 'reasonHash', 'reason');

  if (!newDocumentHash || !reasonHash) {
    throw validationError({
      body: {
        newDocumentHash: 'Required non-empty string, or provide newDocumentBase64 so backend can hash it',
        reasonHash: 'Required non-empty string, or provide reason so backend can hash it'
      }
    });
  }

  return {
    oldCertificateId,
    newCertificateId: readNonEmptyString(body, 'newCertificateId') ?? randomUUID(),
    newCertificateNumber: readRequiredString(body, 'newCertificateNumber'),
    newDocumentHash,
    newIpfsCid: readRequiredString(body, 'newIpfsCid'),
    reasonHash,
    reissuedAt: readNonEmptyString(body, 'reissuedAt') ?? new Date().toISOString()
  };
}
