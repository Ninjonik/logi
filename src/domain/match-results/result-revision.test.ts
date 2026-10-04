import { createResultRevision, type ResultDraft } from "./result-revision"
import assert from "node:assert/strict"
import test from "node:test"
const draft: ResultDraft = {
    participants: [
        { id: "a", label: "A", score: 0 },
        { id: "b", label: "B", score: null },
        { id: "c", label: "C", score: 7 },
    ],
    origin: "manual",
    sessionLinks: [],
    players: [],
}
const actor = { id: "reviewer", kind: "session" as const },
    now = "2026-09-29T10:00:00.000Z"
const first = () =>
    createResultRevision({
        previous: null,
        expectedRevision: 0,
        draft,
        action: "stage",
        actor,
        now,
    })
test("import cannot confirm and reimport cannot overwrite confirmed revision", () => {
    assert.throws(() =>
        createResultRevision({
            previous: first(),
            expectedRevision: 1,
            draft,
            action: "confirm",
            actor: { id: "collector", kind: "import" },
            now,
        })
    )
    const confirmed = createResultRevision({
        previous: first(),
        expectedRevision: 1,
        draft,
        action: "confirm",
        actor,
        now,
    })
    assert.throws(() =>
        createResultRevision({
            previous: confirmed,
            expectedRevision: 2,
            draft,
            action: "stage",
            actor: { id: "collector", kind: "import" },
            now,
        })
    )
})
test("concurrent confirmations conflict; correction retains prior audit", () => {
    const previous = first()
    const confirmed = createResultRevision({
        previous,
        expectedRevision: 1,
        draft,
        action: "confirm",
        actor,
        now,
    })
    assert.throws(
        () =>
            createResultRevision({
                previous: confirmed,
                expectedRevision: 1,
                draft,
                action: "confirm",
                actor,
                now,
            }),
        /conflict/i
    )
    assert.throws(
        () =>
            createResultRevision({
                previous: confirmed,
                expectedRevision: 2,
                draft,
                action: "correct",
                actor,
                now,
            }),
        /reason/i
    )
    const corrected = createResultRevision({
        previous: confirmed,
        expectedRevision: 2,
        draft: {
            ...draft,
            participants: draft.participants.map((p) => ({ ...p, score: 4 })),
        },
        action: "correct",
        actor,
        now,
        reason: "Reviewed score correction",
    })
    assert.equal(corrected.supersedesVersion, 2)
    assert.equal(corrected.version, 3)
    assert.equal(confirmed.participants[0].score, 0)
    assert.equal(corrected.reviewerId, "reviewer")
})
test("zero differs from null and multi-faction result is not coerced", () => {
    const revision = first()
    assert.equal(revision.participants.length, 3)
    assert.deepEqual(
        revision.participants.map((p) => p.score),
        [0, null, 7]
    )
    assert.equal(revision.reviewedAt, null)
    assert.throws(() =>
        createResultRevision({
            previous: null,
            expectedRevision: 0,
            draft: {
                ...draft,
                participants: [draft.participants[0], draft.participants[0]],
            },
            action: "stage",
            actor,
            now,
        })
    )
})
