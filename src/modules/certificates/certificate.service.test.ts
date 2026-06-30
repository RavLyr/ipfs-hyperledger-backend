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
      issuer: 'Universitas Diponegoro',
      universityName: 'Universitas Diponegoro',
      faculty: 'Fakultas Peternakan dan Pertanian'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:RegisterIssuer',
        args: ['Universitas Diponegoro', 'Universitas Diponegoro', 'Fakultas Peternakan dan Pertanian', 'Org1MSP']
      }
    ]);
  });

  it('issues certificate with legacy Fabric placeholder mapping derived from new metadata', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseIssueCertificateBody({
      certificateId: 'CERT-001',
      certificateNumber: '0010084122122026100006',
      studentName: 'MAYAKA PUTY DANUZKYA',
      studentId: '23020122130052',
      graduationDate: '2025-12-16',
      studyProgram: 'Program Sarjana Teknologi Pangan',
      faculty: 'Fakultas Peternakan dan Pertanian',
      degreeLevel: 'S1',
      degreeName: 'Sarjana Teknologi Pangan',
      degreeAbbreviation: 'S.T.P.',
      universityName: 'Universitas Diponegoro',
      universityAccreditationNumber: '106/SK/BAN-PT/Ak.Ppj/PT/II/2023',
      programAccreditationAgency: 'BAN-PT',
      programAccreditationNumber: '2780/SK/BAN-PT/Akred-Intl/S/VII/2023',
      issueDate: '2026-01-15',
      deanName: 'Prof. Sugiharto, S.Pt., M.Sc., Ph.D.',
      rectorName: 'Prof. Dr. Suharnomo, S.E., M.Si.',
      issuer: 'Universitas Diponegoro',
      ipfsCid: 'bafy-certificate'
    });

    await service.issueCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:IssueCertificate',
        args: [
          'CERT-001',
          '0010084122122026100006',
          'ac3da95c7f09c03f2ddcf45a22c8a59ceca7ca170f4f14c0b9ff3220f701f829',
          'Universitas Diponegoro',
          'S1',
          'Sarjana Teknologi Pangan',
          'bafy-certificate',
          '2026-01-15',
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
        certificateId: 'CERT-001',
        certificateNumber: '0010084122122026100006',
        studentName: 'MAYAKA PUTY DANUZKYA',
        studentId: '23020122130052',
        graduationDate: '2025-12-16',
        studyProgram: 'Program Sarjana Teknologi Pangan',
        faculty: 'Fakultas Peternakan dan Pertanian',
        degreeLevel: 'S1',
        degreeName: 'Sarjana Teknologi Pangan',
        degreeAbbreviation: 'S.T.P.',
        universityName: 'Universitas Diponegoro',
        universityAccreditationNumber: '106/SK/BAN-PT/Ak.Ppj/PT/II/2023',
        programAccreditationAgency: 'BAN-PT',
        programAccreditationNumber: '2780/SK/BAN-PT/Akred-Intl/S/VII/2023',
        issueDate: '2026-01-15',
        deanName: 'Prof. Sugiharto, S.Pt., M.Sc., Ph.D.',
        rectorName: 'Prof. Dr. Suharnomo, S.E., M.Si.',
        issuer: 'UNKNOWN',
        ipfsCid: 'bafy-certificate'
      }),
      (err: unknown) => err instanceof AppError && err.statusCode === 404
    );
  });

  it('verifies certificate with VerifyCertificate evaluate transaction', async () => {
    const expected = {
      certificateId: 'CERT-001',
      valid: true,
      status: 'ACTIVE',
      message: 'certificate is valid',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: false,
      tampered: false
    };
    const { gateway, calls } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', ipfsCid: 'ipfs-cid' });

    assert.equal(result, expected);
    assert.deepEqual(calls, [
      {
        mode: 'evaluate',
        functionName: 'SmartContract:VerifyCertificate',
        args: ['CERT-001', 'ipfs-cid']
      }
    ]);
  });

  it('revokes certificate with reasonHash only', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseRevokeCertificateBody(
      { certificateId: 'CERT-001' },
      { reasonHash: 'reason-hash', revokedAt: '2026-06-18T01:00:00Z' }
    );

    await service.revokeCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:RevokeCertificate',
        args: ['CERT-001', 'reason-hash', '2026-06-18T01:00:00Z']
      }
    ]);
  });

  it('reissues certificate with ReissueCertificate argument order', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);

    await service.reissueCertificate({
      oldCertificateId: 'CERT-001',
      newCertificateId: 'CERT-002',
      newCertificateNumber: 'NO-002',
      newIpfsCid: 'bafy-new',
      reasonHash: 'reason-hash',
      reissuedAt: '2026-06-18T02:00:00Z'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:ReissueCertificate',
        args: ['CERT-001', 'CERT-002', 'NO-002', 'bafy-new', 'reason-hash', '2026-06-18T02:00:00Z']
      }
    ]);
  });
});

describe('certificate metadata validation', () => {
  it('parses upload metadata using the new backend contract', () => {
    const input = parseUploadCertificateBody({
      certificateId: 'CERT-001',
      certificateNumber: '0010084122122026100006',
      studentName: 'MAYAKA PUTY DANUZKYA',
      studentId: '23020122130052',
      graduationDate: '2025-12-16',
      studyProgram: 'Program Sarjana Teknologi Pangan',
      faculty: 'Fakultas Peternakan dan Pertanian',
      degreeLevel: 'S1',
      degreeName: 'Sarjana Teknologi Pangan',
      degreeAbbreviation: 'S.T.P.',
      universityName: 'Universitas Diponegoro',
      universityAccreditationNumber: '106/SK/BAN-PT/Ak.Ppj/PT/II/2023',
      programAccreditationAgency: 'BAN-PT',
      programAccreditationNumber: '2780/SK/BAN-PT/Akred-Intl/S/VII/2023',
      issueDate: '2026-01-15',
      deanName: 'Prof. Sugiharto, S.Pt., M.Sc., Ph.D.',
      rectorName: 'Prof. Dr. Suharnomo, S.E., M.Si.',
      issuer: 'Universitas Diponegoro'
    });

    assert.equal(input.issueDate, '2026-01-15');
    assert.equal(input.issuer, 'Universitas Diponegoro');
  });
});
