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

    const json = message.components[0]?.toJSON()
    assert.equal(json?.type, 17)
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

    assert.match(JSON.stringify(message.components[0]?.toJSON()), /Pěchota/)
    assert.match(JSON.stringify(message.components[0]?.toJSON()), /Tank/)
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
        JSON.stringify(message.components[0]?.toJSON()),
        /membership-flow:draft-1:link/
    )
})
