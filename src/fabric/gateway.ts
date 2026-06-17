import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

import * as grpc from '@grpc/grpc-js';
import { connect, Gateway, Identity, Signer, signers } from '@hyperledger/fabric-gateway';

import { env } from '../config/env';

let gateway: Gateway | undefined;
let grpcClient: grpc.Client | undefined;

async function newGrpcConnection(): Promise<grpc.Client> {
  const tlsRootCert = await fs.readFile(env.FABRIC_TLS_CERT_PATH);
  const credentials = grpc.credentials.createSsl(tlsRootCert);

  return new grpc.Client(env.FABRIC_PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': env.FABRIC_PEER_TLS_HOST_OVERRIDE
  });
}

async function newIdentity(): Promise<Identity> {
  const credentials = await fs.readFile(env.FABRIC_CLIENT_CERT_PATH);

  return {
    mspId: env.FABRIC_MSP_ID,
    credentials
  };
}

async function newSigner(): Promise<Signer> {
  const privateKeyPem = await fs.readFile(env.FABRIC_CLIENT_KEY_PATH);
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  return signers.newPrivateKeySigner(privateKey);
}

export async function getGateway(): Promise<Gateway> {
  if (gateway) {
    return gateway;
  }

  grpcClient = await newGrpcConnection();
  gateway = connect({
    client: grpcClient,
    identity: await newIdentity(),
    signer: await newSigner(),
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    endorseOptions: () => ({ deadline: Date.now() + 15000 }),
    submitOptions: () => ({ deadline: Date.now() + 5000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 })
  });

  return gateway;
}

export function closeGateway(): void {
  gateway?.close();
  grpcClient?.close();
  gateway = undefined;
  grpcClient = undefined;
}
