import { env } from './env';

export type FabricConfig = {
  readonly channelName: string;
  readonly chaincodeName: string;
  readonly mspId: string;
  readonly peerEndpoint: string;
  readonly peerTlsHostOverride: string;
  readonly tlsCertPath: string;
  readonly clientCertPath: string;
  readonly clientKeyPath: string;
};

export const fabricConfig: FabricConfig = {
  channelName: env.FABRIC_CHANNEL_NAME,
  chaincodeName: env.FABRIC_CHAINCODE_NAME,
  mspId: env.FABRIC_MSP_ID,
  peerEndpoint: env.FABRIC_PEER_ENDPOINT,
  peerTlsHostOverride: env.FABRIC_PEER_TLS_HOST_OVERRIDE,
  tlsCertPath: env.FABRIC_TLS_CERT_PATH,
  clientCertPath: env.FABRIC_CLIENT_CERT_PATH,
  clientKeyPath: env.FABRIC_CLIENT_KEY_PATH
};
