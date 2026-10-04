import {
    matchTeamSummarySchema,
    validateMatchTeamInputs,
} from "@/domain/teams/match-teams"
import {
    integrationChangeSchema,
    syncRecordSchema,
} from "@/domain/integrations/change"
import { teamDtoSchema, teamPageSchema } from "@/domain/teams/team"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { z } from "zod"

const fixture = (name: string): Record<string, unknown> =>
    JSON.parse(
        readFileSync(
            `docs/integrations/website/v0.15/fixtures/${name}.json`,
            "utf8"
        )
    )
const PUBLIC_LOGO =
    /^https:\/\/logi\.example\/api\/image-assets\/[0-9a-f]{32}\.png$/

test("team detail fixtures are closed minimized DTOs with public logo URLs or explicit nulls", () => {
    const withLogo = teamDtoSchema.parse(fixture("team").data)
    assert.equal(withLogo.gameId, "hell_let_loose")
    assert.match(withLogo.logoUrl ?? "", PUBLIC_LOGO)
    assert.equal(withLogo.shortCode, "SAD")
    const withoutLogo = teamDtoSchema.parse(fixture("team-without-logo").data)
    assert.equal(withoutLogo.gameId, "wardogs")
    assert.equal(withoutLogo.logoUrl, null)
    assert.equal(withoutLogo.shortCode, null)
    for (const team of [withLogo, withoutLogo]) {
        assert.equal("logoAssetId" in team, false)
        assert.equal("archivedAt" in team, false)
        assert.equal("guildId" in team, false)
    }
})

test("team collection fixture is a single-game page without a continuation", () => {
    const page = teamPageSchema.parse(fixture("teams-page").data)
    assert.equal(page.items.length, 2)
    assert.equal(page.nextCursor, null)
    assert.ok(page.items.every((team) => team.gameId === "hell_let_loose"))
    assert.equal(
        new Set(page.items.map((team) => team.id)).size,
        page.items.length
    )
})

test("team change rows use the teams resource with upsert and remove operations", () => {
    const upsert = integrationChangeSchema.parse(
        (fixture("team-change-upsert").data as unknown[])[0]
    )
    const remove = integrationChangeSchema.parse(
        (fixture("team-change-remove").data as unknown[])[0]
    )
    assert.equal(upsert.resource, "teams")
    assert.equal(upsert.operation, "upsert")
    assert.equal(remove.resource, "teams")
    assert.equal(remove.operation, "remove")
    assert.ok(BigInt(remove.revision) > BigInt(upsert.revision))
})

test("team sync record carries the same DTO as the detail read", () => {
    const record = syncRecordSchema.parse(fixture("sync-record-team").data)
    assert.equal(record.resource, "teams")
    assert.equal(record.operation, "upsert")
    const team = teamDtoSchema.parse(record.data)
    assert.equal(team.id, record.id)
    assert.deepEqual(team, fixture("team").data)
})

test("match team fixtures are valid per-game slot and side assignments without asset identifiers", () => {
    const summaries = z.array(matchTeamSummarySchema).max(3)
    for (const [name, gameId, sides] of [
        ["match-teams-hll", "hell_let_loose", ["Allies", "Axis"]],
        [
            "match-teams-wardogs",
            "wardogs",
            ["Valkyra", "Manticore", "Lonestar"],
        ],
    ] as const) {
        const teams = summaries.parse(fixture(name).matchTeams)
        assert.deepEqual(
            teams.map((team) => team.side),
            [...sides]
        )
        assert.deepEqual(
            teams.map((team) => team.slot),
            ["a", "b", "c"].slice(0, sides.length)
        )
        assert.equal(
            validateMatchTeamInputs(
                gameId,
                teams.map(({ teamId, slot, side }) => ({ teamId, slot, side }))
            ),
            null
        )
        for (const team of teams) {
            assert.equal("logoAssetId" in team, false)
            if (team.logoUrl !== null) assert.match(team.logoUrl, PUBLIC_LOGO)
        }
    }
})
