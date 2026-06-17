import { fabricConfig } from '../../config/fabric.config';
import { FabricGatewayClient } from '../../infrastructure/fabric/fabric-gateway.client';
import type { FabricResult } from '../../infrastructure/fabric/fabric-result';
import type { InvokeFabricBody } from './fabric.dto';
import type { FabricHealth, FabricInvokeResult } from './fabric.types';

const fabricClient = new FabricGatewayClient(fabricConfig);

export async function getFabricHealth(): Promise<FabricHealth> {
  const assets = await evaluateTransaction('GetAllAssets');
  const itemCount = Array.isArray(assets) ? assets.length : null;

  return {
    status: 'connected',
    itemCount
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

export function closeFabricClient(): void {
  fabricClient.close();
}
