import * as graphicsWrites from "../../../convex/discordPanelGraphicsWrites"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as graphics from "../../../convex/discordPanelGraphics"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const access = { secret, guildId: "guild-a", actor: actorFixture }

function asset(
    ctx: ReturnType<typeof testContext>,
    id: string,
    overrides: Record<string, unknown> = {}
) {
    const publicId = id.replace(/\W/g, "").padEnd(32, "0").slice(0, 32)
    ctx.db.seed("imageAssets", {
        _id: id,
        guildId: "guild-a",
        kind: "panel-banner",
        publicId,
        storageId: `_storage:${id}`,
        contentType: "image/webp",
        width: 1200,
        height: 400,
        bytes: 4096,
        sha256: "a".repeat(64),
        publicUrl: `https://logi.test/api/image-assets/${publicId}.webp`,
        state: "ready",
        createdAt: "2026-10-04T00:00:00.000Z",
        createdBy: actorFixture.subject,
        ...overrides,
    })
}
function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    ctx.db.tables.gameDataConnections = [
        {
            _id: "gameDataConnections:hll",
            guildId: "guild-a",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            enabled: true,
            observation: null,
        },
        {
            _id: "gameDataConnections:wd",
            guildId: "guild-a",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            enabled: true,
            observation: null,
        },
        {
            _id: "gameDataConnections:other",
            guildId: "guild-b",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            enabled: true,
            observation: null,
        },
    ]
    asset(ctx, "imageAssets:banner")
    asset(ctx, "imageAssets:map", {
        kind: "panel-map",
        width: 800,
        height: 800,
    })
    asset(ctx, "imageAssets:foreign", { guildId: "guild-b" })
    asset(ctx, "imageAssets:logo", { kind: "team-logo" })
    asset(ctx, "imageAssets:gone", { state: "deleting" })
    return ctx
}
const rows = (ctx: ReturnType<typeof testContext>, table: string) =>
    ctx.db.tables[table] ?? []
const update = (
    ctx: ReturnType<typeof testContext>,
    patch: unknown,
    extra = {}
) => invoke(graphicsWrites.update, ctx, { ...access, ...extra, patch })

test("only a workspace admin with a live dashboard session reads or writes graphics", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(graphics.get, ctx, { ...access, secret: "wrong" }),
        /Unauthorized/
    )
    await assert.rejects(
        invoke(graphics.get, ctx, { ...access, guildId: "guild-b" }),
        /Forbidden/
    )
    ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
    await assert.rejects(update(ctx, { defaultStyle: "b" }), /Forbidden/)
    assert.equal(ctx.db.tables.discordPanelGraphics, undefined)
})

test("defaults read as style A with every server and no emoji yet", async () => {
    const ctx = setup()
    const view = await invoke(graphics.get, ctx, access)
    assert.equal(view.revision, 0)
    assert.deepEqual(view.settings, {
        defaultStyle: "a",
        servers: [],
        maps: [],
    })
    assert.deepEqual(
        view.servers.map((s: { id: string }) => s.id),
        ["gameDataConnections:hll", "gameDataConnections:wd"]
    )
    assert.equal(view.emoji.faction.ready, 0)
    assert.equal(view.clanAccent, "#e8a33d")
})

test("saving stores verified URLs, keeps references and releases them on removal", async () => {
    const ctx = setup()
    assert.deepEqual(
        await update(ctx, {
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
        }),
        { ok: true, revision: 1 }
    )
    const row = ctx.db.tables.discordPanelGraphics[0]
    assert.equal(
        row.servers[0].bannerUrl,
        "https://logi.test/api/image-assets/imageAssetsbanner000000000000000.webp"
    )
    assert.equal(row.servers[0].barColor, "#2bb3a3")
    assert.equal(row.maps[0].publicId, "imageAssetsmap000000000000000000")
    assert.equal(row.updatedBy, actorFixture.subject)
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((r) => [r.assetId, r.owner]),
        [
            ["imageAssets:banner", "panelGraphics"],
            ["imageAssets:map", "panelGraphics"],
        ]
    )
    const bot = await invoke(graphics.forBot, ctx, {
        secret,
        guildId: "guild-a",
    })
    assert.equal(bot.defaultStyle, "b")
    assert.equal(bot.servers[0].banner.crop, "top")
    assert.equal(JSON.stringify(bot).includes("imageAssets:"), false)
    const view = await invoke(graphics.get, ctx, access)
    assert.equal(view.servers[0].banner.width, 1200)
    assert.equal(view.maps[0].image.url, row.maps[0].url)
    assert.deepEqual(
        await update(ctx, {
            servers: [{ connectionId: "gameDataConnections:hll", reset: true }],
            maps: [
                { game: "hell_let_loose", mapKey: "carentan", assetId: null },
            ],
            expectedRevision: 1,
        }),
        { ok: true, revision: 2 }
    )
    assert.deepEqual(ctx.db.tables.imageAssetReferences, [])
    assert.deepEqual(ctx.db.tables.discordPanelGraphics[0].servers, [])
})

test("foreign, wrong-kind and deleted assets, unknown servers and stale revisions are refused", async () => {
    const ctx = setup()
    const banner = (assetId: string) => ({
        servers: [
            { connectionId: "gameDataConnections:wd", bannerAssetId: assetId },
        ],
    })
    for (const id of [
        "imageAssets:foreign",
        "imageAssets:logo",
        "imageAssets:gone",
        "imageAssets:map",
        "nonsense",
    ])
        assert.deepEqual(
            await update(ctx, banner(id)),
            { error: "asset_unavailable" },
            id
        )
    assert.deepEqual(
        await update(ctx, {
            maps: [
                {
                    game: "wardogs",
                    mapKey: "ozeti",
                    assetId: "imageAssets:banner",
                },
            ],
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(
        await update(ctx, {
            servers: [
                { connectionId: "gameDataConnections:other", crop: "top" },
            ],
        }),
        { error: "unknown_server" }
    )
    await assert.rejects(update(ctx, { defaultStyle: "d" }))
    assert.equal(ctx.db.tables.discordPanelGraphics, undefined)
    await update(ctx, { defaultStyle: "c" })
    assert.deepEqual(
        await update(ctx, { defaultStyle: "b", expectedRevision: 0 }),
        {
            error: "conflict",
        }
    )
    assert.equal(rows(ctx, "discordPanelGraphics")[0]?.defaultStyle, "c")
})

test("the bot reads the projection and reports emoji only with the internal secret", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(graphics.forBot, ctx, { secret: "wrong", guildId: "guild-a" }),
        /Unauthorized/
    )
    assert.equal(
        (await invoke(graphics.forBot, ctx, { secret, guildId: "guild-a" }))
            .defaultStyle,
        "a"
    )
    const report = {
        applicationId: "123456789012345678",
        ready: ["us", "ger", "live"],
        failed: ["axis"],
        checkedAt: 1000,
    }
    await assert.rejects(
        invoke(graphicsWrites.reportEmoji, ctx, { secret: "wrong", report }),
        /Unauthorized/
    )
    await assert.rejects(
        invoke(graphicsWrites.reportEmoji, ctx, {
            secret,
            report: { ...report, applicationId: "x" },
        })
    )
    await invoke(graphicsWrites.reportEmoji, ctx, { secret, report })
    await invoke(graphicsWrites.reportEmoji, ctx, {
        secret,
        report: { ...report, checkedAt: 2000 },
    })
    assert.equal(ctx.db.tables.discordApplicationEmoji.length, 1)
    const view = await invoke(graphics.get, ctx, access)
    assert.deepEqual(view.emoji, {
        faction: { ready: 2, total: 12, complete: false },
        status: { ready: 1, total: 7, complete: false },
        checkedAt: 2000,
    })
})
