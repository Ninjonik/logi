import { getRankedSignupMessages } from "@/lib/clan-language/ranked-signup"
import { rankedSignupView, reorderSignupChoices } from "./ranked-signup"
import { getSystemMessages } from "@/lib/clan-language/system"
import { validateMessageView } from "./message-validation"
import assert from "node:assert/strict"
import test from "node:test"

test("arrow buttons reorder choices, boundary arrows do nothing, remove preserves order", () => {
    assert.deepEqual(reorderSignupChoices(["A", "B", "C"], "up", 1), [
        "B",
        "A",
        "C",
    ])
    assert.deepEqual(reorderSignupChoices(["A", "B", "C"], "down", 0), [
        "B",
        "A",
        "C",
    ])
    assert.deepEqual(reorderSignupChoices(["A", "B"], "up", 0), ["A", "B"])
    assert.deepEqual(reorderSignupChoices(["A", "B"], "down", 1), ["A", "B"])
    assert.deepEqual(reorderSignupChoices(["A", "B", "C"], "remove", 1), [
        "A",
        "C",
    ])
})

for (const language of ["en", "cs", "de", "pl"] as const) {
    test(`ranked signup views fit Discord limits in ${language}, including 25 choices`, () => {
        const copy = getRankedSignupMessages(language)
        const options = Array.from({ length: 25 }, (_, index) => ({
            value: `group-${index}`,
            name: `${index} ${"x".repeat(90)}`,
        }))
        for (const count of [0, 1, 5, 25])
            for (const editing of [false, true])
                for (const page of [0, 1, 6]) {
                    const view = rankedSignupView({
                        token: "12345678-1234-1234-1234-123456789012",
                        revision: 10,
                        choices: options
                            .slice(0, count)
                            .map((option) => option.name),
                        options,
                        copy,
                        editing,
                        page,
                    })
                    assert.deepEqual(
                        validateMessageView(view, {
                            copy: getSystemMessages(language).kit,
                            locale: copy.locale,
                        }).issues,
                        []
                    )
                    if (!editing && count === 1)
                        assert.equal(
                            view.blocks
                                .filter((block) => block.kind === "buttons")
                                .flatMap((block) =>
                                    block.kind === "buttons"
                                        ? block.buttons
                                        : []
                                ).length,
                            1
                        )
                }
    })
}
