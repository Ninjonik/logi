import { z } from "zod"

import type { ApplicationChannelReport } from "@/domain/membership/application-channels"
import { readBoundedJson } from "@/lib/api/request-json"

/**
 * Routes of the application settings page (N4):
 * - `POST /api/servers/{serverId}/membership-application`
 *   `{"action":"check-channels","panelChannelId":…,"threadChannelId":…}`
 *   reads the bot's permissions in the two channels (N4-05, N4-06, N4-B08);
 * - `{"action":"attach-image","assetId":…|null}` keeps a chosen panel banner
 *   referenced and returns its URL (N4-09).
 * Clan admins only, from the dashboard origin, checked before the body is read.
 */

const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

const channelId = z
    .string()
    .regex(/^\d{17,20}$/)
    .nullable()

export const membershipApplicationRequestSchema = z.discriminatedUnion(
    "action",
    [
        z.strictObject({
            action: z.literal("check-channels"),
            panelChannelId: channelId,
            threadChannelId: channelId,
        }),
        z.strictObject({
            action: z.literal("attach-image"),
            assetId: z
                .string()
                .regex(/^[A-Za-z0-9_-]{1,64}$/)
                .nullable(),
        }),
    ]
)

export type MembershipApplicationRoutePorts<A> = {
    isWriteOrigin(request: Request): boolean
    /** A clan admin with a live dashboard session; null denies. */
    access(serverId: string): Promise<A | null>
    checkChannels(
        access: A,
        channels: {
            panelChannelId: string | null
            threadChannelId: string | null
        }
    ): Promise<ApplicationChannelReport>
    attachImage(
        access: A,
        assetId: string | null
    ): Promise<{ ok: true; url: string | null } | { ok: false }>
}

export function membershipApplicationRoutes<A>(
    ports: MembershipApplicationRoutePorts<A>
) {
    return {
        async POST(request: Request, params: { serverId: string }) {
            const access = ports.isWriteOrigin(request)
                ? await ports.access(params.serverId).catch(() => null)
                : null
            if (!access) return json({ error: "forbidden" }, 403)
            const body = membershipApplicationRequestSchema.safeParse(
                await readBoundedJson(request, 1024)
            )
            if (!body.success) return json({ error: "invalid_request" }, 400)
            try {
                if (body.data.action === "check-channels")
                    return json({
                        channels: await ports.checkChannels(access, {
                            panelChannelId: body.data.panelChannelId,
                            threadChannelId: body.data.threadChannelId,
                        }),
                    })
                const result = await ports.attachImage(
                    access,
                    body.data.assetId
                )
                return result.ok
                    ? json({ url: result.url })
                    : json({ error: "invalid_asset" }, 400)
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
