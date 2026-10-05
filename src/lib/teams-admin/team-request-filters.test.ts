import assert from "node:assert/strict"
import test from "node:test"

import {
    filterTeamRequests,
    requestClanOptions,
    selectedTeamRequest,
} from "@/lib/teams-admin/team-request-filters"
import type { TeamRequestRecord } from "@/domain/teams/team-request"

function request(
    id: string,
    overrides: Partial<TeamRequestRecord> = {}
): TeamRequestRecord {
    return {
        id,
        guildId: "100000000000000001",
        workspaceName: "Wolves",
        requestedBy: "200000000000000001",
        kind: "create",
        gameId: "hell_let_loose",
        teamId: null,
        teamName: null,
        proposal: {
            name: `Team ${id}`,
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
        createdAt: "2026-10-05T10:00:00.000Z",
        notification: "none",
        ...overrides,
    }
}

const items = [
    request("a"),
    request("b", { gameId: "wardogs" }),
    request("c", { guildId: "100000000000000002", workspaceName: "Bears" }),
]

test("filters by game and clan together", () => {
    assert.deepEqual(
        filterTeamRequests(items, { game: "all", clan: "all" }).map(
            (r) => r.id
        ),
        ["a", "b", "c"]
    )
    assert.deepEqual(
        filterTeamRequests(items, { game: "hell_let_loose", clan: "all" }).map(
            (r) => r.id
        ),
        ["a", "c"]
    )
    assert.deepEqual(
        filterTeamRequests(items, {
            game: "hell_let_loose",
            clan: "100000000000000002",
        }).map((r) => r.id),
        ["c"]
    )
})

test("lists each requesting clan once, by name", () => {
    assert.deepEqual(
        requestClanOptions([
            ...items,
            request("d", { workspaceName: null }),
            request("e", {
                guildId: "100000000000000003",
                workspaceName: null,
            }),
        ]),
        [
            { id: "100000000000000003", name: null },
            { id: "100000000000000002", name: "Bears" },
            { id: "100000000000000001", name: "Wolves" },
        ]
    )
})

test("keeps the chosen request selected while it is listed", () => {
    assert.equal(selectedTeamRequest(items, "b")?.id, "b")
    assert.equal(selectedTeamRequest(items, "gone")?.id, "a")
    assert.equal(selectedTeamRequest([], "a"), null)
})
