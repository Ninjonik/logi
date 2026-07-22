export function normalizeOptionalArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

export function dedupePreservingOrder<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
