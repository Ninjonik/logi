import { z } from "zod"

import { readBoundedJson } from "@/lib/api/request-json"

const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

/** Dashboard request body: players an admin excuses or stops excusing. */
export const eventExcusesRequestSchema = z.strictObject({
    excuses: z
        .array(
            z.strictObject({
                userId: z.string().regex(/^\d{5,25}$/),
                excused: z.boolean(),
            })
        )
        .min(1)
        .max(200),
})

/** What the Convex mutation `eventAttendance:setExcuses` answers. */
export type EventExcusesResult = {
    status: "saved" | "closed" | "invalid" | "not_found"
}

export type EventExcusesPorts = {
    origin: string
    /** Current clan admin with a live dashboard session; null denies. */
    access(serverId: string): Promise<{
        guildId: string
        actorDiscordId: string
    } | null>
    save(input: {
        guildId: string
        eventId: string
        actorId: string
        excuses: Array<{ userId: string; excused: boolean }>
    }): Promise<EventExcusesResult>
    revalidate(serverId: string, eventId: string): void
}

/**
 * `POST /api/servers/{serverId}/events/{eventId}/excuses` with
 * `{ "excuses": [{ "userId", "excused" }] }`: a clan admin marks roster
 * players as excused (design E3). Same-origin clan admins only; Convex checks
 * the match, that it is still open and that the players are on its roster.
 */
export function eventExcusesHandler(ports: EventExcusesPorts) {
    return async function POST(
        request: Request,
        params: { serverId: string; eventId: string }
    ): Promise<Response> {
        if (request.headers.get("origin") !== ports.origin)
            return json({ error: "forbidden" }, 403)
        try {
            const access = await ports.access(params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const input = eventExcusesRequestSchema.safeParse(
                await readBoundedJson(request, 16 * 1024)
            )
            if (!input.success) return json({ error: "invalid_request" }, 400)
            const result = await ports.save({
                guildId: access.guildId,
                eventId: params.eventId,
                actorId: access.actorDiscordId,
                excuses: input.data.excuses,
            })
            switch (result.status) {
                case "saved":
                    ports.revalidate(params.serverId, params.eventId)
                    return json({ ok: true })
                case "closed":
                    return json({ error: "match_closed" }, 409)
                case "invalid":
                    return json({ error: "invalid_request" }, 400)
                case "not_found":
                    return json({ error: "not_found" }, 404)
            }
        } catch {
            return json({ error: "unavailable" }, 503)
        }
    }
}
