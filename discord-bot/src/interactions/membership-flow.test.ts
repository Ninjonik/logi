import assert from "node:assert/strict"
import test from "node:test"

import { buildMembershipFlowMessage } from "./membership-flow"

test("membership flow renders a Wardogs review without specialization", () => {
    const message = buildMembershipFlowMessage({
        language: "en",
        draftId: "draft-1",
        step: "review",
        gameId: "wardogs",
        platformLinked: true,
        answers: [{ label: "Experience", value: "Experienced" }],
    })

    const json = message.components.map((component) => component.toJSON())
    assert.equal(json[0]?.type, 17)
    assert.match(JSON.stringify(json), /membership-flow:draft-1:submit/)
    assert.match(JSON.stringify(json), /Wardogs/)
})

test("membership flow exposes localized specialization choices", () => {
    const message = buildMembershipFlowMessage({
        language: "cs",
        draftId: "draft-1",
        step: "specialization",
        gameId: "hell_let_loose",
        platformLinked: false,
    })

    assert.match(
        JSON.stringify(
            message.components.map((component) => component.toJSON())
        ),
        /Pěchota/
    )
    assert.match(
        JSON.stringify(
            message.components.map((component) => component.toJSON())
        ),
        /Tank/
    )
})

test("membership flow always renders the account action", () => {
    const message = buildMembershipFlowMessage({
        language: "cs",
        draftId: "draft-1",
        step: "account",
        gameId: "wardogs",
        platformLinked: false,
    })

    assert.match(
        JSON.stringify(
            message.components.map((component) => component.toJSON())
        ),
        /membership-flow:draft-1:link/
    )
})

test("membership flow skips an empty application form and renders review copy", () => {
    const message = buildMembershipFlowMessage({
        language: "en",
        draftId: "draft-1",
        step: "questions",
        gameId: "wardogs",
        platformLinked: true,
        hasQuestions: false,
    })

    const json = JSON.stringify(
        message.components.map((component) => component.toJSON())
    )
    assert.match(json, /# Review/)
    assert.doesNotMatch(json, /undefined/)
    assert.match(json, /membership-flow:draft-1:submit/)
})
