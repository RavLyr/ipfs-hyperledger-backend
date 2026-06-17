import type { Request, Response } from 'express';

import { parseInvokeFabricBody } from './fabric.dto';
import * as fabricService from './fabric.service';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await fabricService.getFabricHealth();

  res.json({
    success: true,
    data: health
  });
}

export async function invoke(req: Request, res: Response): Promise<void> {
  const body = parseInvokeFabricBody(req.body as unknown);
  const data = await fabricService.invokeFabric(body);

  res.json({
    success: true,
    data
  });
}
