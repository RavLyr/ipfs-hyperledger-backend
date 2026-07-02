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
    universityName: row.universityName,
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
      universityName: data.universityName,
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

export async function findAllCertificates(issuerId?: string): Promise<Certificate[]> {
  const where = issuerId ? { issuerId } : {};
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return certificates.map(mapCertificate);
}
