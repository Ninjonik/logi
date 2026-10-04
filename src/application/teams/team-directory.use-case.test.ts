import {
    changeTeamLifecycle,
    createTeam,
    updateTeam,
    type TeamDirectoryPorts,
} from "./team-directory.use-case"
import {
    InMemoryTeamDirectory,
    InMemoryTeamLogos,
} from "@/infrastructure/testing/in-memory-team-directory"
import { TEAM_DIRECTORY_LIMIT } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

const scope = {
    guildId: "guild-a",
    actor: "100000000000000001",
    enabledGames: ["hell_let_loose", "wardogs"],
}
function fixture() {
    const repository = new InMemoryTeamDirectory()
    const logos = new InMemoryTeamLogos({
        "asset-a": "guild-a",
        "asset-b": "guild-a",
        "asset-foreign": "guild-b",
    })
    let tick = 0
    const ports: TeamDirectoryPorts = {
        repository,
        logos,
        now: () => `2026-10-04T12:00:0${tick++}.000Z`,
    }
    return { repository, logos, ports }
}
const createInput = {
    gameId: "hell_let_loose",
    name: "  Valkyria ",
    shortCode: "VLK",
    logoAssetId: "asset-a",
    idempotencyKey: "create-valkyria-1",
}

test("create writes the team, its logo reference, audit and upsert, and replays by key", async () => {
    const { repository, logos, ports } = fixture()
    const created = await createTeam(ports, scope, createInput)
    assert.deepEqual(created, {
        ok: true,
        teamId: "team-1",
        revision: 1,
        replayed: false,
    })
    assert.equal(repository.teams[0]?.normalizedName, "valkyria")
    assert.deepEqual(logos.references.get("team-1"), {
        guildId: "guild-a",
        assetIds: ["asset-a"],
    })
    assert.deepEqual(
        repository.audits.map((row) => [row.operation, row.actor]),
        [["create", scope.actor]]
    )
    assert.deepEqual(repository.changes, [
        { id: "team-1", operation: "upsert" },
    ])
    assert.deepEqual(await createTeam(ports, scope, createInput), {
        ok: true,
        teamId: "team-1",
        revision: 1,
        replayed: true,
    })
    assert.deepEqual(
        await createTeam(ports, scope, { ...createInput, name: "Other" }),
        { error: "idempotency_conflict" }
    )
    assert.equal(repository.teams.length, 1)
    assert.equal(repository.changes.length, 1)
})

test("create rejects duplicates with the existing ID, disabled games, foreign logos and a full directory", async () => {
    const { repository, ports } = fixture()
    await createTeam(ports, scope, createInput)
    assert.deepEqual(
        await createTeam(ports, scope, {
            ...createInput,
            name: "VALKYRIA",
            idempotencyKey: "create-valkyria-2",
        }),
        { error: "duplicate_name", existingId: "team-1" }
    )
    assert.deepEqual(
        await createTeam(
            ports,
            { ...scope, enabledGames: ["hell_let_loose"] },
            { ...createInput, gameId: "wardogs", idempotencyKey: "k-wardogs1" }
        ),
        { error: "game_disabled" }
    )
    assert.deepEqual(
        await createTeam(ports, scope, {
            ...createInput,
            name: "Foreign logo",
            logoAssetId: "asset-foreign",
            idempotencyKey: "create-foreign-1",
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(await createTeam(ports, scope, { name: "x" }), {
        error: "invalid_team",
    })
    for (let n = repository.teams.length; n < TEAM_DIRECTORY_LIMIT; n++)
        repository.teams.push({
            ...repository.teams[0]!,
            id: `filler-${n}`,
            normalizedName: `filler ${n}`,
        })
    assert.deepEqual(
        await createTeam(ports, scope, {
            ...createInput,
            name: "One too many",
            idempotencyKey: "create-overflow-1",
        }),
        { error: "limit_reached" }
    )
    // Nothing was written for any rejection.
    assert.equal(repository.audits.length, 1)
    assert.equal(repository.changes.length, 1)
})

test("update checks the revision, uniqueness and a changed logo, then audits and emits", async () => {
    const { repository, logos, ports } = fixture()
    await createTeam(ports, scope, createInput)
    await createTeam(ports, scope, {
        ...createInput,
        name: "Bravo",
        logoAssetId: null,
        idempotencyKey: "create-bravo-0001",
    })
    assert.deepEqual(
        await updateTeam(ports, scope, "team-1", {
            expectedRevision: 1,
            name: "bravo",
        }),
        { error: "duplicate_name", existingId: "team-2" }
    )
    assert.deepEqual(
        await updateTeam(ports, scope, "team-1", {
            expectedRevision: 2,
            shortCode: null,
        }),
        { error: "revision_conflict" }
    )
    assert.deepEqual(
        await updateTeam(ports, scope, "team-1", {
            expectedRevision: 1,
            logoAssetId: "asset-foreign",
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(
        await updateTeam(ports, scope, "missing", {
            expectedRevision: 1,
            name: "Gone",
        }),
        { error: "not_found" }
    )
    assert.deepEqual(
        await updateTeam(ports, { ...scope, guildId: "guild-b" }, "team-1", {
            expectedRevision: 1,
            name: "Hijack",
        }),
        { error: "not_found" }
    )
    assert.deepEqual(
        await updateTeam(ports, scope, "team-1", {
            expectedRevision: 1,
            name: "Valkyria Prime",
            logoAssetId: "asset-b",
        }),
        { ok: true, revision: 2 }
    )
    assert.equal(repository.teams[0]?.normalizedName, "valkyria prime")
    assert.deepEqual(logos.references.get("team-1")?.assetIds, ["asset-b"])
    assert.deepEqual(
        repository.audits.map((row) => row.operation),
        ["create", "create", "update"]
    )
    assert.deepEqual(repository.changes.at(-1), {
        id: "team-1",
        operation: "upsert",
    })
})

test("archive emits a removal, restore an upsert, and both require the current revision", async () => {
    const { repository, ports } = fixture()
    await createTeam(ports, scope, createInput)
    assert.deepEqual(
        await changeTeamLifecycle(
            ports,
            scope,
            "team-1",
            { expectedRevision: 1 },
            "archive"
        ),
        { ok: true, revision: 2 }
    )
    assert.ok(repository.teams[0]?.archivedAt)
    assert.deepEqual(
        await updateTeam(ports, scope, "team-1", {
            expectedRevision: 2,
            name: "Edited",
        }),
        { error: "archived" }
    )
    assert.deepEqual(
        await changeTeamLifecycle(
            ports,
            scope,
            "team-1",
            { expectedRevision: 1 },
            "restore"
        ),
        { error: "revision_conflict" }
    )
    assert.deepEqual(
        await changeTeamLifecycle(
            ports,
            scope,
            "team-1",
            { expectedRevision: 2 },
            "restore"
        ),
        { ok: true, revision: 3 }
    )
    assert.deepEqual(
        await changeTeamLifecycle(
            ports,
            scope,
            "team-1",
            { expectedRevision: 3 },
            "restore"
        ),
        { error: "not_archived" }
    )
    assert.deepEqual(
        repository.changes.map((row) => row.operation),
        ["upsert", "remove", "upsert"]
    )
    assert.deepEqual(
        repository.audits.map((row) => row.operation),
        ["create", "archive", "restore"]
    )
})
