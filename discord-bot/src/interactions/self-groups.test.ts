import { validateMessageView } from "../../../src/domain/discord-messages/message-validation"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { selfGroupsView } from "./self-groups"
import assert from "node:assert/strict"
import test from "node:test"

for (const language of ["en", "cs", "de", "pl"])
    test(`/groups picker fits Discord limits in ${language}`, () => {
        for (const count of [0, 1, 26, 100])
            for (const page of [0, 1, 3]) {
                const groups = Array.from({ length: count }, (_, index) => ({
                    id: `group-${index}`,
                    name: `Group ${index}`,
                    gameId: "hell_let_loose",
                    selected: index % 2 === 0,
                }))
                const view = selfGroupsView(
                    {
                        language,
                        groups,
                        games: [
                            { id: "hell_let_loose", name: "Hell Let Loose" },
                        ],
                    },
                    "100000000000000001",
                    page
                )
                assert.deepEqual(
                    validateMessageView(view, {
                        copy: getSystemMessages(language).kit,
                        locale: language,
                    }).issues,
                    []
                )
            }
    })

for (const language of ["en", "cs", "de", "pl"]) {
    test(`/groups asks for a game first and scopes groups in ${language}`, () => {
        const context = {
            language,
            games: [
                { id: "hell_let_loose", name: "Hell Let Loose" },
                { id: "wardogs", name: "Wardogs" },
            ],
            groups: [
                {
                    id: "tank",
                    name: "Tanker",
                    gameId: "hell_let_loose",
                    selected: false,
                },
                {
                    id: "pilot",
                    name: "Pilot",
                    gameId: "wardogs",
                    selected: true,
                },
            ],
        }
        const first = selfGroupsView(context, "123")
        const selects = first.blocks.filter((block) => block.kind === "select")
        assert.equal(selects.length, 1)
        assert.deepEqual(
            selects[0].select.options.map((option) => option.value),
            ["hell_let_loose", "wardogs"]
        )
        const selected = selfGroupsView(context, "123", 0, false, "wardogs")
        assert.deepEqual(
            selected.blocks
                .find((block) => block.kind === "select")
                ?.select.options.map((option) => option.value),
            ["remove:pilot"]
        )
        assert.ok(
            selected.blocks.some(
                (block) =>
                    block.kind === "buttons" &&
                    block.buttons.some(
                        (button) =>
                            button.kind === "action" &&
                            button.id === "self-groups:games:123:0"
                    )
            )
        )
        assert.deepEqual(
            selfGroupsView(context, "123", 0, false, "removed-game"),
            first
        )
        for (const view of [first, selected])
            assert.deepEqual(
                validateMessageView(view, {
                    copy: getSystemMessages(language).kit,
                    locale: language,
                }).issues,
                []
            )
    })
    test(`/groups paginates games within Discord limits in ${language}`, () => {
        const context = {
            language,
            groups: [],
            games: Array.from({ length: 30 }, (_, i) => ({
                id: `game-${i}`,
                name: `Game ${i}`,
            })),
        }
        for (const page of [0, 1, 100]) {
            const view = selfGroupsView(context, "123", page)
            assert.deepEqual(
                validateMessageView(view, {
                    copy: getSystemMessages(language).kit,
                    locale: language,
                }).issues,
                []
            )
            assert.equal(
                view.blocks.find((block) => block.kind === "select")?.select
                    .options.length,
                page === 0 ? 25 : 5
            )
        }
    })
}
