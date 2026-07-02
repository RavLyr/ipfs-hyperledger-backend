import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { findIssuerByIdentifier as findIssuerByIssuerId, type AuthenticatedIssuer } from '../modules/certificates/certificate.repository';

export type AuthRole = 'ISSUER_ADMIN';

export type AuthTokenPayload = {
  readonly issuerId: string;
  readonly role: AuthRole;
};

export type RequestAuthContext = {
  readonly issuer: AuthenticatedIssuer;
  readonly token: AuthTokenPayload;
};

export type AuthMiddlewareDependencies = {
  readonly verifyToken: (token: string) => unknown;
  readonly findIssuerByIssuerId: (issuerId: string) => Promise<AuthenticatedIssuer | null>;
};

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuthContext;
    }
  }
}

function readBearerToken(headerValue: string | undefined): string {
  if (!headerValue) {
    throw new AppError('Authorization header is required', 401);
  }

  const [scheme, token] = headerValue.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Authorization header must use Bearer token', 401);
  }

  return token;
}

function isTokenPayload(value: unknown): value is AuthTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return payload.role === 'ISSUER_ADMIN' && typeof payload.issuerId === 'string' && payload.issuerId.trim().length > 0;
}

export function createAuthenticateRequest(dependencies: AuthMiddlewareDependencies) {
  return async function authenticateRequest(authHeader: string | undefined): Promise<RequestAuthContext> {
    const token = readBearerToken(authHeader);

    let payload: unknown;
    try {
      payload = dependencies.verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    if (!isTokenPayload(payload)) {
      throw new AppError('Invalid token payload', 401);
    }

    const issuer = await dependencies.findIssuerByIssuerId(payload.issuerId);

    if (!issuer || !issuer.isActive || issuer.status !== 'ACTIVE') {
      throw new AppError('Authenticated issuer is inactive or missing', 403);
    }

    return {
      issuer,
      token: payload
    };
  };
}

const authenticateRequest = createAuthenticateRequest({
  verifyToken: (token) => jwt.verify(token, env.JWT_SECRET),
  findIssuerByIssuerId,
});

function createRoleGuard(
  authenticate: (authHeader: string | undefined) => Promise<RequestAuthContext>,
  requiredRole?: AuthRole,
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void authenticate(req.header('authorization'))
      .then((auth): void => {
        if (requiredRole && auth.token.role !== requiredRole) {
          throw new AppError('Issuer admin role is required', 403);
        }

        req.auth = auth;
        next();
      })
      .catch(next);
  };
}

export function requireAuth(): RequestHandler {
  return createRoleGuard(authenticateRequest);
}

export function requireIssuerAdmin(): RequestHandler {
  return createRoleGuard(authenticateRequest, 'ISSUER_ADMIN');
}

export function createRequireAuth(dependencies: AuthMiddlewareDependencies): RequestHandler {
  return createRoleGuard(createAuthenticateRequest(dependencies));
}

export function createRequireIssuerAdmin(dependencies: AuthMiddlewareDependencies): RequestHandler {
  return createRoleGuard(createAuthenticateRequest(dependencies), 'ISSUER_ADMIN');
}
