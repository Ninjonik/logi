import { z } from "zod"

import {
    MAX_PANELS_PER_GUILD,
    PANEL_KINDS,
    PANEL_REFRESH_SECONDS,
    panelSaveSchema,
} from "../discord-publications/settings"

import { defineClanSettingsSlice } from "./settings-slices"

/**
 * `/api/v1` clan settings slice `discordPanels` ("Panely v Discordu",
 * P1-B10): every panel with its settings in the shape the dashboard editor
 * saves (`panelSaveSchema`). PATCH creates or edits panels; a new panel is
 * saved as not sent and an edited sent panel is redrawn by the bot on its
 * next pass, exactly as "Uložit" in the editor.
 *
 * Deliberate exclusions (recorded in `configuration-coverage.md`): the live
 * Discord actions (send, refresh, pause, resume, retry, delete the message,
 * remove the panel), the provider test read, the channel check and the
 * encrypted server password stay in the dashboard
 * (`/api/servers/{serverId}/discord-panels`).
 */

const panelId = z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/)

/** One panel as GET returns it; `settings` is accepted back by PATCH unchanged. */
export const discordPanelApiItemSchema = z.object({
    id: z.string(),
    kind: z.enum(PANEL_KINDS),
    /** Pass as `expectedRevision` to refuse a concurrent change. */
    revision: z.number().int().min(0),
    /** A message reached Discord at least once; the kind can no longer change. */
    sent: z.boolean(),
    /** "Neodesláno": saved but not sent. */
    draft: z.boolean(),
    paused: z.boolean(),
    settings: panelSaveSchema,
})
export type DiscordPanelApiItem = z.infer<typeof discordPanelApiItemSchema>

export const discordPanelsApiSchema = z.object({
    /** Every panel refreshes every 60 s; not configurable. */
    refreshSeconds: z.literal(PANEL_REFRESH_SECONDS),
    panels: z.array(discordPanelApiItemSchema).max(MAX_PANELS_PER_GUILD + 50),
})
export type DiscordPanelsApiView = z.infer<typeof discordPanelsApiSchema>

export const discordPanelsPatchSchema = z
    .strictObject({
        panels: z
            .array(
                z.strictObject({
                    /** Absent or null creates a new panel (saved as not sent). */
                    id: panelId.nullable().optional(),
                    expectedRevision: z.number().int().min(0).optional(),
                    settings: panelSaveSchema,
                })
            )
            .min(1)
            .max(MAX_PANELS_PER_GUILD),
    })
    .refine(
        (patch) => {
            const ids = patch.panels.flatMap((panel) =>
                panel.id ? [panel.id] : []
            )
            return new Set(ids).size === ids.length
        },
        { message: "A panel is listed twice.", path: ["panels"] }
    )
export type DiscordPanelsPatch = z.infer<typeof discordPanelsPatchSchema>

const EMPTY_VIEW: DiscordPanelsApiView = {
    refreshSeconds: PANEL_REFRESH_SECONDS,
    panels: [],
}

export const discordPanelsSettingsSlice = defineClanSettingsSlice({
    key: "discordPanels",
    description:
        "Discord panels (live server, Naše servery, results, WD League, calendar, competition tables): every panel's settings as the dashboard editor saves them. PATCH creates panels (saved as not sent) or edits them (a sent panel is redrawn within 60 s). Sending, refreshing, pausing, retrying and deleting messages, the provider test read, the channel check and the server password are dashboard-only live actions.",
    schema: discordPanelsApiSchema,
    patchSchema: discordPanelsPatchSchema,
    external: true,
    read: ({ external }) => {
        const parsed = discordPanelsApiSchema.safeParse(external?.discordPanels)
        return parsed.success ? parsed.data : EMPTY_VIEW
    },
    // Stored in `discordPublicPanels` by `convex/clanSettingsStores.ts`.
    toPatch: () => ({}),
})
