import assert from "node:assert/strict"
import test from "node:test"

import {
    commandAccessConfig,
    guildCommandConfigFromStored,
    membershipEnabledAnywhere,
} from "./guild-config"
import { legacyStatsServerDrafts } from "./legacy-stats-servers"

const GUILD = "100000000000000000"

test("the bot's view of a server unions every category's support roles and finds the live score channel", () => {
    const config = guildCommandConfigFromStored({
        config: {
            guildId: GUILD,
            defaultLanguage: "cs",
            timezone: "Europe/Prague",
            dashboardAdminRoleId: "100000000000000001",
            clanRoleId: "100000000000000002",
            announcementsChannelId: "300000000000000003",
            commandSettings: {
                serverStatus: { roleIds: ["100000000000000009"] },
            },
            statsSettings: {
                enabled: false,
                games: { hell_let_loose: true, wardogs: true },
            },
            messageStyle: { accentColor: "#123abc", iconDensity: "rich" },
            ticketSettings: {
                enabled: true,
                submitChannelId: "300000000000000002",
                categories: [
                    { supportRoleIds: ["100000000000000003"] },
                    { supportRoleIds: ["100000000000000004", "not-a-role"] },
                ],
            },
            membershipSettings: { enabled: false, categories: [] },
            gameOverrides: {
                wardogs: {
                    membershipSettings: {
                        enabled: true,
                        categories: [
                            { supportRoleIds: ["100000000000000005"] },
                        ],
                    },
                },
            },
        },
        registration: { requestedAt: 5, registeredAt: 3, signature: "abc" },
        panels: [
            {
                gameId: "wardogs",
                kind: "results",
                channelId: "300000000000000007",
                enabled: true,
            },
            {
                gameId: "wardogs",
                kind: "server",
                channelId: "300000000000000008",
                enabled: false,
            },
            {
                gameId: "wardogs",
                kind: "scoreboard",
                channelId: "300000000000000009",
                enabled: true,
            },
        ],
    })
    assert.equal(config.language, "cs")
    assert.equal(config.timeZone, "Europe/Prague")
    assert.deepEqual(config.ticketSupportRoleIds, [
        "100000000000000003",
        "100000000000000004",
    ])
    assert.equal(config.membershipEnabled, true, "a per-game membership counts")
    assert.deepEqual(config.membershipSupportRoleIds, ["100000000000000005"])
    assert.deepEqual(config.liveScoreChannelIds, {
        wardogs: "300000000000000009",
    })
    assert.deepEqual(config.messageStyle, {
        accentColor: "#123ABC",
        iconDensity: "rich",
    })
    assert.deepEqual(config.registration, {
        requestedAt: 5,
        requestKind: "manual",
        registeredAt: 3,
        signature: "abc",
    })
    const access = commandAccessConfig(config)
    assert.equal(access.settings.stats.enabled, false)
    assert.deepEqual(access.settings["server-status"].roleIds, [
        "100000000000000009",
    ])
})

test("membership counts as on when the base or any game's settings are on (N3-21)", () => {
    assert.equal(membershipEnabledAnywhere({}), false)
    assert.equal(
        membershipEnabledAnywhere({ membershipSettings: { enabled: true } }),
        true
    )
    assert.equal(
        membershipEnabledAnywhere({
            membershipSettings: { enabled: false },
            gameOverrides: {
                wardogs: { membershipSettings: { enabled: true } },
                hell_let_loose: undefined,
            },
        }),
        true
    )
    assert.equal(
        membershipEnabledAnywhere({
            gameOverrides: { wardogs: { clanRoleId: "100000000000000002" } },
        }),
        false
    )
})

test("a pending request carries its kind; an older row without one is manual (M1-B01)", () => {
    const of = (registration: Record<string, unknown> | null) =>
        guildCommandConfigFromStored({
            config: { guildId: GUILD },
            registration,
        }).registration.requestKind
    assert.equal(of({ requestedAt: 5, requestKind: "save" }), "save")
    assert.equal(of({ requestedAt: 5 }), "manual")
    assert.equal(of({ registeredAt: 5 }), null)
    assert.equal(of(null), null)
})

test("unknown language and broken settings fall back safely", () => {
    const config = guildCommandConfigFromStored({
        config: {
            guildId: GUILD,
            defaultLanguage: "xx",
            commandSettings: { help: { audience: 7 } },
            statsSettings: "broken",
        },
    })
    assert.equal(config.language, "en")
    assert.equal(config.timeZone, "UTC")
    assert.equal(config.commandSettings, null)
    assert.equal(config.statsSettings, null)
    assert.equal(commandAccessConfig(config).settings.stats.enabled, true)
})

test("old stats servers become encrypted CRCON game server drafts (N3-B09)", () => {
    const { drafts, skipped } = legacyStatsServerDrafts({
        servers: [
            {
                url: "https://crcon.vlci.cz/api/get_players_history",
                token: "Bearer abcdefgh123",
            },
            { url: "https://crcon.vlci.cz/api/other", token: "abcdefgh123" },
            { url: "http://insecure.test/api", token: "abcdefgh123" },
            { url: "not a url", token: "abcdefgh123" },
            { url: "https://short-key.test/", token: "x" },
        ],
        exceptions: {
            hell_let_loose: {
                playerStatsServers: [
                    {
                        url: "https://second.vlci.cz:8443/api",
                        token: "secret-key-2",
                    },
                ],
            },
            wardogs: {
                playerStatsServers: [
                    { url: "https://wardogs.test/api", token: "secret-key-3" },
                ],
            },
        },
    })
    assert.deepEqual(
        drafts.map((draft) => draft.source),
        [
            {
                displayName: "crcon.vlci.cz",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                origin: "https://crcon.vlci.cz/",
                providerServerId: "1",
            },
            {
                displayName: "second.vlci.cz",
                gameId: "hell_let_loose",
                provider: "hll_crcon",
                origin: "https://second.vlci.cz:8443/",
                providerServerId: "1",
            },
        ]
    )
    assert.equal(
        drafts[0]!.key,
        "abcdefgh123",
        "the Bearer prefix is not part of the key"
    )
    assert.equal(skipped, 4)
})
