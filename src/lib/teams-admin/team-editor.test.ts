import {
    approveDecision,
    catalogueFormCommand,
    editorValuesFromProposal,
    editorValuesFromTeam,
    proposalChanges,
    rebaseCatalogueForm,
    rejectDecision,
    validateEditorValues,
    type TeamEditorValues,
} from "./team-editor"
import type { TeamRequestRecord } from "@/domain/teams/team-request"
import type { TeamRecord } from "@/domain/teams/team"
import assert from "node:assert/strict"
import test from "node:test"

const team = (overrides: Partial<TeamRecord> = {}): TeamRecord => ({
    id: "team-1",
    gameId: "wardogs",
    name: "Alpha Squad",
    shortCode: "ALP",
    logoUrl: "https://logi.test/logo.png",
    description: "We play Sundays.",
    links: ["https://alpha.example"],
    revision: 3,
    updatedAt: "2026-10-01T00:00:00.000Z",
    logoAssetId: "asset-1",
    linkedGuildId: null,
    mergedIntoTeamId: null,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
})
const proposal = (
    overrides: Partial<TeamRequestRecord["proposal"]> = {}
): TeamRequestRecord["proposal"] => ({
    name: "Bravo",
    shortCode: null,
    logoAssetId: "asset-9",
    logoUrl: "https://logi.test/bravo.png",
    description: null,
    links: [],
    ...overrides,
})
const values = (overrides: Partial<TeamEditorValues> = {}) => ({
    ...editorValuesFromTeam(team()),
    ...overrides,
})

test("editor values always expose three link inputs", () => {
    assert.deepEqual(editorValuesFromTeam(null), {
        name: "",
        shortCode: "",
        description: "",
        links: ["", "", ""],
        logo: { assetId: null, url: null },
    })
    assert.deepEqual(editorValuesFromTeam(team()).links, [
        "https://alpha.example",
        "",
        "",
    ])
    assert.deepEqual(editorValuesFromProposal(proposal()), {
        name: "Bravo",
        shortCode: "",
        description: "",
        links: ["", "", ""],
        logo: { assetId: "asset-9", url: "https://logi.test/bravo.png" },
    })
})

test("validation normalizes values and names the first invalid field", () => {
    const ok = validateEditorValues(
        values({
            name: "  Alpha   Squad ",
            shortCode: "  ",
            description: "  Hello  ",
            links: [" https://a.example ", "", "https://b.example"],
        })
    )
    assert.deepEqual(ok, {
        ok: true,
        fields: {
            name: "Alpha Squad",
            shortCode: null,
            description: "Hello",
            links: ["https://a.example", "https://b.example"],
            logoAssetId: "asset-1",
        },
    })
    const field = (overrides: Partial<TeamEditorValues>) => {
        const result = validateEditorValues(values(overrides))
        return result.ok ? null : result.field
    }
    assert.equal(field({ name: "   " }), "name")
    assert.equal(field({ shortCode: "X".repeat(17) }), "shortCode")
    assert.equal(field({ description: "d".repeat(501) }), "description")
    assert.equal(field({ links: ["http://plain.example", "", ""] }), "links")
    assert.equal(
        field({ links: ["https://a.example", "https://a.example", ""] }),
        "links"
    )
})

test("a new catalogue team becomes a create with every field", () => {
    const command = catalogueFormCommand({
        base: null,
        values: values({ name: "Charlie" }),
        linkedGuildId: "123456789012345678",
        gameId: "hell_let_loose",
        idempotencyKey: "key-12345678",
    })
    assert.deepEqual(command, {
        kind: "send",
        command: {
            action: "create",
            input: {
                gameId: "hell_let_loose",
                name: "Charlie",
                shortCode: "ALP",
                description: "We play Sundays.",
                links: ["https://alpha.example"],
                logoAssetId: "asset-1",
                linkedGuildId: "123456789012345678",
                idempotencyKey: "key-12345678",
            },
        },
    })
})

test("an edit sends only changed fields at the base revision", () => {
    const base = team()
    const unchanged = catalogueFormCommand({
        base,
        values: values({ name: " Alpha  Squad " }),
        linkedGuildId: "",
        gameId: "wardogs",
        idempotencyKey: "key-12345678",
    })
    assert.deepEqual(unchanged, { kind: "unchanged" })
    const changed = catalogueFormCommand({
        base,
        values: values({
            description: "",
            links: ["https://alpha.example", "https://discord.gg/alpha", ""],
            logo: { assetId: null, url: null },
        }),
        linkedGuildId: "123456789012345678",
        gameId: "wardogs",
        idempotencyKey: "key-12345678",
    })
    assert.deepEqual(changed, {
        kind: "send",
        command: {
            action: "update",
            teamId: "team-1",
            input: {
                expectedRevision: 3,
                description: null,
                links: ["https://alpha.example", "https://discord.gg/alpha"],
                logoAssetId: null,
                linkedGuildId: "123456789012345678",
            },
        },
    })
    // Unlinking is a change to null.
    const unlinked = catalogueFormCommand({
        base: team({ linkedGuildId: "123456789012345678" }),
        values: values(),
        linkedGuildId: "",
        gameId: "wardogs",
        idempotencyKey: "key-12345678",
    })
    assert.deepEqual(unlinked.kind === "send" ? unlinked.command.input : null, {
        expectedRevision: 3,
        linkedGuildId: null,
    })
})

test("invalid fields and linked workspaces are reported, not sent", () => {
    assert.deepEqual(
        catalogueFormCommand({
            base: null,
            values: values({ name: "" }),
            linkedGuildId: "",
            gameId: "wardogs",
            idempotencyKey: "key-12345678",
        }),
        { kind: "invalid", field: "name" }
    )
    assert.deepEqual(
        catalogueFormCommand({
            base: null,
            values: values(),
            linkedGuildId: "not-a-guild",
            gameId: "wardogs",
            idempotencyKey: "key-12345678",
        }),
        { kind: "invalid", field: "linkedGuildId" }
    )
})

test("a stale form keeps the user's edits and follows the latest for the rest", () => {
    const previous = team()
    const latest = team({
        name: "Alpha Squad Renamed",
        shortCode: "AS",
        description: "Now Saturdays.",
        links: ["https://new.example"],
        logoAssetId: "asset-2",
        logoUrl: "https://logi.test/2.png",
        linkedGuildId: "123456789012345678",
        revision: 4,
    })
    const rebased = rebaseCatalogueForm(
        {
            values: values({ shortCode: "MINE" }),
            linkedGuildId: "",
        },
        previous,
        latest
    )
    assert.deepEqual(rebased, {
        values: {
            name: "Alpha Squad Renamed",
            shortCode: "MINE",
            description: "Now Saturdays.",
            links: ["https://new.example", "", ""],
            logo: { assetId: "asset-2", url: "https://logi.test/2.png" },
        },
        linkedGuildId: "123456789012345678",
    })
})

test("approval sends the proposal only when it was edited", () => {
    const request = { kind: "create" as const, proposal: proposal() }
    const plain = approveDecision({
        request,
        values: editorValuesFromProposal(request.proposal),
        currentTeam: null,
    })
    assert.deepEqual(plain, {
        kind: "send",
        edited: false,
        decision: { decision: "approve" },
    })
    const edited = approveDecision({
        request,
        values: {
            ...editorValuesFromProposal(request.proposal),
            shortCode: "BRV",
            logo: { assetId: "platform-asset", url: "https://logi.test/p.png" },
        },
        currentTeam: null,
    })
    assert.deepEqual(edited, {
        kind: "send",
        edited: true,
        decision: {
            decision: "approve",
            proposal: {
                name: "Bravo",
                shortCode: "BRV",
                description: null,
                links: [],
                logoAssetId: "platform-asset",
            },
        },
    })
})

test("a change request approval carries the current team's revision", () => {
    const request = { kind: "update" as const, proposal: proposal() }
    const vals = editorValuesFromProposal(request.proposal)
    assert.deepEqual(
        approveDecision({ request, values: vals, currentTeam: null }),
        { kind: "needs_team" }
    )
    assert.deepEqual(
        approveDecision({
            request,
            values: vals,
            currentTeam: { revision: 7 },
        }),
        {
            kind: "send",
            edited: false,
            decision: { decision: "approve", targetRevision: 7 },
        }
    )
    assert.deepEqual(
        approveDecision({
            request,
            values: { ...vals, name: " " },
            currentTeam: { revision: 7 },
        }),
        { kind: "invalid", field: "name" }
    )
})

test("a rejection requires a bounded reason", () => {
    assert.deepEqual(rejectDecision("  Duplicate of Alpha  "), {
        kind: "send",
        decision: { decision: "reject", reason: "Duplicate of Alpha" },
    })
    assert.deepEqual(rejectDecision("   "), { kind: "invalid" })
    assert.deepEqual(rejectDecision("r".repeat(501)), { kind: "invalid" })
})

test("proposal changes name the fields a change request alters", () => {
    assert.deepEqual(
        [
            ...proposalChanges(
                proposal({
                    name: "Alpha Squad",
                    shortCode: "ALP",
                    logoAssetId: "asset-1",
                    description: "New text",
                    links: [],
                }),
                team()
            ),
        ].sort(),
        ["description", "links"]
    )
})
