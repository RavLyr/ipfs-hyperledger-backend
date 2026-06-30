import { fabricConfig } from '../../config/fabric.config';
import { FabricGatewayClient, type FabricSubmitResult } from '../../infrastructure/fabric/fabric-gateway.client';
import type { FabricResult } from '../../infrastructure/fabric/fabric-result';
import type { InvokeFabricBody } from './fabric.dto';
import type { FabricHealth, FabricInvokeResult } from './fabric.types';

const fabricClient = new FabricGatewayClient(fabricConfig);

export async function getFabricHealth(): Promise<FabricHealth> {
  const demoIssuerExists = await evaluateTransaction('SmartContract:IssuerExists', 'DEMO_ISSUER');

  return {
    status: demoIssuerExists === true || demoIssuerExists === 'true' ? 'connected' : 'degraded',
    itemCount: null
  };
}

export async function invokeFabric(input: InvokeFabricBody): Promise<FabricInvokeResult> {
  const args = input.args ?? [];
  const result =
    input.mode === 'evaluate'
      ? await evaluateTransaction(input.functionName, ...args)
      : await submitTransaction(input.functionName, ...args);

  return {
    mode: input.mode ?? 'submit',
    result
  };
}

export async function evaluateTransaction(functionName: string, ...args: string[]): Promise<FabricResult> {
  return fabricClient.evaluateTransaction(functionName, args);
}

export async function submitTransaction(functionName: string, ...args: string[]): Promise<FabricResult> {
  return fabricClient.submitTransaction(functionName, args);
}

export async function submitTransactionWithTxId(
  functionName: string,
  ...args: string[]
): Promise<FabricSubmitResult> {
  return fabricClient.submitTransactionWithTxId(functionName, args);
}

export function closeFabricClient(): void {
  fabricClient.close();
}
