import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { certificateRoutes } from './modules/certificates/certificate.routes';
import { fabricRoutes } from './modules/fabric/fabric.routes';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    success: true,
    message: "Server is running"
  });
});

import { authRoutes } from './modules/auth/auth.routes';

app.use('/fabric', fabricRoutes);
app.use('/api/fabric', fabricRoutes);
app.use('/api', certificateRoutes);
app.use('/auth', authRoutes);
app.use("/certificates", certificateRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
