import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import * as authController from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/register', asyncHandler(authController.register));
