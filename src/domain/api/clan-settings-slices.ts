/**
 * Every settings slice of `/api/v1` clan settings. A workstream adds its
 * slice module (see `settings-slices.ts`) and appends it here; the route,
 * the Convex mutation, `GET` and OpenAPI pick it up from this list.
 */

import {
    assertClanSettingsSlices,
    type AnyClanSettingsSlice,
} from "./settings-slices"
import { commandsSettingsSlice } from "./commands-settings-slice"

export const CLAN_SETTINGS_SLICES: readonly AnyClanSettingsSlice[] = [
    commandsSettingsSlice as AnyClanSettingsSlice,
]

assertClanSettingsSlices(CLAN_SETTINGS_SLICES)
