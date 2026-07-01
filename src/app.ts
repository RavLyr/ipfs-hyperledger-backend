import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { authRoutes } from './modules/auth/auth.routes';
import { verifyCertificateController } from './modules/certificates/certificate.controller';
import { certificateRoutes } from './modules/certificates/certificate.routes';
import { fabricRoutes } from './modules/fabric/fabric.routes';
import { asyncHandler } from './utils/asyncHandler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    success: true,
    message: 'Server is running'
  });
});

app.get('/verify/:nomorIjazah', asyncHandler(verifyCertificateController));

app.use('/auth', authRoutes);
app.use('/fabric', fabricRoutes);
app.use('/api/fabric', fabricRoutes);
app.use('/api', certificateRoutes);
app.use('/certificates', certificateRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
