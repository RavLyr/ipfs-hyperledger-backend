import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

import type { Identity, Signer } from '@hyperledger/fabric-gateway';
import { signers } from '@hyperledger/fabric-gateway';

import type { FabricConfig } from '../../config/fabric.config';

export async function createIdentity(config: FabricConfig): Promise<Identity> {
  const credentials = await fs.readFile(config.clientCertPath);

  return {
    mspId: config.mspId,
    credentials
  };
}

export async function createSigner(config: FabricConfig): Promise<Signer> {
  const privateKeyPem = await fs.readFile(config.clientKeyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  return signers.newPrivateKeySigner(privateKey);
}
