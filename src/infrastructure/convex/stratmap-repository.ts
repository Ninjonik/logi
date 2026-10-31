import type {
    StratmapFields,
    StratmapRecord,
    StratmapRepository,
} from "../../application/stratmaps/save-stratmap"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export class ConvexStratmapRepository implements StratmapRepository {
    constructor(private readonly ctx: MutationCtx) {}
    async get(id: string) {
        const row = await this.ctx.db.get(id as Id<"stratmaps">)
        return row ? { ...row, id: String(row._id) } : null
    }
    async getEvent(id: string) {
        return this.ctx.db.get(id as Id<"events">)
    }
    async create(record: Omit<StratmapRecord, "id">) {
        return String(
            await this.ctx.db.insert("stratmaps", {
                ...record,
                eventId: record.eventId as Id<"events"> | undefined,
            })
        )
    }
    async update(id: string, fields: StratmapFields & { updatedAt: string }) {
        await this.ctx.db.patch(id as Id<"stratmaps">, {
            ...fields,
            eventId: fields.eventId as Id<"events"> | undefined,
        })
    }
}
