import { isMessageEnabled } from "../src/domain/discord-messages/notification-settings"
import { mutation, query, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

export const membershipOperationKind = v.union(
    v.literal("application-open"),
    v.literal("application-close"),
    v.literal("ticket-open"),
    v.literal("ticket-close")
)
type Kind =
    "application-open" | "application-close" | "ticket-open" | "ticket-close"
const repair = v.object({
    threadId: v.string(),
    action: v.union(
        v.literal("member"),
        v.literal("rename"),
        v.literal("lock"),
        v.literal("archive")
    ),
    value: v.optional(v.string()),
})

export async function rememberMembershipOperation(
    ctx: MutationCtx,
    input: {
        key: string
        guildId: string
        kind: Kind
        subjectId: string
        actorId: string
        expectedKeys?: string[]
        requestJson?: string
    }
) {
    if (input.key.length > 240) throw new Error("Invalid operation key")
    if (input.requestJson && input.requestJson.length > 32_000)
        throw new Error("Membership recovery input too large")
    if (
        input.expectedKeys &&
        (input.expectedKeys.length > 20 ||
            input.expectedKeys.some((key) => !key || key.length > 240))
    )
        throw new Error("Invalid membership effect plan")
    const existing = await ctx.db
        .query("discordMembershipOperations")
        .withIndex("key", (q) => q.eq("key", input.key))
        .unique()
    if (existing) {
        if (
            existing.guildId !== input.guildId ||
            existing.kind !== input.kind ||
            existing.subjectId !== input.subjectId ||
            existing.actorId !== input.actorId
        )
            throw new Error("Membership operation scope mismatch")
        if (input.expectedKeys && !existing.expectedKeys)
            await ctx.db.patch(existing._id, {
                expectedKeys: input.expectedKeys,
            })
        if (input.requestJson && !existing.requestJson)
            await ctx.db.patch(existing._id, { requestJson: input.requestJson })
        return existing._id
    }
    const now = Date.now()
    return ctx.db.insert("discordMembershipOperations", {
        ...input,
        state: "pending",
        createdAt: now,
        updatedAt: now,
        workDueAt: now + 300_000,
        workAttempts: 0,
    })
}

export const open = mutation({
    args: {
        secret: v.string(),
        key: v.string(),
        guildId: v.string(),
        kind: membershipOperationKind,
        subjectId: v.string(),
        actorId: v.string(),
        expectedKeys: v.optional(v.array(v.string())),
        requestJson: v.optional(v.string()),
    },
    handler: async (ctx, { secret, ...input }) => {
        assertInternalSecret(secret)
        return rememberMembershipOperation(ctx, input)
    },
})

export const begin = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        key: v.string(),
        mode: v.union(v.literal("send"), v.literal("reconcile")),
        repair: v.optional(repair),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (!operation) throw new Error("Membership operation missing")
        if (!args.key || args.key.length > 240)
            throw new Error("Invalid effect key")
        const now = Date.now()
        if (operation.kind.endsWith("-open") && args.key !== "thread") {
            const created = await ctx.db
                .query("discordMembershipEffects")
                .withIndex("operation_key", (q) =>
                    q.eq("operationId", operation._id).eq("key", "thread")
                )
                .unique()
            if (created?.resourceId) {
                const threadId = created.resourceId
                const resource =
                    operation.kind === "ticket-open"
                        ? await ctx.db
                              .query("ticketThreads")
                              .withIndex("threadId", (q) =>
                                  q.eq("threadId", threadId)
                              )
                              .unique()
                        : await ctx.db
                              .query("membershipApplicationThreads")
                              .withIndex("threadId", (q) =>
                                  q.eq("threadId", threadId)
                              )
                              .unique()
                if (resource?.status === "closed")
                    throw new Error("Opening effects superseded by closure")
            }
        }
        const prior = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("operation_key", (q) =>
                q.eq("operationId", args.operationId).eq("key", args.key)
            )
            .unique()
        if (prior) {
            if (prior.mode !== args.mode)
                throw new Error("Effect mode mismatch")
            if (
                prior.state === "confirmed" ||
                prior.state === "refused" ||
                prior.state === "skipped"
            )
                return { state: prior.state, resourceId: prior.resourceId }
            if (prior.state === "started" && prior.leaseUntil > now)
                return { state: "busy" as const }
            if (
                prior.state === "uncertain" ||
                (prior.state === "started" && prior.mode === "send")
            ) {
                await ctx.db.patch(prior._id, {
                    state: "uncertain",
                    updatedAt: now,
                })
                await ctx.db.patch(operation._id, {
                    state: "review",
                    updatedAt: now,
                })
                return { state: "uncertain" as const }
            }
            if (prior.state === "failed" || prior.attempts >= 5)
                return { state: "failed" as const }
            if (prior.retryAt > now) return { state: "deferred" as const }
            const token = `${prior._id}:${prior.attempts + 1}`
            await ctx.db.patch(prior._id, {
                state: "started",
                token,
                attempts: prior.attempts + 1,
                leaseUntil: now + 300_000,
                updatedAt: now,
            })
            return { state: "execute" as const, token }
        }
        if (operation.state === "complete")
            throw new Error("Completed operation cannot gain effects")
        const token = `${operation._id}:${args.key}:1`
        await ctx.db.insert("discordMembershipEffects", {
            operationId: operation._id,
            key: args.key,
            mode: args.mode,
            repair: args.repair,
            repairable: Boolean(args.repair),
            state: "started",
            attempts: 1,
            token,
            leaseUntil: now + 300_000,
            retryAt: 0,
            createdAt: now,
            updatedAt: now,
        })
        return { state: "execute" as const, token }
    },
})

export const finish = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        key: v.string(),
        token: v.string(),
        state: v.union(
            v.literal("confirmed"),
            v.literal("refused"),
            v.literal("uncertain"),
            v.literal("retry")
        ),
        resourceId: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const effect = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("operation_key", (q) =>
                q.eq("operationId", args.operationId).eq("key", args.key)
            )
            .unique()
        if (
            !effect ||
            effect.token !== args.token ||
            effect.state !== "started" ||
            effect.leaseUntil <= Date.now()
        )
            throw new Error("Membership effect ownership lost")
        const state =
            args.state === "retry" && effect.attempts >= 5
                ? "failed"
                : args.state
        await ctx.db.patch(effect._id, {
            state,
            resourceId: args.resourceId,
            error: args.error?.slice(0, 500),
            retryAt:
                Date.now() +
                Math.min(60_000 * 2 ** (effect.attempts - 1), 900_000),
            updatedAt: Date.now(),
        })
        if (state === "uncertain" || state === "failed")
            await ctx.db.patch(args.operationId, {
                state: "review",
                updatedAt: Date.now(),
            })
    },
})

export const complete = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        await ctx.db.patch(args.operationId, { finishRequested: true })
        const operation = await ctx.db.get(args.operationId)
        if (!operation) throw new Error("Membership operation missing")
        if (!operation.expectedKeys?.length)
            throw new Error("Membership effect plan missing")
        for (const key of operation.expectedKeys ?? []) {
            const effect = await ctx.db
                .query("discordMembershipEffects")
                .withIndex("operation_key", (q) =>
                    q.eq("operationId", args.operationId).eq("key", key)
                )
                .unique()
            if (
                !effect ||
                (effect.state !== "confirmed" &&
                    effect.state !== "refused" &&
                    effect.state !== "skipped")
            )
                return false
        }
        for (const state of [
            "started",
            "uncertain",
            "retry",
            "failed",
        ] as const) {
            if (
                await ctx.db
                    .query("discordMembershipEffects")
                    .withIndex("operation_state", (q) =>
                        q.eq("operationId", args.operationId).eq("state", state)
                    )
                    .first()
            )
                return false
        }
        await ctx.db.patch(args.operationId, {
            state: "complete",
            updatedAt: Date.now(),
        })
        return true
    },
})

export const heartbeat = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        key: v.string(),
        token: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const effect = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("operation_key", (q) =>
                q.eq("operationId", args.operationId).eq("key", args.key)
            )
            .unique()
        if (
            !effect ||
            effect.state !== "started" ||
            effect.token !== args.token ||
            effect.leaseUntil <= Date.now()
        )
            return false
        await ctx.db.patch(effect._id, { leaseUntil: Date.now() + 300_000 })
        await ctx.db.patch(args.operationId, {
            updatedAt: Date.now(),
            workDueAt: Date.now() + 300_000,
        })
        return true
    },
})

/** Opt-outs skip untouched DMs without claiming that an uncertain send was refused. */
export const skip = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        key: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (!operation || !/^(dm|confirmation-dm):/.test(args.key))
            throw new Error("Invalid notification skip")
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", operation.guildId))
            .unique()
        const disabled =
            config &&
            (args.key.startsWith("confirmation-dm:")
                ? config.membershipSettings?.sendConfirmationDm === false
                : !isMessageEnabled(
                      config,
                      operation.kind === "ticket-close"
                          ? "ticketCloseDm"
                          : "applicationCloseDm"
                  ))
        if (!disabled) throw new Error("Notification is not disabled")
        const effect = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("operation_key", (q) =>
                q.eq("operationId", operation._id).eq("key", args.key)
            )
            .unique()
        if (
            effect &&
            (effect.state === "confirmed" ||
                effect.state === "refused" ||
                effect.state === "skipped")
        )
            return { state: effect.state, resourceId: effect.resourceId }
        if (
            effect &&
            (effect.state === "started" ||
                effect.state === "uncertain" ||
                effect.state === "failed")
        )
            return { state: "uncertain" as const }
        const now = Date.now()
        if (effect)
            await ctx.db.patch(effect._id, { state: "skipped", updatedAt: now })
        else
            await ctx.db.insert("discordMembershipEffects", {
                operationId: operation._id,
                key: args.key,
                mode: "send",
                state: "skipped",
                attempts: 0,
                token: "notification-disabled",
                leaseUntil: 0,
                retryAt: 0,
                createdAt: now,
                updatedAt: now,
            })
        return { state: "skipped" as const }
    },
})

/** A small indexed repair lane. It never replays a possibly accepted send. */
export const claimRepair = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        const expired = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("state_leaseUntil", (q) =>
                q.eq("state", "started").lte("leaseUntil", now)
            )
            .take(25)
        for (const effect of expired) {
            const state =
                effect.mode === "send"
                    ? "uncertain"
                    : effect.repair && effect.attempts < 5
                      ? "retry"
                      : "failed"
            await ctx.db.patch(effect._id, {
                state,
                retryAt: now + 60_000,
                updatedAt: now,
            })
            if (state !== "retry")
                await ctx.db.patch(effect.operationId, {
                    state: "review",
                    updatedAt: now,
                })
        }
        const candidates = await ctx.db
            .query("discordMembershipEffects")
            .withIndex("repairable_state_retryAt", (q) =>
                q
                    .eq("repairable", true)
                    .eq("state", "retry")
                    .lte("retryAt", now)
            )
            .take(25)
        for (const effect of candidates) {
            if (effect.mode !== "reconcile" || effect.attempts >= 5) {
                await ctx.db.patch(effect._id, {
                    state: "failed",
                    updatedAt: now,
                })
                await ctx.db.patch(effect.operationId, {
                    state: "review",
                    updatedAt: now,
                })
                continue
            }
            if (!effect.repair) continue
            const operation = await ctx.db.get(effect.operationId)
            if (!operation) throw new Error("Membership operation missing")
            const token = `${effect._id}:${effect.attempts + 1}`
            await ctx.db.patch(effect._id, {
                state: "started",
                attempts: effect.attempts + 1,
                token,
                leaseUntil: now + 300_000,
                updatedAt: now,
            })
            return {
                operationId: effect.operationId,
                key: effect.key,
                token,
                repair: effect.repair,
                guildId: operation.guildId,
                finishRequested: operation.finishRequested ?? false,
            }
        }
        return null
    },
})

/** Operator pagination is tenant-scoped and never interprets a missing receipt as a failed send. */
export const claimWorkflow = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        // Completed workflows are collectible; unresolved evidence is retained.
        const old = await ctx.db
            .query("discordMembershipOperations")
            .withIndex("state_updatedAt", (q) =>
                q.eq("state", "complete").lt("updatedAt", now - 90 * 86400_000)
            )
            .take(2)
        for (const operation of old) {
            const effects = await ctx.db
                .query("discordMembershipEffects")
                .withIndex("operation_key", (q) =>
                    q.eq("operationId", operation._id)
                )
                .take(100)
            for (const effect of effects) await ctx.db.delete(effect._id)
            const audits = await ctx.db
                .query("discordMembershipReconciliations")
                .withIndex("operationId", (q) =>
                    q.eq("operationId", operation._id)
                )
                .take(100)
            for (const audit of audits) await ctx.db.delete(audit._id)
            if (effects.length < 100 && audits.length < 100)
                await ctx.db.delete(operation._id)
        }
        const candidates = await Promise.all(
            (["pending", "review"] as const).map((state) =>
                ctx.db
                    .query("discordMembershipOperations")
                    .withIndex("state_workDueAt", (q) =>
                        q.eq("state", state).lte("workDueAt", now)
                    )
                    .first()
            )
        )
        const operation = candidates
            .filter((row) => row !== null)
            .sort((a, b) => (a.workDueAt ?? 0) - (b.workDueAt ?? 0))[0]
        if (!operation) return null
        if ((operation.workAttempts ?? 0) >= 5) {
            await ctx.db.patch(operation._id, {
                state: "review",
                workDueAt: Number.MAX_SAFE_INTEGER,
            })
            return null
        }
        const attempts = (operation.workAttempts ?? 0) + 1
        const token = `${operation._id}:${operation.workGeneration ?? 0}:${attempts}:${now}`
        await ctx.db.patch(operation._id, {
            workAttempts: attempts,
            workToken: token,
            workLeaseUntil: now + 300_000,
            workDueAt: now + 300_000,
        })
        const thread = operation.kind.endsWith("-close")
            ? operation.subjectId
            : (
                  await ctx.db
                      .query("discordMembershipEffects")
                      .withIndex("operation_key", (q) =>
                          q.eq("operationId", operation._id).eq("key", "thread")
                      )
                      .unique()
              )?.resourceId
        const draftId =
            operation.kind === "application-open"
                ? ctx.db.normalizeId(
                      "membershipApplicationFormDrafts",
                      operation.subjectId
                  )
                : null
        const draft = draftId ? await ctx.db.get(draftId) : null
        return {
            ...operation,
            id: String(operation._id),
            token,
            threadId: thread ?? null,
            source: draft?.source ?? null,
        }
    },
})

export const workflowHeartbeat = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        token: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (
            !operation ||
            operation.workToken !== args.token ||
            (operation.workLeaseUntil ?? 0) <= Date.now()
        )
            return false
        await ctx.db.patch(operation._id, {
            workLeaseUntil: Date.now() + 300_000,
            workDueAt: Date.now() + 300_000,
        })
        return true
    },
})

export const finishWorkflow = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        token: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (
            !operation ||
            operation.workToken !== args.token ||
            (operation.workLeaseUntil ?? 0) <= Date.now()
        )
            throw new Error("Membership workflow ownership lost")
        if (operation.state === "complete") {
            await ctx.db.patch(operation._id, {
                workToken: undefined,
                workLeaseUntil: undefined,
            })
            return
        }
        const exhausted = (operation.workAttempts ?? 0) >= 5
        await ctx.db.patch(operation._id, {
            state: exhausted ? "review" : operation.state,
            workToken: undefined,
            workLeaseUntil: undefined,
            workDueAt: exhausted
                ? Number.MAX_SAFE_INTEGER
                : Date.now() +
                  Math.min(
                      60_000 * 2 ** (operation.workAttempts ?? 1),
                      900_000
                  ),
        })
    },
})

export const inspect = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        state: v.union(
            v.literal("pending"),
            v.literal("review"),
            v.literal("complete")
        ),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const result = await ctx.db
            .query("discordMembershipOperations")
            .withIndex("guild_state", (q) =>
                q.eq("guildId", args.guildId).eq("state", args.state)
            )
            .paginate({ cursor: args.cursor, numItems: 25 })
        return {
            ...result,
            page: result.page.map((row) => ({
                id: String(row._id),
                key: row.key,
                kind: row.kind,
                guildId: row.guildId,
                subjectId: row.subjectId,
                actorId: row.actorId,
                state: row.state,
                expectedKeys: row.expectedKeys,
                workAttempts: row.workAttempts,
                workDueAt: row.workDueAt,
                updatedAt: row.updatedAt,
            })),
        }
    },
})
export const effects = query({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return ctx.db
            .query("discordMembershipEffects")
            .withIndex("operation_key", (q) =>
                q.eq("operationId", args.operationId)
            )
            .paginate({ cursor: args.cursor, numItems: 50 })
    },
})

export const audit = query({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return ctx.db
            .query("discordMembershipReconciliations")
            .withIndex("operationId", (q) =>
                q.eq("operationId", args.operationId)
            )
            .paginate({ cursor: args.cursor, numItems: 50 })
    },
})

export const repairPolicy = query({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        threadId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const operation = await ctx.db.get(args.operationId)
        if (!operation) throw new Error("Membership operation missing")
        const ticket = operation.kind.startsWith("ticket-")
            ? await ctx.db
                  .query("ticketThreads")
                  .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
                  .unique()
            : await ctx.db
                  .query("membershipApplicationThreads")
                  .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
                  .unique()
        if (!ticket || ticket.guildId !== operation.guildId)
            throw new Error("Repair resource scope mismatch")
        if (operation.kind.endsWith("-close")) {
            if (
                operation.subjectId !== args.threadId ||
                ticket.closedByUserId !== operation.actorId
            )
                throw new Error("Repair close scope mismatch")
        } else {
            const receipt = await ctx.db
                .query("discordMembershipEffects")
                .withIndex("operation_key", (q) =>
                    q.eq("operationId", operation._id).eq("key", "thread")
                )
                .unique()
            if (
                receipt?.resourceId !== args.threadId ||
                ticket.creatorId !== operation.actorId
            )
                throw new Error("Repair opening scope mismatch")
        }
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", operation.guildId))
            .unique()
        const category = operation.kind.startsWith("ticket-")
            ? config?.ticketSettings?.categories.find(
                  (row) => row.id === ticket.categoryId
              )
            : config?.membershipSettings?.categories.find(
                  (row) => row.id === ticket.categoryId
              )
        return {
            creatorId: ticket.creatorId,
            status: ticket.status,
            expectedStatus: operation.kind.endsWith("-close")
                ? "closed"
                : "open",
            supportRoleIds: category?.supportRoleIds ?? [],
        }
    },
})

export const legacy = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        kind: v.union(v.literal("ticket"), v.literal("application")),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const page =
            args.kind === "ticket"
                ? await ctx.db
                      .query("ticketThreads")
                      .withIndex("guildId", (q) =>
                          q.eq("guildId", args.guildId)
                      )
                      .paginate({ cursor: args.cursor, numItems: 25 })
                : await ctx.db
                      .query("membershipApplicationThreads")
                      .withIndex("guildId", (q) =>
                          q.eq("guildId", args.guildId)
                      )
                      .paginate({ cursor: args.cursor, numItems: 25 })
        return {
            ...page,
            page: await Promise.all(
                page.page.map(async (row) => {
                    const operation = await ctx.db
                        .query("discordMembershipOperations")
                        .withIndex("key", (q) =>
                            q.eq("key", `${args.kind}-close:${row.threadId}`)
                        )
                        .unique()
                    return {
                        id: String(row._id),
                        threadId: row.threadId,
                        status: row.status,
                        closedAt: row.closedAt ?? null,
                        closeRecovery: operation?.state ?? "legacy_unproven",
                    }
                })
            ),
        }
    },
})

export const reconcile = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        effectId: v.id("discordMembershipEffects"),
        operator: v.string(),
        evidence: v.string(),
        action: v.union(v.literal("confirm"), v.literal("proven_not_sent")),
        resourceId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            !args.operator.trim() ||
            args.evidence.trim().length < 10 ||
            args.evidence.length > 2000
        )
            throw new Error("Operator and concrete evidence required")
        const effect = await ctx.db.get(args.effectId)
        if (
            !effect ||
            effect.operationId !== args.operationId ||
            effect.state === "confirmed" ||
            effect.state === "refused" ||
            effect.state === "skipped" ||
            (effect.state === "started" && effect.leaseUntil > Date.now())
        )
            throw new Error("Effect cannot be reconciled")
        const operation = await ctx.db.get(args.operationId)
        if (!operation || (operation.workLeaseUntil ?? 0) > Date.now())
            throw new Error("Active workflow cannot be reconciled")
        if (
            args.action === "confirm" &&
            effect.key === "thread" &&
            !args.resourceId?.match(/^\d{17,20}$/)
        )
            throw new Error("Confirmed thread requires its Discord ID")
        if (args.action === "proven_not_sent" && effect.attempts >= 5)
            throw new Error(
                "Effect retry budget exhausted; complete repair manually"
            )
        await ctx.db.patch(effect._id, {
            state: args.action === "confirm" ? "confirmed" : "retry",
            resourceId: args.resourceId,
            retryAt: 0,
            updatedAt: Date.now(),
        })
        await ctx.db.patch(args.operationId, {
            state: "pending",
            updatedAt: Date.now(),
            workDueAt: 0,
            workAttempts: 0,
            workToken: undefined,
            workLeaseUntil: undefined,
            workGeneration:
                ((await ctx.db.get(args.operationId))?.workGeneration ?? 0) + 1,
        })
        await ctx.db.insert("discordMembershipReconciliations", {
            operationId: args.operationId,
            effectId: effect._id as Id<"discordMembershipEffects">,
            operator: args.operator,
            evidence: args.evidence,
            action: args.action,
            at: Date.now(),
        })
    },
})

/** Restarts only the workflow budget; confirmed/uncertain send receipts remain authoritative. */
export const resume = mutation({
    args: {
        secret: v.string(),
        operationId: v.id("discordMembershipOperations"),
        operator: v.string(),
        evidence: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (
            !args.operator.trim() ||
            args.evidence.trim().length < 10 ||
            args.evidence.length > 2000
        )
            throw new Error("Operator and concrete evidence required")
        const operation = await ctx.db.get(args.operationId)
        if (
            !operation ||
            operation.state === "complete" ||
            (operation.workLeaseUntil ?? 0) > Date.now()
        )
            throw new Error("Workflow cannot be resumed")
        await ctx.db.patch(operation._id, {
            state: "pending",
            workDueAt: 0,
            workAttempts: 0,
            workToken: undefined,
            workLeaseUntil: undefined,
            workGeneration: (operation.workGeneration ?? 0) + 1,
            updatedAt: Date.now(),
        })
        await ctx.db.insert("discordMembershipReconciliations", {
            operationId: operation._id,
            operator: args.operator,
            evidence: args.evidence,
            action: "resume",
            at: Date.now(),
        })
    },
})
