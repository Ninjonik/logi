import { z } from "zod"

import {
    panelGraphicsPatchSchema,
    type PanelGraphicsPatch,
} from "@/domain/discord-publications/panel-graphics-settings"
import { toPanelGraphicsPageData } from "@/lib/panel-graphics-view"
import { readBoundedJson } from "@/lib/api/request-json"

/** A full P8 save is a few kilobytes; the bound stays far above it. */
export const PANEL_GRAPHICS_MAX_BODY_BYTES = 32 * 1024

export const panelGraphicsUpdateResultSchema = z.union([
    z.object({ ok: z.literal(true), revision: z.number().int().min(1) }),
    z.object({
        error: z.enum(["conflict", "asset_unavailable", "unknown_server"]),
    }),
])
export type PanelGraphicsUpdateResult = z.infer<
    typeof panelGraphicsUpdateResultSchema
>

export type PanelGraphicsRoutePorts<Access> = {
    /** Dashboard public origin; writes from anywhere else are refused. */
    origin: string
    /** Current clan admin with a live dashboard session, else null. */
    access(serverId: string): Promise<Access | null>
    read(access: Access): Promise<unknown>
    update(
        access: Access,
        patch: PanelGraphicsPatch
    ): Promise<PanelGraphicsUpdateResult>
}

const json = (body: unknown, status = 200) =>
    Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

/**
 * `GET/PATCH /api/servers/{serverId}/discord-panel-graphics` for the "Grafika
 * panelů" page (P8). GET returns the settings, the servers with their banner
 * files, every catalogue map with its current image and the emoji status.
 * PATCH applies a partial change (default style, server banners, crop, map
 * switch, bar colour, map overrides) after Convex verified every server and
 * asset. Images are uploaded first through `/image-assets` (`panel-banner`,
 * `panel-map`); this route only references them.
 */
export function panelGraphicsHandlers<Access>(
    ports: PanelGraphicsRoutePorts<Access>
) {
    return {
        async GET(_request: Request, serverId: string): Promise<Response> {
            const access = await ports.access(serverId).catch(() => null)
            if (!access) return json({ error: "forbidden" }, 403)
            try {
                return json(toPanelGraphicsPageData(await ports.read(access)))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
        async PATCH(request: Request, serverId: string): Promise<Response> {
            // Origin and admin access are checked before the body is read.
            if (request.headers.get("origin") !== ports.origin)
                return json({ error: "forbidden" }, 403)
            const access = await ports.access(serverId).catch(() => null)
            if (!access) return json({ error: "forbidden" }, 403)
            const patch = panelGraphicsPatchSchema.safeParse(
                await readBoundedJson(request, PANEL_GRAPHICS_MAX_BODY_BYTES)
            )
            if (!patch.success) return json({ error: "invalid_request" }, 400)
            try {
                const result = await ports.update(access, patch.data)
                if ("ok" in result)
                    return json({ ok: true, revision: result.revision })
                return json(
                    { error: result.error },
                    result.error === "conflict" ? 409 : 400
                )
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
