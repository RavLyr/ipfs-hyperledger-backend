import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/AppError';
import type { FabricResult } from '../../infrastructure/fabric/fabric-result';
import { uploadToIPFS } from '../../infrastructure/ipfs/ipfs.service';
import { sha256Hex } from '../../utils/hash';
import { evaluateTransaction, submitTransaction, submitTransactionWithTxId } from '../fabric/fabric.service';
import type {
  Certificate,
  CertificateTextInput,
  IssueCertificateInput,
  RegisterIssuerInput,
  RevokeCertificateInput,
  VerifyCertificateInput
} from './certificate.dto';
import {
  findAllCertificates,
  findCertificateByCertificateNumber,
  insertCertificate,
  markCertificateRevoked,
} from './certificate.repository';

export type FabricGateway = {
  readonly evaluateTransaction: (functionName: string, ...args: string[]) => Promise<FabricResult>;
  readonly submitTransaction: (functionName: string, ...args: string[]) => Promise<FabricResult>;
  readonly submitTransactionWithTxId: (
    functionName: string,
    ...args: string[]
  ) => Promise<{ readonly transactionId: string; readonly result: FabricResult }>;
};

const defaultGateway: FabricGateway = {
  evaluateTransaction,
  submitTransaction,
  submitTransactionWithTxId
};

const REQUIRED_UPLOAD_FIELDS = [
  'certificateNumber',
  'issuerId',
  'organizationName',
  'departmentName',
  'mspId',
  'certificateType',
  'degreeTitle',
  'studentId',
  'studentName',
  'studyProgram',
  'educationLevel',
  'issuedAt',
] as const;

type RawBody = Record<string, unknown>;

function chaincodeFunction(name: string): string {
  return `SmartContract:${name}`;
}

function isTrueFabricResult(result: FabricResult): boolean {
  return result === true || result === 'true';
}

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
      return runFabric(() => gateway.submitTransaction(chaincodeFunction('InitLedger')));
    },

    registerIssuer(input: RegisterIssuerInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          chaincodeFunction('RegisterIssuer'),
          input.issuerId,
          input.organizationName,
          input.departmentName,
          input.mspId
        )
      );
    },

    getIssuer(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetIssuer'), issuerId));
    },

    issuerExists(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('IssuerExists'), issuerId));
    },

    issueCertificate(input: IssueCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          chaincodeFunction('IssueCertificate'),
          input.certificateId,
          input.certificateNumber,
          input.studentIdHash,
          input.issuerId,
          input.certificateType,
          input.title,
          input.ipfsCid,
          input.issuedAt,
          input.expiredAt
        )
      );
    },

    issueCertificateWithTxId(
      input: IssueCertificateInput
    ): Promise<{ readonly transactionId: string; readonly result: FabricResult }> {
      return runFabric(() =>
        gateway.submitTransactionWithTxId(
          chaincodeFunction('IssueCertificate'),
          input.certificateId,
          input.certificateNumber,
          input.studentIdHash,
          input.issuerId,
          input.certificateType,
          input.title,
          input.ipfsCid,
          input.issuedAt,
          input.expiredAt
        )
      );
    },

    getCertificate(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetCertificate'), certificateId));
    },

    certificateExists(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('CertificateExists'), certificateId));
    },

    verifyCertificate(input: VerifyCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.evaluateTransaction(chaincodeFunction('VerifyCertificate'), input.certificateId, input.ipfsCid)
      );
    },

    revokeCertificate(input: RevokeCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(chaincodeFunction('RevokeCertificate'), input.certificateId, input.reasonHash, input.revokedAt)
      );
    },

    revokeCertificateWithTxId(
      input: RevokeCertificateInput
    ): Promise<{ readonly transactionId: string; readonly result: FabricResult }> {
      return runFabric(() =>
        gateway.submitTransactionWithTxId(
          chaincodeFunction("RevokeCertificate"),
          input.certificateId,
          input.reasonHash,
          input.revokedAt
        )
      );
    },

    getRevocationInfo(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetRevocationInfo'), certificateId));
    },

    getCertificateHistory(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetCertificateHistory'), certificateId));
    },

    getAllCertificates(): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetAllCertificates')));
    },

    getCertificatesByIssuer(issuerId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetCertificatesByIssuer'), issuerId));
    }
  };
}

export const certificateService = createCertificateService();

export async function uploadCertificate(
  body: RawBody,
  file: Express.Multer.File | undefined
): Promise<Certificate> {
  if (!file) {
    throw new Error('file_ijazah is required');
  }

  const input = validateCertificateBody(body);
  const existingCertificate = await findCertificateByCertificateNumber(input.certificateNumber);

  if (existingCertificate) {
    throw new Error(`certificateNumber already exists: ${input.certificateNumber}`);
  }

  const ipfsCid = await uploadToIPFS(file.buffer, file.originalname);
  const issuerExists = await certificateService.issuerExists(input.issuerId);

  if (!isTrueFabricResult(issuerExists)) {
    await certificateService.registerIssuer({
      issuerId: input.issuerId,
      organizationName: input.organizationName,
      departmentName: input.departmentName,
      mspId: input.mspId,
    });
  }

  const fabricTransaction = await certificateService.issueCertificateWithTxId({
    certificateId: input.certificateId,
    certificateNumber: input.certificateNumber,
    studentIdHash: sha256Hex(input.studentId),
    issuerId: input.issuerId,
    certificateType: input.certificateType,
    title: input.degreeTitle,
    ipfsCid,
    issuedAt: input.issuedAt,
    expiredAt: ''
  });

  return insertCertificate({
    ...input,
    ipfsCid,
    file_name: file.originalname,
    mime_type: file.mimetype,
    file_size: file.size,
    ledger_tx_id: fabricTransaction.transactionId,
    status: 'VALID',
  });
}

export async function revokeCertificateAndSync(input: RevokeCertificateInput): Promise<{
  readonly fabricResult: FabricResult;
  readonly certificate: Certificate;
}> {
  const fabricTransaction = await certificateService.revokeCertificateWithTxId(input);
  const certificate = await markCertificateRevoked({
    certificateId: input.certificateId,
    reasonHash: input.reasonHash,
    ledgerTxId: fabricTransaction.transactionId,
    revokedAt: input.revokedAt,
  });

  return {
    fabricResult: fabricTransaction.result,
    certificate,
  };
}

export async function verifyCertificateService(
  certificateNumber: string
): Promise<Certificate | null> {
  const cleanCertificateNumber = certificateNumber.trim();

  if (!cleanCertificateNumber) {
    throw new Error('certificateNumber is required');
  }

  return findCertificateByCertificateNumber(cleanCertificateNumber);
}

export async function getAllCertificatesService(issuerId?: string): Promise<Certificate[]> {
  return findAllCertificates(issuerId);
}

function validateCertificateBody(body: RawBody): CertificateTextInput {
  const missingFields = REQUIRED_UPLOAD_FIELDS.filter((field) => {
    const value = body[field];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const issuedAt = clean(body.issuedAt);
  const graduationDate = clean(body.graduationDate);

  if (!isValidDateOnly(issuedAt)) {
    throw new Error('issuedAt must use YYYY-MM-DD format');
  }

  if (graduationDate && !isValidDateOnly(graduationDate)) {
    throw new Error('graduationDate must use YYYY-MM-DD format');
  }

  return {
    certificateId: clean(body.certificateId) || randomUUID(),
    certificateNumber: clean(body.certificateNumber),
    issuerId: clean(body.issuerId),
    organizationName: clean(body.organizationName),
    departmentName: clean(body.departmentName),
    mspId: clean(body.mspId),
    certificateType: clean(body.certificateType),
    degreeTitle: clean(body.degreeTitle),
    studentId: clean(body.studentId),
    studentName: clean(body.studentName),
    studyProgram: clean(body.studyProgram),
    educationLevel: clean(body.educationLevel),
    graduationDate,
    issuedAt,
  };
}

function clean(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function readHashOrRaw(body: RawBody, hashField: string, rawField: string): string {
  const hash = clean(body[hashField]);

  if (hash) {
    return hash;
  }

  const raw = clean(body[rawField]);

  return raw ? sha256Hex(raw) : '';
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}
