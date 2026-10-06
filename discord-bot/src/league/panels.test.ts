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
} from "../public-panels/panel-runner"
import {
    buildFixturesView,
    buildStandingsView,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    type LeaguePanelOptions,
} from "../../../src/domain/wardogs-league/panels"
import {
    boardLeagueFixtures,
    boardLeagueResults,
} from "../../../src/infrastructure/testing/league-fixtures"
import {
    leagueOptionsOf,
    runLeaguePanels,
    type LeaguePanelData,
} from "./panels"
import { retireLeagueCards, sendLeagueLinkReplies } from "./worker"

const now = Date.parse("2026-10-09T20:00:00.000Z")
const channelId = "123456789012345678"

function panel(overrides: Partial<BotPanel> = {}): BotPanel {
    return {
        _id: "discordPublicPanels:9",
        guildId: "100000000000000099",
        gameId: "wardogs",
        kind: "league",
        channelId,
        enabled: true,
        showPlayers: false,
        artwork: true,
        revision: 4,
        createdAt: now - 86_400_000,
        servers: [],
        status: null,
        ...overrides,
    }
}
const pass: GuildPass = {
    guildId: "100000000000000099",
    language: "cs",
    timeZone: "Europe/Prague",
    clanName: "Vlci",
    clanTag: "VLK",
    siteUrl: "https://logi.app",
    style: null,
    graphics: { defaultStyle: "a", revision: 0, servers: [], mapOverrides: [] },
    seeds: [],
    emoji: {},
    now,
}
function data(options: LeaguePanelOptions, results = boardLeagueResults()) {
    return {
        enabled: true,
        standings: options.table
            ? buildStandingsView(results, {
                  now,
                  ourTeamCodes: ["VLK"],
                  revision: 1,
                  dataAt: now - 60_000,
              })
            : null,
        fixtures:
            options.fixtures || options.recentResults
                ? buildFixturesView(boardLeagueFixtures(now), results, {
                      now,
                      ourTeamCodes: ["VLK"],
                      options,
                      revision: 1,
                      dataAt: now - 60_000,
                  })
                : null,
    } satisfies LeaguePanelData
}
type Published = {
    key: string
    channelId: string | null
    message: MessageCreateOptions
}
function fakes(
    input: {
        bindings?: PublicationBinding[]
        data?: (options: LeaguePanelOptions) => LeaguePanelData
        canAttach?: boolean
        channel?: boolean
    } = {}
) {
    const published: Published[] = []
    let bindings = input.bindings ?? []
    const asked: LeaguePanelOptions[] = []
    const mapAsked: string[] = []
    const ports = {
        publish: async (entry: {
            key: string
            revision: number
            channelId: string | null
            message: MessageCreateOptions
        }) => {
            published.push(entry)
            bindings = [
                ...bindings.filter((binding) => binding.key !== entry.key),
                ...(entry.channelId
                    ? [
                          {
                              key: entry.key,
                              channelId: entry.channelId,
                              messageId: `m-${entry.key}`,
                              hash: null,
                              lastSuccessAt: now,
                          },
                      ]
                    : []),
            ]
            return entry.channelId ? `m-${entry.key}` : null
        },
        bindings: async () => bindings,
        channelAccess: async () =>
            input.channel === false
                ? null
                : { everyoneCanView: true, canAttach: input.canAttach ?? true },
        mapImage: async (_game: string, mapKey: string | null) => {
            mapAsked.push(String(mapKey))
            return {
                name: `mapa-${mapKey}-thumb.webp`,
                bytes: new Uint8Array([1, 2, 3]),
                description: `mapa ${mapKey}`,
            }
        },
        data: async (options: LeaguePanelOptions) => {
            asked.push(options)
            return (input.data ?? data)(options)
        },
    }
    return { ports, published, asked, mapAsked }
}
const text = (message: MessageCreateOptions) =>
    JSON.stringify(
        (message.components as { toJSON(): unknown }[]).map((c) => c.toJSON())
    )

test("the two League messages go out once in order as panel:<id>:standings and :fixtures", async () => {
    const { ports, published, asked, mapAsked } = fakes()
    const result = await runLeaguePanels(panel(), pass, ports)
    assert.deepEqual(asked, [DEFAULT_LEAGUE_PANEL_OPTIONS])
    assert.deepEqual(
        published.map((entry) => [entry.key, entry.channelId]),
        [
            ["panel:discordPublicPanels:9:standings", channelId],
            ["panel:discordPublicPanels:9:fixtures", channelId],
        ]
    )
    assert.match(text(published[0].message), /WD League · tabulka/)
    assert.match(text(published[1].message), /WD League · nejbližší zápasy/)
    // The known map of #38 is the section's thumbnail (P6-24).
    assert.deepEqual(mapAsked, ["zestafona"])
    assert.deepEqual(
        published[1].message.files?.map(
            (file) => (file as { name: string }).name
        ),
        ["mapa-zestafona-thumb.webp"]
    )
    assert.match(
        text(published[1].message),
        /attachment:\/\/mapa-zestafona-thumb\.webp/
    )
    assert.deepEqual(result, {
        messages: 2,
        dataAt: now - 60_000,
        warnings: [],
    })
    // The next pass edits the same two messages in the same order.
    published.length = 0
    await runLeaguePanels(panel(), pass, ports)
    assert.deepEqual(
        published.map((entry) => entry.key),
        [
            "panel:discordPublicPanels:9:standings",
            "panel:discordPublicPanels:9:fixtures",
        ]
    )
})

test("a table created after the fixtures re-posts the fixtures under it (P6-B07)", async () => {
    const { ports, published } = fakes({
        bindings: [
            {
                key: "panel:discordPublicPanels:9:fixtures",
                channelId,
                messageId: "old",
                hash: null,
                lastSuccessAt: now,
            },
        ],
    })
    await runLeaguePanels(panel(), pass, ports)
    assert.deepEqual(
        published.map((entry) => [entry.key, entry.channelId]),
        [
            ["panel:discordPublicPanels:9:fixtures", null],
            ["panel:discordPublicPanels:9:standings", channelId],
            ["panel:discordPublicPanels:9:fixtures", channelId],
        ]
    )
})

test("switched-off content is withdrawn and stored options are read (P2-B15)", async () => {
    const options = {
        table: false,
        fixtures: true,
        recentResults: false,
        fixtureCount: 2,
    }
    const { ports, published, asked } = fakes({
        bindings: [
            {
                key: "panel:discordPublicPanels:9:standings",
                channelId,
                messageId: "old",
                hash: null,
                lastSuccessAt: now,
            },
        ],
    })
    const result = await runLeaguePanels(
        panel({ league: options }),
        pass,
        ports
    )
    assert.deepEqual(asked, [options])
    assert.deepEqual(
        published.map((entry) => [entry.key, entry.channelId]),
        [
            ["panel:discordPublicPanels:9:standings", null],
            ["panel:discordPublicPanels:9:fixtures", channelId],
        ]
    )
    assert.equal(result.messages, 1)
    assert.match(text(published[1].message), /2 nejbližší zápasy/)
    assert.deepEqual(
        leagueOptionsOf(panel({ league: { fixtureCount: 99 } })),
        DEFAULT_LEAGUE_PANEL_OPTIONS
    )
})

test("turning Wardogs League off deletes both messages and reports league_disabled (L3-55)", async () => {
    const { ports, published } = fakes({
        bindings: ["standings", "fixtures"].map((part) => ({
            key: `panel:discordPublicPanels:9:${part}`,
            channelId,
            messageId: part,
            hash: null,
            lastSuccessAt: now,
        })),
        data: () => ({ enabled: false, standings: null, fixtures: null }),
    })
    const result = await runPanel(
        panel(),
        pass,
        { league: (p, g) => runLeaguePanels(p, g, ports) } as PanelRunPorts,
        createPanelRunMemory()
    )
    assert.deepEqual(
        published.map((entry) => [entry.key, entry.channelId]),
        [
            ["panel:discordPublicPanels:9:standings", null],
            ["panel:discordPublicPanels:9:fixtures", null],
        ]
    )
    assert.equal(result?.attempt.ok, false)
    assert.equal(result?.attempt.error?.code, "league_disabled")
})

test("the runner reports the League pass, and a paused panel is drawn once with its chip (L3-54)", async () => {
    const { ports, published } = fakes({ canAttach: false })
    const runnerPorts = {
        league: (p: BotPanel, g: GuildPass) => runLeaguePanels(p, g, ports),
    } as PanelRunPorts
    const live = await runPanel(
        panel(),
        pass,
        runnerPorts,
        createPanelRunMemory()
    )
    assert.equal(live?.attempt.ok, true)
    assert.equal(live?.attempt.messages, 2)
    assert.equal(live?.attempt.nextAt, now + 60_000)
    assert.equal(live?.attempt.dataAt, now - 60_000)
    assert.deepEqual(live?.attempt.warnings, ["attach_files_missing"])
    assert.equal(published[1].message.files, undefined)

    published.length = 0
    const memory = createPanelRunMemory()
    const paused = panel({ paused: true, pausedAt: now - 3600_000 })
    const first = await runPanel(paused, pass, runnerPorts, memory)
    assert.equal(first?.attempt.nextAt, null)
    assert.match(
        text(published[1].message),
        /Pozastaveno\*\* · správce zastavil obnovování/
    )
    assert.equal(await runPanel(paused, pass, runnerPorts, memory), null)
})

test("a missing channel is reported, never a crash", async () => {
    const { ports } = fakes({ channel: false })
    const result = await runPanel(
        panel(),
        pass,
        { league: (p, g) => runLeaguePanels(p, g, ports) } as PanelRunPorts,
        createPanelRunMemory()
    )
    assert.equal(result?.attempt.error?.code, "channel_missing")
})

test("old per-match League cards are deleted once and then left alone", async () => {
    const withdrawn: Array<[string, number]> = []
    let bindings = [
        { key: "league:a", messageId: "1", pending: null },
        { key: "league:b", messageId: null, pending: null },
        { key: "panel:x", messageId: "2", pending: null },
    ]
    const ports = {
        tracking: async () => ({
            settings: { enabled: true, inputChannelId: null },
            records: [
                { id: "a", revision: 5 },
                { id: "b", revision: 6 },
            ],
        }),
        bindings: async () => bindings,
        withdraw: async (key: string, revision: number) => {
            withdrawn.push([key, revision])
            bindings = bindings.map((binding) =>
                binding.key === key ? { ...binding, messageId: null } : binding
            )
        },
    }
    assert.equal(await retireLeagueCards(ports), 1)
    assert.deepEqual(withdrawn, [["league:a", 5]])
    assert.equal(await retireLeagueCards(ports), 0)
})

test("a posted League link is answered once, after the flag is stored (L3-56)", async () => {
    const replies: Array<[string, string, string]> = []
    const marked = new Set<string>()
    const ports = {
        pending: async () => [
            {
                messageId: "200000000000000001",
                channelId: "300000000000000001",
                reply: {
                    matchId: "m41",
                    sourceUrl: "https://wardogsleague.net/matches/m41",
                    fixtureNumber: 41,
                    teamCodes: ["VLK", "MNT", "DEF"],
                    scheduledAt: "2026-10-24T18:00:00.000Z",
                    panelChannelId: channelId,
                    panelMessageUrl: null,
                },
            },
        ],
        context: async () => ({
            language: "cs",
            timeZone: "Europe/Prague",
            messageStyle: null,
        }),
        markReplied: async (messageId: string, matchId: string) => {
            const key = `${messageId}:${matchId}`
            if (marked.has(key)) return false
            marked.add(key)
            return true
        },
        reply: async (
            channel: string,
            message: string,
            payload: MessageCreateOptions
        ) => {
            replies.push([channel, message, text(payload)])
            return true
        },
    }
    assert.equal(await sendLeagueLinkReplies(ports), 1)
    assert.equal(await sendLeagueLinkReplies(ports), 0)
    assert.equal(replies.length, 1)
    assert.equal(replies[0][1], "200000000000000001")
    assert.match(replies[0][2], /NOVÝ ZÁPAS 41/)
    assert.match(
        replies[0][2],
        /Kartu, která se sama obnovuje, najdeš v <#123456789012345678>/
    )
    assert.doesNotMatch(replies[0][2], /Otevřít kartu/)
})
