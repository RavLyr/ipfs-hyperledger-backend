import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    id: z.string().min(1),
    color: z.string().min(1),
    size: z.coerce.number().int().nonnegative(),
    owner: z.string().min(1),
    appraisedValue: z.coerce.number().int().nonnegative()
  })
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    color: z.string().min(1),
    size: z.coerce.number().int().nonnegative(),
    owner: z.string().min(1),
    appraisedValue: z.coerce.number().int().nonnegative()
  })
});

export const assetIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  })
});

export const transferAssetSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    newOwner: z.string().min(1)
  })
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>['body'];
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>['body'];
export type TransferAssetInput = z.infer<typeof transferAssetSchema>['body'];
