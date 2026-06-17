import type { Contract } from '@hyperledger/fabric-gateway';

import { env } from '../config/env';
import { getGateway } from './gateway';

export async function getContract(): Promise<Contract> {
  const gateway = await getGateway();
  const network = gateway.getNetwork(env.FABRIC_CHANNEL_NAME);

  return network.getContract(env.FABRIC_CHAINCODE_NAME);
}
