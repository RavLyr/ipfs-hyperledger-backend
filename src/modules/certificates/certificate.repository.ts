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
    studentName: row.studentName,
    studentId: row.studentId,
    graduationDate: formatDateOnly(row.graduationDate),
    studyProgram: row.studyProgram,
    faculty: row.faculty,
    degreeLevel: row.degreeLevel,
    degreeName: row.degreeName,
    degreeAbbreviation: row.degreeAbbreviation,
    universityName: row.universityName,
    universityAccreditationNumber: row.universityAccreditationNumber,
    programAccreditationAgency: row.programAccreditationAgency,
    programAccreditationNumber: row.programAccreditationNumber,
    issueDate: formatDateOnly(row.issueDate),
    deanName: row.deanName,
    rectorName: row.rectorName,
    fileName: row.fileName,
    ipfsCid: row.ipfsCid,
    ledgerTxId: row.ledgerTxId,
    issuer: row.issuer,
    status: row.status,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt)
  };
}

export async function insertCertificate(data: CreateCertificateInput): Promise<Certificate> {
  const certificate = await prisma.certificate.create({
    data: {
      certificateId: data.certificateId,
      certificateNumber: data.certificateNumber,
      studentName: data.studentName,
      studentId: data.studentId,
      graduationDate: toDate(data.graduationDate),
      studyProgram: data.studyProgram,
      faculty: data.faculty,
      degreeLevel: data.degreeLevel,
      degreeName: data.degreeName,
      degreeAbbreviation: data.degreeAbbreviation,
      universityName: data.universityName,
      universityAccreditationNumber: data.universityAccreditationNumber,
      programAccreditationAgency: data.programAccreditationAgency,
      programAccreditationNumber: data.programAccreditationNumber,
      issueDate: toDate(data.issueDate),
      deanName: data.deanName,
      rectorName: data.rectorName,
      fileName: data.fileName,
      ipfsCid: data.ipfsCid,
      ledgerTxId: data.ledgerTxId,
      issuer: data.issuer,
      status: data.status
    }
  });

  return mapCertificate(certificate);
}

export async function findCertificateByCertificateNumber(
  certificateNumber: string
): Promise<Certificate | null> {
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber }
  });

  return certificate ? mapCertificate(certificate) : null;
}

export async function findAllCertificates(issuer?: string): Promise<Certificate[]> {
  const where = issuer ? { issuer } : {};
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  return certificates.map(mapCertificate);
}
