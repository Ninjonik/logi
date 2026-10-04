import {
    InMemoryTeamDirectory,
    InMemoryTeamLogos,
    InMemoryTeamRequestLogos,
    InMemoryTeamRequests,
} from "@/infrastructure/testing/in-memory-team-directory"
import {
    cancelTeamRequest,
    decideTeamRequest,
    submitTeamRequest,
    type TeamRequestPorts,
} from "./team-requests.use-case"
import { TEAM_REQUEST_PENDING_LIMIT } from "@/domain/teams/team-request"
import assert from "node:assert/strict"
import test from "node:test"

const workspace = { guildId: "guild-a", actor: "200000000000000002" }
const admin = { actor: "100000000000000001" }

function fixture() {
    const owned = {
        "logo-a": "guild-a",
        "logo-b": "guild-b",
        "logo-platform": "platform",
    }
    const requests = new InMemoryTeamRequests()
    const requestLogos = new InMemoryTeamRequestLogos(owned)
    const directory = new InMemoryTeamDirectory()
    const logos = new InMemoryTeamLogos({ ...owned })
    let tick = 0
    const ports: TeamRequestPorts = {
        requests,
        requestLogos,
        directory,
        logos,
        now: () => `2026-10-04T12:00:${String(tick++).padStart(2, "0")}.000Z`,
    }
    return { ports, requests, requestLogos, directory, logos }
}
const createRequest = {
    kind: "create",
    gameId: "hell_let_loose",
    proposal: {
        name: "Valkyria",
        shortCode: "VLK",
        logoAssetId: "logo-a",
        description: "Czech HLL clan",
        links: ["https://valkyria.example"],
    },
    note: "Please add us",
    idempotencyKey: "request-key-0001",
}

test("a submission is stored once per key, keeps its logo referenced and respects the pending limit", async () => {
    const { ports, requests, requestLogos } = fixture()
    const first = await submitTeamRequest(ports, workspace, createRequest)
    assert.deepEqual(first, {
        ok: true,
        requestId: "request-1",
        replayed: false,
    })
    assert.deepEqual(await submitTeamRequest(ports, workspace, createRequest), {
        ok: true,
        requestId: "request-1",
        replayed: true,
    })
    assert.deepEqual(
        await submitTeamRequest(ports, workspace, {
            ...createRequest,
            note: "changed",
        }),
        { error: "idempotency_conflict" }
    )
    assert.deepEqual(requestLogos.references.get("request-1"), ["logo-a"])
    assert.deepEqual(
        await submitTeamRequest(ports, workspace, {
            ...createRequest,
            proposal: { ...createRequest.proposal, logoAssetId: "logo-b" },
            idempotencyKey: "request-key-0002",
        }),
        { error: "asset_unavailable" }
    )
    for (let n = 1; n < TEAM_REQUEST_PENDING_LIMIT; n++)
        await submitTeamRequest(ports, workspace, {
            ...createRequest,
            proposal: { ...createRequest.proposal, logoAssetId: null },
            idempotencyKey: `request-fill-${String(n).padStart(4, "0")}`,
        })
    assert.deepEqual(
        await submitTeamRequest(ports, workspace, {
            ...createRequest,
            idempotencyKey: "request-over-0001",
        }),
        { error: "limit_reached" }
    )
    assert.equal(requests.requests.length, TEAM_REQUEST_PENDING_LIMIT)
    assert.deepEqual(await submitTeamRequest(ports, workspace, { kind: "x" }), {
        error: "invalid_request",
    })
})

test("approval with edits creates the team, adopts the requester's logo and queues one DM", async () => {
    const { ports, requests, requestLogos, directory, logos } = fixture()
    await submitTeamRequest(ports, workspace, createRequest)
    const approved = await decideTeamRequest(ports, admin, "request-1", {
        decision: "approve",
        proposal: { ...createRequest.proposal, name: "Valkyria CZ" },
    })
    assert.deepEqual(approved, {
        ok: true,
        status: "approved",
        teamId: "team-1",
    })
    const team = directory.teams[0]!
    assert.equal(team.name, "Valkyria CZ")
    assert.equal(team.logoAssetId, "logo-a")
    assert.equal(logos.owned["logo-a"], "platform")
    assert.deepEqual(logos.references.get("team-1"), ["logo-a"])
    assert.deepEqual(requestLogos.references.get("request-1"), [])
    assert.equal(directory.audits[0]?.operation, "request_approved")
    assert.equal(directory.audits[0]?.requestId, "request-1")
    assert.deepEqual(directory.changes, [{ id: "team-1", operation: "upsert" }])
    const stored = requests.requests[0]!
    assert.equal(stored.status, "approved")
    assert.equal(stored.resultTeamId, "team-1")
    assert.equal(stored.decidedBy, admin.actor)
    assert.equal(stored.notification, "pending")
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "reject",
            reason: "late",
        }),
        { error: "not_pending" }
    )
})

test("approval refuses a name the catalogue already holds and writes nothing", async () => {
    const { ports, requests, directory } = fixture()
    directory.teams.push({
        id: "existing",
        gameId: "hell_let_loose",
        name: "Valkyria",
        shortCode: null,
        logoAssetId: null,
        description: null,
        links: [],
        linkedGuildId: null,
        mergedIntoTeamId: null,
        normalizedName: "valkyria",
        archivedAt: null,
        revision: 1,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    await submitTeamRequest(ports, workspace, createRequest)
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "approve",
        }),
        { error: "duplicate_name", existingId: "existing" }
    )
    assert.equal(requests.requests[0]?.status, "pending")
    assert.equal(directory.teams.length, 1)
    // The administrator can merge the request into that team instead.
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "merge",
            targetTeamId: "existing",
        }),
        { ok: true, status: "merged", teamId: "existing" }
    )
    assert.equal(requests.requests[0]?.resultTeamId, "existing")
    assert.equal(requests.requests[0]?.notification, "pending")
})

test("a change request updates the target at the reviewed revision; reject needs a reason", async () => {
    const { ports, requests, directory } = fixture()
    directory.teams.push({
        id: "team-x",
        gameId: "wardogs",
        name: "Lonestar",
        shortCode: null,
        logoAssetId: null,
        description: null,
        links: [],
        linkedGuildId: null,
        mergedIntoTeamId: null,
        normalizedName: "lonestar",
        archivedAt: null,
        revision: 4,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    const change = {
        kind: "update",
        teamId: "team-x",
        proposal: {
            name: "Lonestar",
            shortCode: "LST",
            logoAssetId: null,
            description: "Updated",
            links: [],
        },
        note: null,
        idempotencyKey: "change-key-0001",
    }
    assert.equal(
        (await submitTeamRequest(ports, workspace, change)).hasOwnProperty(
            "ok"
        ),
        true
    )
    assert.equal(requests.requests[0]?.gameId, "wardogs")
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "approve",
            targetRevision: 3,
        }),
        { error: "revision_conflict" }
    )
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "approve",
            targetRevision: 4,
        }),
        { ok: true, status: "approved", teamId: "team-x" }
    )
    assert.equal(directory.teams[0]?.shortCode, "LST")
    assert.equal(directory.teams[0]?.revision, 5)
    await submitTeamRequest(ports, workspace, {
        ...change,
        idempotencyKey: "change-key-0002",
    })
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-2", {
            decision: "reject",
            reason: "  ",
        }),
        { error: "invalid_decision" }
    )
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-2", {
            decision: "merge",
            targetTeamId: "team-x",
        }),
        { error: "invalid_decision" }
    )
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-2", {
            decision: "reject",
            reason: "No change needed",
        }),
        { ok: true, status: "rejected", teamId: null }
    )
    assert.equal(requests.requests[1]?.reason, "No change needed")
    directory.teams[0]!.archivedAt = "2026-10-04T00:00:00.000Z"
    assert.deepEqual(
        await submitTeamRequest(ports, workspace, {
            ...change,
            idempotencyKey: "change-key-0003",
        }),
        { error: "team_archived" }
    )
})

test("a change request keeps the team's platform logo without taking a workspace reference", async () => {
    const { ports, requestLogos, directory, logos } = fixture()
    directory.teams.push({
        id: "team-y",
        gameId: "hell_let_loose",
        name: "Valkyria",
        shortCode: "VLK",
        logoAssetId: "logo-platform",
        description: null,
        links: [],
        linkedGuildId: null,
        mergedIntoTeamId: null,
        normalizedName: "valkyria",
        archivedAt: null,
        revision: 2,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    const change = {
        kind: "update",
        teamId: "team-y",
        proposal: {
            name: "Valkyria",
            shortCode: "VLK",
            logoAssetId: "logo-platform",
            description: "New description",
            links: [],
        },
        note: null,
        idempotencyKey: "change-key-0101",
    }
    assert.deepEqual(await submitTeamRequest(ports, workspace, change), {
        ok: true,
        requestId: "request-1",
        replayed: false,
    })
    assert.deepEqual(requestLogos.references.get("request-1"), [])
    assert.deepEqual(
        await decideTeamRequest(ports, admin, "request-1", {
            decision: "approve",
            targetRevision: 2,
        }),
        { ok: true, status: "approved", teamId: "team-y" }
    )
    assert.equal(directory.teams[0]?.logoAssetId, "logo-platform")
    assert.equal(directory.teams[0]?.description, "New description")
    assert.deepEqual(logos.references.get("team-y"), ["logo-platform"])
    // Another platform logo is not the team's own and is not a workspace upload.
    logos.owned["logo-other"] = "platform"
    assert.deepEqual(
        await submitTeamRequest(ports, workspace, {
            ...change,
            proposal: { ...change.proposal, logoAssetId: "logo-other" },
            idempotencyKey: "change-key-0102",
        }),
        { error: "asset_unavailable" }
    )
})

test("only the requesting workspace can cancel, only while pending, without a DM", async () => {
    const { ports, requests, requestLogos } = fixture()
    await submitTeamRequest(ports, workspace, createRequest)
    assert.deepEqual(
        await cancelTeamRequest(ports, { guildId: "guild-b" }, "request-1"),
        { error: "not_found" }
    )
    assert.deepEqual(
        await cancelTeamRequest(ports, { guildId: "guild-a" }, "request-1"),
        { ok: true }
    )
    assert.equal(requests.requests[0]?.status, "cancelled")
    assert.equal(requests.requests[0]?.notification, "none")
    assert.deepEqual(requestLogos.references.get("request-1"), [])
    assert.deepEqual(
        await cancelTeamRequest(ports, { guildId: "guild-a" }, "request-1"),
        { error: "not_pending" }
    )
})
