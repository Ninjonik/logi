import {
    rebaseTeamFormValues,
    teamFormCommand,
    teamFormValues,
    type TeamFormValues,
} from "./team-form"
import type { TeamRecord } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

function record(overrides: Partial<TeamRecord> = {}): TeamRecord {
    return {
        id: "team-1",
        gameId: "hell_let_loose",
        name: "Red Wolves",
        shortCode: "RW",
        logoUrl: "https://assets.example/l1.png",
        logoAssetId: "l1",
        revision: 1,
        updatedAt: "2026-10-01T00:00:00.000Z",
        archivedAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        ...overrides,
    }
}
const command = (base: TeamRecord | null, values: TeamFormValues) =>
    teamFormCommand({
        base,
        values,
        gameId: "hell_let_loose",
        idempotencyKey: "key-12345678",
    })

test("a new team is created with normalized inputs and the dialog key", () => {
    assert.deepEqual(
        command(null, {
            name: "  Red   Wolves ",
            shortCode: "  ",
            logo: { assetId: null, url: null },
        }),
        {
            kind: "send",
            request: {
                action: "create",
                input: {
                    gameId: "hell_let_loose",
                    name: "Red Wolves",
                    shortCode: null,
                    logoAssetId: null,
                    idempotencyKey: "key-12345678",
                },
            },
        }
    )
    assert.deepEqual(command(null, teamFormValues(null)), { kind: "invalid" })
})

test("an update carries only changed fields and the base revision", () => {
    const base = record()
    assert.deepEqual(command(base, teamFormValues(base)), {
        kind: "unchanged",
    })
    assert.deepEqual(
        command(base, {
            ...teamFormValues(base),
            name: "Red Wolves II",
            logo: { assetId: null, url: null },
        }),
        {
            kind: "send",
            request: {
                action: "update",
                teamId: "team-1",
                input: {
                    expectedRevision: 1,
                    name: "Red Wolves II",
                    logoAssetId: null,
                },
            },
        }
    )
})

test("a retry after a revision conflict does not revert another admin's changes", () => {
    const opened = record()
    // Another administrator changed the short code and the logo (revision 2).
    const latest = record({
        revision: 2,
        shortCode: "RWX",
        logoAssetId: "l2",
        logoUrl: "https://assets.example/l2.png",
    })
    // This administrator only renamed the team before the rejected save.
    const typed = { ...teamFormValues(opened), name: "Red Wolves II" }
    const rebased = rebaseTeamFormValues(typed, opened, latest)
    assert.deepEqual(rebased, {
        name: "Red Wolves II",
        shortCode: "RWX",
        logo: { assetId: "l2", url: "https://assets.example/l2.png" },
    })
    assert.deepEqual(command(latest, rebased), {
        kind: "send",
        request: {
            action: "update",
            teamId: "team-1",
            input: { expectedRevision: 2, name: "Red Wolves II" },
        },
    })
})

test("fields the user edited survive the rebase, even when both admins changed them", () => {
    const opened = record()
    const latest = record({ revision: 3, name: "Blue Wolves", shortCode: null })
    const typed = {
        name: "Grey Wolves",
        shortCode: " GW ",
        logo: { assetId: "l9", url: "https://assets.example/l9.png" },
    }
    const rebased = rebaseTeamFormValues(typed, opened, latest)
    assert.deepEqual(rebased, typed)
    assert.deepEqual(command(latest, rebased), {
        kind: "send",
        request: {
            action: "update",
            teamId: "team-1",
            input: {
                expectedRevision: 3,
                name: "Grey Wolves",
                shortCode: "GW",
                logoAssetId: "l9",
            },
        },
    })
})

test("untouched inputs with only extra whitespace follow the latest record", () => {
    const opened = record({ shortCode: null })
    const latest = record({ revision: 2, name: "Red Wolves Elite" })
    const typed = {
        ...teamFormValues(opened),
        name: " Red  Wolves ",
        shortCode: " ",
    }
    assert.deepEqual(rebaseTeamFormValues(typed, opened, latest), {
        name: "Red Wolves Elite",
        shortCode: "RW",
        logo: teamFormValues(latest).logo,
    })
})
