import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AppError } from '../../errors/AppError';
import {
  parseIssueCertificateBody,
  parseUploadCertificateBody,
  parseRevokeCertificateBody
} from './certificate.dto';
import { createCertificateService, type FabricGateway } from './certificate.service';

type Call = {
  readonly mode: 'evaluate' | 'submit';
  readonly functionName: string;
  readonly args: readonly string[];
};

function createMockGateway(results: Record<string, unknown> = {}): { gateway: FabricGateway; calls: Call[] } {
  const calls: Call[] = [];

  function readResult(functionName: string): unknown {
    return results[functionName] ?? results[functionName.replace('SmartContract:', '')] ?? null;
  }

  return {
    calls,
    gateway: {
      async evaluateTransaction(functionName: string, ...args: string[]): Promise<unknown> {
        calls.push({ mode: 'evaluate', functionName, args });

        return readResult(functionName);
      },
      async submitTransaction(functionName: string, ...args: string[]): Promise<unknown> {
        calls.push({ mode: 'submit', functionName, args });

        return readResult(functionName);
      },
      async submitTransactionWithTxId(functionName: string, ...args: string[]): Promise<{ transactionId: string; result: unknown }> {
        calls.push({ mode: 'submit', functionName, args });

        return { transactionId: 'mock-tx-id', result: readResult(functionName) };
      }
    }
  };
}

describe('certificate lifecycle chaincode mapping', () => {
  it('registers issuer with RegisterIssuer argument order', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);

    await service.registerIssuer({
      issuer: 'Universitas Contoh',
      universityName: 'Universitas Contoh',
      faculty: 'Fakultas Contoh'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:RegisterIssuer',
        args: ['Universitas Contoh', 'Universitas Contoh', 'Fakultas Contoh', 'Org1MSP']
      }
    ]);
  });

  it('issues certificate with legacy Fabric placeholder mapping derived from new metadata', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseIssueCertificateBody({
      certificateId: 'CERT-TEST-2026-000001',
      certificateNumber: 'TEST-2026-000001',
      studentName: 'TEST STUDENT',
      studentId: '23000000000000',
      graduationDate: '2026-06-30',
      studyProgram: 'Program Studi Contoh',
      faculty: 'Fakultas Contoh',
      degreeLevel: 'S1',
      degreeName: 'Sarjana Contoh',
      degreeAbbreviation: 'S.C.',
      universityName: 'Universitas Contoh',
      universityAccreditationNumber: 'ACC-UNIV-TEST-001',
      programAccreditationAgency: 'Example Accreditation Agency',
      programAccreditationNumber: 'ACC-PROGRAM-TEST-001',
      issueDate: '2026-07-15',
      deanName: 'Prof. Example Dean',
      rectorName: 'Prof. Example Rector',
      issuer: 'Universitas Contoh',
      ipfsCid: 'bafybeigdummydocumentcid000000000000000000000000000'
    });

    await service.issueCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:IssueCertificate',
        args: [
          'CERT-TEST-2026-000001',
          'TEST-2026-000001',
          '74a73373a8e2abaf3802e05420c3c9abdec2473005841794a2d5027e529dbfe1',
          'Universitas Contoh',
          'S1',
          'Sarjana Contoh',
          'bafybeigdummydocumentcid000000000000000000000000000',
          '2026-07-15',
          ''
        ]
      }
    ]);
  });

  it('maps missing issuer error when issue certificate fails', async () => {
    const gateway: FabricGateway = {
      async evaluateTransaction(): Promise<unknown> {
        return null;
      },
      async submitTransaction(): Promise<unknown> {
        throw new Error('issuer UNKNOWN does not exist');
      },
      async submitTransactionWithTxId(): Promise<{ transactionId: string; result: unknown }> {
        throw new Error('issuer UNKNOWN does not exist');
      }
    };
    const service = createCertificateService(gateway);

    await assert.rejects(
      service.issueCertificate({
        certificateId: 'CERT-TEST-2026-000001',
        certificateNumber: 'TEST-2026-000001',
        studentName: 'TEST STUDENT',
        studentId: '23000000000000',
        graduationDate: '2026-06-30',
        studyProgram: 'Program Studi Contoh',
        faculty: 'Fakultas Contoh',
        degreeLevel: 'S1',
        degreeName: 'Sarjana Contoh',
        degreeAbbreviation: 'S.C.',
        universityName: 'Universitas Contoh',
        universityAccreditationNumber: 'ACC-UNIV-TEST-001',
        programAccreditationAgency: 'Example Accreditation Agency',
        programAccreditationNumber: 'ACC-PROGRAM-TEST-001',
        issueDate: '2026-07-15',
        deanName: 'Prof. Example Dean',
        rectorName: 'Prof. Example Rector',
        issuer: 'UNKNOWN',
        ipfsCid: 'bafybeigdummydocumentcid000000000000000000000000000'
      }),
      (err: unknown) => err instanceof AppError && err.statusCode === 404
    );
  });

  it('verifies certificate with VerifyCertificate evaluate transaction', async () => {
    const expected = {
      certificateId: 'CERT-TEST-2026-000001',
      valid: true,
      status: 'VALID',
      message: 'certificate is valid',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: false,
      tampered: false
    };
    const { gateway, calls } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-TEST-2026-000001', ipfsCid: 'bafybeigdummydocumentcid000000000000000000000000000' });

    assert.equal(result, expected);
    assert.deepEqual(calls, [
      {
        mode: 'evaluate',
        functionName: 'SmartContract:VerifyCertificate',
        args: ['CERT-TEST-2026-000001', 'bafybeigdummydocumentcid000000000000000000000000000']
      }
    ]);
  });

  it('revokes certificate with reasonHash only', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseRevokeCertificateBody(
      { certificateId: 'CERT-TEST-2026-000001' },
      { reasonHash: 'reason-hash', revokedAt: '2026-06-18T01:00:00Z' }
    );

    await service.revokeCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:RevokeCertificate',
        args: ['CERT-TEST-2026-000001', 'reason-hash', '2026-06-18T01:00:00Z']
      }
    ]);
  });

  it('reissues certificate with ReissueCertificate argument order', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);

    await service.reissueCertificate({
      oldCertificateId: 'CERT-TEST-2026-000001',
      newCertificateId: 'CERT-TEST-2026-000002',
      newCertificateNumber: 'TEST-2026-000001',
      newIpfsCid: 'bafybeigdummydocumentcid000000000000000000000000000',
      reasonHash: 'reason-hash',
      reissuedAt: '2026-06-18T02:00:00Z'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:ReissueCertificate',
        args: ['CERT-TEST-2026-000001', 'CERT-TEST-2026-000002', 'TEST-2026-000001', 'bafybeigdummydocumentcid000000000000000000000000000', 'reason-hash', '2026-06-18T02:00:00Z']
      }
    ]);
  });
});

describe('certificate metadata validation', () => {
  it('parses upload metadata using the new backend contract', () => {
    const input = parseUploadCertificateBody({
      certificateId: 'CERT-TEST-2026-000001',
      certificateNumber: 'TEST-2026-000001',
      studentName: 'TEST STUDENT',
      studentId: '23000000000000',
      graduationDate: '2026-06-30',
      studyProgram: 'Program Studi Contoh',
      faculty: 'Fakultas Contoh',
      degreeLevel: 'S1',
      degreeName: 'Sarjana Contoh',
      degreeAbbreviation: 'S.C.',
      universityName: 'Universitas Contoh',
      universityAccreditationNumber: 'ACC-UNIV-TEST-001',
      programAccreditationAgency: 'Example Accreditation Agency',
      programAccreditationNumber: 'ACC-PROGRAM-TEST-001',
      issueDate: '2026-07-15',
      deanName: 'Prof. Example Dean',
      rectorName: 'Prof. Example Rector',
      issuer: 'Universitas Contoh'
    });

    assert.equal(input.issueDate, '2026-07-15');
    assert.equal(input.issuer, 'Universitas Contoh');
  });
});
