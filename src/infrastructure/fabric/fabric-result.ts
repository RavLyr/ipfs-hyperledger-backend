export type FabricResult = unknown;

export function decodeFabricResult(result: Uint8Array): FabricResult {
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
