import { Router } from 'express';
import { requireIssuerAdmin } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import {
  getAllCertificatesController,
  uploadCertificateController,
  verifyCertificateController,
} from "./certificate.controller";
import { asyncHandler } from '../../utils/asyncHandler';
import * as certificateController from './certificate.controller';

export const certificateRoutes = Router();

certificateRoutes.post('/ledger/init', asyncHandler(certificateController.initLedger));

certificateRoutes.post('/issuers', asyncHandler(certificateController.registerIssuer));
certificateRoutes.get('/issuers/:issuerId', asyncHandler(certificateController.getIssuer));
certificateRoutes.get('/issuers/:issuerId/exists', asyncHandler(certificateController.issuerExists));
certificateRoutes.get(
  '/issuers/:issuerId/certificates',
  asyncHandler(certificateController.getCertificatesByIssuer)
);

certificateRoutes.post('/certificates', asyncHandler(certificateController.issueCertificate));
certificateRoutes.get('/certificates', asyncHandler(certificateController.getAllCertificates));
certificateRoutes.get('/certificates/:certificateId', asyncHandler(certificateController.getCertificate));
certificateRoutes.get(
  '/certificates/:certificateId/exists',
  asyncHandler(certificateController.certificateExists)
);
certificateRoutes.post('/certificates/:certificateId/verify', asyncHandler(certificateController.verifyCertificate));
certificateRoutes.post('/certificates/:certificateId/revoke', asyncHandler(certificateController.revokeCertificate));
certificateRoutes.get(
  '/certificates/:certificateId/revocation',
  asyncHandler(certificateController.getRevocationInfo)
);
certificateRoutes.get('/certificates/:certificateId/history', asyncHandler(certificateController.getCertificateHistory));

certificateRoutes.post(
  "/upload",
  requireIssuerAdmin(),
  upload.single("file_ijazah"),
  asyncHandler(uploadCertificateController)
);

certificateRoutes.get(
  "/verify/:nomorIjazah",
  asyncHandler(verifyCertificateController)
);

certificateRoutes.get("/", asyncHandler(getAllCertificatesController));