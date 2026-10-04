import {
    clanResultSummarySchema,
    projectResultSummary,
    resultSummaryPayload,
} from "./result-summaries"
import { createResultRevision } from "../match-results/result-revision"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
test("result summary is closed, nullable, N-participant and excludes player and reviewer identities", () => {
    const event = {
        _id: "event",
        guildId: "guild",
        gameId: "wardogs" as const,
        name: "Three factions",
    }
    assert.equal(projectResultSummary(event).result, null)
    const revision = createResultRevision({
        previous: null,
        expectedRevision: 0,
        action: "stage",
        actor: { id: "staff", kind: "session" },
        now: "2026-09-29T10:00:00Z",
        draft: {
            origin: "manual",
            sessionLinks: [],
            players: [
                {
                    platform: "steam",
                    platformId: "76561198000000001",
                    logiUserId: "private-user",
                    method: "steam_openid",
                    verifiedAt: 1,
                },
            ],
            participants: [
                { id: "a", label: "A", score: 0 },
                { id: "b", label: "B", score: null },
                { id: "c", label: "C", score: 5 },
            ],
        },
    })
    const summary = projectResultSummary({
        ...event,
        reviewedResultGameId: "wardogs",
        reviewedResult: resultSummaryPayload(revision),
    })
    assert.equal(summary.result?.participants.length, 3)
    assert.equal(summary.result?.participants[1].score, null)
    assert.deepEqual(summary.result?.attribution, {
        verified: 1,
        unresolved: 0,
    })
    for (const privateValue of [
        "76561198000000001",
        "private-user",
        "staff",
        "reviewerId",
        "sourceDigest",
    ])
        assert.equal(JSON.stringify(summary).includes(privateValue), false)
    assert.equal(
        projectResultSummary({
            ...event,
            reviewedResultGameId: "hell_let_loose",
            reviewedResult: resultSummaryPayload(revision),
        }).result,
        null
    )
})

test("versioned consumer fixtures preserve result lifecycle, nullable scores and multiple factions", () => {
    for (const name of [
        "unknown",
        "provisional",
        "confirmed",
        "corrected",
        "wardogs-factions",
    ]) {
        const value = JSON.parse(
            readFileSync(
                new URL(
                    `../../../docs/integrations/website/v0.10/fixtures/${name}.json`,
                    import.meta.url
                ),
                "utf8"
            )
        )
        const summary = clanResultSummarySchema.parse(value.data)
        assert.equal(
            summary.resultState,
            name === "wardogs-factions" ? "provisional" : name
        )
        if (name === "unknown") assert.equal(summary.result, null)
        else if (name !== "corrected") {
            assert.equal(summary.result!.participants[0].score, 0)
            assert.equal(summary.result!.participants[1].score, null)
        }
        if (name === "wardogs-factions")
            assert.equal(summary.result!.participants.length, 3)
        assert.equal(
            clanResultSummarySchema.safeParse({
                ...summary,
                reviewerId: "private",
            }).success,
            false
        )
    }
})
