import { leagueSnapshotFixture } from "../../infrastructure/testing/league-fixtures"
import { preparationChipSchema } from "./preparation.schema"
import { preparationChips } from "./preparation"
import type { LeagueMatch } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

const fetched = Date.parse("2026-10-02T18:32:33.561Z")
const withSteps = (
    match: LeagueMatch,
    states: Record<string, ["done" | "current" | "not_started", string | null]>
): LeagueMatch => ({
    ...match,
    progress: match.progress!.map((step) =>
        states[step.label]
            ? {
                  ...step,
                  state: states[step.label][0],
                  detail: states[step.label][1],
              }
            : step
    ),
})

test("#38 on the board: rules 0/3 grey, an open map vote running until it closes, the rest grey", () => {
    const chips = preparationChips(leagueSnapshotFixture(), fetched)
    assert.deepEqual(chips, [
        { kind: "rules", tone: "pending", picked: 0, total: 3 },
        {
            kind: "mapVote",
            tone: "running",
            closesAt: "2026-10-03T10:19:33.154Z",
            opensAt: null,
        },
        { kind: "moderator", tone: "pending" },
        { kind: "readyCheck", tone: "pending" },
    ])
    for (const chip of chips) assert.ok(preparationChipSchema.parse(chip))
})

test("#39: rules 2/3 running and an assigned moderator is done", () => {
    const match = leagueSnapshotFixture({
        rules: { summary: "2 of 3 picked", choices: null },
        moderator: "Kowalski",
    })
    const chips = preparationChips(match, fetched)
    assert.deepEqual(chips[0], {
        kind: "rules",
        tone: "running",
        picked: 2,
        total: 3,
    })
    assert.deepEqual(chips[2], { kind: "moderator", tone: "done" })
    assert.deepEqual(
        preparationChips(
            withSteps(leagueSnapshotFixture(), {
                "Moderator claimed": ["done", "Claimed"],
            }),
            fetched
        )[2],
        { kind: "moderator", tone: "done" }
    )
})

test("#40: rules 1/3 running while the map vote has not opened", () => {
    const chips = preparationChips(
        leagueSnapshotFixture({
            rules: null,
            mapVote: { status: "Not open", closesAt: null, ballots: null },
            progress: withSteps(leagueSnapshotFixture(), {
                "Rules agreed": ["current", "1/3"],
            }).progress,
        }),
        fetched
    )
    assert.deepEqual(chips.slice(0, 2), [
        { kind: "rules", tone: "running", picked: 1, total: 3 },
        { kind: "mapVote", tone: "pending", closesAt: null, opensAt: null },
    ])
})

test("#41–#43: nothing started collapses into one grey chip", () => {
    assert.deepEqual(
        preparationChips(
            leagueSnapshotFixture({
                mapVote: null,
                rules: { summary: "0 of 3 picked", choices: null },
            }),
            fetched
        ),
        [{ kind: "notStarted", tone: "pending" }]
    )
})

test("finished steps are green: all rules picked, closed vote, ready check done", () => {
    const match = withSteps(
        leagueSnapshotFixture({
            rules: { summary: "3 of 3 picked", choices: null },
            mapVote: { status: "Closed", closesAt: null, ballots: null },
        }),
        { "Ready check": ["done", "Passed"] }
    )
    assert.deepEqual(
        preparationChips(match, fetched).map((chip) => chip.tone),
        ["done", "done", "pending", "done"]
    )
    const running = withSteps(leagueSnapshotFixture(), {
        "Ready check": ["current", "Running"],
    })
    assert.equal(preparationChips(running, fetched)[3].tone, "running")
    assert.equal(
        preparationChips(
            withSteps(leagueSnapshotFixture({ rules: null }), {
                "Rules agreed": ["done", null],
            }),
            fetched
        )[0].tone,
        "done"
    )
})

test("a vote past its deadline counts as closed even if the stored page still says Open", () => {
    const chip = preparationChips(
        leagueSnapshotFixture(),
        Date.parse("2026-10-03T10:19:33.154Z")
    )[1]
    assert.deepEqual(chip, {
        kind: "mapVote",
        tone: "done",
        closesAt: null,
        opensAt: null,
    })
})

test("unparseable counts keep the chip without numbers", () => {
    const chip = preparationChips(
        leagueSnapshotFixture({
            rules: { summary: "Waiting on picks", choices: null },
            progress: null,
            mapVote: { status: "Open", closesAt: null, ballots: null },
        }),
        fetched
    )[0]
    assert.deepEqual(chip, {
        kind: "rules",
        tone: "pending",
        picked: null,
        total: null,
    })
})
