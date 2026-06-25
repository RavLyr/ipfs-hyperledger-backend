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
    title: row.title,
    studentIdHash: row.studentIdHash,
    documentHash: row.documentHash,
    ipfsCid: row.ipfsCid,
    file_name: row.fileName,
    mime_type: row.mimeType,
    file_size: row.fileSize === null ? null : Number(row.fileSize),
    ledger_tx_id: row.ledgerTxId,
    status: row.status,
    issuedAt: formatDateTime(row.issuedAt),
    expiredAt: row.expiredAt ? formatDateTime(row.expiredAt) : null,
    previousCertificateId: row.previousCertificateId,
    replacementCertificateId: row.replacementCertificateId,
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
      title: data.title,
      studentIdHash: data.studentIdHash,
      documentHash: data.documentHash,
      ipfsCid: data.ipfsCid,
      fileName: data.file_name,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      ledgerTxId: data.ledger_tx_id,
      status: data.status,
      issuedAt: toDate(data.issuedAt),
      expiredAt: data.expiredAt ? new Date(data.expiredAt) : null,
      previousCertificateId: data.previousCertificateId ?? null,
      replacementCertificateId: data.replacementCertificateId ?? null,
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

export async function findAllCertificates(): Promise<Certificate[]> {
  const certificates = await prisma.certificate.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return certificates.map(mapCertificate);
}
