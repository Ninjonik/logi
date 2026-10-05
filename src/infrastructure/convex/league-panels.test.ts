import {
    markLinkReplied,
    pendingLinkReplies,
} from "../../../convex/leagueDiscovery"
import { leagueSnapshotFixture } from "../testing/league-fixtures"
import { status } from "../../../convex/leagueDiscoveryFixtures"
import { forGuild } from "../../../convex/leagueDiscoveryPanels"
import { claimScan } from "../../../convex/leagueDiscoveryQueue"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "100000000000000099"
const panelChannel = "100000000000000002"
const linksChannel = "100000000000000001"
const matchId = "cmuqt8ep605e1lf018w2nlywu"

function settings(
    ctx: ReturnType<typeof testContext>,
    overrides: Record<string, unknown> = {}
) {
    ctx.db.seed("leagueTrackingSettings", {
        _id: "leagueTrackingSettings:1",
        guildId,
        enabled: true,
        teamCodes: ["VLK"],
        inputChannelId: linksChannel,
        outputChannelId: null,
        revision: 1,
        ...overrides,
    })
}
function leaguePanel(
    ctx: ReturnType<typeof testContext>,
    overrides: Record<string, unknown> = {}
) {
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:9",
        guildId,
        gameId: "wardogs",
        kind: "league",
        connectionId: "",
        channelId: panelChannel,
        enabled: true,
        paused: false,
        showPlayers: false,
        artwork: true,
        refreshSeconds: 60,
        revision: 3,
        createdAt: 1,
        ...overrides,
    })
}

test("turning Wardogs League off returns no panel data, so the bot deletes the messages (L3-55)", async () => {
    const ctx = testContext()
    settings(ctx, { enabled: false })
    assert.deepEqual(await invoke(forGuild, ctx, { secret, guildId }), {
        enabled: false,
        standings: null,
        fixtures: null,
    })
    // A workspace that never saved the settings keeps its panel.
    const fresh = testContext()
    const data = await invoke(forGuild, fresh, { secret, guildId })
    assert.equal(data.enabled, true)
    assert.equal(data.standings.state, "waiting_for_results")
})

test("a running WD League panel keeps the shared scan and collection on without tracking", async () => {
    const ctx = testContext()
    assert.deepEqual(await invoke(status, ctx, { secret }), { wanted: false })
    assert.equal(await invoke(claimScan, ctx, {}), null)
    leaguePanel(ctx)
    assert.deepEqual(await invoke(status, ctx, { secret }), { wanted: true })
    assert.ok(await invoke(claimScan, ctx, {}))
    // Paused, unsent or in a workspace that turned the League off: no.
    for (const change of [{ paused: true }, { draft: true }]) {
        const other = testContext()
        leaguePanel(other, change)
        assert.deepEqual(await invoke(status, other, { secret }), {
            wanted: false,
        })
    }
    const off = testContext()
    leaguePanel(off)
    settings(off, { enabled: false })
    assert.deepEqual(await invoke(status, off, { secret }), { wanted: false })
})

function linkContext() {
    const ctx = testContext()
    settings(ctx)
    leaguePanel(ctx)
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:1",
        guildId,
        key: "panel:discordPublicPanels:9:fixtures",
        channelId: panelChannel,
        messageId: "100000000000000003",
        pending: null,
        hash: null,
        revision: 3,
        fence: 0,
        leaseUntil: 0,
        retryAt: 0,
    })
    ctx.db.seed("leagueTrackedMatches", {
        _id: "leagueTrackedMatches:1",
        guildId,
        matchId,
        firstSeenAt: 1,
        revision: 1,
        pinned: false,
        automatic: false,
        tracked: true,
        announce: true,
        ignored: false,
        paused: false,
        discordRefs: [
            { messageId: "200000000000000001", channelId: linksChannel },
        ],
        state: "tracked",
        snapshotJson: JSON.stringify(
            leagueSnapshotFixture({ fetchedAt: new Date().toISOString() })
        ),
        nextRefreshAt: 0,
        leaseUntil: 0,
        fence: 0,
    })
    ctx.db.seed("leagueMessageRefs", {
        _id: "leagueMessageRefs:1",
        _creationTime: Date.now() - 60_000,
        guildId,
        messageId: "200000000000000001",
        channelId: linksChannel,
        matchIds: [matchId],
        version: 1,
        deleted: false,
    })
    return ctx
}

test("a posted link gets one reply with the match and the panel link, then never again (L3-56)", async () => {
    const ctx = linkContext()
    const pending = await invoke(pendingLinkReplies, ctx, { secret, guildId })
    assert.deepEqual(pending, [
        {
            messageId: "200000000000000001",
            channelId: linksChannel,
            reply: {
                matchId,
                sourceUrl: `https://wardogsleague.net/matches/${matchId}`,
                fixtureNumber: 38,
                teamCodes: ["VLK", "ROG", "BAMC"],
                scheduledAt: "2026-10-10T18:30:00.000Z",
                panelChannelId: panelChannel,
                panelMessageUrl: `https://discord.com/channels/${guildId}/${panelChannel}/100000000000000003`,
            },
        },
    ])
    const mark = {
        secret,
        guildId,
        messageId: "200000000000000001",
        matchId,
    }
    assert.equal(await invoke(markLinkReplied, ctx, mark), true)
    assert.equal(await invoke(markLinkReplied, ctx, mark), false)
    assert.deepEqual(
        await invoke(pendingLinkReplies, ctx, { secret, guildId }),
        []
    )
    assert.equal(
        await invoke(markLinkReplied, ctx, { ...mark, matchId: "other" }),
        false
    )
})

test("no reply when the links channel is the panel channel, without a panel, for old posts or before the page is read (L3-57)", async () => {
    const same = linkContext()
    same.db.tables.discordPublicPanels[0].channelId = linksChannel
    assert.deepEqual(
        await invoke(pendingLinkReplies, same, { secret, guildId }),
        []
    )
    const noPanel = linkContext()
    noPanel.db.tables.discordPublicPanels[0].draft = true
    assert.deepEqual(
        await invoke(pendingLinkReplies, noPanel, { secret, guildId }),
        []
    )
    const old = linkContext()
    old.db.tables.leagueMessageRefs[0]._creationTime =
        Date.now() - 2 * 86_400_000
    assert.deepEqual(
        await invoke(pendingLinkReplies, old, { secret, guildId }),
        []
    )
    const unread = linkContext()
    delete unread.db.tables.leagueTrackedMatches[0].snapshotJson
    assert.deepEqual(
        await invoke(pendingLinkReplies, unread, { secret, guildId }),
        []
    )
    const off = linkContext()
    off.db.tables.leagueTrackingSettings[0].enabled = false
    assert.deepEqual(
        await invoke(pendingLinkReplies, off, { secret, guildId }),
        []
    )
    await assert.rejects(
        invoke(pendingLinkReplies, off, { secret: "wrong", guildId }),
        /Unauthorized/
    )
    await assert.rejects(
        invoke(markLinkReplied, off, {
            secret: "wrong",
            guildId,
            messageId: "x",
            matchId,
        }),
        /Unauthorized/
    )
})
