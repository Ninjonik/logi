import {
    isPanelPaused,
    normalizePanelKind,
} from "../src/domain/discord-publications/settings"
import { connectionSource } from "./gameDataCatalog"
import type { QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

/**
 * The access checks of "Nahlásit hráče", shared by the bot's report reads
 * (`playerReports.ts`, polled every 30 s per clan) and the draft and
 * submission mutations (`playerReportDrafts.ts`). No function definitions
 * here, so neither module bundles the other (ARCHITECTURE.md, "Convex hot
 * paths").
 */
export const base = {
    secret: v.string(),
    guildId: v.string(),
    reporterId: v.string(),
}
export type Subject = { secret: string; guildId: string; reporterId: string }
export function guard(args: Subject) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET ||
        !/^\d{17,20}$/.test(args.guildId) ||
        !/^\d{17,20}$/.test(args.reporterId)
    )
        throw new Error("Unauthorized.")
}
export async function context(
    ctx: Pick<QueryCtx, "db">,
    args: Subject & {
        panelId: Id<"discordPublicPanels">
        revision: number
        channelId: string
    }
) {
    guard(args)
    const panel = await ctx.db.get(args.panelId)
    if (
        !panel ||
        isPanelPaused(panel) ||
        panel.draft ||
        panel.removing ||
        normalizePanelKind(panel.kind) !== "server" ||
        !panel.connectionId ||
        panel.guildId !== args.guildId ||
        panel.revision !== args.revision ||
        panel.channelId !== args.channelId ||
        !panel.reportCategoryId
    )
        return null
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
        .unique()
    const settings = config?.ticketSettings,
        category = settings?.categories.find(
            (c) => c.id === panel.reportCategoryId
        )
    if (!settings?.enabled || !settings.ticketParentChannelId || !category)
        return null
    const id = ctx.db.normalizeId("gameDataConnections", panel.connectionId),
        connection = id ? await ctx.db.get(id) : null
    if (
        !connection?.enabled ||
        connection.guildId !== args.guildId ||
        !["hll_crcon", "wardogs_warcon"].includes(connection.provider)
    )
        return null
    const source = await connectionSource(ctx, connection)
    if (!source) return null
    const policy = {
        guildId: args.guildId,
        panelId: panel._id,
        revision: panel.revision,
        channelId: panel.channelId,
        connectionId: connection._id,
        generation: connection.generation,
        sourceFingerprint: connection.sourceFingerprint,
        parentChannelId: settings.ticketParentChannelId,
        categoryId: category.id,
        categoryLabel: category.label || category.id,
        supportRoleIds: category.supportRoleIds,
        dashboardAdminRoleId: config?.dashboardAdminRoleId ?? null,
    }
    return {
        panel,
        config: config!,
        policy,
        gameId: connection.gameId,
        policyJson: JSON.stringify(policy),
    }
}
export async function draftContext(
    ctx: Pick<QueryCtx, "db">,
    args: Subject & { draftId: Id<"playerReportDrafts"> }
) {
    guard(args)
    const draft = await ctx.db.get(args.draftId)
    if (
        !draft ||
        draft.guildId !== args.guildId ||
        draft.reporterId !== args.reporterId ||
        draft.expiresAt <= Date.now()
    )
        return null
    const access = await context(ctx, { ...args, ...draft })
    return access && access.policyJson === draft.policyJson
        ? { draft, access }
        : null
}
