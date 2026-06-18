import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AppError } from '../../errors/AppError';
import { sha256Hex } from '../../utils/hash';
import { parseIssueCertificateBody, parseRevokeCertificateBody } from './certificate.dto';
import { createCertificateService, type FabricGateway } from './certificate.service';

type Call = {
  readonly mode: 'evaluate' | 'submit';
  readonly functionName: string;
  readonly args: readonly string[];
};

function createMockGateway(results: Record<string, unknown> = {}): { gateway: FabricGateway; calls: Call[] } {
  const calls: Call[] = [];

  return {
    calls,
    gateway: {
      async evaluateTransaction(functionName: string, ...args: string[]): Promise<unknown> {
        calls.push({ mode: 'evaluate', functionName, args });

        return results[functionName] ?? null;
      },
      async submitTransaction(functionName: string, ...args: string[]): Promise<unknown> {
        calls.push({ mode: 'submit', functionName, args });

        return results[functionName] ?? null;
      }
    }
  };
}

describe('certificate lifecycle chaincode mapping', () => {
  it('registers issuer with RegisterIssuer argument order', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);

    await service.registerIssuer({
      issuerId: 'DEMO_ISSUER',
      organizationName: 'Demo University',
      departmentName: 'Academic Office',
      mspId: 'Org1MSP'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'RegisterIssuer',
        args: ['DEMO_ISSUER', 'Demo University', 'Academic Office', 'Org1MSP']
      }
    ]);
  });

  it('issues certificate with IssueCertificate argument order and hashes raw inputs before ledger call', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const documentBase64 = Buffer.from('pdf bytes').toString('base64');
    const input = parseIssueCertificateBody({
      certificateId: 'CERT-001',
      certificateNumber: 'NO-001',
      studentId: 'NIM-RAW-001',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      title: 'Bachelor Certificate',
      documentBase64,
      ipfsCid: 'bafy-certificate',
      issuedAt: '2026-06-18T00:00:00Z'
    });

    await service.issueCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'IssueCertificate',
        args: [
          'CERT-001',
          'NO-001',
          sha256Hex('NIM-RAW-001'),
          'DEMO_ISSUER',
          'DIPLOMA',
          'Bachelor Certificate',
          sha256Hex(Buffer.from(documentBase64, 'base64')),
          'bafy-certificate',
          '2026-06-18T00:00:00Z',
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
      }
    };
    const service = createCertificateService(gateway);

    await assert.rejects(
      service.issueCertificate({
        certificateId: 'CERT-001',
        certificateNumber: 'NO-001',
        studentIdHash: 'student-hash',
        issuerId: 'UNKNOWN',
        certificateType: 'DIPLOMA',
        title: 'Bachelor Certificate',
        documentHash: 'doc-hash',
        ipfsCid: 'bafy-certificate',
        issuedAt: '2026-06-18T00:00:00Z',
        expiredAt: ''
      }),
      (err: unknown) => err instanceof AppError && err.statusCode === 404
    );
  });

  it('verifies certificate with VerifyCertificate evaluate transaction', async () => {
    const expected = {
      certificateId: 'CERT-001',
      valid: true,
      status: 'ACTIVE',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      message: 'certificate is valid',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: false,
      tampered: false
    };
    const { gateway, calls } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', documentHash: 'doc-hash' });

    assert.equal(result, expected);
    assert.deepEqual(calls, [
      {
        mode: 'evaluate',
        functionName: 'VerifyCertificate',
        args: ['CERT-001', 'doc-hash']
      }
    ]);
  });

  it('returns tampered verification result from chaincode unchanged', async () => {
    const expected = {
      certificateId: 'CERT-001',
      valid: false,
      status: 'ACTIVE',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      message: 'document hash does not match certificate record',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: false,
      tampered: true
    };
    const { gateway } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', documentHash: 'wrong-hash' });

    assert.equal(result, expected);
  });

  it('revokes certificate with reasonHash only', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseRevokeCertificateBody(
      { certificateId: 'CERT-001' },
      { reason: 'typed revocation reason', revokedAt: '2026-06-18T01:00:00Z' }
    );

    await service.revokeCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'RevokeCertificate',
        args: ['CERT-001', sha256Hex('typed revocation reason'), '2026-06-18T01:00:00Z']
      }
    ]);
  });

  it('returns revoked verification invalid result from chaincode unchanged', async () => {
    const expected = {
      certificateId: 'CERT-001',
      valid: false,
      status: 'REVOKED',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      message: 'certificate has been revoked',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: true,
      tampered: false
    };
    const { gateway } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', documentHash: 'doc-hash' });

    assert.equal(result, expected);
  });

  it('reissues certificate with ReissueCertificate argument order', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);

    await service.reissueCertificate({
      oldCertificateId: 'CERT-001',
      newCertificateId: 'CERT-002',
      newCertificateNumber: 'NO-002',
      newDocumentHash: 'new-doc-hash',
      newIpfsCid: 'bafy-new',
      reasonHash: 'reason-hash',
      reissuedAt: '2026-06-18T02:00:00Z'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'ReissueCertificate',
        args: ['CERT-001', 'CERT-002', 'NO-002', 'new-doc-hash', 'bafy-new', 'reason-hash', '2026-06-18T02:00:00Z']
      }
    ]);
  });

  it('reads old REISSUED and new ACTIVE certificate states', async () => {
    const oldCertificate = { certificateId: 'CERT-001', status: 'REISSUED', replacementCertificateId: 'CERT-002' };
    const newCertificate = { certificateId: 'CERT-002', status: 'ACTIVE', previousCertificateId: 'CERT-001' };
    const calls: Call[] = [];
    const gateway: FabricGateway = {
      async evaluateTransaction(functionName: string, ...args: string[]): Promise<unknown> {
        calls.push({ mode: 'evaluate', functionName, args });

        return args[0] === 'CERT-001' ? oldCertificate : newCertificate;
      },
      async submitTransaction(): Promise<unknown> {
        return null;
      }
    };
    const service = createCertificateService(gateway);

    assert.equal(await service.getCertificate('CERT-001'), oldCertificate);
    assert.equal(await service.getCertificate('CERT-002'), newCertificate);
    assert.deepEqual(calls, [
      { mode: 'evaluate', functionName: 'GetCertificate', args: ['CERT-001'] },
      { mode: 'evaluate', functionName: 'GetCertificate', args: ['CERT-002'] }
    ]);
  });
});
