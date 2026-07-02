import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import * as fabricController from './fabric.controller';

export const fabricRoutes = Router();

fabricRoutes.get('/health', asyncHandler(fabricController.getHealth));
fabricRoutes.post('/invoke', asyncHandler(fabricController.invoke));
