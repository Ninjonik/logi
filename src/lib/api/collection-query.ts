import type { CollectionFilter } from "@/domain/shared/collection-query";

export type CollectionQuery = { filters: CollectionFilter[]; offset: number; limit: number };

const maximumLimit = 100;
const defaultLimit = 25;
const filterName = /^filter\[([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)\]$/;

function parseNonNegativeInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export function parseCollectionQuery(request: Request): CollectionQuery | { error: string } {
  const params = new URL(request.url).searchParams;
  const offset = parseNonNegativeInteger(params.get("offset"), 0);
  const requestedLimit = parseNonNegativeInteger(params.get("limit"), defaultLimit);
  if (offset === null || requestedLimit === null || requestedLimit < 1 || requestedLimit > maximumLimit) {
    return { error: "offset must be a non-negative integer and limit must be between 1 and 100." };
  }

  const filters: CollectionFilter[] = [];
  for (const [name, value] of params) {
    if (!name.startsWith("filter")) continue;
    const match = filterName.exec(name);
    if (!match) return { error: "Filter names must use filter[field] or filter[parent.field]." };
    filters.push({ path: match[1], value });
  }
  return { filters, offset, limit: requestedLimit };
}

export function isCollectionQueryError(query: CollectionQuery | { error: string }): query is { error: string } {
  return "error" in query;
}

/** Resolves a named, public collection from a response object. Paths are kept
 * explicit by the route so callers cannot traverse arbitrary response data. */
export function getNamedCollection(input: Record<string, unknown>, path: readonly string[]) {
  let value: unknown = input;
  for (const key of path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    value = (value as Record<string, unknown>)[key];
  }
  return Array.isArray(value) ? value as Array<Record<string, unknown>> : null;
}
