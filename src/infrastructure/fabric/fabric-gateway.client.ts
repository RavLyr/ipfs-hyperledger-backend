import { promises as fs } from 'node:fs';

import * as grpc from '@grpc/grpc-js';
import type { Contract, Gateway } from '@hyperledger/fabric-gateway';
import { connect } from '@hyperledger/fabric-gateway';

import type { FabricConfig } from '../../config/fabric.config';
import { createIdentity, createSigner } from './fabric-identity';
import type { FabricResult } from './fabric-result';
import { decodeFabricResult } from './fabric-result';

export type FabricSubmitResult = {
  readonly transactionId: string;
  readonly result: FabricResult;
};

export class FabricGatewayClient {
  private gateway?: Gateway;
  private grpcClient?: grpc.Client;

  public constructor(private readonly config: FabricConfig) {}

  public async evaluateTransaction(functionName: string, args: readonly string[] = []): Promise<FabricResult> {
    const contract = await this.getContract();
    const result = await contract.evaluateTransaction(functionName, ...args);

    return decodeFabricResult(result);
  }

  public async submitTransaction(functionName: string, args: readonly string[] = []): Promise<FabricResult> {
    const contract = await this.getContract();
    const result = await contract.submitTransaction(functionName, ...args);

    return decodeFabricResult(result);
  }

  public async submitTransactionWithTxId(
    functionName: string,
    args: readonly string[] = []
  ): Promise<FabricSubmitResult> {
    const contract = await this.getContract();
    const submittedTransaction = await contract.submitAsync(functionName, { arguments: [...args] });
    const status = await submittedTransaction.getStatus();

    if (!status.successful) {
      throw new Error(`transaction ${status.transactionId} failed with status code ${status.code}`);
    }

    return {
      transactionId: submittedTransaction.getTransactionId(),
      result: decodeFabricResult(submittedTransaction.getResult())
    };
  }

  public close(): void {
    this.gateway?.close();
    this.grpcClient?.close();
    this.gateway = undefined;
    this.grpcClient = undefined;
  }

  private async getContract(): Promise<Contract> {
    const gateway = await this.getGateway();
    const network = gateway.getNetwork(this.config.channelName);

    return network.getContract(this.config.chaincodeName);
  }

  private async getGateway(): Promise<Gateway> {
    if (this.gateway) {
      return this.gateway;
    }

    this.grpcClient = await this.createGrpcConnection();
    this.gateway = connect({
      client: this.grpcClient,
      identity: await createIdentity(this.config),
      signer: await createSigner(this.config),
      evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15000 }),
      submitOptions: () => ({ deadline: Date.now() + 5000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60000 })
    });

    return this.gateway;
  }

  private async createGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(this.config.tlsCertPath);
    const credentials = grpc.credentials.createSsl(tlsRootCert);

    return new grpc.Client(this.config.peerEndpoint, credentials, {
      'grpc.ssl_target_name_override': this.config.peerTlsHostOverride
    });
  }
}
