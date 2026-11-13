import {
    ConvexAssignmentCommandRepository,
    ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories"
import { commitApplicationDecision } from "../src/application/membership/commit-application-decision"
import { UpsertAssignmentUseCase } from "../src/application/assignments/upsert-assignment.use-case"
import { RemoveAssignmentUseCase } from "../src/application/assignments/remove-assignment.use-case"
import { skipsPendingOnApply } from "../src/domain/membership/membership-options"
import { rememberMembershipOperation } from "./discordMembershipEffects"
import { enqueueManagedRoles } from "./memberRoleOperations"
import { systemClock } from "../src/domain/shared/clock"
import { assertInternalSecret } from "./discord_shared"
import type { Id } from "./_generated/dataModel"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

/** Membership provisioning and its remembrance share the submission transaction. */
export const prepareSubmission = mutation({
    args: {
        secret: v.string(),
        draftId: v.id("membershipApplicationFormDrafts"),
        claimToken: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const draft = await ctx.db.get(args.draftId)
        if (
            !draft ||
            draft.submissionClaimToken !== args.claimToken ||
            draft.submissionStatus !== "claimed" ||
            (draft.claimedUntil ?? 0) <= Date.now()
        )
            throw new Error("Application submission ownership lost.")
        if (draft.provisionedAssignmentId) {
            const assignment = await ctx.db.get(draft.provisionedAssignmentId)
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", draft.guildId))
                .unique()
            const category = config?.membershipSettings?.categories.find(
                (row) => row.id === draft.categoryId
            )
            if (
                !assignment ||
                assignment.serverId !== draft.guildId ||
                assignment.userId !== draft.creatorId ||
                !config?.membershipSettings?.enabled ||
                !category ||
                assignment.membershipCategoryId !== category.id ||
                (assignment.gameId ?? "hell_let_loose") !==
                    (category.gameId ?? "hell_let_loose")
            )
                throw new Error("Provisioned membership scope mismatch.")
            return String(assignment._id)
        }
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", draft.guildId))
            .unique()
        const settings = config?.membershipSettings
        const category = settings?.categories.find(
            (row) => row.id === draft.categoryId
        )
        if (!settings?.enabled || !category)
            throw new Error("Application category not configured.")
        const repository = new ConvexAssignmentCommandRepository(ctx)
        const id = await new UpsertAssignmentUseCase(
            repository,
            new ConvexAssignmentRosterSyncPort(ctx),
            systemClock
        ).execute({
            serverDiscordId: draft.guildId,
            userId: draft.creatorId,
            gameId: category.gameId ?? "hell_let_loose",
            type: category.assignmentType,
            status: skipsPendingOnApply(settings, category)
                ? "recruit"
                : "pending",
            membershipCategoryId: category.id,
            secondaryGroupIds: [],
            paused: false,
        })
        await enqueueManagedRoles(ctx, {
            guildId: draft.guildId,
            gameId: category.gameId ?? "hell_let_loose",
            userId: draft.creatorId,
            actor: { userId: draft.creatorId, kind: "application" },
            before: null,
        })
        await ctx.db.patch(draft._id, {
            provisionedAssignmentId: id as Id<"userAssignments">,
        })
        await rememberMembershipOperation(ctx, {
            key: `application-open:${draft._id}`,
            kind: "application-open",
            guildId: draft.guildId,
            subjectId: String(draft._id),
            actorId: draft.creatorId,
        })
        return id
    },
})

export const commit = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        claimToken: v.string(),
        actorId: v.string(),
        reason: v.optional(v.string()),
        outcome: v.union(
            v.literal("member"),
            v.literal("recruit"),
            v.literal("pending"),
            v.literal("mercenary"),
            v.literal("denied")
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await ctx.db
            .query("membershipApplicationThreads")
            .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
            .unique()
        if (!application) throw new Error("Application not found.")
        // The same committed attempt can replay after a dropped mutation response.
        if (application.status === "closed") {
            if (
                application.decisionClaimToken !== args.claimToken ||
                application.closeOutcome !== args.outcome ||
                application.closedByUserId !== args.actorId
            )
                throw new Error("Application decision ownership lost.")
            return {
                assignmentId: application.assignmentId ?? null,
                gameId:
                    application.decisionGameId ??
                    application.gameId ??
                    "hell_let_loose",
            }
        }
        if (
            application.decisionClaimToken !== args.claimToken ||
            (application.decisionLeaseUntil ?? 0) <= Date.now()
        )
            throw new Error("Application decision ownership lost.")
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", application.guildId))
            .unique()
        if (!config) throw new Error("Application configuration not found.")
        const categories = config.membershipSettings?.categories ?? []
        const category = categories.find(
            (row) =>
                row.id === application.categoryId &&
                (row.gameId ?? "hell_let_loose") ===
                    (application.gameId ?? "hell_let_loose")
        )
        const previous = application.assignmentId
            ? await ctx.db.get(application.assignmentId)
            : null
        if (
            previous &&
            (previous.serverId !== application.guildId ||
                previous.userId !== application.creatorId ||
                (previous.gameId ?? "hell_let_loose") !==
                    (application.gameId ?? "hell_let_loose"))
        )
            throw new Error("Application assignment scope mismatch.")
        const assignments = await ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q
                    .eq("serverId", application.guildId)
                    .eq("userId", application.creatorId)
            )
            .collect()
        const repository = new ConvexAssignmentCommandRepository(ctx)
        const sync = new ConvexAssignmentRosterSyncPort(ctx)
        const actor = { userId: args.actorId, kind: "recruitment" as const }
        return commitApplicationDecision(
            {
                upsert: async (input) => {
                    const before = input.assignmentId
                        ? await ctx.db.get(
                              input.assignmentId as Id<"userAssignments">
                          )
                        : null
                    const id = await new UpsertAssignmentUseCase(
                        repository,
                        sync,
                        systemClock
                    ).execute({
                        assignmentId: input.assignmentId,
                        serverDiscordId: application.guildId,
                        userId: application.creatorId,
                        gameId: input.gameId,
                        type: input.type,
                        status: input.status,
                        membershipCategoryId: input.categoryId,
                        secondaryGroupIds: [],
                        paused: false,
                    })
                    await enqueueManagedRoles(ctx, {
                        guildId: application.guildId,
                        gameId: input.gameId,
                        userId: application.creatorId,
                        actor,
                        before,
                    })
                    return id
                },
                remove: async (id) => {
                    const before = await ctx.db.get(id as Id<"userAssignments">)
                    if (
                        !before ||
                        before.serverId !== application.guildId ||
                        before.userId !== application.creatorId
                    )
                        throw new Error("Assignment scope mismatch.")
                    await new RemoveAssignmentUseCase(
                        repository,
                        sync,
                        systemClock
                    ).execute(id)
                    await enqueueManagedRoles(ctx, {
                        guildId: application.guildId,
                        gameId: before.gameId ?? "hell_let_loose",
                        userId: application.creatorId,
                        actor,
                        before,
                    })
                },
                close: async (result) => {
                    await rememberMembershipOperation(ctx, {
                        key: `application-close:${application.threadId}`,
                        kind: "application-close",
                        guildId: application.guildId,
                        subjectId: application.threadId,
                        actorId: args.actorId,
                    })
                    const now = new Date().toISOString()
                    await ctx.db.patch(application._id, {
                        status: "closed",
                        closeOutcome: args.outcome,
                        closedAt: now,
                        closedByUserId: args.actorId,
                        closeReason: args.reason?.trim() || undefined,
                        assignmentId: result.assignmentId as
                            Id<"userAssignments"> | undefined,
                        decisionGameId: result.gameId,
                        decisionLeaseUntil: undefined,
                        updatedAt: now,
                    })
                },
            },
            {
                outcome: args.outcome,
                application,
                assignment: previous
                    ? {
                          id: String(previous._id),
                          type: previous.type,
                          membershipCategoryId: previous.membershipCategoryId,
                      }
                    : null,
                assignments: assignments.map((row) => ({
                    id: String(row._id),
                    gameId: row.gameId,
                })),
                categories,
                categoryType:
                    category?.assignmentType ?? application.assignmentType,
            }
        )
    },
})
