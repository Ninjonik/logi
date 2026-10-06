import { CLAN_SETTINGS_SLICES } from "../../domain/api/clan-settings-slices"
import { clanSettingsOpenApiSchemas } from "../../lib/api/settings-openapi"
import { parseClanSettingsPatch } from "../../domain/api/settings-patch"
import * as publicApiReads from "../../../convex/publicApiReads"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET

function setup() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:writer",
        keyHash: "key",
        guildId: "guild-a",
    })
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "guild-a",
        name: "Vlci",
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: "guild-a",
        timezone: "UTC",
    })
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:hll",
        guildId: "guild-a",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        enabled: true,
        observation: null,
    })
    for (const [id, kind, guildId] of [
        ["imageAssets:banner", "panel-banner", "guild-a"],
        ["imageAssets:map", "panel-map", "guild-a"],
        ["imageAssets:foreign", "panel-banner", "guild-b"],
    ] as const)
        ctx.db.seed("imageAssets", {
            _id: id,
            guildId,
            kind,
            publicId: id.slice(-6).padStart(32, "a"),
            storageId: `_storage:${id}`,
            contentType: "image/webp",
            width: 1200,
            height: 400,
            bytes: 2048,
            sha256: "a".repeat(64),
            publicUrl: `https://logi.test/api/image-assets/${id.slice(-6)}.webp`,
            state: "ready",
            createdAt: "2026-10-05T00:00:00.000Z",
            createdBy: "100000000000000001",
        })
    return ctx
}
let request = 0
const patch = (
    ctx: ReturnType<typeof setup>,
    body: Record<string, unknown>
): Promise<{ status: number; body: string }> =>
    invoke(publicApi.mutateClanSettings, ctx, {
        secret,
        keyHash: "key",
        idempotencyKey: `request-${++request}`,
        bodyHash: `body-${request}`,
        methodPath: "PATCH /clan/settings",
        ...body,
    })

test("GET shows the panel graphics slice with defaults", async () => {
    const ctx = setup()
    const read = await invoke(publicApiReads.getClanSettings, ctx, {
        secret,
        keyHash: "key",
    })
    assert.deepEqual(read.slices.panelGraphics, {
        defaultStyle: "a",
        revision: 0,
        servers: [],
        maps: [],
    })
})

test("PATCH sets the style, a server banner and a map image by asset reference", async () => {
    const ctx = setup()
    const result = await patch(ctx, {
        slices: {
            panelGraphics: {
                defaultStyle: "b",
                servers: [
                    {
                        connectionId: "gameDataConnections:hll",
                        bannerAssetId: "imageAssets:banner",
                        crop: "top",
                        barColor: "#2BB3A3",
                    },
                ],
                maps: [
                    {
                        game: "hell_let_loose",
                        mapKey: "carentan",
                        assetId: "imageAssets:map",
                    },
                ],
            },
        },
    })
    assert.equal(result.status, 200)
    const view = JSON.parse(result.body).data.slices.panelGraphics
    assert.equal(view.defaultStyle, "b")
    assert.equal(view.revision, 1)
    assert.deepEqual(view.servers[0], {
        connectionId: "gameDataConnections:hll",
        banner: {
            assetId: "imageAssets:banner",
            url: "https://logi.test/api/image-assets/banner.webp",
        },
        crop: "top",
        useMapImage: true,
        barColor: "#2bb3a3",
    })
    assert.equal(view.maps[0].image.assetId, "imageAssets:map")
    const row = ctx.db.tables.discordPanelGraphics?.[0]
    assert.equal(row?.updatedBy, "api:apiKeys:writer")
    assert.equal(ctx.db.tables.imageAssetReferences?.length, 2)
    // Panel graphics write no Discord configuration fields.
    assert.equal("panelGraphics" in ctx.db.tables.discordConfigs[0]!, false)
})

test("a foreign asset refuses the whole request; nothing is written", async () => {
    const ctx = setup()
    const result = await patch(ctx, {
        timezone: "Europe/Prague",
        slices: {
            panelGraphics: {
                servers: [
                    {
                        connectionId: "gameDataConnections:hll",
                        bannerAssetId: "imageAssets:foreign",
                    },
                ],
            },
        },
    })
    assert.equal(result.status, 400)
    assert.equal(JSON.parse(result.body).error.code, "validation_error")
    assert.equal(ctx.db.tables.discordPanelGraphics, undefined)
    assert.equal(ctx.db.tables.discordConfigs[0]!.timezone, "UTC")
})

test("a stale revision is a conflict and an invalid slice is refused", async () => {
    const ctx = setup()
    assert.equal(
        (await patch(ctx, { slices: { panelGraphics: { defaultStyle: "c" } } }))
            .status,
        200
    )
    const stale = await patch(ctx, {
        slices: { panelGraphics: { defaultStyle: "b", expectedRevision: 0 } },
    })
    assert.equal(stale.status, 409)
    assert.equal(JSON.parse(stale.body).error.code, "conflict")
    const invalid = await patch(ctx, {
        slices: { panelGraphics: { defaultStyle: "z" } },
    })
    assert.equal(invalid.status, 400)
    assert.equal(ctx.db.tables.discordPanelGraphics?.[0]?.defaultStyle, "c")
})

test("the route parses the slice and OpenAPI documents it", () => {
    const parsed = parseClanSettingsPatch(
        { panelGraphics: { defaultStyle: "a" } },
        CLAN_SETTINGS_SLICES
    )
    assert.equal(parsed.ok, true)
    assert.equal(
        parseClanSettingsPatch(
            { panelGraphics: { bannerUrl: "https://evil" } },
            CLAN_SETTINGS_SLICES
        ).ok,
        false
    )
    const schemas = clanSettingsOpenApiSchemas() as Record<string, unknown>
    assert.ok(schemas.ClanSettingsPanelGraphicsSlice)
    assert.ok(schemas.ClanSettingsPanelGraphicsPatch)
})
