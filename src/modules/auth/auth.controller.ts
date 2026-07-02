import type { Request, Response } from 'express';

import { parseLoginBody } from '../certificates/certificate.dto';
import { loginIssuer } from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseLoginBody(req.body as unknown);
  const data = await loginIssuer(input);

  res.json({
    success: true,
    data
  });
}

import { parseRegisterBody } from '../certificates/certificate.dto';
import { registerIssuer } from './auth.service';

export async function register(req: Request, res: Response): Promise<void> {
  const input = parseRegisterBody(req.body as unknown);
  await registerIssuer(input);

  res.status(201).json({
    success: true,
    message: 'Issuer registered successfully'
  });
}
