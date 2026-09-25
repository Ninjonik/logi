import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export class ConvexLegacyHllEventScopeRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async list() {
        const events = await this.ctx.db.query("events").collect()
        return events.map((event) => ({
            id: String(event._id),
            gameId: event.gameId,
        }))
    }

    async listPage(cursor: string | null, limit: number) {
        const page = await this.ctx.db.query("events").order("asc").paginate({
            cursor,
            numItems: limit,
        })

        return {
            records: page.page.map((event) => ({
                id: String(event._id),
                gameId: event.gameId,
            })),
            cursor: page.continueCursor,
            isDone: page.isDone,
        }
    }

    async setGameId(id: string, gameId: string): Promise<void> {
        if (gameId !== "hell_let_loose") {
            throw new Error(
                `Unsupported Convex event game identifier: ${gameId}`
            )
        }

        await this.ctx.db.patch(id as Id<"events">, { gameId })
    }
}
