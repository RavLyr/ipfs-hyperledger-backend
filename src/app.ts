import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorMiddleware } from './middlewares/error.middleware';
import { notFoundMiddleware } from './middlewares/not-found.middleware';
import { assetRoutes } from './modules/assets/asset.routes';
import { fabricRoutes } from './modules/fabric/fabric.routes';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok'
  });
});

app.use('/fabric', fabricRoutes);
app.use('/api/fabric', fabricRoutes);
app.use('/assets', assetRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
