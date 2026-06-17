import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  FABRIC_CHANNEL_NAME: z.string().min(1),
  FABRIC_CHAINCODE_NAME: z.string().min(1),
  FABRIC_MSP_ID: z.string().min(1),
  FABRIC_PEER_ENDPOINT: z.string().min(1),
  FABRIC_PEER_TLS_HOST_OVERRIDE: z.string().min(1),
  FABRIC_TLS_CERT_PATH: z.string().min(1),
  FABRIC_CLIENT_CERT_PATH: z.string().min(1),
  FABRIC_CLIENT_KEY_PATH: z.string().min(1)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment variables: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`);
}

export const env = parsedEnv.data;
