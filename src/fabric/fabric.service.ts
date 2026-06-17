import { getContract } from './contract';

export type FabricResult = unknown;

function parseFabricResult(result: Uint8Array): FabricResult {
  if (result.length === 0) {
    return null;
  }

  const text = Buffer.from(result).toString('utf8');
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return text;
  }
}

export async function evaluateTransaction(functionName: string, ...args: string[]): Promise<FabricResult> {
  const contract = await getContract();
  const result = await contract.evaluateTransaction(functionName, ...args);

  return parseFabricResult(result);
}

export async function submitTransaction(functionName: string, ...args: string[]): Promise<FabricResult> {
  const contract = await getContract();
  const result = await contract.submitTransaction(functionName, ...args);

  return parseFabricResult(result);
}
