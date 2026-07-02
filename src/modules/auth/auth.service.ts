import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import type { AuthRole } from '../../middleware/auth.middleware';
import type { LoginInput } from '../certificates/certificate.dto';
import {
  findIssuerByIdentifier,
  updateIssuerLastLogin,
  type AuthenticatedIssuer,
} from '../certificates/certificate.repository';

export type LoginResult = {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly issuer: {
    readonly issuerId: string;
    readonly organizationName: string;
    readonly departmentName: string;
    readonly mspId: string;
    readonly username: string;
    readonly email: string;
  };
};

export type AuthServiceDependencies = {
  readonly findIssuerByIdentifier: (identifier: string) => Promise<AuthenticatedIssuer | null>;
  readonly updateIssuerLastLogin: (issuerId: string, loggedInAt: Date) => Promise<void>;
  readonly comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
  readonly signToken: (issuerId: string, role: AuthRole) => string;
};

function assertIssuerIsActive(issuer: AuthenticatedIssuer): void {
  if (!issuer.isActive || issuer.status !== 'ACTIVE') {
    throw new AppError('Issuer account is inactive', 403);
  }
}

function signAccessToken(issuerId: string, role: AuthRole): string {
  return jwt.sign({ issuerId, role }, env.JWT_SECRET, { expiresIn: '12h' });
}

export function createLoginIssuerService(dependencies: AuthServiceDependencies) {
  return async function loginIssuer(input: LoginInput): Promise<LoginResult> {
    const issuer = await dependencies.findIssuerByIdentifier(input.identifier);

    if (!issuer) {
      throw new AppError('Invalid credentials', 401);
    }

    assertIssuerIsActive(issuer);

    const passwordMatches = await dependencies.comparePassword(input.password, issuer.passwordHash);

    if (!passwordMatches) {
      throw new AppError('Invalid credentials', 401);
    }

    const now = new Date();
    await dependencies.updateIssuerLastLogin(issuer.issuerId, now);

    return {
      accessToken: dependencies.signToken(issuer.issuerId, 'ISSUER_ADMIN'),
      tokenType: 'Bearer',
      issuer: {
        issuerId: issuer.issuerId,
        organizationName: issuer.organizationName,
        departmentName: issuer.departmentName,
        mspId: issuer.mspId,
        username: issuer.username,
        email: issuer.email,
      }
    };
  };
}

export const loginIssuer = createLoginIssuerService({
  findIssuerByIdentifier,
  updateIssuerLastLogin,
  comparePassword: bcrypt.compare,
  signToken: signAccessToken,
});

import { createIssuerAccount } from '../certificates/certificate.repository';
import type { RegisterInput } from '../certificates/certificate.dto';

export async function registerIssuer(input: RegisterInput): Promise<void> {
  const existingIssuer = await findIssuerByIdentifier(input.issuerId);
  if (existingIssuer) {
    throw new AppError('Issuer already exists', 400);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(input.passwordRaw, saltRounds);

  await createIssuerAccount({
    ...input,
    passwordHash
  });
}
