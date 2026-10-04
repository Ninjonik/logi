import {
    appendTeamPage,
    appendTeamRequests,
    canCancelTeamRequest,
    fillTeamTemplate,
    TEAM_REQUEST_STATUS_BADGE,
    teamActionLabel,
    teamLinkView,
    teamRequestHeading,
    teamRequestOutcome,
    teamRequestResultIdsToResolve,
    withCancelledTeamRequest,
} from "./team-list"
import {
    TEAM_REQUEST_STATUSES,
    type TeamRequestRecord,
} from "@/domain/teams/team-request"
import type { TeamRecord } from "@/domain/teams/team"
import { getDictionary } from "@/i18n/dictionaries"
import assert from "node:assert/strict"
import test from "node:test"

function team(id: string, name: string) {
    return {
        id,
        gameId: "wardogs",
        name,
        shortCode: null,
        logoUrl: null,
        logoAssetId: null,
        description: null,
        links: [],
        linkedGuildId: null,
        mergedIntoTeamId: null,
        revision: 1,
        updatedAt: "2026-10-01T00:00:00.000Z",
        archivedAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
    } satisfies TeamRecord
}
const names = (items: readonly TeamRecord[]) => items.map((item) => item.name)

function request(
    overrides: Partial<TeamRequestRecord> = {}
): TeamRequestRecord {
    return {
        id: "r1",
        guildId: "910000000000000001",
        workspaceName: "Alpha Clan",
        requestedBy: "123456789",
        kind: "create",
        gameId: "wardogs",
        teamId: null,
        teamName: null,
        proposal: {
            name: "Red Wolves",
            shortCode: null,
            logoAssetId: null,
            logoUrl: null,
            description: null,
            links: [],
        },
        note: null,
        status: "pending",
        reason: null,
        resultTeamId: null,
        decidedAt: null,
        createdAt: "2026-10-04T10:00:00.000Z",
        notification: "none",
        ...overrides,
    }
}

test("further catalogue pages never duplicate rows", () => {
    const list = [team("1", "Alpha"), team("2", "Bravo")]
    assert.deepEqual(
        names(appendTeamPage(list, [team("2", "Bravo"), team("3", "Charlie")])),
        ["Alpha", "Bravo", "Charlie"]
    )
    assert.equal(list.length, 2, "the loaded page is not mutated")
})

test("labels insert values literally, in one pass", () => {
    assert.equal(
        teamActionLabel("Suggest a change to {name}", "Alpha $& Co"),
        "Suggest a change to Alpha $& Co"
    )
    assert.equal(
        teamActionLabel("{name} – {name}", "$` $$ $1"),
        "$` $$ $1 – $` $$ $1"
    )
    assert.equal(
        fillTeamTemplate("{game} · {name}", {
            game: "Wardogs",
            name: "{game}",
        }),
        "Wardogs · {game}",
        "a placeholder inside a value is not expanded"
    )
    assert.equal(
        fillTeamTemplate("Link {index} of {total}", { index: "2" }),
        "Link 2 of {total}"
    )
})

test("only https links without credentials are rendered, with a short label", () => {
    assert.deepEqual(teamLinkView("https://red.example/"), {
        href: "https://red.example/",
        label: "red.example",
    })
    assert.deepEqual(teamLinkView("https://discord.gg/abc/"), {
        href: "https://discord.gg/abc/",
        label: "discord.gg/abc",
    })
    for (const unsafe of [
        "http://red.example",
        "javascript:alert(1)",
        "https://user:pw@red.example",
        "not a url",
    ])
        assert.equal(teamLinkView(unsafe), null, unsafe)
})

test("every status has a badge variant and a label in each locale", () => {
    for (const status of TEAM_REQUEST_STATUSES) {
        assert.ok(TEAM_REQUEST_STATUS_BADGE[status])
        for (const locale of ["en", "cs", "de"] as const)
            assert.ok(
                getDictionary(locale).teamRequests.statuses[status].length > 0
            )
    }
    assert.equal(TEAM_REQUEST_STATUS_BADGE.rejected, "destructive")
    assert.equal(TEAM_REQUEST_STATUS_BADGE.pending, "outline")
})

test("a change request is headed by its target team, a new-team request by its proposal", () => {
    assert.equal(teamRequestHeading(request()), "Red Wolves")
    assert.equal(
        teamRequestHeading(
            request({ kind: "update", teamId: "t1", teamName: "Old Wolves" })
        ),
        "Old Wolves"
    )
    assert.equal(
        teamRequestHeading(request({ kind: "update", teamId: "t1" })),
        "Red Wolves",
        "a target that can no longer be read falls back to the proposal"
    )
})

test("outcomes show the rejection reason or the resulting team", () => {
    assert.equal(teamRequestOutcome(request()), null)
    assert.deepEqual(
        teamRequestOutcome(
            request({ status: "rejected", reason: "Duplicate of Alpha." })
        ),
        { kind: "reason", reason: "Duplicate of Alpha." }
    )
    for (const status of ["approved", "merged"] as const)
        assert.deepEqual(
            teamRequestOutcome(request({ status, resultTeamId: "t9" })),
            { kind: "team", teamId: "t9" }
        )
    assert.equal(teamRequestOutcome(request({ status: "cancelled" })), null)
})

test("only pending requests can be cancelled, and a confirmed cancel updates the row", () => {
    for (const status of TEAM_REQUEST_STATUSES)
        assert.equal(
            canCancelTeamRequest(request({ status })),
            status === "pending"
        )
    const items = [request(), request({ id: "r2", status: "approved" })]
    const next = withCancelledTeamRequest(
        items,
        "r1",
        "2026-10-04T11:00:00.000Z"
    )
    assert.equal(next[0]?.status, "cancelled")
    assert.equal(next[0]?.decidedAt, "2026-10-04T11:00:00.000Z")
    assert.equal(items[0]?.status, "pending", "the loaded list is not mutated")
    assert.deepEqual(
        withCancelledTeamRequest(items, "r2", "2026-10-04T11:00:00.000Z"),
        items,
        "a decided request is never shown as cancelled"
    )
})

test("resulting teams are looked up once, except a change request's own target", () => {
    const items = [
        request({ id: "r1", status: "approved", resultTeamId: "t1" }),
        request({ id: "r2", status: "merged", resultTeamId: "t2" }),
        request({ id: "r3", status: "merged", resultTeamId: "t2" }),
        request({
            id: "r4",
            kind: "update",
            teamId: "t3",
            teamName: "Charlie",
            status: "approved",
            resultTeamId: "t3",
        }),
        request({ id: "r5", status: "rejected", reason: "No." }),
    ]
    assert.deepEqual(teamRequestResultIdsToResolve(items, new Set()), [
        "t1",
        "t2",
    ])
    assert.deepEqual(teamRequestResultIdsToResolve(items, new Set(["t1"])), [
        "t2",
    ])
})

test("further request pages never duplicate rows", () => {
    assert.deepEqual(
        appendTeamRequests(
            [request({ id: "r1" })],
            [request({ id: "r1" }), request({ id: "r2" })]
        ).map((item) => item.id),
        ["r1", "r2"]
    )
})
