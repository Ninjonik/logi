import {
    ManagedRoleFailure,
    reconcileManagedRoles,
    type ManagedRoleOutcome,
} from "../../../src/application/membership/reconcile-managed-roles"
import {
    createManagedRoleDiscord,
    type RoleEvidence,
    type RoleSnapshot,
} from "../../../src/infrastructure/discord/managed-roles"
import { makeFunctionReference } from "convex/server"
import type { Client } from "discord.js"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

type Claim = { guildId: string; operationId: string; fence: number }
type Work = {
    verdict: "ready" | "denied" | "superseded"
    allowedRoleIds: string[]
    desiredRoleIds: string[]
    guildId?: string
    discordUserId?: string
    actorId?: string
}
type Ports = {
    now(): number
    prepare(claim: Claim, evidence?: RoleEvidence): Promise<Work>
    discord(work: {
        guildId: string
        userId: string
        actorId: string
        operationId: string
    }): {
        observe(): Promise<RoleSnapshot>
        change(action: "add" | "remove", id: string): Promise<void>
    }
    finish(
        claim: Claim,
        status: ManagedRoleOutcome,
        reason: string,
        retryAfterMs?: number,
        evidence?: RoleEvidence
    ): Promise<boolean>
}
export async function processManagedRoleOperation(claim: Claim, ports: Ports) {
    let evidence: RoleEvidence | undefined,
        discord: ReturnType<Ports["discord"]> | undefined
    const assertFreshEvidence = () => {
        if (!evidence) return // The initial prepare precedes the first observation.
        const age = ports.now() - evidence.observedAt
        if (!Number.isFinite(age) || age < 0 || age > 10_000)
            throw new ManagedRoleFailure("observation_expired")
    }
    return reconcileManagedRoles({
        now: ports.now,
        prepare: async () => {
            assertFreshEvidence()
            const work = await ports.prepare(claim, evidence)
            // A slow backend response must not turn old provider evidence into
            // an unchecked authorization immediately before a Discord write.
            assertFreshEvidence()
            if (
                work.verdict === "ready" &&
                work.guildId === claim.guildId &&
                work.discordUserId &&
                work.actorId
            )
                discord ??= ports.discord({
                    guildId: work.guildId,
                    userId: work.discordUserId,
                    actorId: work.actorId,
                    operationId: claim.operationId,
                })
            else if (work.verdict === "ready")
                return { ...work, verdict: "denied" }
            return work
        },
        observe: async () => {
            if (!discord) throw new Error("Missing role work.")
            const snapshot = await discord.observe()
            evidence = snapshot.evidence
            return { ...snapshot, actorAuthorized: evidence.actorPresent }
        },
        change: async (action, id) => {
            if (!discord) throw new Error("Missing role work.")
            await discord.change(action, id)
        },
        finish: (status, reason, retryAfterMs) =>
            ports.finish(claim, status, reason, retryAfterMs, evidence),
    })
}
const claimReference = makeFunctionReference<"mutation">(
    "memberRoleOperations:claimNext"
)
const prepareReference = makeFunctionReference<"query">(
    "memberRoleOperations:prepare"
)
const finishReference = makeFunctionReference<"mutation">(
    "memberRoleOperations:finish"
)
const activeGuilds = new Set<string>()
/** One bounded operation per guild polling pass; durable leases also protect multiple bot processes. */
export async function syncManagedMemberRoles(client: Client, guildId: string) {
    if (!client.user || activeGuilds.has(guildId)) return
    activeGuilds.add(guildId)
    try {
        const claim = (await convex.mutation(claimReference, {
            secret: env.internalSecret,
            guildId,
        })) as Omit<Claim, "guildId"> | null
        if (!claim) return
        await processManagedRoleOperation(
            { ...claim, guildId },
            {
                now: Date.now,
                prepare: (work, evidence) =>
                    convex.query(prepareReference, {
                        secret: env.internalSecret,
                        operationId: work.operationId,
                        fence: work.fence,
                        evidence,
                    }),
                discord: (work) =>
                    createManagedRoleDiscord({
                        ...work,
                        botUserId: client.user!.id,
                        token: env.botToken,
                    }),
                finish: (work, outcome, reason, retryAfterMs, evidence) =>
                    convex.mutation(finishReference, {
                        secret: env.internalSecret,
                        operationId: work.operationId,
                        fence: work.fence,
                        outcome,
                        reason,
                        retryAfterMs,
                        evidence,
                    }),
            }
        )
    } finally {
        activeGuilds.delete(guildId)
    }
}

/** Independent recovery polling also runs when no event/config subscription changes. */
export function startManagedRoleWorker(client: Client) {
    let running = false,
        offset = 0
    const tick = async () => {
        if (running || !client.isReady()) return
        running = true
        try {
            const guildIds = [...client.guilds.cache.values()]
                .filter((guild) => guild.available)
                .map((guild) => guild.id)
                .sort()
            if (!guildIds.length) return
            offset %= guildIds.length
            const batch = Array.from(
                { length: Math.min(4, guildIds.length) },
                (_, i) => guildIds[(offset + i) % guildIds.length]
            )
            offset = (offset + batch.length) % guildIds.length
            const results = await Promise.allSettled(
                batch.map((id) => syncManagedMemberRoles(client, id))
            )
            results.forEach((result, i) => {
                if (result.status === "rejected")
                    logWarn(
                        "managed-roles",
                        "Managed role recovery pass failed",
                        { guildId: batch[i] }
                    )
            })
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => {
        void tick()
    }, 10_000)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
