import assert from "node:assert/strict"
import test from "node:test"

import type { MessageCreateOptions } from "discord.js"

import {
    createPanelRunMemory,
    runPanel,
    type BotPanel,
    type GuildPass,
    type PanelRunPorts,
    type PublicationBinding,
} from "./panel-runner"
import type { ResultEvent } from "../../../src/application/discord-publications/results"
import type { HllServed } from "../../../src/application/game-data/read-hll-live"
import { hllLiveFixture } from "../../../src/infrastructure/testing/hll-live"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { PublicationChannelError } from "../sync/publication"

const now = Date.parse("2026-10-04T00:00:30.000Z")
const channelId = "123456789012345678"

const snapshot = {
    id: "hll-1",
    guildId: "100000000000000099",
    gameId: "hell_let_loose",
    provider: "hll_crcon",
    displayName: "Vlci #1",
    state: "online",
    map: "Utah Beach Warfare",
    players: 2,
    capacity: 100,
    providerInstanceId: null,
    scores: [],
    capabilities: [],
    observedAt: "2026-10-04T00:00:00.000Z",
    lastSuccessAt: "2026-10-04T00:00:00.000Z",
    providerUpdatedAt: null,
    freshness: "fresh",
    attribution: null,
} as unknown as ServerSnapshot

function panel(overrides: Partial<BotPanel> = {}): BotPanel {
    return {
        _id: "discordPublicPanels:1",
        guildId: "100000000000000099",
        gameId: "hell_let_loose",
        kind: "server",
        channelId,
        connectionId: "hll-1",
        title: "Vlci #1 · Public",
        enabled: true,
        showPlayers: true,
        showLeaders: true,
        reportCategoryId: "tickets",
        artwork: false,
        revision: 7,
        createdAt: now - 86_400_000,
        servers: [
            {
                connectionId: "hll-1",
                name: "Vlci #1 · Public",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                snapshot,
                seedPlan: null,
                join: {
                    slug: "vlci-1",
                    address: "203.0.113.24:7777",
                    joinCode: null,
                    hasPassword: true,
                },
            },
        ],
        status: null,
        ...overrides,
    }
}

const pass: GuildPass = {
    guildId: "100000000000000099",
    language: "cs",
    timeZone: "Europe/Prague",
    clanName: "Vlci",
    siteUrl: "https://logi.app",
    style: null,
    graphics: {
        defaultStyle: "b",
        revision: 0,
        servers: [],
        mapOverrides: [],
    },
    seeds: [],
    emoji: {},
    now,
}

type Published = {
    key: string
    revision: number
    channelId: string | null
    message: MessageCreateOptions
}

function fakes(overrides: Partial<PanelRunPorts> = {}) {
    const published: Published[] = []
    const calls = {
        password: 0,
        notified: 0,
        purged: [] as string[],
        calendar: 0,
    }
    let bindings: PublicationBinding[] = []
    const ports: PanelRunPorts = {
        publish: async (input) => {
            published.push(input)
            return input.channelId ? "323456789012345678" : null
        },
        bindings: async () => bindings,
        channelAccess: async () => ({ everyoneCanView: true, canAttach: true }),
        hllLive: async (): Promise<HllServed> => ({
            kind: "ready",
            envelope: {
                connectionId: "hll-1",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                data: hllLiveFixture(),
            },
        }),
        warconLive: async () => ({ kind: "denied" }),
        password: async () => {
            calls.password++
            return "tajne123"
        },
        clanPlayers: async () => [],
        runningMatch: async () => null,
        scoreImage: async () => null,
        bannerImage: async () => null,
        mapImage: async () => null,
        resultsPage: async () => ({ cursor: null, events: [] }),
        competition: async () => null,
        refreshCalendar: async () => {
            calls.calendar++
        },
        purge: async (id) => {
            calls.purged.push(id)
            return true
        },
        notifyPasswordHidden: async () => {
            calls.notified++
        },
        ...overrides,
    }
    return {
        ports,
        published,
        calls,
        setBindings: (value: PublicationBinding[]) => {
            bindings = value
        },
    }
}

type Json = Record<string, unknown>
function nodes(value: unknown): Json[] {
    if (!value || typeof value !== "object") return []
    if (Array.isArray(value)) return value.flatMap(nodes)
    const record = value as Json
    return [record, ...nodes(record.components), ...nodes(record.accessory)]
}
function render(message: MessageCreateOptions) {
    const all = nodes(
        (message.components ?? []).map((component) =>
            "toJSON" in component
                ? (component as { toJSON(): unknown }).toJSON()
                : component
        )
    )
    return {
        text: all
            .map((node) => node.content)
            .filter((content): content is string => typeof content === "string")
            .join("\n"),
        buttons: all.filter((node) => node.type === 2),
    }
}

test("a live panel is posted as one Components V2 message with chip, data and buttons", async () => {
    const fake = fakes()
    const result = await runPanel(
        panel({ requestedAt: now - 1_000 }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.ok(result)
    assert.equal(result.attempt.ok, true)
    assert.equal(result.attempt.handledRequestAt, now - 1_000)
    assert.equal(result.attempt.nextAt, now + 60_000)
    assert.equal(result.attempt.messages, 1)
    assert.equal(fake.published.length, 1)
    const sent = fake.published[0]!
    assert.equal(sent.key, "panel:discordPublicPanels:1")
    assert.equal(sent.revision, 7)
    assert.equal(sent.channelId, channelId)
    const { text, buttons } = render(sent.message)
    assert.match(text, /ŽIVÝ SERVER · HELL LET LOOSE/)
    assert.match(text, /Živě/)
    assert.match(text, /2 \/ 100 hráčů/)
    assert.match(text, /obnovuje se každých 60 s/)
    assert.deepEqual(
        buttons.map((button) => button.label),
        ["Připojit se", "Zobrazit hráče", "Nahlásit hráče"]
    )
    assert.equal(buttons[0]?.url, "https://logi.app/join/vlci-1")
    assert.equal(
        buttons[1]?.custom_id,
        "logi:players:discordPublicPanels:1:7:0:open"
    )
    // A public channel: never the password, and the decrypting action is not even called.
    assert.doesNotMatch(JSON.stringify(sent.message), /tajne123/)
    assert.equal(fake.calls.password, 0)
})

test("a private channel shows the password; turning public removes it and notifies once", async () => {
    let everyone = false
    const fake = fakes({
        channelAccess: async () => ({
            everyoneCanView: everyone,
            canAttach: true,
        }),
    })
    const withPassword = panel({
        content: { password: true },
        reportCategoryId: undefined,
    })
    const memory = createPanelRunMemory()
    const first = await runPanel(withPassword, pass, fake.ports, memory)
    assert.match(render(fake.published[0]!.message).text, /Heslo `tajne123`/)
    assert.match(render(fake.published[0]!.message).text, /KLANOVÝ SERVER/)
    assert.equal(first?.passwordNotified, false)

    everyone = true
    const second = await runPanel(withPassword, pass, fake.ports, memory)
    assert.doesNotMatch(JSON.stringify(fake.published[1]!.message), /tajne123/)
    assert.equal(second?.passwordNotified, true)
    assert.deepEqual(second?.attempt.warnings, [
        "password_hidden_public_channel",
    ])
    assert.equal(fake.calls.notified, 1)

    // Already notified: no second notice, still no password.
    const third = await runPanel(
        {
            ...withPassword,
            status: {
                handledRequestAt: null,
                passwordNotifiedAt: now,
                sentAt: now,
            },
        },
        pass,
        fake.ports,
        memory
    )
    assert.equal(third?.passwordNotified, false)
    assert.equal(fake.calls.notified, 1)
    assert.equal(fake.calls.password, 1)

    // Private again: the notice resets for the next change.
    everyone = false
    const fourth = await runPanel(
        {
            ...withPassword,
            status: {
                handledRequestAt: null,
                passwordNotifiedAt: now,
                sentAt: now,
            },
        },
        pass,
        fake.ports,
        memory
    )
    assert.equal(fourth?.passwordReset, true)
})

test("a failed live read never skips the post: the collected data is shown", async () => {
    const fake = fakes({
        hllLive: async () => {
            throw new Error("CRCON timeout with key=secret")
        },
    })
    const result = await runPanel(
        panel(),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(result?.attempt.ok, true)
    assert.deepEqual(result?.attempt.warnings, ["live_data_unavailable"])
    assert.equal(fake.published.length, 1)
    assert.doesNotMatch(JSON.stringify(result), /key=secret/)
})

test("a paused panel is drawn once with Pozastaveno, then left alone until a request", async () => {
    const fake = fakes()
    const memory = createPanelRunMemory()
    const paused = panel({ paused: true })
    const first = await runPanel(paused, pass, fake.ports, memory)
    assert.equal(first?.attempt.nextAt, null)
    assert.match(render(fake.published[0]!.message).text, /Pozastaveno/)
    assert.equal(await runPanel(paused, pass, fake.ports, memory), null)
    assert.equal(fake.published.length, 1)
    const requested = { ...paused, requestedAt: now }
    assert.ok(await runPanel(requested, pass, fake.ports, memory))
    assert.equal(fake.published.length, 2)
})

test("an unsent panel withdraws its message; a removed panel is purged", async () => {
    const fake = fakes()
    fake.setBindings([
        {
            key: "panel:discordPublicPanels:1",
            channelId,
            messageId: "323456789012345678",
            hash: null,
            lastSuccessAt: now,
        },
        {
            key: "panel:other",
            channelId,
            messageId: "423456789012345678",
            hash: null,
            lastSuccessAt: now,
        },
    ])
    const result = await runPanel(
        panel({ draft: true, requestedAt: now }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(result?.attempt.messages, 0)
    assert.equal(result?.attempt.handledRequestAt, now)
    assert.deepEqual(fake.published, [
        {
            key: "panel:discordPublicPanels:1",
            revision: 7,
            channelId: null,
            message: {},
        },
    ])
    const removed = await runPanel(
        panel({ removing: true }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(removed, null)
    assert.deepEqual(fake.calls.purged, ["discordPublicPanels:1"])
})

test("Discord errors become codes with the missing permission names", async () => {
    const fake = fakes({
        publish: async () => {
            throw new PublicationChannelError("missing_permissions", [
                "EmbedLinks",
                "AttachFiles",
            ])
        },
    })
    const result = await runPanel(
        panel({ requestedAt: now }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(result?.attempt.ok, false)
    assert.deepEqual(result?.attempt.error, {
        code: "missing_permissions",
        at: now,
        permissions: ["embed_links", "attach_files"],
    })
    assert.equal(result?.attempt.handledRequestAt, now)
    assert.equal(result?.attempt.nextAt, now + 30_000)
})

test("a deleted channel and a server that stopped collecting are named", async () => {
    const gone = await runPanel(
        panel(),
        pass,
        fakes({ channelAccess: async () => null }).ports,
        createPanelRunMemory()
    )
    assert.equal(gone?.attempt.error?.code, "channel_missing")
    const idle = panel()
    idle.servers[0] = { ...idle.servers[0]!, snapshot: null }
    const stopped = await runPanel(
        idle,
        pass,
        fakes().ports,
        createPanelRunMemory()
    )
    assert.equal(stopped?.attempt.error?.code, "source_not_collecting")
    const missing = await runPanel(
        panel({ servers: [] }),
        pass,
        fakes().ports,
        createPanelRunMemory()
    )
    assert.equal(missing?.attempt.error?.code, "source_missing")
})

test("Naše servery lists public data only, never a password or players", async () => {
    const fake = fakes()
    const base = panel()
    const result = await runPanel(
        panel({
            kind: "servers",
            connectionId: undefined,
            connectionIds: ["hll-1"],
            title: undefined,
            content: { password: true },
            servers: [base.servers[0]!],
        }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(result?.attempt.ok, true)
    const { text, buttons } = render(fake.published[0]!.message)
    assert.match(text, /NAŠE SERVERY · VLCI/)
    assert.match(text, /Kde se hraje/)
    assert.doesNotMatch(text, /Heslo|Synthetic Allied/)
    assert.equal(fake.calls.password, 0)
    assert.deepEqual(
        buttons.map((button) => button.label),
        ["Připojit se"]
    )
})

test("each Naše servery row shows its map, attached once and only when shown", async () => {
    const fake = fakes({
        mapImage: async () => ({
            name: "mapa-utah-beach-0f1e2d.webp",
            bytes: new Uint8Array([1, 2, 3]),
            description: "Utah Beach",
        }),
    })
    const base = panel({ artwork: true })
    await runPanel(
        panel({
            kind: "servers",
            artwork: true,
            connectionId: undefined,
            connectionIds: ["hll-1"],
            servers: [base.servers[0]!],
        }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    const message = fake.published[0]!.message
    assert.deepEqual(
        (message.files ?? []).map((file) =>
            typeof file === "object" && file && "name" in file
                ? file.name
                : null
        ),
        ["mapa-utah-beach-0f1e2d.webp"]
    )
    assert.match(
        JSON.stringify(
            message.components?.map((c) => ("toJSON" in c ? c.toJSON() : c))
        ),
        /attachment:\/\/mapa-utah-beach-0f1e2d\.webp/
    )
    // Without Attach Files the rows stay text only.
    const plain = fakes({
        channelAccess: async () => ({
            everyoneCanView: true,
            canAttach: false,
        }),
        mapImage: fake.ports.mapImage,
    })
    const outcome = await runPanel(
        panel({
            kind: "servers",
            artwork: true,
            connectionId: undefined,
            connectionIds: ["hll-1"],
            servers: [base.servers[0]!],
        }),
        pass,
        plain.ports,
        createPanelRunMemory()
    )
    assert.equal(plain.published[0]!.message.files, undefined)
    assert.deepEqual(outcome?.attempt.warnings, ["attach_files_missing"])
})

const result = (index: number): ResultEvent => ({
    id: `events:${index}`,
    name: `Zápas ${index}`,
    map: null,
    card: null,
    result: {
        status: "confirmed",
        version: 1,
        reviewedAt: new Date(now - (10 - index) * 3_600_000).toISOString(),
        participants: [
            { label: "Allies", score: index },
            { label: "Axis", score: 1 },
        ],
    },
})

test("a new results panel backfills the last five confirmed results, oldest first", async () => {
    const fake = fakes({
        resultsPage: async () => ({
            cursor: null,
            events: Array.from({ length: 8 }, (_, i) => result(i + 1)),
        }),
    })
    const outcome = await runPanel(
        panel({
            kind: "results",
            connectionId: undefined,
            servers: [],
            createdAt: now,
            requestedAt: now,
        }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(outcome?.attempt.ok, true)
    assert.equal(outcome?.attempt.messages, 5)
    assert.deepEqual(
        fake.published.map((entry) => entry.key),
        [4, 5, 6, 7, 8].map(
            (i) => `panel:discordPublicPanels:1:result:events:${i}`
        )
    )
    assert.match(render(fake.published[0]!.message).text, /Spojenci 4 : 1 Osa/)
})

test("the calendar redraws only on a request; League waits for its renderer", async () => {
    const fake = fakes()
    const calendar = panel({
        kind: "calendar",
        connectionId: undefined,
        servers: [],
    })
    assert.equal(
        await runPanel(calendar, pass, fake.ports, createPanelRunMemory()),
        null
    )
    const requested = await runPanel(
        { ...calendar, requestedAt: now },
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(fake.calls.calendar, 1)
    assert.equal(requested?.attempt.handledRequestAt, now)
    const league = await runPanel(
        panel({ kind: "league", connectionId: undefined, servers: [] }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(league?.attempt.error?.code, "unsupported_kind")
})

test("a competition posts one table per division and withdraws dropped ones", async () => {
    const fake = fakes({
        competition: async () => ({
            slug: "ecl-2026",
            tables: [
                {
                    divisionId: "d1",
                    competition: "ECL 2026",
                    division: "A",
                    gameName: "Hell Let Loose",
                    rows: [],
                    round: null,
                    nextMatch: null,
                    url: null,
                    updatedAt: now,
                },
            ],
        }),
    })
    fake.setBindings([
        {
            key: "panel:discordPublicPanels:1:division:old",
            channelId,
            messageId: "523456789012345678",
            hash: null,
            lastSuccessAt: now,
        },
    ])
    const outcome = await runPanel(
        panel({
            kind: "competition",
            competitionId: "competitions:1",
            connectionId: undefined,
            servers: [],
        }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(outcome?.attempt.messages, 1)
    assert.deepEqual(
        fake.published.map((entry) => [entry.key, entry.channelId]),
        [
            ["panel:discordPublicPanels:1:division:d1", channelId],
            ["panel:discordPublicPanels:1:division:old", null],
        ]
    )
    const { buttons } = render(fake.published[0]!.message)
    assert.equal(buttons[0]?.url, "https://logi.app/cs/competitions/ecl-2026")
})

test("legacy scoreboard rows run as live server panels", async () => {
    const fake = fakes()
    const outcome = await runPanel(
        panel({ kind: "scoreboard" }),
        pass,
        fake.ports,
        createPanelRunMemory()
    )
    assert.equal(outcome?.attempt.ok, true)
    assert.equal(fake.published.length, 1)
})
