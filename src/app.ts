import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { evaluateTransaction } from './fabric/fabric.service';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { assetRoutes } from './modules/assets/asset.routes';
import { asyncHandler } from './utils/async-handler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok'
  });
});

app.get(
  '/fabric/health',
  asyncHandler(async (_req, res) => {
    const assets = await evaluateTransaction('GetAllAssets');
    const itemCount = Array.isArray(assets) ? assets.length : null;

    res.json({
      success: true,
      data: {
        status: 'connected',
        itemCount
      }
    });
  })
);

app.use('/assets', assetRoutes);

app.use(notFound);
app.use(errorHandler);
