export type MigrationRun = {
  name: string;
  status: "running" | "completed";
  scanned: number;
  updated: number;
  exceptions: number;
  cursor?: string;
  startedAt: string;
  completedAt?: string;
};

export function beginMigrationRun(name: string, now: Date): MigrationRun {
  return {
    name,
    status: "running",
    scanned: 0,
    updated: 0,
    exceptions: 0,
    startedAt: now.toISOString(),
  };
}

export function recordMigrationBatch(
  run: MigrationRun,
  batch: { scanned: number; updated: number; exceptions: number; cursor?: string },
): MigrationRun {
  return {
    ...run,
    scanned: run.scanned + batch.scanned,
    updated: run.updated + batch.updated,
    exceptions: run.exceptions + batch.exceptions,
    cursor: batch.cursor ?? run.cursor,
  };
}

export function completeMigrationRun(run: MigrationRun, now: Date): MigrationRun {
  return {
    ...run,
    status: "completed",
    completedAt: now.toISOString(),
  };
}
