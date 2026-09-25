const LEGACY_SCOPE_TABLES = [
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

type LegacyScopeTable = typeof LEGACY_SCOPE_TABLES[number];
type ScopedRecord = { id: string; gameId?: string };

export function buildLegacyHllScopePlan(input: {
  guildIds: string[];
  records: Record<LegacyScopeTable, ScopedRecord[]>;
}) {
  return {
    enableGuildIds: [...new Set(input.guildIds)].sort(),
    recordIdsByTable: Object.fromEntries(
      LEGACY_SCOPE_TABLES.map((table) => [
        table,
        input.records[table]
          .filter((record) => !record.gameId)
          .map((record) => record.id),
      ]),
    ) as Record<LegacyScopeTable, string[]>,
  };
}
