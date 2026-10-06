import {
    MAX_PANELS_PER_GUILD,
    PANEL_REFRESH_SECONDS,
    isPanelPaused,
    normalizePanelKind,
} from "@/domain/discord-publications/settings"
import type {
    DiscordPanelApiItem,
    DiscordPanelsApiView,
    DiscordPanelsPatch,
} from "@/domain/api/discord-panels-settings-slice"
import { resolvePanelPresentation } from "@/domain/discord-publications/panel-presentation"
import { panelSaveSchema } from "@/domain/discord-publications/settings.schema"

import {
    savePanel,
    type PanelSaveError,
    type PanelSaveStore,
    type SavedPanelSummary,
} from "./save-panel"
import { panelEditorSettings, type StoredPanel } from "./panel-overview"

/**
 * `/api/v1` clan settings slice `discordPanels` (P1-B10): the panels'
 * settings as the dashboard editor saves them. A PATCH runs the editor's own
 * save (`savePanel`) for every listed panel, first against a dry-run store
 * so a refused entry writes nothing, then for real. Live Discord actions are
 * not part of it (deliberate exclusion, `configuration-coverage.md`).
 */

export type ApiSettingsError = { status: number; code: string; message: string }

/** One stored panel as GET shows it; null for a row that is no panel kind. */
export function discordPanelApiItem(
    panel: StoredPanel & { sent: boolean }
): DiscordPanelApiItem | null {
    const kind = normalizePanelKind(panel.kind)
    if (!kind || panel.removing) return null
    const settings = panelEditorSettings(panel, kind)
    const look = resolvePanelPresentation(panel)
    const parsed = panelSaveSchema.safeParse({
        ...settings,
        // The API references assets by ID; the old per-panel emoji are gone (P8-B06).
        presentation: {
            layout: look.layout,
            accentColor: look.accentColor,
            bannerAssetId: look.bannerAssetId,
            factionEmoji: {},
            style: panel.presentation?.style ?? null,
        },
    })
    if (!parsed.success) return null
    return {
        id: panel.id,
        kind,
        revision: panel.revision,
        sent: panel.sent,
        draft: Boolean(panel.draft),
        paused: isPanelPaused(panel),
        settings: parsed.data,
    }
}

export function discordPanelsApiView(
    panels: ReadonlyArray<StoredPanel & { sent: boolean }>
): DiscordPanelsApiView {
    return {
        refreshSeconds: PANEL_REFRESH_SECONDS,
        panels: panels
            .flatMap((panel) => {
                const item = discordPanelApiItem(panel)
                return item ? [item] : []
            })
            .slice(0, MAX_PANELS_PER_GUILD + 50),
    }
}

/** Plain-language API errors of a refused panel save. */
export function discordPanelsApiError(
    reason: PanelSaveError,
    index: number
): ApiSettingsError {
    const at = `discordPanels.panels.${index}`
    const conflict = (message: string) => ({
        status: 409,
        code: "conflict",
        message: `${at}: ${message}`,
    })
    const invalid = (message: string) => ({
        status: 400,
        code: "validation_error",
        message: `${at}: ${message}`,
    })
    switch (reason) {
        case "not_found":
            return {
                status: 404,
                code: "not_found",
                message: `${at}.id: unknown panel.`,
            }
        case "conflict":
            return conflict("the panel changed since expectedRevision.")
        case "kind_locked":
            return conflict(
                "a sent panel keeps its kind; create a new panel for another kind."
            )
        case "removing":
            return conflict("the panel is being removed.")
        case "source_not_found":
            return invalid("unknown game server connection.")
        case "game_mismatch":
            return invalid("the server does not belong to the panel's game.")
        case "report_destination_missing":
            return invalid(
                "reportCategoryId is not a ticket category with a private ticket channel."
            )
        case "report_provider":
            return invalid("player reports need a CRCON or Warcon server.")
        case "duplicate_channel":
            return invalid("this server already has a panel in that channel.")
        case "results_exists":
            return invalid("this game already has a results panel.")
        case "league_exists":
            return invalid("the clan already has a WD League panel.")
        case "calendar_exists":
            return invalid("the clan already has a calendar panel.")
        case "competition_not_found":
            return invalid("unknown competition.")
        case "panel_limit":
            return invalid(`at most ${MAX_PANELS_PER_GUILD} panels per clan.`)
        case "asset_unavailable":
            return invalid(
                "presentation.bannerAssetId is not an uploaded panel banner (panel-banner) of this clan."
            )
    }
}

/**
 * A store that answers like `store` but writes nothing: saves are kept in
 * memory, so later entries of the same PATCH see the earlier ones (two new
 * League panels are refused as in the dashboard). `checkBanner` verifies an
 * uploaded banner without attaching it.
 */
export function dryRunPanelStore(
    store: PanelSaveStore,
    checkBanner: (guildId: string, assetId: string) => Promise<boolean>
): PanelSaveStore {
    const written = new Map<string, SavedPanelSummary>()
    let next = 0
    return {
        ...store,
        async panels(guildId) {
            const stored = await store.panels(guildId)
            const merged = stored.map((panel) => written.get(panel.id) ?? panel)
            for (const [id, panel] of written)
                if (!stored.some((entry) => entry.id === id)) merged.push(panel)
            return merged
        },
        async write({ guildId, id, row }) {
            const banner = row.presentation?.bannerAssetId
            if (banner && !(await checkBanner(guildId, banner)))
                return { error: "asset_unavailable" }
            const panelId = id ?? `dry-run:${next++}`
            const previous = (await store.panels(guildId)).find(
                (panel) => panel.id === panelId
            )
            written.set(panelId, {
                id: panelId,
                kind: row.kind,
                channelId: row.channelId,
                connectionId: row.connectionId ?? null,
                gameId: row.gameId,
                draft: row.draft,
                removing: false,
                sent: previous?.sent ?? false,
                revision: row.revision,
            })
            return { id: panelId }
        },
    }
}

/**
 * Validates every entry of a PATCH without writing; `commit` then saves them
 * in order. A new panel is saved as not sent (`send` is a live action).
 */
export async function prepareDiscordPanelsPatch(
    stores: {
        real: PanelSaveStore
        dryRun: PanelSaveStore
    },
    input: {
        guildId: string
        patch: DiscordPanelsPatch
        now: number
    }
): Promise<
    | { ok: true; commit(updatedBy: string): Promise<void> }
    | { ok: false; error: ApiSettingsError }
> {
    const entries = input.patch.panels
    for (const [index, entry] of entries.entries()) {
        const result = await savePanel(stores.dryRun, {
            guildId: input.guildId,
            panelId: entry.id ?? null,
            settings: entry.settings,
            send: false,
            expectedRevision: entry.expectedRevision ?? null,
            actorId: "api",
            now: input.now,
        })
        if (result.status !== "saved")
            return {
                ok: false,
                error: discordPanelsApiError(result.reason, index),
            }
    }
    return {
        ok: true,
        commit: async (updatedBy) => {
            for (const entry of entries) {
                const result = await savePanel(stores.real, {
                    guildId: input.guildId,
                    panelId: entry.id ?? null,
                    settings: entry.settings,
                    send: false,
                    expectedRevision: entry.expectedRevision ?? null,
                    actorId: updatedBy,
                    now: input.now,
                })
                // The dry run accepted it in this transaction; a refusal now is a bug.
                if (result.status !== "saved")
                    throw new Error("Panel save refused after validation.")
            }
        },
    }
}
