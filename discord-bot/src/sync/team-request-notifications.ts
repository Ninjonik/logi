import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { GAME_LABELS } from "../../../src/domain/games/game"
import { TEAM_GAMES } from "../../../src/domain/teams/team"
import { EmbedBuilder, escapeMarkdown } from "discord.js"
import { z } from "zod"

/** One claimed decision DM, as `teamRequests:claimNotifications` returns it. */
export const teamRequestNotificationSchema = z.object({
    requestId: z.string().min(1),
    discordUserId: z.string(),
    guildId: z.string(),
    language: z.string(),
    kind: z.enum(["create", "update"]),
    gameId: z.enum(TEAM_GAMES),
    status: z.string(),
    requestedName: z.string(),
    teamName: z.string().nullable(),
    reason: z.string().nullable(),
})
export type TeamRequestNotification = z.infer<
    typeof teamRequestNotificationSchema
>
export type TeamRequestDecisionMessage = {
    embeds: EmbedBuilder[]
    allowedMentions: { parse: [] }
}

const COLORS = {
    approved: 0x57f287,
    merged: 0x5865f2,
    rejected: 0xed4245,
} as const
const DISCORD_USER_ID = /^\d{17,20}$/

/**
 * User-supplied text (team names, rejection reasons) shown in a DM: Markdown
 * is escaped and mentions are broken with a zero-width space, then the value
 * is bounded to Discord's embed field size.
 */
export function safeDiscordText(value: string, max = 1024): string {
    const text = escapeMarkdown(value.trim())
        .replace(/@/g, "@\u200b")
        .replace(/</g, "<\u200b")
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * The decision DM in the requesting workspace's language: the outcome, the
 * requested name, the resulting team and, for a rejection, the reason. Only
 * decided requests produce a message.
 */
export function buildTeamRequestDecisionMessage(
    notification: TeamRequestNotification
): TeamRequestDecisionMessage | null {
    const status = notification.status
    if (status !== "approved" && status !== "merged" && status !== "rejected")
        return null
    const copy = getClanDiscordMessages(notification.language).teamRequests
    const title = {
        approved: copy.approvedTitle,
        merged: copy.mergedTitle,
        rejected: copy.rejectedTitle,
    }[status]
    const description =
        status === "approved"
            ? notification.kind === "create"
                ? copy.approvedCreate
                : copy.approvedUpdate
            : status === "merged"
              ? copy.merged
              : copy.rejected
    const embed = new EmbedBuilder()
        .setColor(COLORS[status])
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: copy.request,
                value:
                    notification.kind === "create"
                        ? copy.kindCreate
                        : copy.kindUpdate,
                inline: true,
            },
            {
                name: copy.game,
                value: GAME_LABELS[notification.gameId],
                inline: true,
            },
            {
                name: copy.requestedName,
                value: safeDiscordText(notification.requestedName) || "—",
            }
        )
        .setFooter({ text: copy.footer })
    if (status !== "rejected" && notification.teamName)
        embed.addFields({
            name: copy.team,
            value: safeDiscordText(notification.teamName) || "—",
        })
    if (status === "rejected" && notification.reason)
        embed.addFields({
            name: copy.reason,
            value: safeDiscordText(notification.reason) || "—",
        })
    return { embeds: [embed], allowedMentions: { parse: [] } }
}

export type TeamRequestNotificationPorts = {
    /** Leases due decision DMs; the lease expires if a pass never confirms them. */
    claim(): Promise<unknown>
    /** The Discord user, or null when it cannot be fetched. */
    fetchUser(discordUserId: string): Promise<{
        send(message: TeamRequestDecisionMessage): Promise<unknown>
    } | null>
    /** `failed` schedules a retry with backoff until the attempts run out. */
    mark(requestId: string, outcome: "sent" | "failed"): Promise<unknown>
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
 * accepted it, `failed` when the user cannot be fetched, has DMs closed or
 * the payload is unusable. Nothing is thrown; a failed confirmation leaves
 * the lease to expire so the DM is claimed again.
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
        let outcome: "sent" | "failed" = "failed"
        if (!parsed.success)
            ports.warn("Team request notification is malformed", {
                requestId,
            })
        else {
            const message = buildTeamRequestDecisionMessage(parsed.data)
            const userId = parsed.data.discordUserId
            try {
                const user =
                    message && DISCORD_USER_ID.test(userId)
                        ? await ports.fetchUser(userId)
                        : null
                if (user && message) {
                    await user.send(message)
                    outcome = "sent"
                } else
                    ports.warn("Team request DM recipient unavailable", {
                        requestId,
                    })
            } catch (error) {
                // 50007: the user does not accept DMs from this bot.
                ports.warn("Team request DM could not be delivered", {
                    requestId,
                    code: discordErrorCode(error),
                })
            }
        }
        try {
            await ports.mark(requestId, outcome)
            totals[outcome] += 1
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
    } = {}
): { tick(): Promise<void>; stop(): void } {
    const schedule =
        options.schedule ??
        ((tick: () => void, ms: number) => setInterval(tick, ms))
    const cancel =
        options.cancel ??
        ((timer: NotificationTimer) =>
            clearInterval(timer as ReturnType<typeof setInterval>))
    let running = false,
        stopped = false
    async function tick() {
        if (running || stopped) return
        running = true
        try {
            await pass()
        } catch {
            // The pass reports its own failures; the loop keeps running.
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
        },
    }
}
