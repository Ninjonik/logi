import { z } from "zod"

import {
    joinCodeSchema,
    serverAddressSchema,
    serverPasswordSchema,
} from "@/domain/discord-publications/server-join"
import type { PanelActionResult } from "@/application/discord-publications/panel-actions"
import type { PanelSaveResult } from "@/application/discord-publications/save-panel"
import { PANEL_ACTIONS } from "@/domain/discord-publications/panel-delivery"
import { panelSaveSchema } from "@/domain/discord-publications/settings"
import { readBoundedJson } from "@/lib/api/request-json"

/**
 * The routes of "Panely v Discordu" under `/api/servers/{serverId}/discord-panels`
 * (see `docs/superpowers/specs/discord-redesign/PANELS-API.md`):
 * - `GET` the overview (states, timing, errors, bot heartbeat, sources);
 * - `POST` save one panel (`send` also sends it);
 * - `POST /{panelId}/actions` a live action;
 * - `POST /test-fetch` the provider test read with the rendered preview;
 * - `POST /channel-check` the channel's permissions and privacy;
 * - `PUT /servers/{connectionId}` a server's address, join code and password.
 * Clan admins only; writes only from the dashboard origin, checked before
 * the body is read. Live Discord actions are deliberately not in `/api/v1`.
 */
const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

const reference = z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/)
const snowflake = z.string().regex(/^\d{17,20}$/)

export const panelSaveRequestSchema = z.strictObject({
    panelId: reference.nullable().default(null),
    settings: z.unknown(),
    send: z.boolean().default(false),
    expectedRevision: z.number().int().min(0).nullable().default(null),
})
export const panelActionRequestSchema = z.strictObject({
    action: z.enum(PANEL_ACTIONS),
})
export const panelTestRequestSchema = z.strictObject({
    connectionId: reference,
    panelId: reference.nullable().default(null),
})
export const panelChannelRequestSchema = z.strictObject({
    channelId: snowflake,
})
/** Absent keeps a value; `null` or "" clears it. */
export const panelServerRequestSchema = z.strictObject({
    address: z.union([serverAddressSchema, z.literal(""), z.null()]).optional(),
    joinCode: z.union([joinCodeSchema, z.literal(""), z.null()]).optional(),
    password: z
        .union([serverPasswordSchema, z.literal(""), z.null()])
        .optional(),
})

export type DiscordPanelsAccess = { guildId: string }

export type DiscordPanelsRoutePorts<A extends DiscordPanelsAccess> = {
    isWriteOrigin(request: Request): boolean
    access(serverId: string): Promise<A | null>
    read(access: A): Promise<unknown>
    save(
        access: A,
        input: {
            panelId: string | null
            settings: unknown
            send: boolean
            expectedRevision: number | null
        }
    ): Promise<PanelSaveResult>
    act(
        access: A,
        input: {
            panelId: string
            action: (typeof PANEL_ACTIONS)[number]
        }
    ): Promise<PanelActionResult>
    test(
        access: A,
        input: { connectionId: string; panelId: string | null }
    ): Promise<{ status: string } & Record<string, unknown>>
    checkChannel(access: A, channelId: string): Promise<unknown>
    saveServer(
        access: A,
        input: {
            connectionId: string
            address?: string | null
            joinCode?: string | null
            password?: string | null
        }
    ): Promise<{ status: string } & Record<string, unknown>>
}

const SAVE_STATUS: Record<string, number> = {
    not_found: 404,
    conflict: 409,
    kind_locked: 409,
    removing: 409,
}

export function discordPanelsRoutes<A extends DiscordPanelsAccess>(
    ports: DiscordPanelsRoutePorts<A>
) {
    const writeAccess = async (request: Request, serverId: string) =>
        ports.isWriteOrigin(request)
            ? await ports.access(serverId).catch(() => null)
            : null
    const body = async <T>(
        request: Request,
        schema: z.ZodType<T>,
        limit = 4096
    ) => schema.safeParse(await readBoundedJson(request, limit))

    return {
        async GET(_request: Request, params: { serverId: string }) {
            const access = await ports.access(params.serverId).catch(() => null)
            if (!access) return json({ error: "forbidden" }, 403)
            try {
                return json(await ports.read(access))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async POST(request: Request, params: { serverId: string }) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const parsed = await body(request, panelSaveRequestSchema, 8192)
            if (!parsed.success) return json({ error: "invalid_request" }, 400)
            const settings = panelSaveSchema.safeParse(parsed.data.settings)
            if (!settings.success)
                return json(
                    {
                        error: "invalid_settings",
                        issues: settings.error.issues.map((issue) => ({
                            path: issue.path.map(String).join("."),
                            message: issue.message,
                        })),
                    },
                    400
                )
            try {
                const result = await ports.save(access, {
                    ...parsed.data,
                    settings: settings.data,
                })
                if (result.status === "saved") return json(result)
                return json(
                    { error: result.reason },
                    SAVE_STATUS[result.reason] ?? 400
                )
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async action(
            request: Request,
            params: { serverId: string; panelId: string }
        ) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            if (!reference.safeParse(params.panelId).success)
                return json({ error: "not_found" }, 404)
            const parsed = await body(request, panelActionRequestSchema, 256)
            if (!parsed.success) return json({ error: "invalid_request" }, 400)
            try {
                const result = await ports.act(access, {
                    panelId: params.panelId,
                    action: parsed.data.action,
                })
                if (result.status === "accepted") return json(result, 202)
                if (result.status === "not_found")
                    return json({ error: "not_found" }, 404)
                return json({ error: result.reason }, 409)
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async testFetch(request: Request, params: { serverId: string }) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const parsed = await body(request, panelTestRequestSchema, 512)
            if (!parsed.success) return json({ error: "invalid_request" }, 400)
            try {
                const result = await ports.test(access, parsed.data)
                return result.status === "not_found"
                    ? json({ error: "not_found" }, 404)
                    : json(result)
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async channelCheck(request: Request, params: { serverId: string }) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const parsed = await body(request, panelChannelRequestSchema, 256)
            if (!parsed.success) return json({ error: "invalid_request" }, 400)
            try {
                return json(
                    await ports.checkChannel(access, parsed.data.channelId)
                )
            } catch {
                return json({ error: "verification_unavailable" }, 503)
            }
        },

        async server(
            request: Request,
            params: { serverId: string; connectionId: string }
        ) {
            const access = await writeAccess(request, params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            if (!reference.safeParse(params.connectionId).success)
                return json({ error: "not_found" }, 404)
            const parsed = await body(request, panelServerRequestSchema, 1024)
            if (!parsed.success) return json({ error: "invalid_request" }, 400)
            try {
                const result = await ports.saveServer(access, {
                    connectionId: params.connectionId,
                    ...parsed.data,
                })
                switch (result.status) {
                    case "saved":
                        return json(result)
                    case "not_found":
                        return json({ error: "not_found" }, 404)
                    case "encryption_unavailable":
                        return json({ error: "encryption_unavailable" }, 503)
                    default:
                        return json(
                            { error: "invalid_request", field: result.field },
                            400
                        )
                }
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
