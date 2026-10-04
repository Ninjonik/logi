import {
    ConvexTeamDirectoryRepository,
    ConvexTeamLogoPort,
    ConvexTeamRequestLogoPort,
    ConvexTeamRequestRepository,
    teamById,
} from "../src/infrastructure/convex/team-directory-repositories"
import {
    notificationRetryDelayMs,
    TEAM_REQUEST_PAGE_MAX,
    teamRequestStatusSchema,
    type TeamRequestRecord,
} from "../src/domain/teams/team-request"
import {
    cancelTeamRequest,
    decideTeamRequest,
    submitTeamRequest,
    type TeamRequestPorts,
} from "../src/application/teams/team-requests.use-case"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { authorizePlatformAdmin } from "./platformAdmin"
import type { Doc } from "./_generated/dataModel"
import { getGuildByDiscordId } from "./identity"
import { assetPublicUrl } from "./imageAssets"
import { v } from "convex/values"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
function assertBotSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized.")
}
const workspaceAccess = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const platformAccess = { secret: v.string(), actor: dashboardActor }
type Db = Pick<QueryCtx, "db">
/** Decision DMs claimed by one bot pass stay leased this long. */
const NOTIFICATION_LEASE_MS = 2 * 60_000
const NOTIFICATION_BATCH = 20

function ports(ctx: MutationCtx): TeamRequestPorts {
    return {
        requests: new ConvexTeamRequestRepository(ctx),
        requestLogos: new ConvexTeamRequestLogoPort(ctx),
        directory: new ConvexTeamDirectoryRepository(ctx),
        logos: new ConvexTeamLogoPort(ctx),
        now: () => new Date().toISOString(),
    }
}

async function recordOf(
    ctx: Db,
    row: Doc<"teamRequests">,
    includeRequester: boolean
): Promise<TeamRequestRecord> {
    const [workspace, team] = await Promise.all([
        getGuildByDiscordId(ctx, row.guildId),
        row.teamId ? teamById(ctx, String(row.teamId)) : null,
    ])
    return {
        id: String(row._id),
        guildId: row.guildId,
        workspaceName: workspace?.name ?? null,
        requestedBy: includeRequester ? row.requestedBy : null,
        kind: row.kind,
        gameId: row.gameId,
        teamId: row.teamId ? String(row.teamId) : null,
        teamName: team?.name ?? null,
        proposal: {
            name: row.proposal.name,
            shortCode: row.proposal.shortCode,
            logoAssetId: row.proposal.logoAssetId
                ? String(row.proposal.logoAssetId)
                : null,
            logoUrl: await assetPublicUrl(ctx, row.proposal.logoAssetId),
            description: row.proposal.description,
            links: row.proposal.links,
        },
        note: row.note,
        status: row.status,
        reason: row.reason,
        resultTeamId: row.resultTeamId ? String(row.resultTeamId) : null,
        decidedAt: row.decidedAt,
        createdAt: row.createdAt,
        notification: row.notificationStatus,
    }
}

function assertPage(limit: number, cursor: string | null) {
    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > TEAM_REQUEST_PAGE_MAX ||
        (cursor?.length ?? 0) > 4096
    )
        throw new Error("Invalid pagination.")
}

/** A workspace administrator asks for a new team or a change to an existing one. */
export const submit = mutation({
    args: { ...workspaceAccess, input: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        return await submitTeamRequest(
            ports(ctx),
            { guildId: args.guildId, actor: admin.session.subject },
            args.input
        )
    },
})

/** This workspace's requests, newest first. */
export const listMine = query({
    args: {
        ...workspaceAccess,
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        assertPage(args.limit, args.cursor)
        const page = await ctx.db
            .query("teamRequests")
            .withIndex("guildId_createdAt", (q) =>
                q.eq("guildId", args.guildId)
            )
            .order("desc")
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: await Promise.all(
                page.page.map((row) => recordOf(ctx, row, true))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

export const cancel = mutation({
    args: { ...workspaceAccess, requestId: v.string() },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        return await cancelTeamRequest(
            ports(ctx),
            { guildId: args.guildId },
            args.requestId
        )
    },
})

/** The global moderation queue for one status, oldest first. */
export const queue = query({
    args: {
        ...platformAccess,
        status: v.string(),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        await authorizePlatformAdmin(ctx, args)
        const status = teamRequestStatusSchema.parse(args.status)
        assertPage(args.limit, args.cursor)
        const page = await ctx.db
            .query("teamRequests")
            .withIndex("status_createdAt", (q) => q.eq("status", status))
            .order(status === "pending" ? "asc" : "desc")
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: await Promise.all(
                page.page.map((row) => recordOf(ctx, row, true))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

export const get = query({
    args: { ...platformAccess, requestId: v.string() },
    handler: async (ctx, args): Promise<TeamRequestRecord | null> => {
        await authorizePlatformAdmin(ctx, args)
        const id = ctx.db.normalizeId("teamRequests", args.requestId)
        const row = id ? await ctx.db.get(id) : null
        return row ? await recordOf(ctx, row, true) : null
    },
})

/** Approve (optionally edited), merge into an existing team, or reject with a reason. */
export const decide = mutation({
    args: { ...platformAccess, requestId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizePlatformAdmin(ctx, args)
        return await decideTeamRequest(
            ports(ctx),
            { actor: admin.session.subject },
            args.requestId,
            args.input
        )
    },
})

/**
 * The bot claims due decision DMs. Each claim is leased so a second bot pass
 * does not send the same DM; an unconfirmed lease becomes due again.
 */
export const claimNotifications = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertBotSecret(args.secret)
        const now = Date.now()
        const due = await ctx.db
            .query("teamRequests")
            .withIndex("notificationStatus_notificationNextAttemptAt", (q) =>
                q
                    .eq("notificationStatus", "pending")
                    .lte("notificationNextAttemptAt", now)
            )
            .take(NOTIFICATION_BATCH)
        const claimed = []
        for (const row of due) {
            if ((row.notificationLeaseUntil ?? 0) > now) continue
            await ctx.db.patch(row._id, {
                notificationLeaseUntil: now + NOTIFICATION_LEASE_MS,
                notificationNextAttemptAt: now + NOTIFICATION_LEASE_MS,
            })
            const [config, team] = await Promise.all([
                ctx.db
                    .query("discordConfigs")
                    .withIndex("guildId", (q) => q.eq("guildId", row.guildId))
                    .first(),
                row.resultTeamId
                    ? ctx.db.get(row.resultTeamId)
                    : row.teamId
                      ? ctx.db.get(row.teamId)
                      : null,
            ])
            claimed.push({
                requestId: String(row._id),
                discordUserId: row.requestedBy,
                guildId: row.guildId,
                language: config?.defaultLanguage ?? "en",
                kind: row.kind,
                gameId: row.gameId,
                status: row.status,
                requestedName: row.proposal.name,
                teamName: team?.name ?? null,
                reason: row.reason,
            })
        }
        return claimed
    },
})

/** Confirms a sent DM, or schedules a retry with backoff until the attempts run out. */
export const markNotified = mutation({
    args: {
        secret: v.string(),
        requestId: v.string(),
        outcome: v.union(v.literal("sent"), v.literal("failed")),
    },
    handler: async (ctx, args) => {
        assertBotSecret(args.secret)
        const id = ctx.db.normalizeId("teamRequests", args.requestId)
        const row = id ? await ctx.db.get(id) : null
        if (!row || row.notificationStatus !== "pending") return { ok: false }
        if (args.outcome === "sent") {
            await ctx.db.patch(row._id, {
                notificationStatus: "sent",
                notificationSentAt: new Date().toISOString(),
                notificationNextAttemptAt: null,
                notificationLeaseUntil: null,
            })
            return { ok: true }
        }
        const attempts = row.notificationAttempts + 1
        const delay = notificationRetryDelayMs(attempts)
        await ctx.db.patch(row._id, {
            notificationAttempts: attempts,
            notificationLeaseUntil: null,
            ...(delay === null
                ? {
                      notificationStatus: "failed" as const,
                      notificationNextAttemptAt: null,
                  }
                : { notificationNextAttemptAt: Date.now() + delay }),
        })
        return { ok: true }
    },
})
