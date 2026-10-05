import assert from "node:assert/strict"
import test from "node:test"

import { clanSettingsOpenApiSchemas } from "../../lib/api/settings-openapi"
import { parseClanSettingsPatch } from "../../domain/api/settings-patch"
import { boardSeedSettings } from "../testing/in-memory-seed"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const GUILD = "guild-a"
const CONNECTION = "gameDataConnections:vlci1"

function setup() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:writer",
        keyHash: "key",
        guildId: GUILD,
    })
    ctx.db.seed("guilds", { _id: "guilds:a", discordId: GUILD, name: "Vlci" })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: GUILD,
        timezone: "Europe/Prague",
    })
    ctx.db.seed("gameDataSources", {
        _id: "gameDataSources:vlci1",
        ref: "vlci1",
        guildId: GUILD,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example",
        secretRef: null,
        allowedAddresses: [],
        credentialMode: "encrypted",
        displayName: "Vlci #1 · Public",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        updatedBy: "100000000000000001",
    })
    ctx.db.seed("gameDataConnections", {
        _id: CONNECTION,
        sourceRef: "vlci1",
        guildId: GUILD,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        enabled: true,
        errorCategory: null,
        observation: {
            observedAt: new Date().toISOString(),
            providerUpdatedAt: null,
            displayName: "[CZ] Vlci #1 | Public",
            state: "online",
            map: "Foy",
            players: 12,
            capacity: 64,
            providerInstanceId: null,
            scores: [],
            capabilities: [],
        },
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
        idempotencyKey: `seed-${++request}`,
        bodyHash: `body-${request}`,
        methodPath: "PATCH /clan/settings",
        ...body,
    })
const settings = boardSeedSettings({ cooldownMinutes: 90 })

test("GET lists every game server with its plan or the defaults", async () => {
    const ctx = setup()
    const read = await invoke(publicApi.getClanSettings, ctx, {
        secret,
        keyHash: "key",
    })
    assert.deepEqual(read.slices.seed.servers, [
        {
            connectionId: CONNECTION,
            gameId: "hell_let_loose",
            name: "Vlci #1 · Public",
            configured: false,
            revision: null,
            settings: read.slices.seed.servers[0].settings,
        },
    ])
    assert.equal(read.slices.seed.servers[0].settings.liveFrom, 40)
    assert.equal(read.slices.seed.servers[0].settings.enabled, false)
})

test("PATCH saves a plan through the dashboard's use-case, then changes one field", async () => {
    const ctx = setup()
    const first = await patch(ctx, {
        slices: {
            seed: {
                servers: [
                    {
                        connectionId: CONNECTION,
                        expectedRevision: null,
                        settings,
                    },
                ],
            },
        },
    })
    assert.equal(first.status, 200, first.body)
    const view = JSON.parse(first.body).data.slices.seed.servers[0]
    assert.equal(view.revision, 1)
    assert.equal(view.configured, true)
    assert.deepEqual(view.settings, settings)
    assert.equal(
        ctx.db.tables.discordSeedPlans[0]!.updatedBy,
        "api:apiKeys:writer"
    )
    // The control message and the intro are queued like a dashboard save.
    assert.deepEqual(
        ctx.db.tables.discordSeedMessages.map((row) => row.kind).sort(),
        ["control", "intro"]
    )
    const second = await patch(ctx, {
        slices: {
            seed: {
                servers: [
                    {
                        connectionId: CONNECTION,
                        expectedRevision: 1,
                        settings: { liveFrom: 50 },
                    },
                ],
            },
        },
    })
    assert.equal(second.status, 200, second.body)
    const after = JSON.parse(second.body).data.slices.seed.servers[0]
    assert.equal(after.revision, 2)
    assert.equal(after.settings.liveFrom, 50)
    assert.equal(after.settings.cooldownMinutes, 90, "other fields stay")
})

test("refusals write nothing: stale revision, broken rules, unknown server", async () => {
    const ctx = setup()
    const refused = async (body: Record<string, unknown>, status: number) => {
        const result = await patch(ctx, { timezone: "UTC", ...body })
        assert.equal(result.status, status, result.body)
        assert.equal(ctx.db.tables.discordSeedPlans?.length ?? 0, 0)
        assert.equal(ctx.db.tables.discordConfigs[0]!.timezone, "Europe/Prague")
        return JSON.parse(result.body).error.message as string
    }
    const seed = (entry: Record<string, unknown>) => ({
        slices: { seed: { servers: [entry] } },
    })
    assert.match(
        await refused(
            seed({
                connectionId: CONNECTION,
                expectedRevision: 3,
                settings: {},
            }),
            409
        ),
        /expectedRevision/
    )
    assert.match(
        await refused(
            seed({ connectionId: CONNECTION, settings: { startBelow: 45 } }),
            400
        ),
        /seed\.servers\.0\.settings\.startBelow: start_below_not_under_live/
    )
    assert.match(
        await refused(
            seed({ connectionId: CONNECTION, settings: { liveFrom: 80 } }),
            400
        ),
        /live_above_capacity/,
        "a 64-player server cannot go live at 80"
    )
    assert.match(
        await refused(
            seed({
                connectionId: "gameDataConnections:other",
                settings: {},
            }),
            400
        ),
        /unknown game server/
    )
})

test("the seed slice is parsed by the route and documented in OpenAPI", () => {
    const parsed = parseClanSettingsPatch({
        seed: { servers: [{ connectionId: CONNECTION, settings: {} }] },
    })
    assert.equal(parsed.ok, true)
    assert.equal(
        parseClanSettingsPatch({
            seed: { servers: [{ connectionId: CONNECTION, action: "start" }] },
        }).ok,
        false,
        "no live action through the API"
    )
    const schemas = clanSettingsOpenApiSchemas()
    assert.ok("ClanSettingsSeedSlice" in schemas)
    assert.ok("ClanSettingsSeedPatch" in schemas)
})
