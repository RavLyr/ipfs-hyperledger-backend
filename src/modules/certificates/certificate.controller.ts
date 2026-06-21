import type { Request, Response } from 'express';

import {
  parseCertificateIdParams,
  parseIssueCertificateBody,
  parseIssuerIdParams,
  parseRegisterIssuerBody,
  parseReissueCertificateBody,
  parseRevokeCertificateBody,
  parseVerifyCertificateBody,
} from './certificate.dto';
import { certificateService,
    getAllCertificatesService,
    uploadCertificate,
    verifyCertificateService   , } from './certificate.service';

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
  const issuerId = parseIssuerIdParams(req.params);
  const result = await certificateService.getIssuer(issuerId);

  res.json({ success: true, data: result });
}

export async function issuerExists(req: Request, res: Response): Promise<void> {
  const issuerId = parseIssuerIdParams(req.params);
  const result = await certificateService.issuerExists(issuerId);

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

export async function getAllCertificates(_req: Request, res: Response): Promise<void> {
  const result = await certificateService.getAllCertificates();

  res.json({ success: true, data: result });
}

export async function getCertificatesByIssuer(req: Request, res: Response): Promise<void> {
  const issuerId = parseIssuerIdParams(req.params);
  const result = await certificateService.getCertificatesByIssuer(issuerId);

  res.json({ success: true, data: result });
}



export async function uploadCertificateController(
  req: Request,
  res: Response
): Promise<void> {
  const certificate = await uploadCertificate(req.body, req.file);

  res.status(201).json({
    success: true,
    message: "Certificate uploaded successfully",
    data: certificate,
  });
}

type VerifyCertificateParams = {
  nomorIjazah: string;
};

export async function verifyCertificateController(
  req: Request<VerifyCertificateParams>,
  res: Response
): Promise<void> {
  const certificate = await verifyCertificateService(req.params.nomorIjazah);

  if (!certificate) {
    res.json({
      success: true,
      valid: false,
      data: null,
    });
    return;
  }

  res.json({
    success: true,
    valid: true,
    data: certificate,
  });
}

export async function getAllCertificatesController(
  _req: Request,
  res: Response
): Promise<void> {
  const certificates = await getAllCertificatesService();

  res.json({
    success: true,
    data: certificates,
  });
}