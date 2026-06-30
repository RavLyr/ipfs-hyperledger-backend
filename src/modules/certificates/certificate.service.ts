import { createHash } from 'node:crypto';

import { AppError } from '../../errors/AppError';
import type { FabricResult } from '../../infrastructure/fabric/fabric-result';
import { uploadToIPFS } from '../../infrastructure/ipfs/ipfs.service';
import { evaluateTransaction, submitTransaction, submitTransactionWithTxId } from '../fabric/fabric.service';
import type {
  Certificate,
  CreateCertificateInput,
  IssueCertificateInput,
  RegisterIssuerInput,
  ReissueCertificateInput,
  RevokeCertificateInput,
  UploadCertificateInput,
  VerifyCertificateInput
} from './certificate.dto';
import { parseUploadCertificateBody } from './certificate.dto';
import {
  findAllCertificates,
  findCertificateByCertificateNumber,
  insertCertificate
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

type RawBody = Record<string, unknown>;

type FabricCertificateArguments = {
  readonly certificateId: string;
  readonly certificateNumber: string;
  readonly hashedStudentId: string;
  readonly fabricIssuerKey: string;
  readonly legacyDegreeLevel: string;
  readonly legacyDegreeLabel: string;
  readonly ipfsCid: string;
  readonly issueDate: string;
  readonly emptyExpiryDate: string;
};

type FabricIssuerArguments = {
  readonly fabricIssuerKey: string;
  readonly universityName: string;
  readonly facultyLabel: string;
  readonly fabricMspId: string;
};

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

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function deriveFabricIssuerKey(input: Pick<UploadCertificateInput, 'issuer' | 'universityName'>): string {
  return input.issuer || input.universityName;
}

function deriveFacultyLabel(
  input: Pick<UploadCertificateInput, 'faculty' | 'studyProgram'>
): string {
  return input.faculty || input.studyProgram;
}

function deriveFabricIssuerArguments(
  input: UploadCertificateInput
): FabricIssuerArguments {
  return {
    fabricIssuerKey: deriveFabricIssuerKey(input),
    universityName: input.universityName,
    facultyLabel: deriveFacultyLabel(input),
    fabricMspId: 'Org1MSP'
  };
}

function deriveFabricCertificateArguments(
  input: UploadCertificateInput,
  ipfsCid: string
): FabricCertificateArguments {
  return {
    certificateId: input.certificateId,
    certificateNumber: input.certificateNumber,
    hashedStudentId: sha256Hex(input.studentId),
    fabricIssuerKey: deriveFabricIssuerKey(input),
    legacyDegreeLevel: input.degreeLevel,
    legacyDegreeLabel: input.degreeName,
    ipfsCid,
    issueDate: input.issueDate,
    emptyExpiryDate: ''
  };
}

async function tryIssueCertificateToFabric(
  input: UploadCertificateInput,
  ipfsCid: string
): Promise<string | null> {
  const fabricIssuer = deriveFabricIssuerArguments(input);
  const fabricCertificate = deriveFabricCertificateArguments(input, ipfsCid);

  try {
    const issuerExists = await certificateService.issuerExists(fabricIssuer.fabricIssuerKey);

    if (!isTrueFabricResult(issuerExists)) {
      await certificateService.registerIssuer({
        issuer: fabricIssuer.fabricIssuerKey,
        universityName: fabricIssuer.universityName,
        faculty: fabricIssuer.facultyLabel
      });
    }

    const fabricTransaction = await certificateService.issueCertificateWithTxId({
      certificateId: fabricCertificate.certificateId,
      certificateNumber: fabricCertificate.certificateNumber,
      studentName: input.studentName,
      studentId: input.studentId,
      graduationDate: input.graduationDate,
      studyProgram: input.studyProgram,
      faculty: input.faculty,
      degreeLevel: input.degreeLevel,
      degreeName: input.degreeName,
      degreeAbbreviation: input.degreeAbbreviation,
      universityName: input.universityName,
      universityAccreditationNumber: input.universityAccreditationNumber,
      programAccreditationAgency: input.programAccreditationAgency,
      programAccreditationNumber: input.programAccreditationNumber,
      issueDate: input.issueDate,
      deanName: input.deanName,
      rectorName: input.rectorName,
      issuer: input.issuer,
      ipfsCid: fabricCertificate.ipfsCid
    });

    return fabricTransaction.transactionId;
  } catch {
    return null;
  }
}

export function createCertificateService(gateway: FabricGateway = defaultGateway) {
  return {
    initLedger(): Promise<FabricResult> {
      return runFabric(() => gateway.submitTransaction(chaincodeFunction('InitLedger')));
    },

    registerIssuer(input: RegisterIssuerInput): Promise<FabricResult> {
      const fabricIssuer = {
        issuer: input.issuer,
        universityName: input.universityName,
        faculty: input.faculty,
        fabricMspId: 'Org1MSP'
      };

      return runFabric(() =>
        gateway.submitTransaction(
          chaincodeFunction('RegisterIssuer'),
          fabricIssuer.issuer,
          fabricIssuer.universityName,
          fabricIssuer.faculty,
          fabricIssuer.fabricMspId
        )
      );
    },

    getIssuer(issuer: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetIssuer'), issuer));
    },

    issuerExists(issuer: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('IssuerExists'), issuer));
    },

    issueCertificate(input: IssueCertificateInput): Promise<FabricResult> {
      const fabricCertificate = {
        certificateId: input.certificateId,
        certificateNumber: input.certificateNumber,
        hashedStudentId: sha256Hex(input.studentId),
        fabricIssuerKey: deriveFabricIssuerKey(input),
        legacyDegreeLevel: input.degreeLevel,
        legacyDegreeLabel: input.degreeName,
        ipfsCid: input.ipfsCid,
        issueDate: input.issueDate,
        emptyExpiryDate: ''
      };

      return runFabric(() =>
        gateway.submitTransaction(
          chaincodeFunction('IssueCertificate'),
          fabricCertificate.certificateId,
          fabricCertificate.certificateNumber,
          fabricCertificate.hashedStudentId,
          fabricCertificate.fabricIssuerKey,
          fabricCertificate.legacyDegreeLevel,
          fabricCertificate.legacyDegreeLabel,
          fabricCertificate.ipfsCid,
          fabricCertificate.issueDate,
          fabricCertificate.emptyExpiryDate
        )
      );
    },

    issueCertificateWithTxId(
      input: IssueCertificateInput
    ): Promise<{ readonly transactionId: string; readonly result: FabricResult }> {
      const fabricCertificate = {
        certificateId: input.certificateId,
        certificateNumber: input.certificateNumber,
        hashedStudentId: sha256Hex(input.studentId),
        fabricIssuerKey: deriveFabricIssuerKey(input),
        legacyDegreeLevel: input.degreeLevel,
        legacyDegreeLabel: input.degreeName,
        ipfsCid: input.ipfsCid,
        issueDate: input.issueDate,
        emptyExpiryDate: ''
      };

      return runFabric(() =>
        gateway.submitTransactionWithTxId(
          chaincodeFunction('IssueCertificate'),
          fabricCertificate.certificateId,
          fabricCertificate.certificateNumber,
          fabricCertificate.hashedStudentId,
          fabricCertificate.fabricIssuerKey,
          fabricCertificate.legacyDegreeLevel,
          fabricCertificate.legacyDegreeLabel,
          fabricCertificate.ipfsCid,
          fabricCertificate.issueDate,
          fabricCertificate.emptyExpiryDate
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

    getRevocationInfo(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetRevocationInfo'), certificateId));
    },

    reissueCertificate(input: ReissueCertificateInput): Promise<FabricResult> {
      return runFabric(() =>
        gateway.submitTransaction(
          chaincodeFunction('ReissueCertificate'),
          input.oldCertificateId,
          input.newCertificateId,
          input.newCertificateNumber,
          input.newIpfsCid,
          input.reasonHash,
          input.reissuedAt
        )
      );
    },

    getCertificateHistory(certificateId: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetCertificateHistory'), certificateId));
    },

    getAllCertificates(): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetAllCertificates')));
    },

    getCertificatesByIssuer(issuer: string): Promise<FabricResult> {
      return runFabric(() => gateway.evaluateTransaction(chaincodeFunction('GetCertificatesByIssuer'), issuer));
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

  const input = parseUploadCertificateBody(body);
  const existingCertificate = await findCertificateByCertificateNumber(input.certificateNumber);

  if (existingCertificate) {
    throw new Error(`certificateNumber already exists: ${input.certificateNumber}`);
  }

  const ipfsCid = await uploadToIPFS(file.buffer, file.originalname);
  const ledgerTxId = await tryIssueCertificateToFabric(input, ipfsCid);

  const certificateData: CreateCertificateInput = {
    ...input,
    fileName: file.originalname,
    ipfsCid,
    ledgerTxId,
    status: 'VALID'
  };

  return insertCertificate(certificateData);
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

export async function getAllCertificatesService(issuer?: string): Promise<Certificate[]> {
  return findAllCertificates(issuer);
}
