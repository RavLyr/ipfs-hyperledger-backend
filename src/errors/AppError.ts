export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
