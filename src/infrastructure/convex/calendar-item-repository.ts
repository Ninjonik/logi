import type {
    CalendarItemFields,
    CalendarItemRecord,
    CalendarItemRepository,
} from "../../application/calendar/calendar-item-commands"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export class ConvexCalendarItemRepository implements CalendarItemRepository {
    constructor(private readonly ctx: MutationCtx) {}
    async get(id: string) {
        const record = await this.ctx.db.get(id as Id<"calendarItems">)
        return record ? { ...record, id: String(record._id) } : null
    }
    async list(guildId: string) {
        return (
            await this.ctx.db
                .query("calendarItems")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
        ).map((record) => ({ ...record, id: String(record._id) }))
    }
    async create(record: Omit<CalendarItemRecord, "id">) {
        return String(await this.ctx.db.insert("calendarItems", record))
    }
    async update(
        id: string,
        fields: CalendarItemFields & { updatedAt: string }
    ) {
        await this.ctx.db.patch(id as Id<"calendarItems">, fields)
    }
    async delete(id: string) {
        await this.ctx.db.delete(id as Id<"calendarItems">)
    }
}
