/**
 * `/api/v1` clan settings slice `matchMessages`: the roster message's
 * default look and the publish dialog's defaults (board N1-11, N1-12,
 * N1-24) and the optional attendance post in the match thread (N1-15).
 * The per-publish choices (variant, mentions, change DMs, change post) are
 * a live publish action and deliberately not in the API; see
 * `docs/integrations/website/configuration-coverage.md`.
 */

import { z } from "zod"

import {
    resolveMatchMessageSettings,
    type StoredMatchMessageSettings,
} from "../discord-messages/notification-settings"
import { ROSTER_MESSAGE_VARIANTS } from "../discord-messages/roster-message"
import { defineClanSettingsSlice } from "./settings-slices"

const variant = z.enum(ROSTER_MESSAGE_VARIANTS)

const schema = z.object({
    rosterMessageVariant: variant.describe(
        "Default look of the roster message: photo_text (photo with the text roster) or photo (photo only)."
    ),
    rosterChangesPost: z
        .boolean()
        .describe("Whether the publish dialog pre-selects the change post."),
    rosterChangesDm: z
        .boolean()
        .describe("Whether the publish dialog pre-selects the change DMs."),
    attendanceNoticesInThread: z
        .boolean()
        .describe(
            "Whether late and absence notices are posted in the match thread, without the reason."
        ),
})

export const matchMessagesSettingsSlice = defineClanSettingsSlice({
    key: "matchMessages",
    description:
        "Match messages: the roster message's default look, the publish dialog's defaults and the attendance post in the match thread.",
    schema,
    patchSchema: schema.partial().strict(),
    read: ({ discordConfig }) =>
        resolveMatchMessageSettings(
            discordConfig as StoredMatchMessageSettings | null
        ),
    toPatch: (patch) => ({
        ...(patch.rosterMessageVariant === undefined
            ? {}
            : { rosterMessageVariant: patch.rosterMessageVariant }),
        ...(patch.rosterChangesPost === undefined
            ? {}
            : { rosterChangesPostDefault: patch.rosterChangesPost }),
        ...(patch.rosterChangesDm === undefined
            ? {}
            : { rosterChangesDmDefault: patch.rosterChangesDm }),
        ...(patch.attendanceNoticesInThread === undefined
            ? {}
            : { attendanceNoticesInThread: patch.attendanceNoticesInThread }),
    }),
})
