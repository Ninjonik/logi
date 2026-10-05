import assert from "node:assert/strict"
import test from "node:test"

import {
    savePanel,
    type PanelRowWrite,
    type PanelSaveStore,
    type SavedPanelSummary,
} from "./save-panel"
import {
    MAX_PANELS_PER_GUILD,
    panelSaveSchema,
} from "@/domain/discord-publications/settings"

const channelId = "123456789012345678"

function store(panels: SavedPanelSummary[] = []) {
    const writes: Array<{ id: string | null; row: PanelRowWrite }> = []
    const value: PanelSaveStore = {
        panels: async () => panels,
        connections: async () => [
            { id: "hll-1", gameId: "hell_let_loose", provider: "hll_crcon" },
            { id: "wd-1", gameId: "wardogs", provider: "wardogs_warcon" },
            {
                id: "other",
                gameId: "hell_let_loose",
                provider: "battlemetrics",
            },
        ],
        reportCategories: async () => ["tickets"],
        competition: async (id) =>
            id === "ecl" ? { id, gameId: "hell_let_loose" } : null,
        write: async (input) => {
            writes.push({ id: input.id, row: input.row })
            return { id: input.id ?? `new-${writes.length}` }
        },
    }
    return { value, writes }
}

const save = (
    fake: ReturnType<typeof store>,
    settings: Record<string, unknown>,
    overrides: Partial<Parameters<typeof savePanel>[1]> = {}
) =>
    savePanel(fake.value, {
        guildId: "g1",
        panelId: null,
        settings: panelSaveSchema.parse({ channelId, ...settings }),
        send: false,
        expectedRevision: null,
        actorId: "100000000000000001",
        now: 5_000,
        ...overrides,
    })

const sent = (
    overrides: Partial<SavedPanelSummary> = {}
): SavedPanelSummary => ({
    id: "p1",
    kind: "server",
    channelId,
    connectionId: "hll-1",
    gameId: "hell_let_loose",
    draft: false,
    removing: false,
    sent: true,
    revision: 10,
    ...overrides,
})

test("a new panel is saved unsent with the 60 s refresh, and no request", async () => {
    const fake = store()
    const result = await save(fake, { kind: "server", connectionId: "hll-1" })
    assert.deepEqual(result, {
        status: "saved",
        id: "new-1",
        revision: 5_000,
        sent: false,
    })
    const row = fake.writes[0]!.row
    assert.equal(row.draft, true)
    assert.equal(row.refreshSeconds, 60)
    assert.equal(row.gameId, "hell_let_loose")
    assert.equal(row.requestedAt, undefined)
})

test("saving with send posts it: not a draft and a publish request", async () => {
    const fake = store()
    await save(fake, { kind: "server", connectionId: "hll-1" }, { send: true })
    const row = fake.writes[0]!.row
    assert.equal(row.draft, false)
    assert.equal(row.requestedAt, 5_000)
    assert.equal(row.requestKind, "publish")
})

test("saving a sent panel edits its message in place on the next pass", async () => {
    const fake = store([sent()])
    const result = await save(
        fake,
        { kind: "server", connectionId: "hll-1", title: "Vlci #1" },
        { panelId: "p1", expectedRevision: 10 }
    )
    assert.equal(result.status, "saved")
    const row = fake.writes[0]!.row
    assert.equal(fake.writes[0]!.id, "p1")
    assert.equal(row.draft, false)
    assert.equal(row.requestKind, "refresh")
    assert.ok(row.revision > 10)
})

test("conflicts, kind changes after sending and removal are refused", async () => {
    const fake = store([sent(), sent({ id: "p2", removing: true })])
    assert.deepEqual(
        await save(
            fake,
            { kind: "server", connectionId: "hll-1" },
            { panelId: "p1", expectedRevision: 9 }
        ),
        { status: "invalid", reason: "conflict" }
    )
    assert.deepEqual(
        await save(
            fake,
            { kind: "results", gameId: "hell_let_loose" },
            { panelId: "p1", expectedRevision: 10 }
        ),
        { status: "invalid", reason: "kind_locked" }
    )
    assert.deepEqual(
        await save(
            fake,
            { kind: "server", connectionId: "hll-1" },
            { panelId: "p2" }
        ),
        { status: "invalid", reason: "removing" }
    )
    assert.deepEqual(
        await save(
            fake,
            { kind: "server", connectionId: "hll-1" },
            { panelId: "missing" }
        ),
        { status: "invalid", reason: "not_found" }
    )
    assert.equal(fake.writes.length, 0)
})

test("one results panel per game, one League and one calendar", async () => {
    const fake = store([
        sent({
            id: "r",
            kind: "results",
            gameId: "hell_let_loose",
            connectionId: null,
        }),
        sent({
            id: "l",
            kind: "league",
            gameId: "wardogs",
            connectionId: null,
        }),
        sent({ id: "c", kind: "calendar", gameId: "any", connectionId: null }),
    ])
    assert.deepEqual(
        await save(fake, { kind: "results", gameId: "hell_let_loose" }),
        { status: "invalid", reason: "results_exists" }
    )
    assert.equal(
        (await save(fake, { kind: "results", gameId: "wardogs" })).status,
        "saved"
    )
    assert.deepEqual(await save(fake, { kind: "league" }), {
        status: "invalid",
        reason: "league_exists",
    })
    assert.deepEqual(await save(fake, { kind: "calendar" }), {
        status: "invalid",
        reason: "calendar_exists",
    })
})

test("sources, report destinations and competitions are checked against the workspace", async () => {
    const fake = store([sent()])
    assert.deepEqual(
        await save(fake, { kind: "server", connectionId: "nope" }),
        { status: "invalid", reason: "source_not_found" }
    )
    assert.deepEqual(
        await save(fake, { kind: "server", connectionId: "hll-1" }),
        { status: "invalid", reason: "duplicate_channel" }
    )
    assert.deepEqual(
        await save(fake, {
            kind: "server",
            connectionId: "other",
            reportCategoryId: "tickets",
        }),
        { status: "invalid", reason: "report_provider" }
    )
    assert.deepEqual(
        await save(fake, {
            kind: "server",
            connectionId: "wd-1",
            reportCategoryId: "elsewhere",
        }),
        { status: "invalid", reason: "report_destination_missing" }
    )
    assert.deepEqual(
        await save(fake, { kind: "competition", competitionId: "x" }),
        { status: "invalid", reason: "competition_not_found" }
    )
    assert.deepEqual(
        await save(fake, {
            kind: "servers",
            connectionIds: ["hll-1", "missing"],
        }),
        { status: "invalid", reason: "source_not_found" }
    )
    const mixed = await save(fake, {
        kind: "servers",
        connectionIds: ["hll-1", "wd-1"],
    })
    assert.equal(mixed.status, "saved")
    assert.equal(fake.writes.at(-1)?.row.gameId, "mixed")
})

test("a workspace has at most twenty panels", async () => {
    const fake = store(
        Array.from({ length: MAX_PANELS_PER_GUILD }, (_, i) =>
            sent({
                id: `p${i}`,
                channelId: `12345678901234${String(i).padStart(4, "0")}`,
            })
        )
    )
    assert.deepEqual(await save(fake, { kind: "calendar" }), {
        status: "invalid",
        reason: "panel_limit",
    })
})

test("an unavailable banner asset is reported, not silently dropped", async () => {
    const fake = store()
    fake.value.write = async () => ({ error: "asset_unavailable" })
    assert.deepEqual(await save(fake, { kind: "calendar" }), {
        status: "invalid",
        reason: "asset_unavailable",
    })
})
