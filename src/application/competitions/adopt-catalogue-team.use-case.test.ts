import { InMemoryTeamDirectory } from "@/infrastructure/testing/in-memory-team-directory"
import { adoptCatalogueTeam } from "./adopt-catalogue-team.use-case"
import { TEAM_DIRECTORY_LIMIT } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

const actor = "system:test"
const snowflake = "123456789012345678"
function fixture() {
    const repository = new InMemoryTeamDirectory()
    let tick = 0
    return {
        repository,
        ports: {
            repository,
            now: () => `2026-10-04T12:00:0${tick++}.000Z`,
        },
    }
}

test("creates a catalogue team once per normalized name and game", async () => {
    const { repository, ports } = fixture()
    const first = await adoptCatalogueTeam(ports, actor, {
        gameId: "hell_let_loose",
        name: " Valkyria ",
        linkedGuildId: null,
    })
    assert.deepEqual(first, {
        ok: true,
        teamId: "team-1",
        created: true,
        linked: false,
    })
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: "VALKYRIA",
            linkedGuildId: null,
        }),
        { ok: true, teamId: "team-1", created: false, linked: false }
    )
    // The same name in another game is another team.
    const wardogs = await adoptCatalogueTeam(ports, actor, {
        gameId: "wardogs",
        name: "Valkyria",
        linkedGuildId: null,
    })
    assert.equal("ok" in wardogs && wardogs.teamId, "team-2")
    assert.equal(repository.teams[0].name, "Valkyria")
    assert.deepEqual(
        repository.audits.map((row) => [row.teamId, row.operation, row.actor]),
        [
            ["team-1", "create", actor],
            ["team-2", "create", actor],
        ]
    )
    assert.deepEqual(repository.changes, [
        { id: "team-1", operation: "upsert" },
        { id: "team-2", operation: "upsert" },
    ])
})

test("a real workspace is linked on create and fills a missing link without replacing one", async () => {
    const { repository, ports } = fixture()
    await adoptCatalogueTeam(ports, actor, {
        gameId: "hell_let_loose",
        name: "Omen",
        linkedGuildId: snowflake,
    })
    assert.equal(repository.teams[0].linkedGuildId, snowflake)
    // Existing link kept.
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: "omen",
            linkedGuildId: "223456789012345678",
        }),
        { ok: true, teamId: "team-1", created: false, linked: false }
    )
    assert.equal(repository.teams[0].linkedGuildId, snowflake)
    // An unlinked team gains the link with a new revision, audit and change.
    await adoptCatalogueTeam(ports, actor, {
        gameId: "hell_let_loose",
        name: "Wolves of War",
        linkedGuildId: null,
    })
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: "Wolves of War",
            linkedGuildId: "323456789012345678",
        }),
        { ok: true, teamId: "team-2", created: false, linked: true }
    )
    assert.equal(repository.teams[1].linkedGuildId, "323456789012345678")
    assert.equal(repository.teams[1].revision, 2)
    assert.deepEqual(repository.audits.at(-1)?.operation, "update")
    // A non-snowflake workspace reference is never recorded as a link.
    await adoptCatalogueTeam(ports, actor, {
        gameId: "wardogs",
        name: "Ghost",
        linkedGuildId: "not-a-guild",
    })
    assert.equal(repository.teams[2].linkedGuildId, null)
})

test("reuses archived teams without relinking and never matches a merged record", async () => {
    const { repository, ports } = fixture()
    await adoptCatalogueTeam(ports, actor, {
        gameId: "hell_let_loose",
        name: "Old",
        linkedGuildId: null,
    })
    repository.teams[0].archivedAt = "2026-10-01T00:00:00.000Z"
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: "Old",
            linkedGuildId: snowflake,
        }),
        { ok: true, teamId: "team-1", created: false, linked: false }
    )
    assert.equal(repository.teams[0].linkedGuildId, null)
    repository.teams[0].mergedIntoTeamId = "team-9"
    const created = await adoptCatalogueTeam(ports, actor, {
        gameId: "hell_let_loose",
        name: "Old",
        linkedGuildId: null,
    })
    assert.equal("ok" in created && created.created, true)
})

test("an unusable name or a full catalogue is reported, not written", async () => {
    const { repository, ports } = fixture()
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: " ",
            linkedGuildId: null,
        }),
        { error: "invalid_team" }
    )
    repository.count = async () => TEAM_DIRECTORY_LIMIT
    assert.deepEqual(
        await adoptCatalogueTeam(ports, actor, {
            gameId: "hell_let_loose",
            name: "One more",
            linkedGuildId: null,
        }),
        { error: "limit_reached" }
    )
    assert.equal(repository.teams.length, 0)
})
