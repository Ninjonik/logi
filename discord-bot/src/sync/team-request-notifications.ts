import type { MessageCreateOptions } from "discord.js"
import { z } from "zod"

import {
    isTeamRequestDecision,
    teamRequestDecisionView,
} from "../../../src/domain/discord-messages/team-request-dm"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { resolveClanLanguage } from "../../../src/lib/clan-language/core"
import { clanTeamsPath } from "../../../src/domain/teams/team-links"
import { GAME_LABELS } from "../../../src/domain/games/game"
import { TEAM_GAMES } from "../../../src/domain/teams/team"
import { messagePayload } from "../ui/message-kit"

/** One claimed decision DM, as `teamRequests:claimNotifications` returns it. */
export const teamRequestNotificationSchema = z.object({
    requestId: z.string().min(1),
    claimToken: z.string().min(1).optional(),
    discordUserId: z.string(),
    guildId: z.string(),
    language: z.string(),
    kind: z.enum(["create", "update"]),
    gameId: z.enum(TEAM_GAMES),
    status: z.string(),
    requestedName: z.string(),
    teamName: z.string().nullable(),
    reason: z.string().nullable(),
    // Added for the V2 card; older claims without them still parse.
    teamCode: z.string().nullable().optional(),
    clanName: z.string().nullable().optional(),
    serverId: z.string().nullable().optional(),
    accentColor: z.string().nullable().optional(),
})
export type TeamRequestNotification = z.infer<
    typeof teamRequestNotificationSchema
>
export type TeamRequestDecisionMessage = MessageCreateOptions

const DISCORD_USER_ID = /^\d{17,20}$/
const SERVER_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Logi pages the DM links to, in the clan language. The catalogue has no
 * page per team, so "Otevřít tým v Logi" opens the clan's Týmy for the
 * game searched for the team (L5-39..40); "Otevřít Týmy v Logi" the list.
 */
export function teamRequestLinks(
    notification: Pick<
        TeamRequestNotification,
        "language" | "serverId" | "gameId"
    > &
        Partial<Pick<TeamRequestNotification, "teamName" | "requestedName">>,
    siteUrl: string
) {
    const language = resolveClanLanguage(notification.language)
    const page = (path: string) => new URL(path, siteUrl).toString()
    const serverId =
        notification.serverId && SERVER_ID.test(notification.serverId)
            ? notification.serverId
            : undefined
    const teams = serverId
        ? page(
              clanTeamsPath({
                  language,
                  serverId,
                  gameId: notification.gameId,
              })
          )
        : undefined
    const team = serverId
        ? page(
              clanTeamsPath({
                  language,
                  serverId,
                  gameId: notification.gameId,
                  team: notification.teamName ?? notification.requestedName,
              })
          )
        : undefined
    return {
        team,
        teams,
        settings: page(`/${language}/dashboard/settings/user#zpravy-od-bota`),
    }
}

/**
 * The decision DM in the requesting clan's language (board L5 1.3, L2-57..58):
 * the shared V2 card with the clan colour, the result as a chip, the team by
 * its code, the decider's reason as a quote and a link to the clan's Týmy in
 * Logi. Only decided requests produce a message. Nobody is pinged.
 */
export function buildTeamRequestDecisionMessage(
    notification: TeamRequestNotification,
    siteUrl: string
): TeamRequestDecisionMessage | null {
    const status = notification.status
    if (!isTeamRequestDecision(status)) return null
    const copy = getSystemMessages(notification.language)
    const links = teamRequestLinks(notification, siteUrl)
    const view = teamRequestDecisionView({
        copy: copy.teamRequests,
        gameLabel: GAME_LABELS[notification.gameId],
        status,
        kind: notification.kind,
        requestedName: notification.requestedName,
        team: notification.teamName
            ? { name: notification.teamName, code: notification.teamCode }
            : null,
        reason: notification.reason,
        teamUrl: links.team,
        teamsUrl: links.teams,
        frame: {
            clanName: notification.clanName ?? "",
            settingsUrl: links.settings,
        },
    })
    return messagePayload(view, {
        language: notification.language,
        style: notification.accentColor
            ? { accentColor: notification.accentColor }
            : null,
    })
}

export type TeamRequestNotificationPorts = {
    /** The Logi site the DM links back to. */
    siteUrl: string
    /** Leases due decision DMs; the lease expires if a pass never confirms them. */
    claim(): Promise<unknown>
    /** The Discord user, or null when it cannot be fetched. */
    fetchUser(discordUserId: string): Promise<{
        send(message: TeamRequestDecisionMessage): Promise<unknown>
    } | null>
    begin(requestId: string, claimToken: string): Promise<{ ok: boolean }>
    /**
     * `failed` schedules a retry with backoff until the attempts run out;
     * `undeliverable` (DMs closed) is final.
     */
    mark(
        requestId: string,
        outcome: "sent" | "failed" | "undeliverable" | "uncertain",
        claimToken?: string,
        messageId?: string
    ): Promise<unknown>
    /** Operational log; receives IDs and Discord error codes only. */
    warn(message: string, context: Record<string, string | number>): void
}

function requestIdOf(raw: unknown): string | null {
    const value =
        raw && typeof raw === "object" && "requestId" in raw
            ? (raw as { requestId: unknown }).requestId
            : null
    return typeof value === "string" && value ? value : null
}
function discordErrorCode(error: unknown): string | number {
    const code =
        error && typeof error === "object" && "code" in error
            ? (error as { code: unknown }).code
            : null
    return typeof code === "number" || typeof code === "string"
        ? code
        : "unknown"
}

/**
 * One delivery pass. Every claimed DM is confirmed: `sent` after Discord
 * accepted it. A durable started receipt precedes every send; a lost response
 * or confirmation remains uncertain and must never be replayed automatically.
 */
export async function deliverTeamRequestNotifications(
    ports: TeamRequestNotificationPorts
): Promise<{ sent: number; failed: number }> {
    const totals = { sent: 0, failed: 0 }
    let claimed: unknown
    try {
        claimed = await ports.claim()
    } catch {
        ports.warn("Team request notifications could not be claimed", {})
        return totals
    }
    for (const raw of Array.isArray(claimed) ? claimed : []) {
        const parsed = teamRequestNotificationSchema.safeParse(raw)
        const requestId = parsed.success
            ? parsed.data.requestId
            : requestIdOf(raw)
        if (!requestId) continue
        let outcome: "sent" | "failed" | "undeliverable" | "uncertain" =
            "failed"
        const claimToken = parsed.success
            ? parsed.data.claimToken
            : raw &&
                typeof raw === "object" &&
                "claimToken" in raw &&
                typeof raw.claimToken === "string"
              ? raw.claimToken
              : undefined
        let messageId: string | undefined
        let started = false
        if (!parsed.success)
            ports.warn("Team request notification is malformed", {
                requestId,
            })
        else {
            const userId = parsed.data.discordUserId
            try {
                const message = buildTeamRequestDecisionMessage(
                    parsed.data,
                    ports.siteUrl
                )
                const user =
                    message && DISCORD_USER_ID.test(userId)
                        ? await ports.fetchUser(userId)
                        : null
                if (user && message && claimToken) {
                    const receipt = await ports.begin(requestId, claimToken)
                    if (!receipt.ok) {
                        ports.warn("Team request DM ownership lost", {
                            requestId,
                        })
                        continue
                    }
                    started = true
                    const sent = await user.send(message)
                    if (
                        sent &&
                        typeof sent === "object" &&
                        "id" in sent &&
                        typeof sent.id === "string"
                    )
                        messageId = sent.id
                    outcome = "sent"
                } else
                    ports.warn("Team request DM recipient unavailable", {
                        requestId,
                    })
            } catch (error) {
                const code = discordErrorCode(error)
                // 50007: the user does not accept DMs from this bot; retrying
                // cannot help, so the decision stays recorded as undelivered.
                if (started)
                    outcome =
                        code === 50007 || code === "50007"
                            ? "undeliverable"
                            : "uncertain"
                ports.warn("Team request DM could not be delivered", {
                    requestId,
                    code,
                })
            }
        }
        try {
            await ports.mark(requestId, outcome, claimToken, messageId)
            totals[outcome === "sent" ? "sent" : "failed"] += 1
        } catch {
            ports.warn("Team request DM outcome could not be recorded", {
                requestId,
                outcome,
            })
        }
    }
    return totals
}

export type NotificationTimer = { unref?(): unknown }
/**
 * Runs `pass` now and then every `intervalMs`, never overlapping two passes
 * and never letting a failure escape the timer.
 */
export function startTeamRequestNotificationLoop(
    pass: () => Promise<unknown>,
    options: {
        intervalMs?: number
        schedule?: (tick: () => void, ms: number) => NotificationTimer
        cancel?: (timer: NotificationTimer) => void
        failed: (error: unknown) => void
    }
): { tick(): Promise<void>; stop(): Promise<void> } {
    const schedule =
        options.schedule ??
        ((tick: () => void, ms: number) => setInterval(tick, ms))
    const cancel =
        options.cancel ??
        ((timer: NotificationTimer) =>
            clearInterval(timer as ReturnType<typeof setInterval>))
    let active: Promise<unknown> | undefined
    let running = false,
        stopped = false
    async function tick() {
        if (running || stopped) return
        running = true
        try {
            active = pass()
            await active
        } catch (error) {
            options.failed(error)
        } finally {
            running = false
        }
    }
    const timer = schedule(() => void tick(), options.intervalMs ?? 60_000)
    timer.unref?.()
    void tick()
    return {
        tick,
        stop() {
            stopped = true
            cancel(timer)
            return Promise.resolve(active).then(
                () => undefined,
                () => undefined
            )
        },
    }
}
