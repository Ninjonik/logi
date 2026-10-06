import assert from "node:assert/strict"
import test from "node:test"

import {
    discordPanelsPatchSchema,
    discordPanelsSettingsSlice,
} from "@/domain/api/discord-panels-settings-slice"
import { DEFAULT_PANEL_CONTENT } from "@/domain/discord-publications/settings"

import {
    discordPanelApiItem,
    discordPanelsApiView,
    dryRunPanelStore,
    prepareDiscordPanelsPatch,
} from "./panel-settings-api"
import type {
    PanelRowWrite,
    PanelSaveStore,
    SavedPanelSummary,
} from "./save-panel"
import type { StoredPanel } from "./panel-overview"

const channelId = "123456789012345678"

function store(panels: SavedPanelSummary[] = []) {
    const writes: Array<{ id: string | null; row: PanelRowWrite }> = []
    const value: PanelSaveStore = {
        panels: async () => panels,
        connections: async () => [
            { id: "hll-1", gameId: "hell_let_loose", provider: "hll_crcon" },
        ],
        reportCategories: async () => ["tickets"],
        competition: async () => null,
        write: async (input) => {
            writes.push({ id: input.id, row: input.row })
            return { id: input.id ?? `new-${writes.length}` }
        },
    }
    return { value, writes }
}
const stored = (
    overrides: Partial<StoredPanel> = {}
): StoredPanel & {
    sent: boolean
} => ({
    id: "p1",
    kind: "server",
    gameId: "hell_let_loose",
    channelId,
    connectionId: "hll-1",
    enabled: true,
    showPlayers: true,
    showLeaders: true,
    artwork: true,
    content: { nextMap: false },
    presentation: {
        accentColor: "#2bb3a3",
        bannerUrl: "https://cdn.example/banner.webp",
        bannerAssetId: "asset-1",
        factionEmoji: { allies: "🇺🇸" },
    },
    revision: 7,
    createdAt: 1,
    sent: true,
    ...overrides,
})
const patch = (panels: unknown[]) => discordPanelsPatchSchema.parse({ panels })

test("GET shows each panel's settings as the editor saves them, without emoji or banner URL", () => {
    const item = discordPanelApiItem(stored())!
    assert.equal(item.kind, "server")
    assert.equal(item.revision, 7)
    assert.equal(item.sent, true)
    assert.equal(item.settings.content.nextMap, false)
    assert.equal(item.settings.content.joinCode, true)
    assert.deepEqual(item.settings.presentation?.factionEmoji, {})
    assert.equal(item.settings.presentation?.bannerAssetId, "asset-1")
    assert.equal(JSON.stringify(item).includes("cdn.example"), false)
    const view = discordPanelsApiView([
        stored(),
        stored({ id: "gone", removing: true }),
        stored({ id: "odd", kind: "something" }),
    ])
    assert.equal(view.refreshSeconds, 60)
    assert.deepEqual(
        view.panels.map((panel) => panel.id),
        ["p1"]
    )
    assert.ok(discordPanelsSettingsSlice.schema.safeParse(view).success)
})

test("PATCH validates every entry before anything is written", async () => {
    const fake = store()
    const refused = await prepareDiscordPanelsPatch(
        {
            real: fake.value,
            dryRun: dryRunPanelStore(fake.value, async () => true),
        },
        {
            guildId: "g1",
            now: 5_000,
            patch: patch([
                { settings: { kind: "league", channelId } },
                { settings: { kind: "league", channelId } },
            ]),
        }
    )
    assert.equal(refused.ok, false)
    if (!refused.ok) {
        assert.equal(refused.error.status, 400)
        assert.match(refused.error.message, /discordPanels\.panels\.1/)
    }
    assert.equal(fake.writes.length, 0)
})

test("an accepted PATCH saves new panels as not sent and edits keep their request flag", async () => {
    const fake = store([
        {
            id: "p1",
            kind: "server",
            channelId,
            connectionId: "hll-1",
            gameId: "hell_let_loose",
            draft: false,
            removing: false,
            sent: true,
            revision: 7,
        },
    ])
    const prepared = await prepareDiscordPanelsPatch(
        {
            real: fake.value,
            dryRun: dryRunPanelStore(fake.value, async () => true),
        },
        {
            guildId: "g1",
            now: 9_000,
            patch: patch([
                {
                    id: "p1",
                    expectedRevision: 7,
                    settings: {
                        kind: "server",
                        channelId,
                        connectionId: "hll-1",
                        content: { ...DEFAULT_PANEL_CONTENT, queue: false },
                    },
                },
                { settings: { kind: "calendar", channelId } },
            ]),
        }
    )
    assert.equal(prepared.ok, true)
    assert.equal(fake.writes.length, 0, "the dry run writes nothing")
    if (prepared.ok) await prepared.commit("api:key-1")
    assert.equal(fake.writes.length, 2)
    assert.equal(fake.writes[0]!.row.content.queue, false)
    // A sent panel is redrawn on the bot's next pass, like "Uložit".
    assert.equal(fake.writes[0]!.row.requestKind, "refresh")
    assert.equal(fake.writes[1]!.row.draft, true)
    assert.equal(fake.writes[1]!.row.savedBy, "api:key-1")
})

test("stale revisions, locked kinds and foreign banners are refused like in the dashboard", async () => {
    const fake = store([
        {
            id: "p1",
            kind: "server",
            channelId,
            connectionId: "hll-1",
            gameId: "hell_let_loose",
            draft: false,
            removing: false,
            sent: true,
            revision: 7,
        },
    ])
    const run = (entry: unknown, banner = true) =>
        prepareDiscordPanelsPatch(
            {
                real: fake.value,
                dryRun: dryRunPanelStore(fake.value, async () => banner),
            },
            { guildId: "g1", now: 9_000, patch: patch([entry]) }
        )
    const stale = await run({
        id: "p1",
        expectedRevision: 6,
        settings: { kind: "server", channelId, connectionId: "hll-1" },
    })
    assert.equal(!stale.ok && stale.error.code, "conflict")
    const locked = await run({
        id: "p1",
        settings: { kind: "calendar", channelId },
    })
    assert.equal(!locked.ok && locked.error.status, 409)
    const banner = await run(
        {
            settings: {
                kind: "server",
                channelId: "223456789012345678",
                connectionId: "hll-1",
                presentation: { bannerAssetId: "foreign" },
            },
        },
        false
    )
    assert.match(!banner.ok ? banner.error.message : "", /bannerAssetId/)
    assert.equal(fake.writes.length, 0)
})

test("the patch schema refuses a panel listed twice and live actions", () => {
    assert.equal(
        discordPanelsPatchSchema.safeParse({
            panels: [
                { id: "p1", settings: { kind: "calendar", channelId } },
                { id: "p1", settings: { kind: "calendar", channelId } },
            ],
        }).success,
        false
    )
    assert.equal(
        discordPanelsPatchSchema.safeParse({
            panels: [
                {
                    id: "p1",
                    send: true,
                    settings: { kind: "calendar", channelId },
                },
            ],
        }).success,
        false
    )
})
