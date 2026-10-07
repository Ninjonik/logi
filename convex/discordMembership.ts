import {
    applicationAccountsValidator,
    applicationAnswerKindValidator,
} from "./membershipApplicationValidators"
import {
    assertInternalSecret,
    normalizeConfigDoc,
    normalizeDoc,
} from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

const gameIdValidator = v.union(
    v.literal("hell_let_loose"),
    v.literal("hell_let_loose_vietnam"),
    v.literal("wardogs")
)

export const createTicketThread = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        if (!config?.ticketSettings?.enabled)
            throw new Error("Tickets are not enabled.")
        const category = config.ticketSettings.categories.find(
            (item) => item.id === args.categoryId
        )
        if (!category) throw new Error("Ticket category not found.")
        const nextTicketNumber = (config.ticketCounter ?? 0) + 1
        const now = new Date().toISOString()
        await ctx.db.patch(config._id, { ticketCounter: nextTicketNumber })
        const threadRecordId = await ctx.db.insert("ticketThreads", {
            guildId: args.guildId,
            threadId: args.threadId,
            parentChannelId: args.parentChannelId,
            creatorId: args.creatorId,
            categoryId: category.id,
            categoryLabel: category.label?.trim() || category.id,
            ticketNumber: nextTicketNumber,
            status: "open",
            transcriptMessageId: args.transcriptMessageId,
            answers: args.answers,
            openedAt: now,
            createdAt: now,
            updatedAt: now,
        })
        return {
            ticket: {
                id: String(threadRecordId),
                threadId: args.threadId,
                ticketNumber: nextTicketNumber,
                categoryId: category.id,
                categoryLabel: category.label?.trim() || category.id,
            },
            category,
            config: normalizeConfigDoc(config),
        }
    },
})

export const createMembershipApplicationThread = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        threadId: v.string(),
        parentChannelId: v.string(),
        creatorId: v.string(),
        categoryId: v.string(),
        gameId: v.optional(
            v.union(
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
        assignmentType: v.union(
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        ),
        assignmentId: v.optional(v.id("userAssignments")),
        transcriptMessageId: v.optional(v.string()),
        answers: v.array(
            v.object({
                questionId: v.string(),
                label: v.string(),
                value: v.string(),
                kind: v.optional(applicationAnswerKindValidator),
            })
        ),
        // The application form in windows (L6): the draft is consumed here.
        draftId: v.optional(v.string()),
        source: v.optional(v.union(v.literal("discord"), v.literal("web"))),
        applicantName: v.optional(v.string()),
        games: v.optional(v.array(gameIdValidator)),
        inGameName: v.optional(v.string()),
        accounts: v.optional(applicationAccountsValidator),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        const effectiveConfig = config
        if (!effectiveConfig?.membershipSettings?.enabled)
            throw new Error("Membership applications are not enabled.")
        const category = effectiveConfig.membershipSettings.categories.find(
            (item) =>
                item.id === args.categoryId &&
                (item.gameId ?? "hell_let_loose") ===
                    (args.gameId ?? "hell_let_loose")
        )
        if (!category) throw new Error("Application category not found.")
        const nextApplicationNumber =
            (effectiveConfig.membershipApplicationCounter ?? 0) + 1
        const now = new Date().toISOString()
        await ctx.db.patch(effectiveConfig._id, {
            membershipApplicationCounter: nextApplicationNumber,
        })
        const applicationId = await ctx.db.insert(
            "membershipApplicationThreads",
            {
                guildId: args.guildId,
                gameId: args.gameId,
                threadId: args.threadId,
                parentChannelId: args.parentChannelId,
                creatorId: args.creatorId,
                categoryId: category.id,
                categoryLabel: category.label?.trim() || category.id,
                assignmentType: args.assignmentType,
                applicationNumber: nextApplicationNumber,
                assignmentId: args.assignmentId,
                transcriptMessageId: args.transcriptMessageId,
                answers: args.answers,
                status: "open",
                openedAt: now,
                source: args.source,
                applicantName: args.applicantName?.slice(0, 80),
                games: args.games,
                inGameName: args.inGameName,
                accounts: args.accounts,
                createdAt: now,
                updatedAt: now,
            }
        )
        // The thread exists now; the applicant's draft is done (L6-B04).
        const draftId = args.draftId
            ? ctx.db.normalizeId(
                  "membershipApplicationFormDrafts",
                  args.draftId
              )
            : null
        const draft = draftId ? await ctx.db.get(draftId) : null
        if (
            draft &&
            draft.guildId === args.guildId &&
            draft.creatorId === args.creatorId
        )
            await ctx.db.delete(draft._id)
        return {
            application: {
                id: String(applicationId),
                threadId: args.threadId,
                applicationNumber: nextApplicationNumber,
                categoryLabel: category.label?.trim() || category.id,
            },
            category,
            config: normalizeConfigDoc(effectiveConfig),
        }
    },
})

export const getTicketThreadContext = query({
    args: { secret: v.string(), threadId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const ticket = await ctx.db
            .query("ticketThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!ticket) return null
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", ticket.guildId))
            .unique()
        if (!config) return null
        const category =
            config.ticketSettings?.categories.find(
                (item) => item.id === ticket.categoryId
            ) ?? null
        return {
            config: normalizeConfigDoc(config),
            ticket: normalizeDoc(ticket),
            category,
        }
    },
})

export const getMembershipApplicationThreadContext = query({
    args: { secret: v.string(), threadId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await ctx.db
            .query("membershipApplicationThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!application) return null
        const [config, assignment, assignments] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) =>
                    q.eq("guildId", application.guildId)
                )
                .unique(),
            application.assignmentId
                ? ctx.db.get(application.assignmentId)
                : null,
            // "Přijmout jako žoldáka" may move the membership to the
            // mercenary category of another game (L6-B08).
            ctx.db
                .query("userAssignments")
                .withIndex("serverId_userId", (q) =>
                    q
                        .eq("serverId", application.guildId)
                        .eq("userId", application.creatorId)
                )
                .take(10),
        ])
        if (!config) return null
        // An application record is scoped to its Discord guild and applicant.
        // Do not let a stale/corrupt assignment ID escape that scope: decision
        // handlers can remove an assignment when an application is denied.
        const scopedAssignment =
            assignment &&
            assignment.serverId === application.guildId &&
            assignment.userId === application.creatorId
                ? assignment
                : null
        const applicationGame = application.gameId ?? "hell_let_loose"
        const category =
            config.membershipSettings?.categories.find(
                (item) =>
                    item.id === application.categoryId &&
                    (item.gameId ?? "hell_let_loose") === applicationGame
            ) ?? null
        const guild = await getGuildByDiscordId(ctx, application.guildId)
        return {
            config: normalizeConfigDoc(config),
            application: normalizeDoc(application),
            assignment: scopedAssignment
                ? normalizeDoc(scopedAssignment)
                : null,
            assignments: assignments.map((row) => ({
                id: String(row._id),
                gameId: row.gameId ?? "hell_let_loose",
                type: row.type,
                status: row.status,
                membershipCategoryId: row.membershipCategoryId,
            })),
            category,
            // For the decision card, DM and "Členové v Logi" (L6-50, L6-59).
            clanName: guild?.name ?? "",
            guildRecordId: guild ? String(guild._id) : null,
            ticketChannelId: config.ticketSettings?.enabled
                ? (config.ticketSettings.submitChannelId ?? null)
                : null,
        }
    },
})

export const getMembershipApplicationByAssignment = query({
    args: { secret: v.string(), assignmentId: v.id("userAssignments") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const applications = await ctx.db
            .query("membershipApplicationThreads")
            .collect()
        const application =
            applications.find(
                (item) => item.assignmentId === args.assignmentId
            ) ?? null
        return application ? normalizeDoc(application) : null
    },
})

export const closeTicketThread = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        closedByUserId: v.string(),
        closeReason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const ticket = await ctx.db
            .query("ticketThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!ticket) throw new Error("Ticket not found.")
        const now = new Date().toISOString()
        await ctx.db.patch(ticket._id, {
            status: "closed",
            closedAt: now,
            closedByUserId: args.closedByUserId,
            closeReason: args.closeReason?.trim() || undefined,
            updatedAt: now,
        })
        const report = await ctx.db
            .query("playerReports")
            .withIndex("ticketId", (q) => q.eq("ticketId", ticket._id))
            .unique()
        if (report)
            await ctx.db.patch(report._id, {
                state: "closed",
                leaseUntil: 0,
                updatedAt: Date.now(),
            })
        return { ok: true }
    },
})

export const closeMembershipApplicationThread = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        closedByUserId: v.string(),
        closeReason: v.optional(v.string()),
        closeOutcome: v.union(
            v.literal("denied"),
            v.literal("pending"),
            v.literal("recruit"),
            v.literal("member"),
            v.literal("reserve_member"),
            v.literal("mercenary")
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await ctx.db
            .query("membershipApplicationThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!application) throw new Error("Application not found.")
        if (application.status === "closed") return { ok: false }
        const now = new Date().toISOString()
        await ctx.db.patch(application._id, {
            status: "closed",
            closeOutcome: args.closeOutcome,
            closedAt: now,
            closedByUserId: args.closedByUserId,
            closeReason: args.closeReason?.trim() || undefined,
            decisionLeaseUntil: undefined,
            updatedAt: now,
        })
        return { ok: true }
    },
})

export const updateTicketTranscriptMessage = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        transcriptMessageId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const ticket = await ctx.db
            .query("ticketThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!ticket) throw new Error("Ticket not found.")
        await ctx.db.patch(ticket._id, {
            transcriptMessageId: args.transcriptMessageId,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true }
    },
})

export const updateMembershipApplicationTranscriptMessage = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        transcriptMessageId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await ctx.db
            .query("membershipApplicationThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!application) throw new Error("Application not found.")
        await ctx.db.patch(application._id, {
            transcriptMessageId: args.transcriptMessageId,
            updatedAt: new Date().toISOString(),
        })
        return { ok: true }
    },
})
