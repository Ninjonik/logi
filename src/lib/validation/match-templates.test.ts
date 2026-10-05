import assert from "node:assert/strict"
import test from "node:test"

import { defaultMatchTemplate } from "@/domain/events/match-templates"

import { matchTemplatesSaveSchema } from "./match-templates"

const template = defaultMatchTemplate("tpl_1", "Friendly")

test("a full template list is accepted", () => {
    const parsed = matchTemplatesSaveSchema.safeParse({
        templates: [
            { ...template, gameId: "wardogs", signupGroupIds: ["g1"] },
            { ...template, id: "tpl_2", kind: "training" },
        ],
    })
    assert.ok(parsed.success)
})

test("unknown fields, fractions and foreign role ids are refused", () => {
    for (const bad of [
        { ...template, extra: true },
        { ...template, durationMinutes: 0 },
        { ...template, registrationHoursBeforeMeeting: 1.5 },
        { ...template, gameId: "chess" },
        { ...template, pingMode: "roles", pingRoleIds: ["@everyone"] },
        { ...template, allowedSignupStatuses: ["admin"] },
    ])
        assert.equal(
            matchTemplatesSaveSchema.safeParse({ templates: [bad] }).success,
            false
        )
    assert.equal(matchTemplatesSaveSchema.safeParse({}).success, false)
})
