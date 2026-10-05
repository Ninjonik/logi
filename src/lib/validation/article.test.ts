import assert from "node:assert/strict"
import test from "node:test"

import { articleCreateSchema, getArticleFieldError } from "./article"

const valid = {
    title: " Patch notes ",
    description: "What changed this week.",
    tags: ["news", " hll "],
    body: "## Hello",
    attachments: ["https://example.convex.cloud/api/storage/abc"],
}

test("article schema accepts a complete article", () => {
    const parsed = articleCreateSchema.safeParse(valid)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data?.title, "Patch notes")
})

test("article schema names the first invalid field", () => {
    for (const [input, field] of [
        [{ ...valid, title: "  " }, "title"],
        [{ ...valid, description: "" }, "description"],
        [{ ...valid, body: "   \n" }, "body"],
        [{ ...valid, attachments: ["javascript:alert(1)"] }, "attachments"],
    ] as const) {
        const parsed = articleCreateSchema.safeParse(input)
        assert.equal(parsed.success, false)
        if (!parsed.success)
            assert.equal(getArticleFieldError(parsed.error), field)
    }
})

test("article schema rejects unknown fields such as an author", () => {
    assert.equal(
        articleCreateSchema.safeParse({ ...valid, authorId: "123" }).success,
        false
    )
})
