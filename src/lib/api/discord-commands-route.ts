import { z } from "zod"

import {
    storedCommandSettingsSchema,
    type StoredCommandSettings,
} from "@/domain/discord-commands/command-settings"
import {
    statsCommandSettingsSchema,
    type StatsCommandSettings,
} from "@/domain/player-stats/command-settings"
import { readBoundedJson } from "@/lib/api/request-json"

const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

/** `POST` body of the "Příkazy" page. */
export const discordCommandsRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("save"),
        commandSettings: storedCommandSettingsSchema,
        statsSettings: statsCommandSettingsSchema,
    }),
    /** "Znovu zaregistrovat": a live Discord action, not in `/api/v1`. */
    z.strictObject({ action: z.literal("reregister") }),
    /** "Převést do Herních serverů". */
    z.strictObject({ action: z.literal("convertLegacy") }),
])

export type DiscordCommandsAccess = { guildId: string }

export type DiscordCommandsRoutePorts<A extends DiscordCommandsAccess> = {
    /** `isDashboardWriteOrigin`: writes only from the dashboard's public origin. */
    isWriteOrigin(request: Request): boolean
    /** Current clan admin with a live dashboard session; null denies. */
    access(serverId: string): Promise<A | null>
    registration(access: A): Promise<unknown>
    save(
        access: A,
        input: {
            commandSettings: StoredCommandSettings
            statsSettings: StatsCommandSettings
        }
    ): Promise<unknown>
    reregister(access: A): Promise<{ requestedAt: number }>
    convertLegacy(access: A): Promise<
        | {
              converted: number
              alreadyThere: number
              skipped: number
              failed: number
          }
        | { error: "encryption_unavailable" }
    >
}

/** Bodies are a few kilobytes at most; anything bigger is refused unread. */
const MAX_BODY_BYTES = 16_384

/**
 * `GET/POST /api/servers/{serverId}/discord-commands`: the registration
 * status, saving the "Příkazy" page, "Znovu zaregistrovat" and the legacy
 * conversion. Same-origin clan admins only; Convex re-checks the dashboard
 * session and the admin right in the same transaction.
 */
export function discordCommandsRoutes<A extends DiscordCommandsAccess>(
    ports: DiscordCommandsRoutePorts<A>
) {
    return {
        async GET(_request: Request, params: { serverId: string }) {
            try {
                const access = await ports.access(params.serverId)
                if (!access) return json({ error: "forbidden" }, 403)
                return json(await ports.registration(access))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
        async POST(request: Request, params: { serverId: string }) {
            if (!ports.isWriteOrigin(request))
                return json({ error: "forbidden" }, 403)
            try {
                const access = await ports.access(params.serverId)
                if (!access) return json({ error: "forbidden" }, 403)
                const input = discordCommandsRequestSchema.safeParse(
                    await readBoundedJson(request, MAX_BODY_BYTES)
                )
                if (!input.success)
                    return json({ error: "invalid_request" }, 400)
                switch (input.data.action) {
                    case "save":
                        await ports.save(access, {
                            commandSettings: input.data.commandSettings,
                            statsSettings: input.data.statsSettings,
                        })
                        return json({ ok: true })
                    case "reregister":
                        return json(await ports.reregister(access))
                    case "convertLegacy": {
                        const result = await ports.convertLegacy(access)
                        return "error" in result
                            ? json(result, 503)
                            : json(result)
                    }
                }
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
