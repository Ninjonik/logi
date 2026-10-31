import type {
    SquadPresetFields,
    TopicPresetFields,
} from "../../domain/presets/preset"
import type { PresetRepository } from "../../application/presets/save-preset"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export function topicPresetRepository(
    ctx: MutationCtx
): PresetRepository<TopicPresetFields> {
    return {
        async get(id) {
            const row = await ctx.db.get(id as Id<"topicPresets">)
            return row ? { ...row, id: String(row._id) } : null
        },
        async create(record) {
            return String(await ctx.db.insert("topicPresets", record))
        },
        async update(id, fields) {
            await ctx.db.patch(id as Id<"topicPresets">, fields)
        },
    }
}
export function squadPresetRepository(
    ctx: MutationCtx
): PresetRepository<SquadPresetFields> {
    return {
        async get(id) {
            const row = await ctx.db.get(id as Id<"squadPresets">)
            return row ? { ...row, id: String(row._id) } : null
        },
        async create(record) {
            return String(await ctx.db.insert("squadPresets", record))
        },
        async update(id, fields) {
            await ctx.db.patch(id as Id<"squadPresets">, fields)
        },
    }
}
