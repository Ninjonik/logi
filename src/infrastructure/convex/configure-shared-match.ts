import { sharedMatchSettingsSchema } from "../../lib/validation/shared-match-settings"
import { validateEventDiscussion } from "../../domain/events/discussion"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
import { resolveGameScope } from "../../domain/games/game"
import { sharedMatchMembers } from "./shared-match-store"
import { refreshEventSchedule } from "./event-scheduling"

/** Authenticated dashboard and integration adapters share the same local-only write. */
export async function configureSharedMatchLocal(
    ctx: MutationCtx,
    guildId: string,
    eventId: Id<"events">,
    settings: unknown
) {
    const fields = sharedMatchSettingsSchema.parse(settings)
    const event = await ctx.db.get(eventId)
    if (!event || event.guildId !== guildId || !event.hostEventId)
        throw new Error("External match not found.")
    await sharedMatchMembers(ctx, event)
    validateEventDiscussion(fields)
    for (const id of [
        ...fields.signupGroupIds,
        ...fields.signupGroupLimits.map((item) => item.groupId),
    ]) {
        const normalized = ctx.db.normalizeId("groups", id)
        const group = normalized ? await ctx.db.get(normalized) : null
        if (
            !group ||
            group.guildId !== guildId ||
            resolveGameScope(group.gameId) !== resolveGameScope(event.gameId)
        )
            throw new Error("Group not found for this clan and game.")
    }
    const presetId = fields.topicPresetId
        ? ctx.db.normalizeId("topicPresets", fields.topicPresetId)
        : null
    if (fields.topicPresetId) {
        const preset = presetId ? await ctx.db.get(presetId) : null
        if (!preset || preset.guildId !== guildId)
            throw new Error("Topic preset not found.")
    }
    await ctx.db.patch(eventId, {
        ...fields,
        topicPresetId: presetId ?? undefined,
        pingClan: fields.pingMode === "clan",
        updatedAt: new Date().toISOString(),
    })
    await refreshEventSchedule(ctx, eventId)
    return String(eventId)
}
