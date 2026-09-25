export function selectUnscopedMigrationBatch(input: {
  records: Array<{ id: string; gameId?: string }>;
  cursor: number;
  limit: number;
}) {
  const ids: string[] = [];
  let index = input.cursor;

  while (index < input.records.length && ids.length < input.limit) {
    const record = input.records[index];
    index += 1;
    if (!record.gameId) {
      ids.push(record.id);
    }
  }

  return {
    ids,
    nextCursor: index < input.records.length ? index : null,
    isDone: index >= input.records.length,
  };
}
