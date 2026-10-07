import {
    claimDue,
    finishRead,
    enqueueIndex,
    pruneReferences,
} from "../../../convex/leagueDiscoveryQueue"
import {
    configure,
    manage,
    ingestMessage,
    forGuild,
} from "../../../convex/leagueDiscovery"
import { claim as claimPublication } from "../../../convex/discordPublications"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { parseMatchHtml } from "../wardogs-league/parse-match"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const channelId = "100000000000000002"
const sourceUrl = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const matchId = sourceUrl.split("/").pop()!
const access = { secret, guildId, actor: actorFixture }
const settings = {
    enabled: true,
    teamCodes: ["VLK"],
    inputChannelId: channelId,
    outputChannelId: channelId,
}
const verifiedChannels = [{ id: channelId, guildId, type: 0, canPublish: true }]
const snapshot = {
    ...parseMatchHtml(
        readFileSync(
            new URL(
                "../wardogs-league/fixtures/scheduled.html",
                import.meta.url
            ),
            "utf8"
        ),
        sourceUrl
    ),
    fetchedAt: new Date().toISOString(),
    scheduledAt: new Date(Date.now() + 86400_000).toISOString(),
}
async function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    await invoke(configure, ctx, { ...access, settings, verifiedChannels })
    return ctx
}
async function finish(
    ctx: ReturnType<typeof testContext>,
    job: { id: string; fence: number; settingsRevision: number },
    data = snapshot
) {
    return invoke(finishRead, ctx, {
        id: job.id,
        fence: job.fence,
        settingsRevision: job.settingsRevision,
        readJson: JSON.stringify({
            snapshot: data,
            stale: false,
            ageSeconds: 0,
            error: null,
            lastAttemptAt: data.fetchedAt,
            nextRefreshAt: new Date(Date.now() + 300_000).toISOString(),
        }),
    })
}
async function enqueue(ctx: ReturnType<typeof testContext>) {
    await invoke(enqueueIndex, ctx, {
        guildId,
        revision: ctx.db.tables.leagueTrackingSettings[0].revision,
        indexAt: Date.now(),
        urls: [sourceUrl],
        fixtureUrls: [sourceUrl],
        complete: true,
    })
}
test("manual registration and scanner resolve to the same durable identity", async () => {
    const ctx = await setup()
    await enqueue(ctx)
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    assert.equal(ctx.db.tables.leagueTrackedMatches.length, 1)
    await finish(ctx, await invoke(claimDue, ctx))
    const record = ctx.db.tables.leagueTrackedMatches[0]
    assert.equal(record.matchId, matchId)
    assert.equal(record.pinned, true)
    assert.equal(record.automatic, true)
    assert.equal(record.tracked, true)
})

test("resuming a stored fixture restores its readable snapshot while a fresh read waits in the queue", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    await finish(ctx, await invoke(claimDue, ctx))
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "ignore" })
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "resume" })
    const data = await invoke(forGuild, ctx, { secret, guildId })
    assert.equal(data.records[0]?.fixture?.id, matchId)
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].state, "pending")
})
test("settings change fences pending reads and rejects old publication snapshots", async () => {
    const ctx = await setup()
    await enqueue(ctx)
    const oldJob = await invoke(claimDue, ctx)
    await invoke(configure, ctx, {
        ...access,
        settings: { ...settings, teamCodes: ["OTHER"] },
        verifiedChannels,
    })
    await finish(ctx, oldJob)
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].snapshotJson, undefined)
    await finish(ctx, await invoke(claimDue, ctx))
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].tracked, false)
    assert.equal(
        await invoke(claimPublication, ctx, {
            secret,
            guildId,
            key: `league:${oldJob.id}`,
            revision: oldJob.settingsRevision,
        }),
        null
    )
})
test("deleting a human reference preserves pin and automatic reasons; delayed edits cannot resurrect it", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    await finish(ctx, await invoke(claimDue, ctx))
    const args = {
        secret,
        guildId,
        channelId,
        messageId: "100000000000000003",
        human: true,
    }
    await invoke(ingestMessage, ctx, {
        ...args,
        urls: [sourceUrl],
        version: 1,
        deleted: false,
    })
    await invoke(ingestMessage, ctx, {
        ...args,
        urls: [],
        version: 2,
        deleted: true,
    })
    await invoke(ingestMessage, ctx, {
        ...args,
        urls: [sourceUrl],
        version: 1,
        deleted: false,
    })
    const row = ctx.db.tables.leagueTrackedMatches[0]
    assert.equal(row.discordRefs.length, 0)
    assert.equal(row.tracked, true)
    assert.equal(row.pinned, true)
    assert.equal(row.automatic, true)
    assert.equal(ctx.db.tables.leagueMessageRefs[0].deleted, true)
})
test("a posted link's reference expires 14 days after the post, edits included, and the minute prune removes it", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    await finish(ctx, await invoke(claimDue, ctx))
    const args = {
        secret,
        guildId,
        channelId,
        messageId: "100000000000000004",
        human: true,
        deleted: false,
    }
    const before = Date.now()
    await invoke(ingestMessage, ctx, { ...args, urls: [sourceUrl], version: 1 })
    const ref = ctx.db.tables.leagueMessageRefs[0]
    const day = 86400_000
    assert.ok(ref.expiresAt >= before + 14 * day)
    assert.ok(ref.expiresAt <= Date.now() + 14 * day)
    // An edit that keeps the link keeps the expiry of the post.
    ref._creationTime = Date.now() - 15 * day
    await invoke(ingestMessage, ctx, { ...args, urls: [sourceUrl], version: 2 })
    assert.equal(ref.expiresAt, ref._creationTime + 14 * day)
    await invoke(pruneReferences, ctx)
    assert.deepEqual(ctx.db.tables.leagueMessageRefs, [])
})
test("native event binding is same-guild, Wardogs match-only and one-to-one", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    const event = {
        _id: "events:valid",
        guildId: "guilds:admin",
        gameId: "wardogs",
        kind: "match",
    }
    ctx.db.seed("events", event)
    const link = (eventId: string, url = sourceUrl) =>
        invoke(manage, ctx, {
            ...access,
            sourceUrl: url,
            operation: "link",
            eventId,
        })
    await link(event._id)
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, event._id)
    for (const [id, patch] of [
        ["foreign", { guildId: "guilds:foreign" }],
        ["hll", { gameId: "hell_let_loose" }],
        ["training", { kind: "training" }],
    ] as const) {
        ctx.db.seed("events", { ...event, ...patch, _id: `events:${id}` })
        await assert.rejects(link(`events:${id}`), /not available/)
    }
    const second =
        "https://wardogsleague.net/matches/canotherfixture000000000000"
    await invoke(manage, ctx, {
        ...access,
        sourceUrl: second,
        operation: "add",
    })
    await assert.rejects(link(event._id, second), /already linked/)
    await link("")
    await link(event._id, second)
    assert.equal(ctx.db.tables.leagueTrackedMatches[1].eventId, event._id)
})
test("dashboard revocation prevents tracking changes and foreign guild publication claims", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    await finish(ctx, await invoke(claimDue, ctx))
    const data = await invoke(forGuild, ctx, { secret, guildId })
    assert.equal(
        await invoke(claimPublication, ctx, {
            secret,
            guildId: "foreign",
            key: `league:${data.records[0].id}`,
            revision: data.records[0].revision,
        }),
        null
    )
    ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
    await assert.rejects(
        invoke(configure, ctx, { ...access, settings, verifiedChannels }),
        /Forbidden/
    )
    await assert.rejects(
        invoke(manage, ctx, { ...access, sourceUrl, operation: "ignore" }),
        /Forbidden/
    )
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].tracked, true)
})

test("bounded human-link bursts cannot consume discovery and administrator capacity", async (t) => {
    const now = Date.now()
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = await setup()
    for (let at = 0; at < 500; at += 3) {
        if (at && at % 60 === 0) t.mock.timers.tick(60_001)
        await invoke(ingestMessage, ctx, {
            secret,
            guildId,
            channelId,
            human: true,
            deleted: false,
            messageId: String(BigInt("100000000000000003") + BigInt(at)),
            version: Date.now(),
            urls: Array.from(
                { length: Math.min(3, 500 - at) },
                (_, i) =>
                    `https://wardogsleague.net/matches/candidate-${at + i}`
            ),
        })
    }
    await enqueue(ctx)
    assert.ok(
        ctx.db.tables.leagueTrackedMatches.some(
            (row) => row.matchId === matchId
        ),
        "automatic discovery must retain admission capacity after untrusted intake"
    )
    const manual = "https://wardogsleague.net/matches/admin-addition"
    await invoke(manage, ctx, {
        ...access,
        sourceUrl: manual,
        operation: "add",
    })
    assert.ok(
        ctx.db.tables.leagueTrackedMatches.some(
            (row) => row.matchId === "admin-addition" && row.pinned
        )
    )
})

test("full discovery reclaims only disposable candidates, preserving leases, references and publication recovery", async () => {
    const ctx = await setup()
    for (let at = 0; at < 450; at++)
        ctx.db.seed("leagueTrackedMatches", {
            _id: `leagueTrackedMatches:old-${at}`,
            guildId,
            matchId: `old-${at}`,
            firstSeenAt: Date.now() - 86400_000,
            revision: 1,
            pinned: false,
            ignored: false,
            paused: false,
            automatic: false,
            tracked: false,
            announce: false,
            discordRefs: [],
            state: "unmatched",
            nextRefreshAt: 0,
            leaseUntil: 0,
            fence: 0,
        })
    const rows = ctx.db.tables.leagueTrackedMatches
    rows[0].pinned = true
    rows[1].ignored = true
    rows[2].paused = true
    rows[3].eventId = "events:kept"
    rows[4].discordRefs = [{ channelId, messageId: "100000000000000009" }]
    rows[5].leaseUntil = Date.now() + 60_000
    rows[6].tracked = true
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:pending",
        guildId,
        key: "league:leagueTrackedMatches:old-7",
        messageId: null,
        pending: { marker: "kept", channelId },
    })
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:sent",
        guildId,
        key: "league:leagueTrackedMatches:old-8",
        messageId: "100000000000000010",
        pending: null,
    })
    await enqueue(ctx)
    assert.ok(
        ctx.db.tables.leagueTrackedMatches.some(
            (row) => row.matchId === matchId
        )
    )
    assert.equal(ctx.db.tables.leagueTrackedMatches.length, 450)
    for (let at = 0; at < 9; at++)
        assert.ok(
            ctx.db.tables.leagueTrackedMatches.some(
                (row) => row.matchId === `old-${at}`
            )
        )
})

test("human references cannot protect unlimited existing scanner candidates or reset their quota by editing", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
    const ctx = await setup()
    for (let i = 0; i < 90; i++) {
        const url = `https://wardogsleague.net/matches/existing-${i}`
        await invoke(enqueueIndex, ctx, {
            guildId,
            revision: ctx.db.tables.leagueTrackingSettings[0].revision,
            indexAt: Date.now(),
            urls: [url],
            fixtureUrls: [url],
            complete: true,
        })
        const args = {
            secret,
            guildId,
            channelId,
            human: true,
            messageId: String(BigInt("100000000000000003") + BigInt(i)),
            version: Date.now(),
            deleted: false,
        }
        await invoke(ingestMessage, ctx, { ...args, urls: [url] })
        // Editing earlier links away must not open unlimited durable reservations.
        if (i < 50)
            await invoke(ingestMessage, ctx, {
                ...args,
                version: Date.now() + 1,
                urls: [],
            })
        if (i % 10 === 9) t.mock.timers.tick(60_001)
    }
    assert.equal(
        ctx.db.tables.leagueTrackedMatches
            .slice(50)
            .filter((row) => row.discordRefs.length > 0).length,
        0
    )
    assert.equal(
        ctx.db.tables.leagueTrackedMatches.filter((row) => row.intakeReserved)
            .length,
        50
    )
})

for (const disabled of [true, false])
    test(`existing references can be removed after ${disabled ? "disabling" : "moving"} intake without admitting new links`, async () => {
        const ctx = await setup()
        const args = {
            secret,
            guildId,
            channelId,
            human: true,
            messageId: "100000000000000003",
            version: 1,
            deleted: false,
        }
        await invoke(ingestMessage, ctx, { ...args, urls: [sourceUrl] })
        const otherChannel = "100000000000000009"
        await invoke(configure, ctx, {
            ...access,
            settings: {
                ...settings,
                enabled: !disabled,
                inputChannelId: disabled ? channelId : otherChannel,
            },
            verifiedChannels: [
                ...verifiedChannels,
                { id: otherChannel, guildId, type: 0, canPublish: true },
            ],
        })
        await invoke(ingestMessage, ctx, {
            ...args,
            version: 2,
            urls: ["https://wardogsleague.net/matches/should-not-be-added"],
        })
        assert.equal(ctx.db.tables.leagueTrackedMatches.length, 1)
        assert.equal(
            ctx.db.tables.leagueTrackedMatches[0].discordRefs.length,
            0
        )
        assert.equal(ctx.db.tables.leagueMessageRefs[0].matchIds.length, 0)
        await invoke(ingestMessage, ctx, {
            ...args,
            version: 3,
            urls: [],
            deleted: true,
        })
        assert.equal(ctx.db.tables.leagueMessageRefs[0].deleted, true)
    })

test("explicitly refreshing an archived unresolved match attempts one read without extending the archive horizon", async () => {
    const ctx = await setup()
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "add" })
    const row = ctx.db.tables.leagueTrackedMatches[0]
    row.firstSeenAt = Date.now() - 15 * 86400_000
    row.state = "archived"
    await invoke(manage, ctx, { ...access, sourceUrl, operation: "resume" })
    const job = await invoke(claimDue, ctx)
    assert.ok(job)
    await finish(ctx, job, {
        ...snapshot,
        scheduledAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
    })
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].state, "archived")
    assert.equal(await invoke(claimDue, ctx), null)
})
