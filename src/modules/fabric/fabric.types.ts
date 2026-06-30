import type { FabricResult } from '../../infrastructure/fabric/fabric-result';

export type FabricTransactionMode = 'evaluate' | 'submit';

export type FabricHealth = {
  readonly status: 'connected' | 'degraded';
  readonly itemCount: number | null;
};

export type FabricInvokeResult = {
  readonly mode: FabricTransactionMode;
  readonly result: FabricResult;
};
