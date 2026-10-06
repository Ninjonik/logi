import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import type {
    PanelOverviewResponse,
    PanelServerSaveResult,
    PanelTestResponse,
} from "../../../convex/discordPanels"
import {
    CredentialCipherError,
    parseKeyring,
    sealSecret,
} from "@/infrastructure/game-data/credential-cipher"
import {
    inspectPanelChannel,
    type PanelChannelCheck,
} from "@/lib/gateways/discord-public-channel"
import { serverPasswordPlaintext } from "@/domain/discord-publications/server-join.schema"
import type { PanelActionResult } from "@/application/discord-publications/panel-actions"
import type { PanelSaveResult } from "@/application/discord-publications/save-panel"
import type { PanelAction } from "@/domain/discord-publications/panel-delivery"
import { serverPasswordAad } from "@/domain/discord-publications/server-join"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import type { CredentialEnvelope } from "@/domain/game-data/credentials"
import { getCredentialKeyring, getInternalAuthSecret } from "@/lib/env"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import type { LeagueOverview } from "@/domain/wardogs-league/panels"
import type { DashboardActor } from "../../../convex/dashboardActor"

/**
 * "Panely v Discordu" through the authenticated web gateway: every call
 * carries the internal secret and the dashboard actor from the session,
 * and Convex re-checks the clan-admin right. Discord is never called from
 * here except to read a channel's permissions for "Ověřit".
 */
export type DiscordPanelsAccess = { guildId: string; actor: DashboardActor }

type ActorArgs = { secret: string; guildId: string; actor: DashboardActor }
const actorArgs = (access: DiscordPanelsAccess): ActorArgs => ({
    secret: getInternalAuthSecret(),
    guildId: access.guildId,
    actor: access.actor,
})

const overviewQuery = makeFunctionReference<
    "query",
    ActorArgs,
    PanelOverviewResponse
>("discordPanels:overview")
const saveMutation = makeFunctionReference<
    "mutation",
    ActorArgs & {
        panelId: string | null
        settings: unknown
        send: boolean
        expectedRevision: number | null
    },
    PanelSaveResult
>("discordPanels:save")
const actMutation = makeFunctionReference<
    "mutation",
    ActorArgs & { panelId: string; action: PanelAction },
    PanelActionResult
>("discordPanels:act")
const serverMutation = makeFunctionReference<
    "mutation",
    ActorArgs & {
        connectionId: string
        address?: string | null
        joinCode?: string | null
        password?: CredentialEnvelope | null
    },
    PanelServerSaveResult
>("discordPanels:setServer")
const leaguePreviewQuery = makeFunctionReference<
    "query",
    ActorArgs & { fixtureCount: number },
    LeagueOverview
>("discordPanels:leaguePreview")
const refreshControlMutation = makeFunctionReference<
    "mutation",
    ActorArgs & { connectionId: string },
    { status: "accepted" } | { status: "not_found" }
>("discordPanels:refreshControl")
const testAction = makeFunctionReference<
    "action",
    ActorArgs & { connectionId: string; panelId: string | null },
    PanelTestResponse
>("discordPanels:testFetch")

/** A current clan admin with a live dashboard session; null denies. */
export async function discordPanelsAccess(
    serverId: string
): Promise<DiscordPanelsAccess | null> {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return server?.canAdmin && actor
        ? { guildId: server.server.discordId, actor }
        : null
}

export async function readDiscordPanels(access: DiscordPanelsAccess) {
    return await fetchQuery(overviewQuery, actorArgs(access))
}

export async function saveDiscordPanel(
    access: DiscordPanelsAccess,
    input: {
        panelId: string | null
        settings: unknown
        send: boolean
        expectedRevision: number | null
    }
) {
    return await fetchMutation(saveMutation, {
        ...actorArgs(access),
        ...input,
    })
}

export async function requestDiscordPanelAction(
    access: DiscordPanelsAccess,
    input: { panelId: string; action: PanelAction }
) {
    return await fetchMutation(actMutation, { ...actorArgs(access), ...input })
}

export async function testDiscordPanelFetch(
    access: DiscordPanelsAccess,
    input: { connectionId: string; panelId: string | null }
) {
    return await fetchAction(testAction, { ...actorArgs(access), ...input })
}

/** The WD League messages' data for the editor preview (P2-54, P2-55). */
export async function readLeaguePanelPreview(
    access: DiscordPanelsAccess,
    fixtureCount: number
) {
    return await fetchQuery(leaguePreviewQuery, {
        ...actorArgs(access),
        fixtureCount,
    })
}

/** "Obnovit teď" of a seed control message (P1-18). */
export async function refreshDiscordPanelControl(
    access: DiscordPanelsAccess,
    connectionId: string
) {
    return await fetchMutation(refreshControlMutation, {
        ...actorArgs(access),
        connectionId,
    })
}

export async function checkDiscordPanelChannel(
    access: DiscordPanelsAccess,
    channelId: string
): Promise<PanelChannelCheck> {
    return await inspectPanelChannel(access.guildId, channelId)
}

/** The keyring of this server process; null while encryption is not activated. */
function keyring() {
    try {
        return parseKeyring(getCredentialKeyring())
    } catch (error) {
        if (error instanceof CredentialCipherError) return null
        throw error
    }
}

export type PanelServerInput = {
    connectionId: string
    address?: string | null
    joinCode?: string | null
    /** Plaintext only here: it is encrypted before it leaves this process. */
    password?: string | null
}

/**
 * Saves a server's join details. The password is sealed with the operator
 * keyring (AES-256-GCM, bound to the workspace and server), so only
 * ciphertext reaches Convex; without a keyring nothing is stored.
 */
export async function saveDiscordPanelServer(
    access: DiscordPanelsAccess,
    input: PanelServerInput
): Promise<PanelServerSaveResult | { status: "encryption_unavailable" }> {
    let password: CredentialEnvelope | null | undefined = undefined
    if (input.password === null || input.password === "") password = null
    else if (input.password !== undefined) {
        const ring = keyring()
        if (!ring) return { status: "encryption_unavailable" }
        password = sealSecret(
            ring,
            serverPasswordPlaintext(input.password),
            serverPasswordAad({
                guildId: access.guildId,
                connectionId: input.connectionId,
            })
        )
    }
    return await fetchMutation(serverMutation, {
        ...actorArgs(access),
        connectionId: input.connectionId,
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.joinCode !== undefined ? { joinCode: input.joinCode } : {}),
        ...(password !== undefined ? { password } : {}),
    })
}
