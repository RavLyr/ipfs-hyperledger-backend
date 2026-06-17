import type { RequestHandler } from 'express';

import { AppError } from '../errors/AppError';

export const notFoundMiddleware: RequestHandler = (req, _res, next): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};
