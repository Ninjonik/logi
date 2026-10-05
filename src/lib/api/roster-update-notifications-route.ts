import { z } from "zod"

import { readBoundedJson } from "@/lib/api/request-json"
import type { Roster } from "@/types/domain"

const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

const MAX_BODY_BYTES = 256 * 1024

/**
 * The roster as the dashboard had it before saving. Only what the change
 * summary reads is kept; the saved roster always comes from the server.
 */
const previousRosterSchema = z.object({
    eventId: z.string().min(1).max(64),
    squads: z
        .array(
            z.object({
                name: z.string().max(100),
                players: z
                    .array(
                        z.object({
                            id: z.string().max(32).nullish(),
                            roleName: z.string().max(100).nullish(),
                        })
                    )
                    .max(100),
            })
        )
        .max(100),
})

/** Dashboard request body after a published roster was saved again. */
export const rosterUpdateNotificationSchema = z.strictObject({
    previousRoster: previousRosterSchema,
    // Older dashboards also send the roster they saved; it is ignored.
    nextRoster: z.unknown().optional(),
    postAnnouncement: z.boolean().optional(),
    notifyPlayers: z.boolean().optional(),
    /** "Označit zařazené hráče" on a re-publish: the bot pings them again. */
    mentionPlayers: z.boolean().optional(),
})

const requestIdSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+$/i)

export type RosterUpdateNotificationAccess = {
    /** The saved roster of this clan, as the server has it now. */
    roster: Roster
    /** The clan's Discord guild ID. */
    guildId: string
    /** The admin's Discord ID, recorded with the request. */
    actorId: string
    /** Discord IDs of the clan's members; nobody else gets a message. */
    memberIds: ReadonlySet<string>
}

export type RosterUpdateNotificationPorts = {
    origin: string
    /** Clan admin with a live dashboard session and the roster; null denies. */
    access(
        serverId: string,
        rosterId: string
    ): Promise<RosterUpdateNotificationAccess | "not_found" | null>
    /** Queues the bot's digest and DMs; returns the request's ID. */
    notify(input: {
        serverId: string
        guildId: string
        actorId: string
        previousRoster: Roster
        roster: Roster
        memberIds: ReadonlySet<string>
        postAnnouncement: boolean
        notifyPlayers: boolean
        mentionPlayers: boolean
    }): Promise<Record<string, unknown>>
    /** A queued request's outcome in this clan, or null. */
    status(
        guildId: string,
        requestId: string
    ): Promise<Record<string, unknown> | null>
}

/**
 * The previous roster shaped like the saved one, keeping only slots of clan
 * members so a request can never name an outsider as added or removed.
 */
export function previousRosterForSummary(
    saved: Roster,
    previous: z.infer<typeof previousRosterSchema>,
    memberIds: ReadonlySet<string>
): Roster {
    return {
        ...saved,
        squads: previous.squads.map((squad, index) => ({
            name: squad.name,
            group: "",
            order: index,
            color: "",
            players: squad.players.map((player) => ({
                id:
                    player.id && memberIds.has(player.id)
                        ? player.id
                        : undefined,
                ack: false,
                roleName: player.roleName ?? undefined,
            })),
        })),
    }
}

/**
 * `POST /api/servers/{serverId}/rosters/{rosterId}/update-notifications`
 * asks the bot for the change digest, the change DMs and a new mention of
 * the rostered players; `GET …?requestId=` reports how the DMs went.
 * Same-origin clan admins only; the saved roster is read on the server.
 */
export function rosterUpdateNotificationsHandler(
    ports: RosterUpdateNotificationPorts
) {
    async function authorize(
        request: Request,
        params: { serverId: string; rosterId: string },
        write: boolean
    ) {
        // Browsers omit Origin on same-origin GETs; a read cannot be forged
        // into a write and cross-site pages cannot read the answer.
        if (write && request.headers.get("origin") !== ports.origin)
            return json({ error: "forbidden" }, 403)
        const access = await ports.access(params.serverId, params.rosterId)
        if (!access) return json({ error: "forbidden" }, 403)
        if (access === "not_found") return json({ error: "not_found" }, 404)
        return access
    }

    return {
        async POST(
            request: Request,
            params: { serverId: string; rosterId: string }
        ): Promise<Response> {
            const access = await authorize(request, params, true)
            if (access instanceof Response) return access
            const input = rosterUpdateNotificationSchema.safeParse(
                await readBoundedJson(request, MAX_BODY_BYTES)
            )
            if (!input.success) return json({ error: "invalid_request" }, 400)
            const { roster, memberIds } = access
            if (input.data.previousRoster.eventId !== roster.eventId)
                return json({ error: "invalid_request" }, 400)
            if (!roster.published) return json({ error: "not_published" }, 409)
            try {
                return json(
                    await ports.notify({
                        serverId: params.serverId,
                        guildId: access.guildId,
                        actorId: access.actorId,
                        previousRoster: previousRosterForSummary(
                            roster,
                            input.data.previousRoster,
                            memberIds
                        ),
                        roster,
                        memberIds,
                        postAnnouncement: input.data.postAnnouncement ?? false,
                        notifyPlayers: input.data.notifyPlayers ?? true,
                        mentionPlayers: input.data.mentionPlayers ?? false,
                    })
                )
            } catch {
                return json({ error: "notification_failed" }, 502)
            }
        },

        async GET(
            request: Request,
            params: { serverId: string; rosterId: string }
        ): Promise<Response> {
            const access = await authorize(request, params, false)
            if (access instanceof Response) return access
            const requestId = requestIdSchema.safeParse(
                new URL(request.url).searchParams.get("requestId")
            )
            if (!requestId.success)
                return json({ error: "invalid_request" }, 400)
            const status = await ports.status(access.guildId, requestId.data)
            return status ? json(status) : json({ error: "not_found" }, 404)
        },
    }
}
