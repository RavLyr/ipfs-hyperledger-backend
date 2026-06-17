import { evaluateTransaction, submitTransaction } from '../fabric/fabric.service';
import type { CreateAssetInput, TransferAssetInput, UpdateAssetInput } from './asset.dto';

function toChaincodeNumber(value: number): string {
  return String(value);
}

export async function getAllAssets(): Promise<unknown> {
  return evaluateTransaction('GetAllAssets');
}

export async function getAssetById(id: string): Promise<unknown> {
  return evaluateTransaction('ReadAsset', id);
}

export async function createAsset(input: CreateAssetInput): Promise<unknown> {
  return submitTransaction(
    'CreateAsset',
    input.id,
    input.color,
    toChaincodeNumber(input.size),
    input.owner,
    toChaincodeNumber(input.appraisedValue)
  );
}

export async function updateAsset(id: string, input: UpdateAssetInput): Promise<unknown> {
  return submitTransaction(
    'UpdateAsset',
    id,
    input.color,
    toChaincodeNumber(input.size),
    input.owner,
    toChaincodeNumber(input.appraisedValue)
  );
}

export async function deleteAsset(id: string): Promise<unknown> {
  return submitTransaction('DeleteAsset', id);
}

export async function transferAsset(id: string, input: TransferAssetInput): Promise<unknown> {
  return submitTransaction('TransferAsset', id, input.newOwner);
}
