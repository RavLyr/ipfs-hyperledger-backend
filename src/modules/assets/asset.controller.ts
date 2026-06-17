import type { Request, Response } from 'express';

import {
  assetIdParamsSchema,
  createAssetSchema,
  transferAssetSchema,
  updateAssetSchema
} from './asset.schema';
import * as assetService from './asset.service';

export async function getAssets(_req: Request, res: Response): Promise<void> {
  const assets = await assetService.getAllAssets();

  res.json({
    success: true,
    data: assets
  });
}

export async function getAsset(req: Request, res: Response): Promise<void> {
  const { params } = assetIdParamsSchema.parse({ params: req.params });
  const asset = await assetService.getAssetById(params.id);

  res.json({
    success: true,
    data: asset
  });
}

export async function createAsset(req: Request, res: Response): Promise<void> {
  const { body } = createAssetSchema.parse({ body: req.body });
  const result = await assetService.createAsset(body);

  res.status(201).json({
    success: true,
    message: 'Asset created successfully',
    data: result
  });
}

export async function updateAsset(req: Request, res: Response): Promise<void> {
  const { params, body } = updateAssetSchema.parse({ params: req.params, body: req.body });
  const result = await assetService.updateAsset(params.id, body);

  res.json({
    success: true,
    message: 'Asset updated successfully',
    data: result
  });
}

export async function deleteAsset(req: Request, res: Response): Promise<void> {
  const { params } = assetIdParamsSchema.parse({ params: req.params });
  const result = await assetService.deleteAsset(params.id);

  res.json({
    success: true,
    message: 'Asset deleted successfully',
    data: result
  });
}

export async function transferAsset(req: Request, res: Response): Promise<void> {
  const { params, body } = transferAssetSchema.parse({ params: req.params, body: req.body });
  const result = await assetService.transferAsset(params.id, body);

  res.json({
    success: true,
    message: 'Asset transferred successfully',
    data: result
  });
}
