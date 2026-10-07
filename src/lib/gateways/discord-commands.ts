import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import {
    credentialEncryption,
    newSourceRef,
} from "@/lib/gateways/game-server-credentials"
import { legacyStatsServerDrafts } from "@/domain/discord-commands/legacy-stats-servers"
import type { StoredCommandSettings } from "@/domain/discord-commands/command-settings"
import type { StatsCommandSettings } from "@/domain/player-stats/command-settings"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import type { CredentialEnvelope } from "@/domain/game-data/credentials"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import type { DashboardActor } from "../../../convex/dashboardActor"
import { getInternalAuthSecret } from "@/lib/env"

/** A clan admin's live dashboard session; the actor never comes from a request body. */
export type DiscordCommandsWebAccess = {
    serverId: string
    guildId: string
    actor: DashboardActor
}

type ActorArgs = { secret: string; guildId: string; actor: DashboardActor }

/** The "Registrace příkazů" card (N3-03). */
export type CommandRegistrationStatus = {
    registeredAt: number | null
    commandCount: number | null
    requestedAt: number | null
    failedAt: number | null
    failure: "forbidden" | "rate_limited" | "unavailable" | null
}

const registrationQuery = makeFunctionReference<
    "query",
    ActorArgs,
    CommandRegistrationStatus
>("discordCommands:registrationForDashboard")
const requestMutation = makeFunctionReference<
    "mutation",
    ActorArgs,
    { requestedAt: number }
>("discordCommands:requestRegistration")
const saveMutation = makeFunctionReference<
    "mutation",
    ActorArgs & {
        commandSettings: StoredCommandSettings
        statsSettings: StatsCommandSettings
    },
    { ok: true }
>("discordCommands:saveSettings")
const createSourceMutation = makeFunctionReference<
    "mutation",
    ActorArgs & {
        source: Record<string, string>
        credential: CredentialEnvelope | null
        verified: boolean
        testOutcome: null
        enable: boolean
    },
    { ok: true } | { error: string }
>("gameDataSources:create")

const actorArgs = (access: DiscordCommandsWebAccess): ActorArgs => ({
    secret: getInternalAuthSecret(),
    guildId: access.guildId,
    actor: access.actor,
})

/** Current clan admin of the workspace, read without the dashboard cache. */
export async function discordCommandsWebAccess(
    serverId: string
): Promise<DiscordCommandsWebAccess | null> {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return server?.canAdmin && actor
        ? { serverId, guildId: server.server.discordId, actor }
        : null
}

export async function readCommandRegistration(
    access: DiscordCommandsWebAccess
) {
    return await fetchQuery(registrationQuery, actorArgs(access))
}

/** "Znovu zaregistrovat": the bot registers the commands within a minute. */
export async function requestCommandRegistration(
    access: DiscordCommandsWebAccess
) {
    return await fetchMutation(requestMutation, actorArgs(access))
}

/** Saves the page; Convex re-checks the session and the admin right. */
export async function saveCommandSettings(
    access: DiscordCommandsWebAccess,
    input: {
        commandSettings: StoredCommandSettings
        statsSettings: StatsCommandSettings
    }
) {
    return await fetchMutation(saveMutation, { ...actorArgs(access), ...input })
}

export type LegacyConversionResult = {
    converted: number
    alreadyThere: number
    skipped: number
    failed: number
}

/**
 * "Převést do Herních serverů" (N3-06, N3-B09): every old stats server
 * connection becomes a Hell Let Loose CRCON game server with its key stored
 * AES-256-GCM encrypted, as a disabled draft to test in Herní servery. The
 * old entries stay until an admin removes them, because the player search
 * of /link still reads them.
 */
export async function convertLegacyStatsServers(
    access: DiscordCommandsWebAccess
): Promise<LegacyConversionResult | { error: "encryption_unavailable" }> {
    const context = await getServerContextUncached(access.serverId)
    const config = context?.discordConfig
    const { drafts, skipped } = legacyStatsServerDrafts({
        servers: config?.playerStatsServers ?? [],
        exceptions: config?.gameOverrides ?? {},
    })
    if (!drafts.length)
        return { converted: 0, alreadyThere: 0, skipped, failed: 0 }
    const encryption = credentialEncryption()
    if (!encryption) return { error: "encryption_unavailable" }
    const result: LegacyConversionResult = {
        converted: 0,
        alreadyThere: 0,
        skipped,
        failed: 0,
    }
    for (const draft of drafts) {
        const ref = newSourceRef()
        const outcome = await fetchMutation(createSourceMutation, {
            ...actorArgs(access),
            source: { ref, ...draft.source },
            credential: encryption.encrypt(
                {
                    guildId: access.guildId,
                    sourceRef: ref,
                    provider: draft.source.provider,
                    origin: draft.source.origin,
                    providerServerId: draft.source.providerServerId,
                },
                draft.key
            ),
            verified: false,
            testOutcome: null,
            enable: false,
        }).catch(() => ({ error: "unavailable" }))
        if ("ok" in outcome) result.converted++
        else if (outcome.error === "duplicate_identity") result.alreadyThere++
        else result.failed++
    }
    return result
}
