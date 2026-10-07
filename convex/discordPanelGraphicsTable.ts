import { defineTable } from "convex/server"
import { v } from "convex/values"

/** Panel style A/B/C. */
export const panelStyleValidator = v.union(
    v.literal("a"),
    v.literal("b"),
    v.literal("c")
)
const bannerCrop = v.union(
    v.literal("top"),
    v.literal("center"),
    v.literal("bottom")
)
const mapGame = v.union(v.literal("hell_let_loose"), v.literal("wardogs"))

/**
 * Clan-wide panel graphics ("Grafika panelů", P8): one row per workspace.
 * Every asset reference carries the public ID and URL that the mutation read
 * from the verified asset; the client never supplies a URL.
 */
export const discordPanelGraphics = defineTable({
    guildId: v.string(),
    defaultStyle: panelStyleValidator,
    servers: v.array(
        v.object({
            connectionId: v.string(),
            bannerAssetId: v.union(v.id("imageAssets"), v.null()),
            bannerPublicId: v.union(v.string(), v.null()),
            bannerUrl: v.union(v.string(), v.null()),
            crop: bannerCrop,
            useMapImage: v.boolean(),
            barColor: v.union(v.string(), v.null()),
        })
    ),
    maps: v.array(
        v.object({
            game: mapGame,
            mapKey: v.string(),
            assetId: v.id("imageAssets"),
            publicId: v.string(),
            url: v.string(),
        })
    ),
    revision: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
}).index("guildId", ["guildId"])

/**
 * The bot's last application emoji provisioning report. Application emoji
 * belong to the bot application, not to a workspace, so there is one row.
 */
export const discordApplicationEmoji = defineTable({
    key: v.literal("global"),
    applicationId: v.string(),
    ready: v.array(v.string()),
    failed: v.array(v.string()),
    checkedAt: v.number(),
    /** Installed emoji IDs and names for dashboard previews (P2-B09); absent from older bots. */
    installed: v.optional(
        v.array(v.object({ key: v.string(), id: v.string(), name: v.string() }))
    ),
}).index("key", ["key"])
