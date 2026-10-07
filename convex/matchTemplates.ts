import { normalizeMatchTemplates } from "../src/domain/events/match-templates"
import { storedMatchTemplateValidator } from "./matchTemplateValidators"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { getGuildDiscordId } from "./identity"
import { v } from "convex/values"

/**
 * Replaces a clan's match templates (settings › Match templates, design D1),
 * including group caps, attendance reminder offsets, the participant roles
 * switch and the roster's squad preset. Signup groups, caps, topic presets
 * and squad presets that do not belong to this clan are dropped, so a
 * template can never point at another clan's data.
 */
export const save = mutation({
    args: {
        secret: v.string(),
        guildId: v.id("guilds"),
        templates: v.array(storedMatchTemplateValidator),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await ctx.db.get(args.guildId)
        if (!guild) throw new Error("Server not found.")
        const result = normalizeMatchTemplates(args.templates)
        if (!result.ok) return result

        const guildDiscordId = getGuildDiscordId(guild)
        const [groups, topicPresets, squadPresets] = await Promise.all([
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
                .collect(),
            ctx.db
                .query("topicPresets")
                .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
                .collect(),
            ctx.db
                .query("squadPresets")
                .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
                .collect(),
        ])
        const groupIds = new Set(groups.map((group) => String(group._id)))
        const topicPresetIds = new Set(
            topicPresets.map((preset) => String(preset._id))
        )
        const squadPresetIds = new Set(
            squadPresets.map((preset) => String(preset._id))
        )
        const templates = result.templates.map((template) => {
            const limits = template.signupGroupLimits?.filter((limit) =>
                groupIds.has(limit.groupId)
            )
            return {
                ...template,
                signupGroupIds: template.signupGroupIds?.filter((groupId) =>
                    groupIds.has(groupId)
                ),
                signupGroupLimits: limits?.length ? limits : undefined,
                topicPresetId:
                    template.topicPresetId &&
                    topicPresetIds.has(template.topicPresetId)
                        ? template.topicPresetId
                        : undefined,
                squadPresetId:
                    template.squadPresetId &&
                    squadPresetIds.has(template.squadPresetId)
                        ? template.squadPresetId
                        : undefined,
            }
        })

        await ctx.db.patch(guild._id, {
            matchTemplates: templates,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true as const, templates }
    },
})
