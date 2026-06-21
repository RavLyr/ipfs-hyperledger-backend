import { AppError } from '../../errors/AppError';
import type { FabricResult } from '../../infrastructure/fabric/fabric-result';
import { evaluateTransaction, submitTransaction } from '../fabric/fabric.service';
import type {
  IssueCertificateInput,
  RegisterIssuerInput,
  ReissueCertificateInput,
  RevokeCertificateInput,
  VerifyCertificateInput
} from './certificate.dto';

export type FabricGateway = {
  readonly evaluateTransaction: (functionName: string, ...args: string[]) => Promise<FabricResult>;
  readonly submitTransaction: (functionName: string, ...args: string[]) => Promise<FabricResult>;
};

const defaultGateway: FabricGateway = {
  evaluateTransaction,
  submitTransaction
};

function mapFabricError(err: unknown): never {
  if (err instanceof AppError) {
    throw err;
  }

  if (!(err instanceof Error)) {
    throw new AppError('Fabric transaction failed', 502);
  }

  const message = err.message || 'Fabric transaction failed';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('does not exist') || lowerMessage.includes('not found')) {
    throw new AppError(message, 404);
  }

  if (
    lowerMessage.includes('already exists') ||
    lowerMessage.includes('not active') ||
    lowerMessage.includes('not authorized') ||
    lowerMessage.includes('msp id') ||
    lowerMessage.includes('must be active') ||
    lowerMessage.includes('is required')
  ) {
    throw new AppError(message, 409);
  }

  throw new AppError(message, 502);
}

async function runFabric<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    mapFabricError(err);
  }
}

export function createCertificateService(gateway: FabricGateway = defaultGateway) {
  return {
    initLedger(): Promise<FabricResult> {
      return runFabric(() => gateway.submitTransaction('InitLedger'));
    },

    registerIssuer(input: RegisterIssuerInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          'RegisterIssuer',
          input.issuerId,
          input.organizationName,
          input.departmentName,
          input.mspId
        )
      );
    },

    getIssuer(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetIssuer', issuerId));
    },

    issuerExists(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('IssuerExists', issuerId));
    },

    issueCertificate(input: IssueCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          'IssueCertificate',
          input.certificateId,
          input.certificateNumber,
          input.studentIdHash,
          input.issuerId,
          input.certificateType,
          input.title,
          input.documentHash,
          input.ipfsCid,
          input.issuedAt,
          input.expiredAt
        )
      );
    },

    getCertificate(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetCertificate', certificateId));
    },

    certificateExists(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('CertificateExists', certificateId));
    },

    verifyCertificate(input: VerifyCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.evaluateTransaction('VerifyCertificate', input.certificateId, input.documentHash)
      );
    },

    revokeCertificate(input: RevokeCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction('RevokeCertificate', input.certificateId, input.reasonHash, input.revokedAt)
      );
    },

    getRevocationInfo(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetRevocationInfo', certificateId));
    },

    reissueCertificate(input: ReissueCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          'ReissueCertificate',
          input.oldCertificateId,
          input.newCertificateId,
          input.newCertificateNumber,
          input.newDocumentHash,
          input.newIpfsCid,
          input.reasonHash,
          input.reissuedAt
        )
      );
    },

    getCertificateHistory(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetCertificateHistory', certificateId));
    },

    getAllCertificates(): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetAllCertificates'));
    },

    getCertificatesByIssuer(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction('GetCertificatesByIssuer', issuerId));
    }
  };
}

export const certificateService = createCertificateService();

import { uploadToIPFS } from "../../infrastructure/ipfs/ipfs.service";
import {
  findAllCertificates,
  findCertificateByNomorIjazah,
  insertCertificate,
} from "./certificate.repository";
import type { Certificate, CertificateTextInput } from "./certificate.dto";

const REQUIRED_FIELDS = [
  "nama_mahasiswa",
  "nim",
  "email_mahasiswa",
  "program_studi",
  "fakultas",
  "tahun_masuk",
  "tahun_lulus",
  "nomor_ijazah",
  "tanggal_terbit_ijazah",
] as const;

type RawBody = Record<string, unknown>;

export async function uploadCertificate(
  body: RawBody,
  file: Express.Multer.File | undefined
): Promise<Certificate> {
  const input = validateCertificateBody(body);

  if (!file) {
    throw new Error("file_ijazah is required");
  }

  const existingCertificate = await findCertificateByNomorIjazah(
    input.nomor_ijazah
  );

  if (existingCertificate) {
    throw new Error(`nomor_ijazah already exists: ${input.nomor_ijazah}`);
  }

  const cid = await uploadToIPFS(file.buffer, file.originalname);

  const savedCertificate = await insertCertificate({
    ...input,
    cid,
    file_name: file.originalname,
    mime_type: file.mimetype,
    file_size: file.size,
    ledger_tx_id: "PENDING_CHAINCODE",
    status: "VALID",
  });

  return savedCertificate;
}

export async function verifyCertificateService(
  nomorIjazah: string
): Promise<Certificate | null> {
  const cleanNomorIjazah = nomorIjazah.trim();

  if (!cleanNomorIjazah) {
    throw new Error("nomor_ijazah is required");
  }

  return findCertificateByNomorIjazah(cleanNomorIjazah);
}

export async function getAllCertificatesService(): Promise<Certificate[]> {
  return findAllCertificates();
}

function validateCertificateBody(body: RawBody): CertificateTextInput {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    const value = body[field];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  const nama_mahasiswa = clean(body.nama_mahasiswa);
  const nim = clean(body.nim);
  const email_mahasiswa = clean(body.email_mahasiswa);
  const program_studi = clean(body.program_studi);
  const fakultas = clean(body.fakultas);
  const nomor_ijazah = clean(body.nomor_ijazah);
  const tanggal_terbit_ijazah = clean(body.tanggal_terbit_ijazah);

  const tahun_masuk = parseYear(body.tahun_masuk, "tahun_masuk");
  const tahun_lulus = parseYear(body.tahun_lulus, "tahun_lulus");

  if (!isValidEmail(email_mahasiswa)) {
    throw new Error("email_mahasiswa format is invalid");
  }

  if (tahun_lulus < tahun_masuk) {
    throw new Error("tahun_lulus cannot be smaller than tahun_masuk");
  }

  if (!isValidDateOnly(tanggal_terbit_ijazah)) {
    throw new Error("tanggal_terbit_ijazah must use YYYY-MM-DD format");
  }

  return {
    nama_mahasiswa,
    nim,
    email_mahasiswa,
    program_studi,
    fakultas,
    tahun_masuk,
    tahun_lulus,
    nomor_ijazah,
    tanggal_terbit_ijazah,
  };
}

function clean(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function parseYear(value: unknown, fieldName: string): number {
  const parsed = Number(clean(value));

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  if (parsed < 1900 || parsed > 2100) {
    throw new Error(`${fieldName} is out of allowed range`);
  }

  return parsed;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}
