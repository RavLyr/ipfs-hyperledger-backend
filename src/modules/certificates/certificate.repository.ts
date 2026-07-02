import type { Certificate as PrismaCertificate } from '@prisma/client';

import { prisma } from '../../config/prisma';
import type { Certificate, CreateCertificateInput } from './certificate.dto';

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

function mapCertificate(row: PrismaCertificate): Certificate {
  return {
    id: row.id,
    certificateId: row.certificateId,
    certificateNumber: row.certificateNumber,
    issuerId: row.issuerId,
    certificateType: row.certificateType,
    degreeTitle: row.degreeTitle,
    studentId: row.studentId,
    studentName: row.studentName,
    organizationName: row.organizationName,
    studyProgram: row.studyProgram,
    educationLevel: row.educationLevel,
    graduationDate: row.graduationDate ? formatDateOnly(row.graduationDate) : null,

    ipfsCid: row.ipfsCid,
    file_name: row.fileName,
    mime_type: row.mimeType,
    file_size: row.fileSize === null ? null : Number(row.fileSize),
    ledger_tx_id: row.ledgerTxId,
    status: row.status,
    issuedAt: formatDateTime(row.issuedAt),
    created_at: formatDateTime(row.createdAt),
    updated_at: formatDateTime(row.updatedAt),
  };
}

export async function insertCertificate(
  data: CreateCertificateInput
): Promise<Certificate> {
  const issuer = await prisma.issuer.upsert({
    where: { issuerId: data.issuerId },
    update: {},
    create: {
      issuerId: data.issuerId,
      organizationName: data.organizationName,
      departmentName: data.departmentName,
      mspId: data.mspId,
      username: `issuer_${Date.now()}`,
      email: `issuer_${Date.now()}@example.com`,
      passwordHash: '$2b$10$7EqJtq98hPqEX7fNZaFWoOHiJqP3rYpN96CB2A6qsYqS2Q6D6nM4K',
    },
  });

  const certificate = await prisma.certificate.create({
    data: {
      certificateId: data.certificateId,
      certificateNumber: data.certificateNumber,
      issuerId: issuer.issuerId,
      certificateType: data.certificateType,
      degreeTitle: data.degreeTitle,
      studentId: data.studentId,
      studentName: data.studentName,
      organizationName: data.organizationName,
      studyProgram: data.studyProgram,
      educationLevel: data.educationLevel,
      graduationDate: data.graduationDate ? toDate(data.graduationDate) : null,

      ipfsCid: data.ipfsCid,
      fileName: data.file_name,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      ledgerTxId: data.ledger_tx_id,
      status: data.status,
      issuedAt: toDate(data.issuedAt)
    },
  });

  return mapCertificate(certificate);
}

export async function findCertificateByCertificateNumber(
  certificateNumber: string
): Promise<Certificate | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber },
  });

  return certificate ? mapCertificate(certificate) : null;
}

export async function findCertificateById(
  certificateId: string
): Promise<Certificate | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateId },
  });

  return certificate ? mapCertificate(certificate) : null;
}

export async function findAllCertificates(issuerId?: string): Promise<Certificate[]> {
  const where = issuerId ? { issuerId } : {};
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return certificates.map(mapCertificate);
}

export async function updateCertificateStatus(
  certificateId: string,
  status: 'VALID' | 'REVOKED'
): Promise<Certificate> {
  const certificate = await prisma.certificate.update({
    where: { certificateId },
    data: { status },
  });
  return mapCertificate(certificate);
}

export async function insertRevocation(data: {
  revocationId: string;
  certificateId: string;
  issuerId: string;
  reasonHash: string;
  ledgerTxId: string;
  revokedAt: string;
}) {
  return prisma.revocation.create({
    data: {
      revocationId: data.revocationId,
      certificateId: data.certificateId,
      issuerId: data.issuerId,
      reasonHash: data.reasonHash,
      ledgerTxId: data.ledgerTxId,
      revokedAt: new Date(data.revokedAt),
    }
  });
}

export interface AuthenticatedIssuer {
  readonly issuerId: string;
  readonly organizationName: string;
  readonly departmentName: string;
  readonly mspId: string;
  readonly username: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

function mapAuthenticatedIssuer(row: any): AuthenticatedIssuer {
  return {
    issuerId: row.issuerId,
    organizationName: row.organizationName,
    departmentName: row.departmentName,
    mspId: row.mspId,
    username: row.username,
    email: row.email,
    passwordHash: row.passwordHash,
    isActive: row.isActive,
    status: row.status as 'ACTIVE' | 'INACTIVE',
  };
}

export async function findIssuerByIssuerId(issuerId: string): Promise<AuthenticatedIssuer | null> {
  const issuer = await prisma.issuer.findUnique({
    where: { issuerId },
  });

  return issuer ? mapAuthenticatedIssuer(issuer) : null;
}

export async function findIssuerByIdentifier(identifier: string): Promise<AuthenticatedIssuer | null> {
  const issuer = await prisma.issuer.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier }
      ]
    },
  });

  return issuer ? mapAuthenticatedIssuer(issuer) : null;
}

export async function updateIssuerLastLogin(issuerId: string, lastLoginAt: Date): Promise<void> {
  await prisma.issuer.update({
    where: { issuerId },
    data: { lastLoginAt },
  });
}
