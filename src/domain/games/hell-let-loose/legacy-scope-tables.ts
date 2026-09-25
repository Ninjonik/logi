export const legacyHllScopeTables = [
  "assignments",
  "groups",
  "events",
  "calendarItems",
  "topicPresets",
  "squadPresets",
  "stratmaps",
  "matchStats",
  "competitions",
] as const;

export type LegacyHllScopeTable = typeof legacyHllScopeTables[number];

export function assertLegacyHllScopeTable(value: string): LegacyHllScopeTable {
  if (!(legacyHllScopeTables as readonly string[]).includes(value)) {
    throw new Error(`Unsupported legacy HLL scope table: ${value}`);
  }

  return value as LegacyHllScopeTable;
}
