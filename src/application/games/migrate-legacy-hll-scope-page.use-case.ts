export type LegacyScopePageRepository = {
    listPage(
        cursor: string | null,
        limit: number
    ): Promise<{
        records: Array<{ id: string; gameId?: string }>
        cursor: string | null
        isDone: boolean
    }>
    setGameId(id: string, gameId: string): Promise<void>
}

export class MigrateLegacyHllScopePageUseCase {
    constructor(private readonly repository: LegacyScopePageRepository) {}

    async execute(input: {
        cursor: string | null
        limit: number
        dryRun: boolean
    }) {
        const page = await this.repository.listPage(input.cursor, input.limit)
        const ids = page.records
            .filter((record) => !record.gameId)
            .map((record) => record.id)
        if (!input.dryRun)
            for (const id of ids)
                await this.repository.setGameId(id, "hell_let_loose")
        return {
            scanned: page.records.length,
            updated: ids.length,
            cursor: page.cursor,
            isDone: page.isDone,
        }
    }
}
