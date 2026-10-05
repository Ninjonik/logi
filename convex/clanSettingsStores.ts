import {
    panelGraphicsApiView,
    PANEL_GRAPHICS_API_ERRORS,
} from "../src/domain/api/panel-graphics-settings-slice"
import {
    externalClanSettingsSlicePatches,
    type AnyClanSettingsSlice,
} from "../src/domain/api/settings-slices"
import { panelGraphicsPatchSchema } from "../src/domain/discord-publications/panel-graphics-settings"
import {
    preparePanelGraphicsChange,
    readStoredPanelGraphics,
} from "./discordPanelGraphics"
import type { MutationCtx, QueryCtx } from "./_generated/server"

/**
 * Stores of the `/api/v1` settings slices that live in their own table
 * (`external` slices in `src/domain/api/settings-slices.ts`). `read` gives
 * the slice its value; `prepare` validates a patch against the database
 * without writing and `commit` stores it, so a refused request never
 * writes half of a settings change.
 */
export type ClanSettingsStoreError = {
    status: number
    code: string
    message: string
}
export type ClanSettingsStore = {
    read(ctx: Pick<QueryCtx, "db">, guildId: string): Promise<unknown>
    prepare(
        ctx: MutationCtx,
        guildId: string,
        patch: unknown
    ): Promise<
        | { ok: true; commit(updatedBy: string): Promise<void> }
        | { ok: false; error: ClanSettingsStoreError }
    >
}

export const CLAN_SETTINGS_STORES: Readonly<Record<string, ClanSettingsStore>> =
    {
        panelGraphics: {
            read: async (ctx, guildId) =>
                panelGraphicsApiView(
                    await readStoredPanelGraphics(ctx, guildId)
                ),
            prepare: async (ctx, guildId, patch) => {
                const change = await preparePanelGraphicsChange(
                    ctx,
                    guildId,
                    panelGraphicsPatchSchema.parse(patch)
                )
                if (!("ok" in change))
                    return {
                        ok: false,
                        error: PANEL_GRAPHICS_API_ERRORS[change.error],
                    }
                return {
                    ok: true,
                    commit: async (updatedBy) => {
                        await change.commit(updatedBy)
                    },
                }
            },
        },
    }

function storeOf(slice: AnyClanSettingsSlice) {
    const store = CLAN_SETTINGS_STORES[slice.key]
    if (!store) throw new Error(`Settings slice "${slice.key}" has no store.`)
    return store
}

/** `source.external` for every external slice. */
export async function readExternalClanSettings(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    slices: readonly AnyClanSettingsSlice[]
): Promise<Record<string, unknown>> {
    const external: Record<string, unknown> = {}
    for (const slice of slices)
        if (slice.external)
            external[slice.key] = await storeOf(slice).read(ctx, guildId)
    return external
}

/**
 * Validates the external parts of a PATCH. The returned `commit` writes all
 * of them; call it only when the whole request is accepted.
 */
export async function prepareExternalClanSettings(
    ctx: MutationCtx,
    guildId: string,
    rawSlices: Readonly<Record<string, unknown>>,
    slices: readonly AnyClanSettingsSlice[]
): Promise<
    | { ok: true; commit(updatedBy: string): Promise<void> }
    | { ok: false; error: ClanSettingsStoreError }
> {
    const commits: Array<(updatedBy: string) => Promise<void>> = []
    for (const [key, patch] of Object.entries(
        externalClanSettingsSlicePatches(rawSlices, slices)
    )) {
        const slice = slices.find((candidate) => candidate.key === key)!
        const prepared = await storeOf(slice).prepare(ctx, guildId, patch)
        if (!prepared.ok) return prepared
        commits.push(prepared.commit)
    }
    return {
        ok: true,
        commit: async (updatedBy) => {
            for (const commit of commits) await commit(updatedBy)
        },
    }
}
