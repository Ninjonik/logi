import { assertLegacyHllScopeTable } from "@/domain/games/hell-let-loose/legacy-scope-tables";
import { assertInternalSecret } from "./event-handlers";

export async function handleLegacyHllScopeMigration<T>(input: { secret: string; expectedSecret: string; table: string; cursor: number; limit: number; dryRun: boolean; execute: (input: { cursor: number; limit: number; dryRun: boolean }) => Promise<T> }) {
  assertInternalSecret(input.secret, input.expectedSecret);
  assertLegacyHllScopeTable(input.table);
  if (!Number.isInteger(input.cursor) || input.cursor < 0 || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new Error("Migration limit must be between 1 and 100.");
  return await input.execute({ cursor: input.cursor, limit: input.limit, dryRun: input.dryRun });
}
