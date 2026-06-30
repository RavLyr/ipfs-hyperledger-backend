import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/AppError';

export type RegisterIssuerInput = {
  readonly issuer: string;
  readonly universityName: string;
  readonly faculty: string;
};

export type IssueCertificateInput = {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly studentName: string;
  readonly studentId: string;
  readonly graduationDate: string;
  readonly studyProgram: string;
  readonly faculty: string;
  readonly degreeLevel: string;
  readonly degreeName: string;
  readonly degreeAbbreviation: string;
  readonly universityName: string;
  readonly universityAccreditationNumber: string;
  readonly programAccreditationAgency: string;
  readonly programAccreditationNumber: string;
  readonly issueDate: string;
  readonly deanName: string;
  readonly rectorName: string;
  readonly issuer: string;
  readonly ipfsCid: string;
};

export type UploadCertificateInput = Omit<IssueCertificateInput, 'ipfsCid'>;

export type VerifyCertificateInput = {
  readonly certificateId: string;
  readonly ipfsCid: string;
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

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

function readRequiredDate(source: Record<string, unknown>, field: string): string {
  const value = readRequiredString(source, field);

  if (!isValidDateOnly(value)) {
    throw validationError({ body: { [field]: 'Expected YYYY-MM-DD format' } });
  }

  return value;
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

export function parseIssuerParams(params: unknown): string {
  return parseIdParam(params, 'issuer');
}

export function parseCertificateIdParams(params: unknown): string {
  return parseIdParam(params, 'certificateId');
}

export function parseRegisterIssuerBody(body: unknown): RegisterIssuerInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  return {
    issuer: readRequiredString(body, 'issuer'),
    universityName: readRequiredString(body, 'universityName'),
    faculty: readRequiredString(body, 'faculty')
  };
}

export function parseIssueCertificateBody(body: unknown): IssueCertificateInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  return {
    certificateId: readNonEmptyString(body, 'certificateId') ?? randomUUID(),
    certificateNumber: readRequiredString(body, 'certificateNumber'),
    studentName: readRequiredString(body, 'studentName'),
    studentId: readRequiredString(body, 'studentId'),
    graduationDate: readRequiredDate(body, 'graduationDate'),
    studyProgram: readRequiredString(body, 'studyProgram'),
    faculty: readRequiredString(body, 'faculty'),
    degreeLevel: readRequiredString(body, 'degreeLevel'),
    degreeName: readRequiredString(body, 'degreeName'),
    degreeAbbreviation: readRequiredString(body, 'degreeAbbreviation'),
    universityName: readRequiredString(body, 'universityName'),
    universityAccreditationNumber: readRequiredString(body, 'universityAccreditationNumber'),
    programAccreditationAgency: readRequiredString(body, 'programAccreditationAgency'),
    programAccreditationNumber: readRequiredString(body, 'programAccreditationNumber'),
    issueDate: readRequiredDate(body, 'issueDate'),
    deanName: readRequiredString(body, 'deanName'),
    rectorName: readRequiredString(body, 'rectorName'),
    issuer: readRequiredString(body, 'issuer'),
    ipfsCid: readRequiredString(body, 'ipfsCid')
  };
}

export function parseUploadCertificateBody(body: unknown): UploadCertificateInput {
  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  return {
    certificateId: readNonEmptyString(body, 'certificateId') ?? randomUUID(),
    certificateNumber: readRequiredString(body, 'certificateNumber'),
    studentName: readRequiredString(body, 'studentName'),
    studentId: readRequiredString(body, 'studentId'),
    graduationDate: readRequiredDate(body, 'graduationDate'),
    studyProgram: readRequiredString(body, 'studyProgram'),
    faculty: readRequiredString(body, 'faculty'),
    degreeLevel: readRequiredString(body, 'degreeLevel'),
    degreeName: readRequiredString(body, 'degreeName'),
    degreeAbbreviation: readRequiredString(body, 'degreeAbbreviation'),
    universityName: readRequiredString(body, 'universityName'),
    universityAccreditationNumber: readRequiredString(body, 'universityAccreditationNumber'),
    programAccreditationAgency: readRequiredString(body, 'programAccreditationAgency'),
    programAccreditationNumber: readRequiredString(body, 'programAccreditationNumber'),
    issueDate: readRequiredDate(body, 'issueDate'),
    deanName: readRequiredString(body, 'deanName'),
    rectorName: readRequiredString(body, 'rectorName'),
    issuer: readRequiredString(body, 'issuer')
  };
}

export function parseVerifyCertificateBody(params: unknown, body: unknown): VerifyCertificateInput {
  const certificateId = parseCertificateIdParams(params);

  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const ipfsCid = readRequiredString(body, 'ipfsCid');

  return { certificateId, ipfsCid };
}

export function parseRevokeCertificateBody(params: unknown, body: unknown): RevokeCertificateInput {
  const certificateId = parseCertificateIdParams(params);

  if (!isRecord(body)) {
    throw validationError({ body: 'Expected object' });
  }

  const reasonHash = readRequiredString(body, 'reasonHash');

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

  const reasonHash = readRequiredString(body, 'reasonHash');

  return {
    oldCertificateId,
    newCertificateId: readNonEmptyString(body, 'newCertificateId') ?? randomUUID(),
    newCertificateNumber: readRequiredString(body, 'newCertificateNumber'),
    newIpfsCid: readRequiredString(body, 'newIpfsCid'),
    reasonHash,
    reissuedAt: readNonEmptyString(body, 'reissuedAt') ?? new Date().toISOString()
  };
}

export type CertificateStatus = 'VALID' | 'REVOKED';

export interface Certificate {
  id: string;
  certificateId: string;
  certificateNumber: string;
  studentName: string;
  studentId: string;
  graduationDate: string;
  studyProgram: string;
  faculty: string;
  degreeLevel: string;
  degreeName: string;
  degreeAbbreviation: string;
  universityName: string;
  universityAccreditationNumber: string;
  programAccreditationAgency: string;
  programAccreditationNumber: string;
  issueDate: string;
  deanName: string;
  rectorName: string;
  fileName: string;
  ipfsCid: string;
  ledgerTxId: string | null;
  issuer: string;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCertificateInput extends UploadCertificateInput {
  fileName: string;
  ipfsCid: string;
  ledgerTxId: string | null;
  status: CertificateStatus;
}
