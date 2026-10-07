import { reportSubmissionSchema } from "../../domain/player-reports/report"
import { closeTicketThread } from "../../../convex/discordMembership"
import { sourceSchema } from "../../domain/game-data/contracts"
import * as drafts from "../../../convex/playerReportDrafts"
import * as reports from "../../../convex/playerReports"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"
const guildId = "111111111111111111",
    reporterId = "222222222222222222",
    channelId = "333333333333333333",
    parentChannelId = "444444444444444444"
const input = {
    choice: 0,
    manualPlayer: "",
    reason: "Synthetic report for testing only.",
    incident: "now",
    evidence: "https://example.com/evidence",
}
async function fixture(t: TestContext) {
    const source = sourceSchema.parse({
        ref: "hll",
        guildId,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example",
        secretRef: null,
    })
    const previous = process.env.LOGI_GAME_DATA_SOURCES
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    t.after(() => {
        if (previous === undefined) delete process.env.LOGI_GAME_DATA_SOURCES
        else process.env.LOGI_GAME_DATA_SOURCES = previous
    })
    const ctx = testContext(),
        scope = { secret: "dev-internal-auth-secret", guildId, reporterId }
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:hll",
        guildId,
        sourceRef: "hll",
        provider: "hll_crcon",
        gameId: "hell_let_loose",
        sourceFingerprint: JSON.stringify(source),
        generation: 1,
        enabled: true,
    })
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:one",
        guildId,
        channelId,
        connectionId: "gameDataConnections:hll",
        kind: "server",
        enabled: true,
        revision: 1,
        reportCategoryId: "report",
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId,
        ticketSettings: {
            enabled: true,
            ticketParentChannelId: parentChannelId,
            categories: [
                { id: "report", label: "Reports", supportRoleIds: [] },
            ],
        },
    })
    const entry = {
        ...scope,
        panelId: "discordPublicPanels:one",
        revision: 1,
        channelId,
    }
    const observation = {
        map: "Utah Beach",
        serverName: "Synthetic",
        observedAt: new Date().toISOString(),
        players: [
            {
                name: "Synthetic player",
                playerId: "76561198000000001",
                team: "allies",
            },
        ],
    }
    const draftId = await invoke(drafts.createDraft, ctx, {
        ...entry,
        interactionId: "555555555555555555",
        observationJson: JSON.stringify(observation),
    })
    return {
        ctx,
        scope,
        entry,
        draftId,
        submit: () =>
            invoke(drafts.submit, ctx, {
                ...scope,
                draftId,
                submissionJson: JSON.stringify(input),
            }),
    }
}
test("private report submission is durable, deduplicated and closes with the tracked ticket", async (t) => {
    const { ctx, scope, submit } = await fixture(t),
        reportId = await submit()
    assert.equal(await submit(), reportId)
    const claim = await invoke(reports.claim, ctx, { ...scope, reportId })
    assert.equal(claim.canCreate, true)
    assert.equal(
        (await invoke(reports.claim, ctx, { ...scope, reportId })).kind,
        "busy"
    )
    assert.equal(JSON.parse(claim.contextJson).player.provenance, "observed")
    await invoke(reports.bind, ctx, {
        ...scope,
        reportId,
        fence: claim.fence,
        threadId: "666666666666666666",
    })
    const completed = await invoke(reports.complete, ctx, {
        ...scope,
        reportId,
        fence: claim.fence,
        messageId: "777777777777777777",
    })
    assert.equal(completed.ticketNumber, 1)
    assert.equal(ctx.db.tables.ticketThreads.length, 1)
    assert.equal(
        (await invoke(reports.claim, ctx, { ...scope, reportId })).threadId,
        "666666666666666666"
    )
    await invoke(closeTicketThread, ctx, {
        secret: scope.secret,
        threadId: "666666666666666666",
        closedByUserId: reporterId,
        closeReason: "Synthetic test complete",
    })
    assert.equal((await ctx.db.get(reportId))?.state, "closed")
})
for (const change of [
    "revision",
    "destination",
    "roles",
    "source",
    "disabled",
]) {
    test(`report submit rejects a stale ${change} policy`, async (t) => {
        const { ctx, submit } = await fixture(t)
        if (change === "revision")
            await ctx.db.patch("discordPublicPanels:one", { revision: 2 })
        if (change === "disabled")
            await ctx.db.patch("discordPublicPanels:one", { enabled: false })
        if (change === "source")
            await ctx.db.patch("gameDataConnections:hll", {
                sourceFingerprint: "changed",
            })
        const config = (await ctx.db.get("discordConfigs:one"))!
        if (change === "destination")
            config.ticketSettings.ticketParentChannelId = "888888888888888888"
        if (change === "roles")
            config.ticketSettings.categories[0].supportRoleIds = [
                "999999999999999999",
            ]
        await assert.rejects(submit(), /expired|changed/)
        assert.equal(ctx.db.tables.playerReports?.length ?? 0, 0)
    })
}
test("report drafts and intents reject another subject or community", async (t) => {
    const { ctx, scope, draftId, submit } = await fixture(t),
        reportId = await submit()
    for (const wrong of [
        { reporterId: "888888888888888888" },
        { guildId: "888888888888888888" },
    ]) {
        assert.equal(
            await invoke(drafts.draft, ctx, { ...scope, ...wrong, draftId }),
            null
        )
        await assert.rejects(
            invoke(reports.claim, ctx, { ...scope, ...wrong, reportId })
        )
    }
})
test("an expired creation lease permits reconciliation but never another create", async (t) => {
    const { ctx, scope, submit } = await fixture(t),
        reportId = await submit(),
        first = await invoke(reports.claim, ctx, { ...scope, reportId })
    await ctx.db.patch(reportId, { leaseUntil: 0 })
    const recovered = await invoke(reports.claim, ctx, { ...scope, reportId })
    assert.equal(recovered.canCreate, false)
    assert.ok(recovered.fence > first.fence)
    await assert.rejects(
        invoke(reports.bind, ctx, {
            ...scope,
            reportId,
            fence: first.fence,
            threadId: "666666666666666666",
        })
    )
})
test("report observations must be fresh and submissions enforce evidence/text bounds", async (t) => {
    const { ctx, entry } = await fixture(t)
    await assert.rejects(
        invoke(drafts.createDraft, ctx, {
            ...entry,
            interactionId: "555555555555555556",
            observationJson: JSON.stringify({
                map: null,
                serverName: null,
                observedAt: new Date(Date.now() - 61_000).toISOString(),
                players: [{ name: "player", playerId: null, team: null }],
            }),
        }),
        /expired/
    )
    for (const change of [
        { evidence: "javascript:alert(1)" },
        { evidence: "https://user:password@example.com" },
        { reason: "" },
        { choice: -1, manualPlayer: "" },
    ])
        assert.equal(
            reportSubmissionSchema.safeParse({ ...input, ...change }).success,
            false
        )
})
test("manual player identity remains explicitly unverified", async (t) => {
    const { ctx, scope, draftId } = await fixture(t)
    const reportId = await invoke(drafts.submit, ctx, {
        ...scope,
        draftId,
        submissionJson: JSON.stringify({
            ...input,
            choice: -1,
            manualPlayer: "Player who left",
        }),
    })
    const context = JSON.parse(
        (await invoke(reports.claim, ctx, { ...scope, reportId })).contextJson
    )
    assert.equal(context.player.provenance, "manual_unverified")
    assert.equal(context.player.playerId, null)
})

test("report submission enforces cooldown and active-report limits even across different forms", async (t) => {
    const { ctx, scope, entry, draftId, submit } = await fixture(t),
        first = await submit()
    const observation = {
        map: null,
        serverName: null,
        observedAt: null,
        players: [],
    }
    const next = await invoke(drafts.createDraft, ctx, {
        ...entry,
        interactionId: "555555555555555556",
        observationJson: JSON.stringify(observation),
    })
    const send = () =>
        invoke(drafts.submit, ctx, {
            ...scope,
            draftId: next,
            submissionJson: JSON.stringify({
                ...input,
                choice: -1,
                manualPlayer: "Synthetic",
            }),
        })
    await assert.rejects(send(), /one minute/)
    await ctx.db.patch(first, { createdAt: Date.now() - 120_000 })
    for (let i = 0; i < 2; i++)
        ctx.db.seed("playerReports", {
            _id: `playerReports:open-${i}`,
            guildId,
            reporterId,
            draftId: `other-${i}`,
            state: "open",
            createdAt: Date.now() - 180_000,
        })
    await assert.rejects(send(), /Three reports/)
    assert.equal(
        await invoke(drafts.submit, ctx, {
            ...scope,
            draftId,
            submissionJson: JSON.stringify(input),
        }),
        first
    )
})

test("five active report forms is the maximum and delivery stops on revoked policy", async (t) => {
    const { ctx, scope, entry, submit } = await fixture(t)
    const observation = JSON.stringify({
        map: null,
        serverName: null,
        observedAt: null,
        players: [],
    })
    for (let i = 1; i < 5; i++)
        await invoke(drafts.createDraft, ctx, {
            ...entry,
            interactionId: `55555555555555555${i}`,
            observationJson: observation,
        })
    await assert.rejects(
        invoke(drafts.createDraft, ctx, {
            ...entry,
            interactionId: "555555555555555559",
            observationJson: observation,
        }),
        /Too many/
    )
    const reportId = await submit(),
        claim = await invoke(reports.claim, ctx, { ...scope, reportId })
    await ctx.db.patch("discordPublicPanels:one", { enabled: false })
    await assert.rejects(
        invoke(reports.bind, ctx, {
            ...scope,
            reportId,
            fence: claim.fence,
            threadId: "666666666666666666",
        }),
        /changed/
    )
    assert.equal(ctx.db.tables.ticketThreads?.length ?? 0, 0)
})
