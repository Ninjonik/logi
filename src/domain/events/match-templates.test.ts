import assert from "node:assert/strict"
import test from "node:test"

import {
    MAX_MATCH_TEMPLATES,
    defaultMatchTemplate,
    normalizeMatchTemplates,
    templateSchedule,
    templatesFor,
    type MatchTemplate,
} from "./match-templates"

const friendly: MatchTemplate = {
    ...defaultMatchTemplate("friendly", " Friendly "),
    gameId: "hell_let_loose",
    signupGroupIds: ["g1", "g1", "g2"],
    allowedSignupStatuses: ["member", "recruit", "member"],
}

test("templates are trimmed and de-duplicated", () => {
    const result = normalizeMatchTemplates([friendly])
    assert.ok(result.ok)
    assert.equal(result.templates[0].name, "Friendly")
    assert.deepEqual(result.templates[0].signupGroupIds, ["g1", "g2"])
    assert.deepEqual(result.templates[0].allowedSignupStatuses, [
        "member",
        "recruit",
    ])
})

test("a template for every game offers every signup group", () => {
    const result = normalizeMatchTemplates([{ ...friendly, gameId: undefined }])
    assert.ok(result.ok)
    assert.equal(result.templates[0].signupGroupIds, undefined)
})

test("a training template drops match-only settings", () => {
    const result = normalizeMatchTemplates([
        {
            ...friendly,
            kind: "training",
            createForumChannel: true,
            useGeneralSignup: true,
            topicPresetId: "t1",
        },
    ])
    assert.ok(result.ok)
    const [training] = result.templates
    assert.equal(training.createForumChannel, false)
    assert.equal(training.useGeneralSignup, false)
    assert.equal(training.topicPresetId, undefined)
    assert.equal(training.signupGroupIds, undefined)
    assert.deepEqual(training.allowedSignupStatuses, [])
})

test("invalid templates are refused with the reason and position", () => {
    assert.deepEqual(
        normalizeMatchTemplates([friendly, { ...friendly, name: "Again" }]),
        { ok: false, error: "duplicate_id", index: 1 }
    )
    assert.deepEqual(normalizeMatchTemplates([{ ...friendly, name: "  " }]), {
        ok: false,
        error: "missing_name",
        index: 0,
    })
    assert.deepEqual(
        normalizeMatchTemplates([{ ...friendly, durationMinutes: 0 }]),
        { ok: false, error: "invalid_times", index: 0 }
    )
    assert.deepEqual(
        normalizeMatchTemplates([
            { ...friendly, registrationHoursBeforeMeeting: 1.5 },
        ]),
        { ok: false, error: "invalid_times", index: 0 }
    )
    assert.deepEqual(
        normalizeMatchTemplates([
            { ...friendly, pingMode: "roles", pingRoleIds: [" "] },
        ]),
        { ok: false, error: "missing_ping_roles", index: 0 }
    )
    assert.deepEqual(
        normalizeMatchTemplates(
            Array.from({ length: MAX_MATCH_TEMPLATES + 1 }, (_, index) => ({
                ...friendly,
                id: `t${index}`,
            }))
        ),
        { ok: false, error: "too_many" }
    )
})

test("ping roles are kept only when roles are pinged", () => {
    const result = normalizeMatchTemplates([
        { ...friendly, pingMode: "clan", pingRoleIds: ["r1"] },
    ])
    assert.ok(result.ok)
    assert.deepEqual(result.templates[0].pingRoleIds, [])
})

test("templates are offered by kind and game", () => {
    const templates = [
        friendly,
        { ...friendly, id: "any", gameId: undefined },
        { ...friendly, id: "wardogs", gameId: "wardogs" as const },
        { ...friendly, id: "training", kind: "training" as const },
    ]
    assert.deepEqual(
        templatesFor(templates, "match", "hell_let_loose").map(
            (template) => template.id
        ),
        ["friendly", "any"]
    )
    assert.deepEqual(
        templatesFor(templates, "training", "wardogs").map(
            (template) => template.id
        ),
        []
    )
    assert.deepEqual(templatesFor(undefined, "match", "wardogs"), [])
})

test("a match timeline counts back from the start", () => {
    // Sunday 11 October 2026, 20:00 in Prague.
    assert.deepEqual(
        templateSchedule(
            { ...friendly, announcementHoursBeforeStart: 72 },
            "2026-10-11T18:00:00.000Z"
        ),
        {
            registrationStart: "2026-10-08T18:00:00.000Z",
            registrationEnd: "2026-10-10T17:30:00.000Z",
            meetingStart: "2026-10-11T17:30:00.000Z",
            gameStart: "2026-10-11T18:00:00.000Z",
            gameEnd: "2026-10-11T19:30:00.000Z",
        }
    )
})

test("a training starts at its meeting and an invalid start has no timeline", () => {
    assert.deepEqual(
        templateSchedule(
            { ...friendly, kind: "training", durationMinutes: 60 },
            "2026-10-14T17:30:00.000Z"
        ),
        {
            registrationStart: undefined,
            registrationEnd: "2026-10-13T17:30:00.000Z",
            meetingStart: "2026-10-14T17:30:00.000Z",
            gameStart: "2026-10-14T17:30:00.000Z",
            gameEnd: "2026-10-14T18:30:00.000Z",
        }
    )
    assert.equal(templateSchedule(friendly, "not a date"), null)
})
