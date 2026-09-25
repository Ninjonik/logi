import { selectUnscopedMigrationBatch } from "@/domain/games/migration-batch-policy"

type LegacyGameScopeRepository = {
    list(): Promise<Array<{ id: string; gameId?: string }>>
    setGameId(id: string, gameId: string): Promise<void>
}

export class MigrateLegacyHllScopeUseCase {
    constructor(private readonly repository: LegacyGameScopeRepository) {}

    async execute(input: { cursor: number; limit: number; dryRun: boolean }) {
        const records = await this.repository.list()
        const batch = selectUnscopedMigrationBatch({
            records,
            cursor: input.cursor,
            limit: input.limit,
        })

        if (!input.dryRun) {
            for (const id of batch.ids) {
                await this.repository.setGameId(id, "hell_let_loose")
            }
        }

        const nextPosition = batch.nextCursor ?? records.length
        return {
            scanned: nextPosition - input.cursor,
            updated: batch.ids.length,
            cursor: batch.nextCursor,
            isDone: batch.isDone,
        }
    }
}
