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
