import { Router } from 'express';

import { requireIssuerAdmin } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  getAllCertificatesController,
  uploadCertificateController,
  verifyCertificateController,
} from './certificate.controller';
import * as certificateController from './certificate.controller';

export const certificateRoutes = Router();

certificateRoutes.post('/ledger/init', requireIssuerAdmin(), asyncHandler(certificateController.initLedger));

certificateRoutes.post('/issuers', requireIssuerAdmin(), asyncHandler(certificateController.registerIssuer));
certificateRoutes.get('/issuers/:issuerId', requireIssuerAdmin(), asyncHandler(certificateController.getIssuer));
certificateRoutes.get('/issuers/:issuerId/exists', requireIssuerAdmin(), asyncHandler(certificateController.issuerExists));
certificateRoutes.get(
  '/issuers/:issuerId/certificates',
  requireIssuerAdmin(),
  asyncHandler(certificateController.getCertificatesByIssuer)
);

certificateRoutes.post('/certificates', requireIssuerAdmin(), asyncHandler(certificateController.issueCertificate));
certificateRoutes.get('/certificates', requireIssuerAdmin(), asyncHandler(certificateController.getAllCertificates));
certificateRoutes.get('/certificates/:certificateId', requireIssuerAdmin(), asyncHandler(certificateController.getCertificate));
certificateRoutes.get(
  '/certificates/:certificateId/exists',
  requireIssuerAdmin(),
  asyncHandler(certificateController.certificateExists)
);
certificateRoutes.post('/certificates/:certificateId/verify', requireIssuerAdmin(), asyncHandler(certificateController.verifyCertificate));
certificateRoutes.post('/certificates/:certificateId/revoke', requireIssuerAdmin(), asyncHandler(certificateController.revokeCertificate));
certificateRoutes.get(
  '/certificates/:certificateId/revocation',
  requireIssuerAdmin(),
  asyncHandler(certificateController.getRevocationInfo)
);
certificateRoutes.get('/certificates/:certificateId/history', requireIssuerAdmin(), asyncHandler(certificateController.getCertificateHistory));

certificateRoutes.post(
  '/upload',
  requireIssuerAdmin(),
  upload.single('file_ijazah'),
  asyncHandler(uploadCertificateController)
);

certificateRoutes.get(
  '/verify/:nomorIjazah',
  asyncHandler(verifyCertificateController)
);

certificateRoutes.get('/', asyncHandler(getAllCertificatesController));
