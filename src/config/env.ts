import dotenv from 'dotenv';

import { AppError } from '../errors/AppError';

dotenv.config();

export type Env = {
  readonly PORT: number;
  readonly FABRIC_CHANNEL_NAME: string;
  readonly FABRIC_CHAINCODE_NAME: string;
  readonly FABRIC_MSP_ID: string;
  readonly FABRIC_PEER_ENDPOINT: string;
  readonly FABRIC_PEER_TLS_HOST_OVERRIDE: string;
  readonly FABRIC_TLS_CERT_PATH: string;
  readonly FABRIC_CLIENT_CERT_PATH: string;
  readonly FABRIC_CLIENT_KEY_PATH: string;
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USER: string;
  readonly DB_PASSWORD: string;
  readonly DB_NAME: string;
  readonly IPFS_API_URL: string;
  readonly IPFS_GATEWAY_URL: string;
  readonly PUBLIC_API_URL: string;
  readonly JWT_SECRET: string;
};

function readString(name: keyof Omit<Env, 'PORT'>): string {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`Invalid environment variable: ${name}`, 500);
  }

  return value.trim();
}

function readPort(): number {
  const rawValue = process.env.PORT ?? '3000';
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port <= 0) {
    throw new AppError('Invalid environment variable: PORT', 500, {
      PORT: 'Expected a positive integer'
    });
  }

  return port;
}

function readPublicUrl(name: "PUBLIC_API_URL" | "IPFS_GATEWAY_URL", fallback: string): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError("Invalid environment variable: " + name, 500);
  }

  return fallback;
}


function readJwtSecret(): string {
  const value = process.env.JWT_SECRET?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError("Invalid environment variable: JWT_SECRET", 500);
  }

  return "dev_jwt_secret_change_me";
}

export const env: Env = {
  PORT: readPort(),
  FABRIC_CHANNEL_NAME: readString('FABRIC_CHANNEL_NAME'),
  FABRIC_CHAINCODE_NAME: readString('FABRIC_CHAINCODE_NAME'),
  FABRIC_MSP_ID: readString('FABRIC_MSP_ID'),
  FABRIC_PEER_ENDPOINT: readString('FABRIC_PEER_ENDPOINT'),
  FABRIC_PEER_TLS_HOST_OVERRIDE: readString('FABRIC_PEER_TLS_HOST_OVERRIDE'),
  FABRIC_TLS_CERT_PATH: readString('FABRIC_TLS_CERT_PATH'),
  FABRIC_CLIENT_CERT_PATH: readString('FABRIC_CLIENT_CERT_PATH'),
  FABRIC_CLIENT_KEY_PATH: readString('FABRIC_CLIENT_KEY_PATH'),
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: Number(process.env.DB_PORT || 5433),
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD || "password",
  DB_NAME: process.env.DB_NAME || "ipfs_hyperledger_db",
  IPFS_API_URL: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
  IPFS_GATEWAY_URL: readPublicUrl("IPFS_GATEWAY_URL", "http://127.0.0.1:8081"),
  PUBLIC_API_URL: readPublicUrl("PUBLIC_API_URL", "http://localhost:3000"),
  JWT_SECRET: readJwtSecret(),
};
