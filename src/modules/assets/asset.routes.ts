import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler';
import * as assetController from './asset.controller';

export const assetRoutes = Router();

assetRoutes.get('/', asyncHandler(assetController.getAssets));
assetRoutes.get('/:id', asyncHandler(assetController.getAsset));
assetRoutes.post('/', asyncHandler(assetController.createAsset));
assetRoutes.put('/:id', asyncHandler(assetController.updateAsset));
assetRoutes.delete('/:id', asyncHandler(assetController.deleteAsset));
assetRoutes.post('/:id/transfer', asyncHandler(assetController.transferAsset));
