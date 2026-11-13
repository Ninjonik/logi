import { confirmedDmRefusal } from "./durable-delivery"
import { makeFunctionReference } from "convex/server"
import { startOwnedInterval } from "./task-owner"
import type { Client } from "discord.js"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

export type MembershipOperation = {
    expectedKeys?: string[]
    requestJson?: string
    key: string
    guildId: string
    subjectId: string
    actorId: string
    kind:
        | "application-open"
        | "application-close"
        | "ticket-open"
        | "ticket-close"
}
export type MembershipReceipt = {
    state: "confirmed" | "refused" | "skipped"
    resourceId?: string
}
export type MembershipEffectPort = Pick<
    MembershipEffects,
    "effect" | "complete" | "skip"
>
export type MembershipRepair = {
    threadId: string
    action: "member" | "rename" | "lock" | "archive"
    value?: string
}
type Begin =
    | MembershipReceipt
    | { state: "execute"; token: string }
    | { state: "uncertain" | "busy" | "failed" | "deferred" }
export class MembershipEffectLeaseLost extends Error {}

/** Membership/ticket effects only: ambiguous sends require evidence before replay. */
export class MembershipEffects {
    private operationId?: Promise<string>
    private authorityLost = false
    constructor(
        readonly operation: MembershipOperation,
        private readonly call = async (
            name: string,
            args: Record<string, unknown>
        ): Promise<unknown> =>
            convex.mutation(
                makeFunctionReference<"mutation">(
                    `discordMembershipEffects:${name}`
                ),
                { secret: env.internalSecret, ...args }
            ),
        private readonly assertAuthority: () => Promise<void> = async () => {}
    ) {}

    private id() {
        return (this.operationId ??= this.call("open", {
            key: this.operation.key,
            kind: this.operation.kind,
            guildId: this.operation.guildId,
            subjectId: this.operation.subjectId,
            actorId: this.operation.actorId,
            expectedKeys: this.operation.expectedKeys,
            requestJson: this.operation.requestJson,
        }).then((value) => {
            if (typeof value !== "string")
                throw new Error(
                    "Membership effect journal requires the updated backend"
                )
            return value
        }))
    }

    async effect(
        key: string,
        mode: "send" | "reconcile",
        execute: () => Promise<{ id?: string } | void>,
        dm = false,
        repair?: MembershipRepair
    ): Promise<MembershipReceipt> {
        if (this.authorityLost)
            throw new MembershipEffectLeaseLost(
                "Membership operation authority was lost"
            )
        await this.assertAuthority()
        const operationId = await this.id()
        const prior = (await this.call("begin", {
            operationId,
            key,
            mode,
            repair,
        })) as Begin
        if (
            prior.state === "confirmed" ||
            prior.state === "refused" ||
            prior.state === "skipped"
        )
            return prior
        if (prior.state !== "execute")
            throw new Error(
                `Membership effect ${key} requires reconciliation (${prior.state})`
            )
        let resourceId: string | undefined
        let failure: unknown
        let state: "confirmed" | "refused" | "uncertain" | "retry" = "confirmed"
        let lost = false
        const stop = startOwnedInterval(
            async () => {
                if (
                    !(await this.call("heartbeat", {
                        operationId,
                        key,
                        token: prior.token,
                    }))
                ) {
                    lost = true
                    this.authorityLost = true
                }
            },
            30_000,
            () => {
                lost = true
                this.authorityLost = true
            },
            false
        )
        try {
            await this.assertAuthority()
            resourceId = (await execute())?.id
        } catch (error) {
            failure = error
            state =
                dm && confirmedDmRefusal(error)
                    ? "refused"
                    : mode === "send"
                      ? "uncertain"
                      : "retry"
        } finally {
            await stop()
        }
        if (lost || this.authorityLost)
            throw new MembershipEffectLeaseLost(
                "Membership effect lease lost; outcome requires reconciliation"
            )
        await this.call("finish", {
            operationId,
            key,
            token: prior.token,
            state,
            resourceId,
            error:
                failure instanceof Error
                    ? failure.name
                    : failure
                      ? "Discord effect failed"
                      : undefined,
        })
        if (state === "uncertain" || state === "retry") {
            logWarn(
                "membership-recovery",
                "Discord effect retained for reconciliation",
                { guildId: this.operation.guildId, operationId, key, state }
            )
            throw (
                failure ??
                new Error(`Membership effect ${key} requires reconciliation`)
            )
        }
        return { state, resourceId }
    }

    async complete() {
        if (this.authorityLost)
            throw new MembershipEffectLeaseLost(
                "Membership operation authority was lost"
            )
        await this.assertAuthority()
        return this.call("complete", { operationId: await this.id() })
    }
    async skip(
        key: string
    ): Promise<MembershipReceipt | { state: "uncertain" }> {
        if (this.authorityLost)
            throw new MembershipEffectLeaseLost(
                "Membership operation authority was lost"
            )
        await this.assertAuthority()
        return this.call("skip", {
            operationId: await this.id(),
            key,
        }) as Promise<MembershipReceipt | { state: "uncertain" }>
    }
}

export function startMembershipEffectRecovery(client: Client) {
    const call = (name: string, args: Record<string, unknown> = {}) =>
        convex.mutation(
            makeFunctionReference<"mutation">(
                `discordMembershipEffects:${name}`
            ),
            { secret: env.internalSecret, ...args }
        )
    let stopped = false
    const stop = startOwnedInterval(
        async () => {
            // Sequential admission precedes the claim; no overlapping repair passes.
            for (let i = 0; i < 10 && !stopped; i++) {
                const row = (await call("claimRepair")) as {
                    operationId: string
                    key: string
                    token: string
                    guildId: string
                    repair: MembershipRepair
                    finishRequested: boolean
                } | null
                if (!row) break
                let lost = false
                const lease = async () => {
                    if (
                        lost ||
                        !(await call("heartbeat", {
                            operationId: row.operationId,
                            key: row.key,
                            token: row.token,
                        }))
                    ) {
                        lost = true
                        throw new Error("Membership repair lease lost")
                    }
                }
                await lease()
                const stopHeartbeat = startOwnedInterval(
                    lease,
                    30_000,
                    () => {
                        lost = true
                    },
                    false
                )
                let state: "confirmed" | "retry" = "confirmed"
                try {
                    const guild = await client.guilds.fetch(row.guildId)
                    const thread = await guild.channels.fetch(
                        row.repair.threadId
                    )
                    if (!thread?.isThread())
                        throw new Error("Repair thread is unavailable")
                    if (!client.user || thread.ownerId !== client.user.id)
                        throw new Error(
                            "Repair thread is not owned by this bot"
                        )
                    const policy = (await convex.query(
                        makeFunctionReference<"query">(
                            "discordMembershipEffects:repairPolicy"
                        ),
                        {
                            secret: env.internalSecret,
                            operationId: row.operationId,
                            threadId: row.repair.threadId,
                        }
                    )) as {
                        creatorId: string
                        status: "open" | "closed"
                        expectedStatus: "open" | "closed"
                        supportRoleIds: string[]
                    }
                    if (policy.status !== policy.expectedStatus)
                        throw new Error(
                            "Repair superseded by a later lifecycle transition"
                        )
                    if (row.repair.action === "member") {
                        if (!row.repair.value)
                            throw new Error("Repair member missing")
                        const member = await guild.members.fetch({
                            user: row.repair.value,
                            force: true,
                        })
                        if (
                            policy.status !== "open" ||
                            (member.id !== policy.creatorId &&
                                !policy.supportRoleIds.some((id) =>
                                    member.roles.cache.has(id)
                                ))
                        )
                            throw new Error(
                                "Member no longer satisfies the thread invitation policy"
                            )
                        await lease()
                        await thread.members.add(row.repair.value)
                    } else if (row.repair.action === "rename") {
                        if (!row.repair.value)
                            throw new Error("Repair name missing")
                        await lease()
                        if (thread.name !== row.repair.value)
                            await thread.setName(row.repair.value)
                    } else if (row.repair.action === "lock") {
                        await lease()
                        if (!thread.locked) await thread.setLocked(true)
                    } else {
                        await lease()
                        if (!thread.archived) await thread.setArchived(true)
                    }
                } catch (error) {
                    state = "retry"
                    logWarn(
                        "membership-recovery",
                        "Desired-state repair failed",
                        { operationId: row.operationId, key: row.key, error }
                    )
                } finally {
                    await stopHeartbeat()
                }
                if (lost)
                    throw new Error(
                        "Membership repair outcome requires reconciliation"
                    )
                await call("finish", {
                    operationId: row.operationId,
                    key: row.key,
                    token: row.token,
                    state,
                })
                if (state === "confirmed" && row.finishRequested)
                    await call("complete", { operationId: row.operationId })
            }
        },
        60_000,
        (error) =>
            logWarn("membership-recovery", "Recovery pass failed", { error })
    )
    return () => {
        stopped = true
        return stop()
    }
}
