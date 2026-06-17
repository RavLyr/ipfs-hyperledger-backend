import type { ErrorRequestHandler } from 'express';

import { AppError } from '../errors/AppError';

type ErrorResponse = {
  readonly success: false;
  readonly error: {
    readonly message: string;
    readonly details?: unknown;
  };
};

export const errorMiddleware: ErrorRequestHandler = (err: unknown, _req, res, _next): void => {
  const appError = toAppError(err);
  const response: ErrorResponse = {
    success: false,
    error: {
      message: appError.message,
      details: appError.details
    }
  };

  res.status(appError.statusCode).json(response);
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof Error) {
    return new AppError(err.message || 'Internal server error', 500);
  }

  return new AppError('Internal server error', 500);
}
