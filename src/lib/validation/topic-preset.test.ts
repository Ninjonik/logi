import assert from "node:assert/strict"
import test from "node:test"

import { topicPresetSchema } from "./topic-preset"

function validTopic(attachments: string[]) {
    return {
        name: "Briefing",
        topics: [
            {
                id: "topic-1",
                title: "Plan",
                attachments: [],
                messages: [
                    {
                        id: "message-1",
                        attachments,
                    },
                ],
            },
        ],
    }
}

test("topic preset permits at most ten attachments in each Discord message", () => {
    const tenUrls = Array.from(
        { length: 10 },
        (_, index) => `https://example.test/${index}.png`
    )

    assert.equal(topicPresetSchema.safeParse(validTopic(tenUrls)).success, true)
    assert.equal(
        topicPresetSchema.safeParse(
            validTopic([...tenUrls, "https://example.test/10.png"])
        ).success,
        false
    )
})
