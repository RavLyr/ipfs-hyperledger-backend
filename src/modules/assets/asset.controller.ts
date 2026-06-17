import type { Request, Response } from 'express';

import {
  parseAssetIdParams,
  parseCreateAssetBody,
  parseTransferAssetBody,
  parseUpdateAssetBody
} from './asset.dto';
import * as assetService from './asset.service';

export async function getAssets(_req: Request, res: Response): Promise<void> {
  const assets = await assetService.getAllAssets();

  res.json({
    success: true,
    data: assets
  });
}

export async function getAsset(req: Request, res: Response): Promise<void> {
  const id = parseAssetIdParams(req.params);
  const asset = await assetService.getAssetById(id);

  res.json({
    success: true,
    data: asset
  });
}

export async function createAsset(req: Request, res: Response): Promise<void> {
  const body = parseCreateAssetBody(req.body as unknown);
  const result = await assetService.createAsset(body);

  res.status(201).json({
    success: true,
    message: 'Asset created successfully',
    data: result
  });
}

export async function updateAsset(req: Request, res: Response): Promise<void> {
  const id = parseAssetIdParams(req.params);
  const body = parseUpdateAssetBody(req.body as unknown);
  const result = await assetService.updateAsset(id, body);

  res.json({
    success: true,
    message: 'Asset updated successfully',
    data: result
  });
}

export async function deleteAsset(req: Request, res: Response): Promise<void> {
  const id = parseAssetIdParams(req.params);
  const result = await assetService.deleteAsset(id);

  res.json({
    success: true,
    message: 'Asset deleted successfully',
    data: result
  });
}

export async function transferAsset(req: Request, res: Response): Promise<void> {
  const id = parseAssetIdParams(req.params);
  const body = parseTransferAssetBody(req.body as unknown);
  const result = await assetService.transferAsset(id, body);

  res.json({
    success: true,
    message: 'Asset transferred successfully',
    data: result
  });
}
