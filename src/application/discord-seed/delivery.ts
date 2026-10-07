import { applySeedRunEvent, type SeedFailure } from "@/domain/discord-seed/run"

import type { SeedPorts, StoredSeedRun } from "./ports"

/**
 * Where a run's call belongs now. A seeding run shows its call; an ended run
 * only edits a call that exists (a late post would be wrong), and with "Smazat
 * zprávu a seed ukončit" the call disappears at the live threshold (P3-17).
 */
export type SeedCallTarget =
    | { action: "show"; channelId: string }
    | { action: "remove" }
    | { action: "none" }

export function seedCallTarget(
    run: Pick<StoredSeedRun, "status" | "endAction" | "channelId">,
    hasMessage: boolean
): SeedCallTarget {
    if (run.status === "seeding")
        return { action: "show", channelId: run.channelId }
    if (!hasMessage) return { action: "none" }
    return run.status === "live" && run.endAction === "delete"
        ? { action: "remove" }
        : { action: "show", channelId: run.channelId }
}

/**
 * The Discord side of one seed call, implemented by the bot with its durable
 * managed-message publisher (lease, invisible marker recovery, edit in
 * place): `publish(channelId)` posts or edits the call and answers the
 * message ID; `publish(null)` deletes it. The bot's payload carries the role
 * ping, which Discord delivers only when the message is created, so edits
 * ping nobody (P5-03, P5-12).
 */
export type SeedCallPublisher = {
    /** Undefined when another worker holds the message right now. */
    publish(channelId: string | null): Promise<string | null | undefined>
    /** Discord refused the channel for good (missing, wrong type, permissions). */
    isPermanentFailure(error: unknown): boolean
    /** Members holding the Seed role now ("34 · @Seed"); null when unknown. */
    roleMemberCount(roleId: string): Promise<number | null>
}

export type SeedCallReports = {
    posted(input: {
        runId: string
        pingedMembers: number | null
    }): Promise<void>
    failed(input: { runId: string; reason: SeedFailure }): Promise<void>
}

/**
 * Delivers one call, then reports the first post (with the pinged member
 * count for the history) or a permanent channel failure, so the run fails
 * at once instead of waiting for its delivery deadline.
 */
export async function deliverSeedCall(
    input: { run: StoredSeedRun; hasMessage: boolean },
    ports: { discord: SeedCallPublisher; reports: SeedCallReports }
): Promise<
    { kind: "delivered"; messageId: string | null } | { kind: "skipped" }
> {
    const target = seedCallTarget(input.run, input.hasMessage)
    if (target.action === "none") return { kind: "skipped" }
    try {
        const messageId = await ports.discord.publish(
            target.action === "show" ? target.channelId : null
        )
        if (messageId === undefined) return { kind: "skipped" }
        if (messageId && input.run.callPostedAt === null)
            await ports.reports.posted({
                runId: input.run.id,
                pingedMembers:
                    input.run.ping.kind === "role"
                        ? await ports.discord.roleMemberCount(
                              input.run.ping.roleId
                          )
                        : null,
            })
        return { kind: "delivered", messageId }
    } catch (error) {
        if (
            input.run.status === "seeding" &&
            !input.hasMessage &&
            ports.discord.isPermanentFailure(error)
        )
            await ports.reports.failed({
                runId: input.run.id,
                reason: "channel_unavailable",
            })
        throw error
    }
}

export type SeedDeliveryRecord =
    | { kind: "recorded"; run: StoredSeedRun }
    | { kind: "unchanged" }
    | { kind: "not_found" }

/** The bot's report that a call is in Discord, with the pinged member count. */
export async function recordSeedCallPosted(
    ports: Pick<SeedPorts, "store" | "clock">,
    input: { guildId: string; runId: string; pingedMembers: number | null }
): Promise<SeedDeliveryRecord> {
    const run = await ports.store.run(input.runId)
    if (!run || run.guildId !== input.guildId) return { kind: "not_found" }
    const step = applySeedRunEvent(run, {
        kind: "call_posted",
        at: ports.clock.now().getTime(),
        pingedMembers: input.pingedMembers,
    })
    if (!step.changed) return { kind: "unchanged" }
    const recorded: StoredSeedRun = { ...run, ...step.run }
    await ports.store.saveRun(recorded)
    return { kind: "recorded", run: recorded }
}

/** The bot's report that a call cannot be posted: the run fails and frees the server. */
export async function reportSeedCallFailed(
    ports: Pick<SeedPorts, "store" | "clock" | "messages">,
    input: { guildId: string; runId: string; reason: SeedFailure }
): Promise<SeedDeliveryRecord> {
    const run = await ports.store.run(input.runId)
    if (!run || run.guildId !== input.guildId) return { kind: "not_found" }
    const step = applySeedRunEvent(run, {
        kind: "fail",
        at: ports.clock.now().getTime(),
        reason: input.reason,
    })
    if (!step.changed) return { kind: "unchanged" }
    const failed: StoredSeedRun = { ...run, ...step.run }
    await ports.store.saveRun(failed)
    const plan = await ports.store.plan(run)
    if (plan?.state.activeRunId === run.id)
        await ports.store.savePlanState(plan.id, {
            ...plan.state,
            activeRunId: null,
        })
    await ports.messages.controlChanged(run)
    return { kind: "recorded", run: failed }
}
