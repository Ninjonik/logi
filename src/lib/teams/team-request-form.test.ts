import {
    addTeamLinkRow,
    catalogueDuplicate,
    removeTeamLinkRow,
    setTeamLinkRow,
    teamLogoUploadMessage,
    teamRequestFormInput,
    teamRequestFormValues,
    type TeamRequestFormValues,
    type TeamRequestTarget,
} from "./team-request-form"
import { teamRequestFingerprint } from "@/domain/teams/team-request"
import { IMAGE_UPLOAD_ERRORS } from "@/lib/image-asset-upload"
import type { TeamRecord } from "@/domain/teams/team"
import { getDictionary } from "@/i18n/dictionaries"
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
        description: "Sunday league side.",
        links: ["https://red.example/"],
        linkedGuildId: null,
        mergedIntoTeamId: null,
        revision: 1,
        updatedAt: "2026-10-01T00:00:00.000Z",
        archivedAt: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        ...overrides,
    }
}
const KEY = "key-12345678"
const create: TeamRequestTarget = { kind: "create", gameId: "hell_let_loose" }
const build = (target: TeamRequestTarget, values: TeamRequestFormValues) =>
    teamRequestFormInput({ target, values, idempotencyKey: KEY })
const empty = teamRequestFormValues(create)

test("a new-team request starts empty or with the picker's typed name", () => {
    assert.deepEqual(empty, {
        name: "",
        shortCode: "",
        logo: { assetId: null, url: null },
        description: "",
        links: [],
        note: "",
    })
    assert.equal(
        teamRequestFormValues(create, "  Red   Wolves ").name,
        "Red Wolves"
    )
    assert.equal(
        [...teamRequestFormValues(create, "é".repeat(200)).name].length,
        120
    )
})

test("a change request starts from the team's current details", () => {
    assert.deepEqual(
        teamRequestFormValues({ kind: "update", team: record() }),
        {
            name: "Red Wolves",
            shortCode: "RW",
            logo: { assetId: "l1", url: "https://assets.example/l1.png" },
            description: "Sunday league side.",
            links: ["https://red.example/"],
            note: "",
        }
    )
})

test("a new-team request is normalized into the submit payload with the dialog key", () => {
    assert.deepEqual(
        build(create, {
            name: "  Red   Wolves ",
            shortCode: "  ",
            logo: { assetId: "asset_1", url: "https://cdn/a.png" },
            description: "  Plays on Sundays.\nEU based.  ",
            links: ["", " https://red.example/ ", "   "],
            note: "  Seen in the EU cup ",
        }),
        {
            kind: "send",
            input: {
                kind: "create",
                gameId: "hell_let_loose",
                proposal: {
                    name: "Red Wolves",
                    shortCode: null,
                    logoAssetId: "asset_1",
                    description: "Plays on Sundays.\nEU based.",
                    links: ["https://red.example/"],
                },
                note: "Seen in the EU cup",
                idempotencyKey: KEY,
            },
        }
    )
    assert.deepEqual(build(create, { ...empty, name: "Alpha" }), {
        kind: "send",
        input: {
            kind: "create",
            gameId: "hell_let_loose",
            proposal: {
                name: "Alpha",
                shortCode: null,
                logoAssetId: null,
                description: null,
                links: [],
            },
            note: null,
            idempotencyKey: KEY,
        },
    })
})

test("a change request carries every proposed field for the target team", () => {
    const team = record()
    const result = build(
        { kind: "update", team },
        {
            ...teamRequestFormValues({ kind: "update", team }),
            name: "Red Wolves Elite",
            note: "Renamed this season",
        }
    )
    assert.deepEqual(result, {
        kind: "send",
        input: {
            kind: "update",
            teamId: "team-1",
            proposal: {
                name: "Red Wolves Elite",
                shortCode: "RW",
                // The team's current logo is proposed unchanged.
                logoAssetId: "l1",
                description: "Sunday league side.",
                links: ["https://red.example/"],
            },
            note: "Renamed this season",
            idempotencyKey: KEY,
        },
    })
    const cleared = build(
        { kind: "update", team },
        {
            ...teamRequestFormValues({ kind: "update", team }),
            logo: { assetId: null, url: null },
            description: " ",
            links: [],
        }
    )
    assert.equal(cleared.kind, "send")
    if (cleared.kind === "send")
        assert.deepEqual(cleared.input.proposal, {
            name: "Red Wolves",
            shortCode: "RW",
            logoAssetId: null,
            description: null,
            links: [],
        })
})

test("a change request without a changed field is not sent, even with a note", () => {
    const team = record()
    const values = teamRequestFormValues({ kind: "update", team })
    assert.deepEqual(build({ kind: "update", team }, values), {
        kind: "unchanged",
    })
    assert.deepEqual(
        build(
            { kind: "update", team },
            {
                ...values,
                name: " Red  Wolves ",
                links: ["https://red.example/", ""],
                note: "Please check",
            }
        ),
        { kind: "unchanged" }
    )
})

test("each invalid field is reported with its own issue", () => {
    assert.deepEqual(build(create, empty), {
        kind: "invalid",
        errors: { name: "nameRequired" },
        invalidLinks: [],
    })
    assert.deepEqual(
        build(create, {
            ...empty,
            name: "x".repeat(121),
            shortCode: "y".repeat(17),
            description: "z".repeat(501),
        }),
        {
            kind: "invalid",
            errors: {
                name: "nameInvalid",
                shortCode: "shortCodeInvalid",
                description: "descriptionInvalid",
            },
            invalidLinks: [],
        }
    )
    assert.deepEqual(
        build(create, {
            ...empty,
            name: "Alpha",
            links: [
                "https://ok.example",
                "http://insecure.example",
                "https://user:pw@secret.example",
            ],
        }),
        {
            kind: "invalid",
            errors: { links: "linksInvalid" },
            invalidLinks: [1, 2],
        }
    )
    assert.deepEqual(
        build(create, {
            ...empty,
            name: "Alpha",
            links: ["https://a.example", " https://a.example "],
        }),
        {
            kind: "invalid",
            errors: { links: "linksDuplicate" },
            invalidLinks: [1],
        }
    )
    assert.deepEqual(
        build(create, {
            ...empty,
            name: "Alpha",
            links: [
                "https://a.example",
                "https://b.example",
                "https://c.example",
                "https://d.example",
            ],
        }),
        { kind: "invalid", errors: { links: "linksTooMany" }, invalidLinks: [] }
    )
    assert.deepEqual(
        build(create, { ...empty, name: "Alpha", note: "n".repeat(501) }),
        { kind: "invalid", errors: { note: "noteInvalid" }, invalidLinks: [] }
    )
    assert.deepEqual(
        build(create, { ...empty, name: "Alpha", note: "bell\u0007" }),
        { kind: "invalid", errors: { note: "noteInvalid" }, invalidLinks: [] }
    )
})

test("a bad idempotency key is a form error, never a silently changed key", () => {
    assert.deepEqual(
        teamRequestFormInput({
            target: create,
            values: { ...empty, name: "Alpha" },
            idempotencyKey: "short",
        }),
        { kind: "invalid", errors: { form: "invalid" }, invalidLinks: [] }
    )
})

test("a retry with the same dialog key replays: unchanged or whitespace-only edits keep the fingerprint", () => {
    const values = {
        ...empty,
        name: "Red Wolves",
        links: ["https://red.example/"],
    }
    const first = build(create, values)
    const retry = build(create, values)
    const retouched = build(create, {
        ...values,
        name: "  Red  Wolves",
        links: ["", "https://red.example/ "],
    })
    assert.equal(first.kind, "send")
    assert.equal(retry.kind, "send")
    assert.equal(retouched.kind, "send")
    if (
        first.kind !== "send" ||
        retry.kind !== "send" ||
        retouched.kind !== "send"
    )
        return
    assert.deepEqual(retry, first)
    assert.equal(retry.input.idempotencyKey, KEY)
    assert.equal(
        teamRequestFingerprint(retouched.input),
        teamRequestFingerprint(first.input)
    )
    // A real edit after a lost response changes the payload; the server then
    // answers idempotency_conflict instead of storing a second request.
    const edited = build(create, { ...values, name: "Blue Wolves" })
    assert.equal(edited.kind, "send")
    if (edited.kind === "send") {
        assert.equal(edited.input.idempotencyKey, KEY)
        assert.notEqual(
            teamRequestFingerprint(edited.input),
            teamRequestFingerprint(first.input)
        )
    }
})

test("link rows are added up to the maximum, edited and removed by position", () => {
    let rows = addTeamLinkRow([])
    rows = addTeamLinkRow(rows)
    rows = addTeamLinkRow(rows)
    assert.deepEqual(rows, ["", "", ""])
    assert.deepEqual(addTeamLinkRow(rows), ["", "", ""])
    rows = setTeamLinkRow(rows, 1, "https://b.example")
    assert.deepEqual(rows, ["", "https://b.example", ""])
    assert.deepEqual(removeTeamLinkRow(rows, 0), ["https://b.example", ""])
})

test("an active catalogue team with the same normalized name is a duplicate", () => {
    const items = [
        record({ id: "a", name: "Alpha" }),
        record({ id: "b", name: "Red Wolves" }),
        record({
            id: "c",
            name: "Bravo",
            archivedAt: "2026-10-02T00:00:00.000Z",
        }),
    ]
    assert.equal(catalogueDuplicate(items, " red   WOLVES ")?.id, "b")
    assert.equal(catalogueDuplicate(items, "Red Wolve"), null)
    assert.equal(catalogueDuplicate(items, "bravo"), null)
})

for (const locale of ["en", "cs", "de"] as const) {
    test(`logo upload failures read from the ${locale} team messages with the retry wait`, () => {
        const messages = getDictionary(locale).teams.uploadErrors
        for (const error of IMAGE_UPLOAD_ERRORS) {
            const message = teamLogoUploadMessage(messages, {
                error,
                retryAfterMs: null,
            })
            assert.ok(message.length > 0, `${locale} ${error}`)
            if (error !== "upload_limited")
                assert.equal(message, messages[error])
        }
        const limited = teamLogoUploadMessage(messages, {
            error: "upload_limited",
            retryAfterMs: 41_200,
        })
        assert.ok(limited.includes("42"), limited)
        assert.ok(!limited.includes("{seconds}"), limited)
    })

    test(`every ${locale} validation issue has a message`, () => {
        const validation = getDictionary(locale).teamRequests.validation
        for (const issue of [
            "nameRequired",
            "nameInvalid",
            "shortCodeInvalid",
            "descriptionInvalid",
            "linksInvalid",
            "linksDuplicate",
            "linksTooMany",
            "noteInvalid",
            "invalid",
        ] as const)
            assert.ok(validation[issue].length > 0, `${locale} ${issue}`)
    })
}
