import type { Request, Response } from 'express';

import {
  parseCertificateIdParams,
  parseIssueCertificateBody,
  parseIssuerParams,
  parseRegisterIssuerBody,
  parseReissueCertificateBody,
  parseRevokeCertificateBody,
  parseVerifyCertificateBody
} from './certificate.dto';
import {
  certificateService,
  getAllCertificatesService,
  uploadCertificate,
  verifyCertificateService
} from './certificate.service';
import { getIPFSGatewayUrl } from '../../infrastructure/ipfs/ipfs.service';

export async function initLedger(_req: Request, res: Response): Promise<void> {
  const result = await certificateService.initLedger();

  res.json({ success: true, message: 'Ledger initialized successfully', data: result });
}

export async function registerIssuer(req: Request, res: Response): Promise<void> {
  const input = parseRegisterIssuerBody(req.body as unknown);
  const result = await certificateService.registerIssuer(input);

  res.status(201).json({ success: true, message: 'Issuer registered successfully', data: result });
}

export async function getIssuer(req: Request, res: Response): Promise<void> {
  const issuer = parseIssuerParams(req.params);
  const result = await certificateService.getIssuer(issuer);

  res.json({ success: true, data: result });
}

export async function issuerExists(req: Request, res: Response): Promise<void> {
  const issuer = parseIssuerParams(req.params);
  const result = await certificateService.issuerExists(issuer);

  res.json({ success: true, data: result });
}

export async function issueCertificate(req: Request, res: Response): Promise<void> {
  const input = parseIssueCertificateBody(req.body as unknown);
  const result = await certificateService.issueCertificate(input);

  res.status(201).json({
    success: true,
    message: 'Certificate issued successfully',
    data: {
      certificateId: input.certificateId,
      fabricResult: result
    }
  });
}

export async function getCertificate(req: Request, res: Response): Promise<void> {
  const certificateId = parseCertificateIdParams(req.params);
  const result = await certificateService.getCertificate(certificateId);

  res.json({ success: true, data: result });
}

export async function certificateExists(req: Request, res: Response): Promise<void> {
  const certificateId = parseCertificateIdParams(req.params);
  const result = await certificateService.certificateExists(certificateId);

  res.json({ success: true, data: result });
}

export async function verifyCertificate(req: Request, res: Response): Promise<void> {
  const input = parseVerifyCertificateBody(req.params, req.body as unknown);
  const result = await certificateService.verifyCertificate(input);

  res.json({ success: true, data: result });
}

export async function revokeCertificate(req: Request, res: Response): Promise<void> {
  const input = parseRevokeCertificateBody(req.params, req.body as unknown);
  const result = await certificateService.revokeCertificate(input);

  res.json({ success: true, message: 'Certificate revoked successfully', data: result });
}

export async function getRevocationInfo(req: Request, res: Response): Promise<void> {
  const certificateId = parseCertificateIdParams(req.params);
  const result = await certificateService.getRevocationInfo(certificateId);

  res.json({ success: true, data: result });
}

export async function reissueCertificate(req: Request, res: Response): Promise<void> {
  const input = parseReissueCertificateBody(req.params, req.body as unknown);
  const result = await certificateService.reissueCertificate(input);

  res.status(201).json({
    success: true,
    message: 'Certificate reissued successfully',
    data: {
      oldCertificateId: input.oldCertificateId,
      newCertificateId: input.newCertificateId,
      fabricResult: result
    }
  });
}

export async function getCertificateHistory(req: Request, res: Response): Promise<void> {
  const certificateId = parseCertificateIdParams(req.params);
  const result = await certificateService.getCertificateHistory(certificateId);

  res.json({ success: true, data: result });
}

export async function getAllCertificates(req: Request, res: Response): Promise<void> {
  const issuer = typeof req.query.issuer === 'string' ? req.query.issuer.trim() : undefined;
  const result = issuer
    ? await certificateService.getCertificatesByIssuer(issuer)
    : await certificateService.getAllCertificates();

  res.json({ success: true, data: result });
}

export async function getCertificatesByIssuer(req: Request, res: Response): Promise<void> {
  const issuer = parseIssuerParams(req.params);
  const result = await certificateService.getCertificatesByIssuer(issuer);

  res.json({ success: true, data: result });
}

export async function uploadCertificateController(
  req: Request,
  res: Response
): Promise<void> {
  const certificate = await uploadCertificate(req.body, req.file);

  res.status(201).json({
    success: true,
    message: 'Certificate uploaded successfully',
    data: certificate
  });
}

export async function verifyCertificateController(
  req: Request,
  res: Response
): Promise<void> {
  const nomorIjazah = typeof req.params.nomorIjazah === 'string' ? req.params.nomorIjazah : '';
  const certificate = await verifyCertificateService(nomorIjazah);

  if (!certificate) {
    res.json({
      success: true,
      valid: false,
      message: 'Certificate not found in database',
      data: null
    });
    return;
  }

  try {
    const ledgerResult = await certificateService.verifyCertificate({
      certificateId: certificate.certificateId,
      ipfsCid: certificate.ipfsCid
    });

    const valid = Boolean(
      ledgerResult && typeof ledgerResult === 'object' && 'valid' in ledgerResult && (ledgerResult as { valid?: unknown }).valid === true
    );

    res.json({
      success: true,
      valid,
      message:
        ledgerResult && typeof ledgerResult === 'object' && 'message' in ledgerResult && typeof (ledgerResult as { message?: unknown }).message === 'string'
          ? (ledgerResult as { message: string }).message
          : 'Ledger verification failed',
      ledgerData: ledgerResult,
      dbData: certificate,
      documentUrl: valid ? getIPFSGatewayUrl(certificate.ipfsCid) : null
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Verification failed';

    res.json({
      success: true,
      valid: certificate.status === 'VALID',
      message: `Ledger verification unavailable: ${errorMessage}`,
      ledgerData: null,
      dbData: certificate,
      documentUrl: getIPFSGatewayUrl(certificate.ipfsCid)
    });
  }
}

export async function getAllCertificatesController(
  req: Request,
  res: Response
): Promise<void> {
  const issuer = typeof req.query.issuer === 'string' ? req.query.issuer.trim() : undefined;
  const certificates = await getAllCertificatesService(issuer);

  res.json({
    success: true,
    data: certificates
  });
}
