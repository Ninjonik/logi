import { z } from "zod"

import {
    MANUAL_REMINDER_AUDIENCES,
    type ManualReminderAudience,
    type ManualReminderUnavailable,
} from "@/domain/events/manual-reminders"
import { readBoundedJson } from "@/lib/api/request-json"

const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store", ...headers },
    })

/** Dashboard request body: who the reminder goes to. */
export const eventReminderRequestSchema = z.strictObject({
    audience: z.enum(MANUAL_REMINDER_AUDIENCES),
})

/** What the Convex mutation `eventReminders:requestManual` answers. */
export type EventReminderResult =
    | { status: "queued"; queued: number }
    | { status: "rate_limited"; retryAt: string }
    | { status: "unavailable"; reason: ManualReminderUnavailable }
    | { status: "not_found" }

export type EventReminderPorts = {
    origin: string
    /** Current clan admin with a live dashboard session; null denies. */
    access(serverId: string): Promise<{
        guildId: string
        actorDiscordId: string
    } | null>
    request(input: {
        guildId: string
        eventId: string
        audience: ManualReminderAudience
        requestedBy: string
    }): Promise<EventReminderResult>
    now?: () => number
}

/**
 * `POST /api/servers/{serverId}/events/{eventId}/reminders` with
 * `{ "audience": "unanswered" | "unconfirmed" }` queues reminder DMs and
 * answers `{ queued: number }`. Same-origin clan admins only; Convex checks
 * the match, the recipients and the per-match cool-down.
 */
export function eventRemindersHandler(ports: EventReminderPorts) {
    return async function POST(
        request: Request,
        params: { serverId: string; eventId: string }
    ): Promise<Response> {
        if (request.headers.get("origin") !== ports.origin)
            return json({ error: "forbidden" }, 403)
        try {
            const access = await ports.access(params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const input = eventReminderRequestSchema.safeParse(
                await readBoundedJson(request, 1024)
            )
            if (!input.success) return json({ error: "invalid_request" }, 400)
            const result = await ports.request({
                guildId: access.guildId,
                eventId: params.eventId,
                audience: input.data.audience,
                requestedBy: access.actorDiscordId,
            })
            switch (result.status) {
                case "queued":
                    return json({ queued: result.queued })
                case "rate_limited": {
                    const now = ports.now?.() ?? Date.now()
                    const seconds = Math.max(
                        1,
                        Math.ceil((Date.parse(result.retryAt) - now) / 1000)
                    )
                    return json(
                        { error: "rate_limited", retryAt: result.retryAt },
                        429,
                        { "Retry-After": String(seconds) }
                    )
                }
                case "unavailable":
                    return json(
                        { error: "unavailable", reason: result.reason },
                        409
                    )
                case "not_found":
                    return json({ error: "not_found" }, 404)
            }
        } catch {
            return json({ error: "unavailable" }, 503)
        }
    }
}
