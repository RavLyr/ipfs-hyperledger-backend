// @ts-nocheck
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
      issuerId: 'DEMO_ISSUER',
      organizationName: 'Demo University',
      departmentName: 'Academic Office',
      mspId: 'Org1MSP'
    });

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:RegisterIssuer',
        args: ['DEMO_ISSUER', 'Demo University', 'Academic Office', 'Org1MSP']
      }
    ]);
  });

  it('issues certificate with IssueCertificate argument order and hashes raw inputs before ledger call', async () => {
    const { gateway, calls } = createMockGateway();
    const service = createCertificateService(gateway);
    const input = parseIssueCertificateBody({
      certificateId: 'CERT-001',
      certificateNumber: 'NO-001',
      studentId: 'NIM-RAW-001',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      title: 'Bachelor Certificate',
      ipfsCid: 'bafy-certificate',
      issuedAt: '2026-06-18T00:00:00Z'
    });

    await service.issueCertificate(input);

    assert.deepEqual(calls, [
      {
        mode: 'submit',
        functionName: 'SmartContract:IssueCertificate',
        args: [
          'CERT-001',
          'NO-001',
          sha256Hex('NIM-RAW-001'),
          'DEMO_ISSUER',
          'DIPLOMA',
          'Bachelor Certificate',
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
      },
      async submitTransactionWithTxId(): Promise<{ transactionId: string; result: unknown }> {
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

  it('returns tampered verification result from chaincode unchanged', async () => {
    const expected = {
      certificateId: 'CERT-001',
      valid: false,
      status: 'ACTIVE',
      issuerId: 'DEMO_ISSUER',
      certificateType: 'DIPLOMA',
      message: 'IPFS CID does not match certificate record',
      issuedAt: '2026-06-18T00:00:00Z',
      revoked: false,
      tampered: true
    };
    const { gateway } = createMockGateway({ VerifyCertificate: expected });
    const service = createCertificateService(gateway);

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', ipfsCid: 'wrong-cid' });

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
        functionName: 'SmartContract:RevokeCertificate',
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

    const result = await service.verifyCertificate({ certificateId: 'CERT-001', ipfsCid: 'ipfs-cid' });

    assert.equal(result, expected);
  });

  it('derives issuer compatibility fields from authenticated issuer during upload', async () => {
    const findCalls: string[] = [];
    const uploaded: Record<string, unknown>[] = [];
    const { gateway, calls } = createMockGateway({ IssuerExists: false, IssueCertificate: true });
    const uploadService = createUploadCertificateService({
      uploadToIPFS: async () => 'bafy-uploaded',
      findCertificateByCertificateNumber: async (certificateNumber: string) => {
        findCalls.push(certificateNumber);
        return null;
      },
      insertCertificate: async (data) => {
        uploaded.push(data as unknown as Record<string, unknown>);
        return {
          id: 1,
          certificateId: data.certificateId,
          certificateNumber: data.certificateNumber,
          issuerId: data.issuerId,
          certificateType: data.certificateType,
          degreeTitle: data.degreeTitle,
          studentId: data.studentId,
          studentName: data.studentName,
          organizationName: data.organizationName,
          studyProgram: data.studyProgram,
          educationLevel: data.educationLevel,
          graduationDate: data.graduationDate || null,

          ipfsCid: data.ipfsCid,
          file_name: data.file_name,
          mime_type: data.mime_type,
          file_size: data.file_size,
          ledger_tx_id: data.ledger_tx_id,
          status: data.status,
          issuedAt: data.issuedAt,
          created_at: '2026-07-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
        };
      }
    });

    const result = await uploadService(
      {
        certificateId: 'CERT-UP-1',
        certificateNumber: 'NO-UP-1',
        issuerId: 'SHOULD-NOT-BE-USED',
        organizationName: 'Fake Org',
        departmentName: 'Fakultas Kedokteran',
        mspId: 'FakeMSP',
        certificateType: 'DIPLOMA',
        degreeTitle: 'Sarjana Teknik',
        studentId: 'NIM-001',
        studentName: 'Budi',
        studyProgram: 'Teknik Sipil',
        educationLevel: 'S1',
        issuedAt: '2026-06-27',
      },
      {
        fieldname: 'file_ijazah',
        originalname: 'ijazah.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1234,
        buffer: Buffer.from('pdf'),
        stream: undefined as never,
        destination: '',
        filename: '',
        path: ''
      },
      authenticatedIssuer
    );

    assert.deepEqual(findCalls, ['NO-UP-1']);
    assert.equal(result.issuerId, 'UNDIP');
    assert.equal(result.organizationName, 'Universitas Diponegoro');
    assert.equal(uploaded[0]?.['issuerId'], 'UNDIP');
    assert.equal(uploaded[0]?.['organizationName'], 'Universitas Diponegoro');
    assert.deepEqual(calls.map((call) => ({ functionName: call.functionName, args: call.args })), [
      { functionName: 'SmartContract:IssuerExists', args: ['UNDIP'] },
      { functionName: 'SmartContract:RegisterIssuer', args: ['UNDIP', 'Universitas Diponegoro', 'Fakultas Kedokteran', 'Org1MSP'] },
      {
        functionName: 'SmartContract:IssueCertificate',
        args: ['CERT-UP-1', 'NO-UP-1', sha256Hex('NIM-001'), 'UNDIP', 'DIPLOMA', 'Sarjana Teknik', 'bafy-uploaded', 'bafy-uploaded', '2026-06-27', '']
      }
    ]);
  });
});


describe('auth middleware', () => {
  it('rejects invalid JWT', async () => {
    const middleware = createRequireAuth({
      verifyToken: () => {
        throw new Error('bad token');
      },
      findIssuerByIssuerId: async () => authenticatedIssuer,
    });

    await new Promise<void>((resolve, reject) => {
      middleware(
        {
          header: () => 'Bearer invalid-token',
        } as never,
        {} as never,
        (err?: unknown) => {
          try {
            assert.ok(err instanceof AppError);
            assert.equal(err.statusCode, 401);
            assert.equal(err.message, 'Invalid or expired token');
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  });

  it('allows issuer admin and attaches authenticated issuer', async () => {
    const middleware = createRequireIssuerAdmin({
      verifyToken: () => ({ issuerId: 'UNDIP', role: 'ISSUER_ADMIN' }),
      findIssuerByIssuerId: async () => authenticatedIssuer,
    });

    const req = {
      header: () => 'Bearer valid-token',
      auth: undefined,
    } as unknown as Parameters<ReturnType<typeof createRequireIssuerAdmin>>[0];

    await new Promise<void>((resolve, reject) => {
      middleware(req, {} as never, (err?: unknown) => {
        try {
          assert.equal(err, undefined);
          assert.equal(req.auth?.issuer.issuerId, 'UNDIP');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
});
