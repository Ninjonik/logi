import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { z } from "zod"

import {
    checkApplicationChannels,
    type ApplicationChannelReport,
} from "@/domain/membership/application-channels"
import type { ApplicationState } from "../../../convex/membershipApplications"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getDiscordBotToken, getInternalAuthSecret } from "@/lib/env"
import type { DashboardActor } from "../../../convex/dashboardActor"

/**
 * Web access to the clan application: the settings page's channel checks
 * and panel image (clan admins), and the web form of Variant B (any signed-in
 * Discord account). The actor always comes from the dashboard session, never
 * from a request body; Convex checks it again.
 */

export type MembershipAdminAccess = { guildId: string; actor: DashboardActor }

/** A clan admin of the workspace with a live dashboard session. */
export async function membershipAdminAccess(
    serverId: string
): Promise<MembershipAdminAccess | null> {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return server?.canAdmin && actor
        ? { guildId: server.server.discordId, actor }
        : null
}

const attachImage = makeFunctionReference<
    "mutation",
    {
        secret: string
        actor: DashboardActor
        guildId: string
        assetId: string | null
    },
    { ok: true; url: string | null } | { ok: false }
>("membershipApplications:attachMembershipPanelImage")

/** Keeps the chosen panel banner referenced and returns its public URL (N4-09). */
export async function attachMembershipPanelImage(
    access: MembershipAdminAccess,
    assetId: string | null
) {
    return await fetchMutation(attachImage, {
        secret: getInternalAuthSecret(),
        actor: access.actor,
        guildId: access.guildId,
        assetId,
    })
}

const id = z.string().regex(/^\d{17,20}$/)
const bits = z.string().regex(/^\d{1,30}$/)
const channelSchema = z.object({
    id,
    guild_id: id,
    type: z.number(),
    permission_overwrites: z
        .array(z.object({ id, type: z.number(), allow: bits, deny: bits }))
        .default([]),
})
const roleSchema = z.object({
    id,
    permissions: bits,
    position: z.number().int(),
    mentionable: z.boolean(),
    managed: z.boolean(),
})

/**
 * Reads the two channels and the bot's roles from Discord with the bot token
 * (N4-B08). A missing or foreign channel reads as unusable; any other
 * Discord failure throws and the route answers "unavailable".
 */
export async function verifyApplicationChannels(
    guildId: string,
    channels: { panelChannelId: string | null; threadChannelId: string | null }
): Promise<ApplicationChannelReport> {
    id.parse(guildId)
    const token = getDiscordBotToken()
    if (!token) throw new Error("Discord bot token is not configured.")
    const get = async (path: string, optional = false) => {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
            headers: { Authorization: `Bot ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
            redirect: "error",
        })
        if (optional && (response.status === 404 || response.status === 403))
            return null
        if (!response.ok)
            throw new Error("Discord channel verification unavailable.")
        return (await response.json()) as unknown
    }
    const channel = async (channelId: string | null) => {
        if (!channelId) return null
        const raw = await get(`/channels/${id.parse(channelId)}`, true)
        const parsed = raw === null ? null : channelSchema.parse(raw)
        // Text and announcement channels only.
        return parsed?.guild_id === guildId && [0, 5].includes(parsed.type)
            ? { overwrites: parsed.permission_overwrites }
            : { overwrites: [], unusable: true }
    }
    const [bot, roles, panelChannel, threadChannel] = await Promise.all([
        get("/users/@me").then((raw) => z.object({ id }).parse(raw)),
        get(`/guilds/${guildId}/roles`).then((raw) =>
            z.array(roleSchema).parse(raw)
        ),
        channel(channels.panelChannelId),
        channel(channels.threadChannelId),
    ])
    const member = z
        .object({ roles: z.array(id) })
        .parse(await get(`/guilds/${guildId}/members/${bot.id}`))
    return checkApplicationChannels({
        guildId,
        bot: { id: bot.id, roleIds: member.roles },
        roles,
        panelChannel,
        threadChannel,
    })
}

// --- Variant B: the web form ----------------------------------------------------

type ActorArgs = { secret: string; actor: DashboardActor; guildId: string }

export type WebApplicationPage =
    | { status: "signed-out" }
    | { status: "unavailable" }
    | { status: "ready"; applicantName: string; state: ApplicationState }

export type WebApplicationStatus =
    | { state: "signed-out" }
    | { state: "editing" }
    | { state: "queued" }
    | { state: "failed"; reason: string }
    | { state: "done"; number: number; threadId: string }

const pageQuery = makeFunctionReference<"query", ActorArgs, WebApplicationPage>(
    "membershipApplications:webApplicationPage"
)
const saveMutation = makeFunctionReference<
    "mutation",
    ActorArgs & { windowId: string; values: Record<string, string[]> },
    unknown
>("membershipApplications:saveWebApplicationWindow")
const submitMutation = makeFunctionReference<"mutation", ActorArgs, unknown>(
    "membershipApplications:submitWebApplication"
)
const statusQuery = makeFunctionReference<
    "query",
    ActorArgs,
    WebApplicationStatus
>("membershipApplications:webApplicationStatus")

const args = (actor: DashboardActor, guildId: string): ActorArgs => ({
    secret: getInternalAuthSecret(),
    actor,
    guildId,
})

/** The signed-in applicant; the web form never trusts a browser-sent user. */
export async function webApplicant() {
    return await currentDashboardActor()
}

export async function readWebApplicationPage(
    actor: DashboardActor,
    guildId: string
) {
    return await fetchQuery(pageQuery, args(actor, guildId))
}

export async function saveWebApplicationWindow(
    actor: DashboardActor,
    guildId: string,
    windowId: string,
    values: Record<string, string[]>
) {
    return await fetchMutation(saveMutation, {
        ...args(actor, guildId),
        windowId,
        values,
    })
}

export async function submitWebApplication(
    actor: DashboardActor,
    guildId: string
) {
    return await fetchMutation(submitMutation, args(actor, guildId))
}

export async function readWebApplicationStatus(
    actor: DashboardActor,
    guildId: string
): Promise<WebApplicationStatus> {
    return (await fetchQuery(
        statusQuery,
        args(actor, guildId)
    )) as WebApplicationStatus
}
