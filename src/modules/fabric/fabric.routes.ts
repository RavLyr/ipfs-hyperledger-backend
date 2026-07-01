import { Router } from 'express';

import { requireIssuerAdmin } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as fabricController from './fabric.controller';

export const fabricRoutes = Router();

fabricRoutes.get('/health', requireIssuerAdmin(), asyncHandler(fabricController.getHealth));
fabricRoutes.post('/invoke', requireIssuerAdmin(), asyncHandler(fabricController.invoke));
