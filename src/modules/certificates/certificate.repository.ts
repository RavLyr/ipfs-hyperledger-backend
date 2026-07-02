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

export async function markCertificateRevoked(data: {
  readonly certificateId: string;
  readonly reasonHash: string;
  readonly ledgerTxId: string;
  readonly revokedAt: string;
}): Promise<Certificate> {
  const revokedAt = new Date(data.revokedAt);

  const certificate = await prisma.$transaction(async (tx) => {
    const currentCertificate = await tx.certificate.findUniqueOrThrow({
      where: { certificateId: data.certificateId },
    });

    await tx.revocation.upsert({
      where: { certificateId: data.certificateId },
      update: {
        reasonHash: data.reasonHash,
        ledgerTxId: data.ledgerTxId,
        revokedAt,
      },
      create: {
        revocationId: `REVOKE_${data.certificateId}`,
        certificateId: data.certificateId,
        issuerId: currentCertificate.issuerId,
        reasonHash: data.reasonHash,
        ledgerTxId: data.ledgerTxId,
        revokedAt,
      },
    });

    return tx.certificate.update({
      where: { certificateId: data.certificateId },
      data: { status: "REVOKED" },
    });
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

export async function findAllCertificates(issuerId?: string): Promise<Certificate[]> {
  const where = issuerId ? { issuerId } : {};
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return certificates.map(mapCertificate);
}

export type AuthenticatedIssuer = {
  readonly issuerId: string;
  readonly organizationName: string;
  readonly departmentName: string;
  readonly mspId: string;
  readonly username: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly status: string;
};

export async function findIssuerByIdentifier(identifier: string): Promise<AuthenticatedIssuer | null> {
  const issuer = await prisma.issuer.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier },
        { issuerId: identifier }
      ]
    }
  });

  if (!issuer) return null;

  return {
    issuerId: issuer.issuerId,
    organizationName: issuer.organizationName,
    departmentName: issuer.departmentName,
    mspId: issuer.mspId,
    username: issuer.username!,
    email: issuer.email!,
    passwordHash: issuer.passwordHash!,
    isActive: issuer.isActive,
    status: issuer.status,
  };
}

export async function updateIssuerLastLogin(issuerId: string, loggedInAt: Date): Promise<void> {
  await prisma.issuer.update({
    where: { issuerId },
    data: { lastLogin: loggedInAt }
  });
}

export type CreateIssuerInput = {
  issuerId: string;
  organizationName: string;
  departmentName: string;
  mspId: string;
  username: string;
  email: string;
  passwordHash: string;
};

export async function createIssuerAccount(data: CreateIssuerInput): Promise<void> {
  await prisma.issuer.create({
    data: {
      issuerId: data.issuerId,
      organizationName: data.organizationName,
      departmentName: data.departmentName,
      mspId: data.mspId,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      isActive: true,
      status: 'ACTIVE'
    }
  });
}
