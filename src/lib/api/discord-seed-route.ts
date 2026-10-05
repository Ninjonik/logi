import { z } from "zod"

import type {
    SeedActionResult,
    SeedPlanSaveView,
} from "@/application/discord-seed/action-result"
import {
    parseSeedPlanSettings,
    type SeedPlanSettings,
} from "@/domain/discord-seed/plan"
import type { SeedChannelReport } from "@/domain/discord-seed/channels"
import { readBoundedJson } from "@/lib/api/request-json"

const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store", ...headers },
    })

const connectionId = z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/)

/** `PUT` body: the whole plan, the revision it was loaded at, and an optional check-only mode. */
export const seedPlanRequestSchema = z.strictObject({
    expectedRevision: z.number().int().min(0).nullable(),
    settings: z.unknown(),
    verifyOnly: z.boolean().optional(),
})

/** `POST` body: the live actions "Seed teď" and "Ukončit seed". */
export const seedActionRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("start"),
        /** A new random key per click; a retried request starts nothing twice. */
        requestKey: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
    }),
    z.strictObject({ action: z.literal("stop") }),
])

export type DiscordSeedAccess = { guildId: string }

export type DiscordSeedRoutePorts<A extends DiscordSeedAccess> = {
    /** `isDashboardWriteOrigin`: writes only from the dashboard's public origin. */
    isWriteOrigin(request: Request): boolean
    /** Current clan admin with a live dashboard session; null denies. */
    access(serverId: string): Promise<A | null>
    read(access: A, connectionId: string | null): Promise<unknown>
    save(
        access: A,
        input: {
            connectionId: string
            expectedRevision: number | null
            settings: SeedPlanSettings
        }
    ): Promise<SeedPlanSaveView>
    verifyChannels(
        access: A,
        settings: SeedPlanSettings
    ): Promise<SeedChannelReport>
    start(
        access: A,
        input: { connectionId: string; requestKey: string }
    ): Promise<SeedActionResult>
    stop(access: A, input: { connectionId: string }): Promise<SeedActionResult>
    now?: () => number
}

function actionResponse(result: SeedActionResult, now: number): Response {
    switch (result.status) {
        case "started":
        case "duplicate":
        case "stopped":
            return json(result)
        case "cooldown": {
            const seconds = Math.max(
                1,
                Math.ceil((Date.parse(result.retryAt) - now) / 1000)
            )
            return json({ error: "cooldown", retryAt: result.retryAt }, 429, {
                "Retry-After": String(seconds),
            })
        }
        case "running":
            return json({ error: "running", runId: result.runId }, 409)
        case "unavailable":
            return json({ error: "unavailable", reason: result.reason }, 409)
        case "forbidden":
            return json({ error: "forbidden" }, 403)
        case "not_found":
            return json({ error: "not_found" }, 404)
    }
}

/**
 * The seed page's routes under `/api/servers/{serverId}/discord-seed`:
 * - `GET ?server={connectionId}`: tabs, plan, status and 30-day history;
 * - `PUT /{connectionId}`: save the plan after checking its Discord channels
 *   (`verifyOnly` checks without saving);
 * - `POST /{connectionId}`: `{"action":"start","requestKey":…}` or
 *   `{"action":"stop"}`, live Discord actions outside `/api/v1`.
 * Clan admins only; writes only from the dashboard origin, checked before the
 * body is read.
 */
export function discordSeedRoutes<A extends DiscordSeedAccess>(
    ports: DiscordSeedRoutePorts<A>
) {
    const writeAccess = async (request: Request, serverId: string) =>
        ports.isWriteOrigin(request)
            ? await ports.access(serverId).catch(() => null)
            : null

    return {
        async GET(request: Request, params: { serverId: string }) {
            const access = await ports.access(params.serverId).catch(() => null)
            if (!access) return json({ error: "forbidden" }, 403)
            const server = new URL(request.url).searchParams.get("server")
            if (server !== null && !connectionId.safeParse(server).success)
                return json({ error: "invalid_request" }, 400)
            try {
                return json(await ports.read(access, server))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async PUT(
            request: Request,
            params: { serverId: string; connectionId: string }
        ) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            if (!connectionId.safeParse(params.connectionId).success)
                return json({ error: "not_found" }, 404)
            const body = seedPlanRequestSchema.safeParse(
                await readBoundedJson(request, 8192)
            )
            if (!body.success) return json({ error: "invalid_request" }, 400)
            const plan = parseSeedPlanSettings(body.data.settings)
            if (!plan.ok)
                return json({ error: "invalid_plan", issues: plan.issues }, 400)
            let channels: SeedChannelReport
            try {
                channels = await ports.verifyChannels(access, plan.plan)
            } catch {
                return json({ error: "verification_unavailable" }, 503)
            }
            if (body.data.verifyOnly) return json({ channels })
            if (channels.problems.length)
                return json({ error: "channels", channels }, 400)
            try {
                const result = await ports.save(access, {
                    connectionId: params.connectionId,
                    expectedRevision: body.data.expectedRevision,
                    settings: plan.plan,
                })
                switch (result.status) {
                    case "saved":
                        return json({ revision: result.revision, channels })
                    case "invalid":
                        return json(
                            { error: "invalid_plan", issues: result.issues },
                            400
                        )
                    case "conflict":
                        return json(
                            { error: "conflict", revision: result.revision },
                            409
                        )
                    case "not_found":
                        return json({ error: "not_found" }, 404)
                }
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async POST(
            request: Request,
            params: { serverId: string; connectionId: string }
        ) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            if (!connectionId.safeParse(params.connectionId).success)
                return json({ error: "not_found" }, 404)
            const body = seedActionRequestSchema.safeParse(
                await readBoundedJson(request, 512)
            )
            if (!body.success) return json({ error: "invalid_request" }, 400)
            try {
                const result =
                    body.data.action === "start"
                        ? await ports.start(access, {
                              connectionId: params.connectionId,
                              requestKey: body.data.requestKey,
                          })
                        : await ports.stop(access, {
                              connectionId: params.connectionId,
                          })
                return actionResponse(result, ports.now?.() ?? Date.now())
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
