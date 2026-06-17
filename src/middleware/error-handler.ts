import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

type ErrorWithStatus = Error & {
  statusCode?: number;
  status?: number;
  details?: unknown;
};

export const errorHandler: ErrorRequestHandler = (err: ErrorWithStatus, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: err.flatten()
      }
    });
    return;
  }

  const statusCode = err.statusCode ?? err.status ?? 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      details: err.details
    }
  });
};
