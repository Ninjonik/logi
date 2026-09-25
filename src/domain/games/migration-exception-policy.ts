export function buildMigrationException(input: {
  runId: string;
  table: string;
  recordId: string;
  reason: string;
  now: Date;
}) {
  return {
    ...input,
    createdAt: input.now.toISOString(),
  };
}
