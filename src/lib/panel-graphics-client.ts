import { z } from "zod"

import type { PanelGraphicsPatch } from "@/domain/discord-publications/panel-graphics-settings"
import { panelGraphicsViewSchema } from "@/lib/api/panel-graphics-route"

/** Error codes of `PATCH /api/servers/{serverId}/discord-panel-graphics`. */
export const PANEL_GRAPHICS_SAVE_ERRORS = [
    "conflict",
    "asset_unavailable",
    "unknown_server",
    "invalid_request",
    "forbidden",
    "unavailable",
] as const
export type PanelGraphicsSaveError = (typeof PANEL_GRAPHICS_SAVE_ERRORS)[number]

const tileSchema = z.object({
    game: z.enum(["hell_let_loose", "wardogs"]),
    key: z.string(),
    name: z.string(),
    status: z.enum(["custom", "builtin", "none"]),
    image: z.string().nullable(),
    builtIn: z.string().nullable(),
})
const loadSchema = panelGraphicsViewSchema.extend({
    mapTiles: z.array(tileSchema),
})
export type PanelGraphicsPageData = z.infer<typeof loadSchema>
const route = (serverId: string) =>
    `/api/servers/${encodeURIComponent(serverId)}/discord-panel-graphics`

/** Same-origin read of the "Grafika panelů" page data. */
export async function loadPanelGraphics(
    serverId: string,
    fetcher: typeof fetch = fetch
): Promise<
    | { ok: true; data: PanelGraphicsPageData }
    | { ok: false; error: "forbidden" | "unavailable" }
> {
    try {
        const response = await fetcher(route(serverId), { cache: "no-store" })
        if (response.status === 403) return { ok: false, error: "forbidden" }
        const parsed = loadSchema.safeParse(
            await response.json().catch(() => null)
        )
        return response.ok && parsed.success
            ? { ok: true, data: parsed.data }
            : { ok: false, error: "unavailable" }
    } catch {
        return { ok: false, error: "unavailable" }
    }
}

const savedSchema = z.object({ ok: z.literal(true), revision: z.number() })
const failedSchema = z.object({ error: z.enum(PANEL_GRAPHICS_SAVE_ERRORS) })
/**
 * Saves a partial change (the "Uložit" save bar). Uploads happen before,
 * through `uploadImageAsset` with `panel-banner` or `panel-map`; the patch
 * names the returned asset IDs.
 */
export async function savePanelGraphics(
    serverId: string,
    patch: PanelGraphicsPatch,
    fetcher: typeof fetch = fetch
): Promise<
    | { ok: true; revision: number }
    | { ok: false; error: PanelGraphicsSaveError }
> {
    try {
        const response = await fetcher(route(serverId), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        })
        const body: unknown = await response.json().catch(() => null)
        const saved = savedSchema.safeParse(body)
        if (response.ok && saved.success)
            return { ok: true, revision: saved.data.revision }
        const failed = failedSchema.safeParse(body)
        return {
            ok: false,
            error: failed.success
                ? failed.data.error
                : response.status === 403
                  ? "forbidden"
                  : "unavailable",
        }
    } catch {
        return { ok: false, error: "unavailable" }
    }
}
