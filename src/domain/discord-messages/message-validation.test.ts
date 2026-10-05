import assert from "node:assert/strict"
import test from "node:test"

import {
    assertValidMessageView,
    InvalidMessageViewError,
    validateMessageView,
    type MessageViewIssueCode,
} from "./message-validation"
import {
    errorCard,
    pagedListReply,
    panelFrame,
    type MessageButton,
    type MessageView,
} from "./message-view"
import type { MessageLayoutOptions } from "./message-layout"

const options: MessageLayoutOptions = {
    copy: {
        updated: "Aktualizováno {time}",
        refreshEvery: "obnovuje se každých {seconds} s",
        managed: "Spravováno v Logi",
        dmClan: "Klan {clan}",
        dmSettings: "Nastavit zprávy",
        page: "Strana {page} z {pages}",
        paused: "Pozastaveno",
        lastData: "poslední data {time}",
    },
    locale: "cs-CZ",
}
const action = (
    id: string,
    style: "primary" | "success" | "secondary" | "danger" = "secondary"
): MessageButton => ({ kind: "action", id, label: `Akce ${id}`, style })
const view = (buttons: MessageButton[][]): MessageView => ({
    accent: "clan",
    header: { title: "Zpráva" },
    blocks: buttons.map((row) => ({ kind: "buttons", buttons: row })),
})
const codes = (value: MessageView) => {
    const result = validateMessageView(value, options)
    return result.issues.map((issue) => issue.code)
}
const expectOnly = (value: MessageView, code: MessageViewIssueCode) =>
    assert.deepEqual(codes(value), [code])

test("standard cards and frames are valid", () => {
    assert.deepEqual(
        validateMessageView(
            errorCard({ title: "Tohle se nepovedlo", body: "Zkus to znovu." }),
            options
        ),
        { ok: true, issues: [] }
    )
    assert.deepEqual(
        codes(
            panelFrame({
                label: "Výsledek · Přátelák",
                title: "VLK 4 : 1 ROG",
                actions: [
                    [
                        action("players", "primary"),
                        action("report"),
                        {
                            kind: "link",
                            url: "https://logi.app/m/1",
                            label: "Zobrazit zápas",
                        },
                    ],
                ],
                updatedAt: Date.now(),
            })
        ),
        []
    )
    assert.deepEqual(
        codes(
            pagedListReply({
                title: "Hráči",
                rows: Array.from({ length: 30 }, (_, i) => `Hráč ${i}`),
                page: 2,
                id: (page) => `p:${page}`,
                previousLabel: "Předchozí",
                nextLabel: "Další",
            })
        ),
        []
    )
})

test("a message has at most one primary action, blurple or green", () => {
    expectOnly(
        view([[action("a", "primary"), action("b", "success")]]),
        "too-many-primary"
    )
    expectOnly(
        view([[action("a", "primary")], [action("b", "primary")]]),
        "too-many-primary"
    )
    assert.deepEqual(
        codes(view([[action("a", "success"), action("b", "danger")]])),
        []
    )
})

test("at most five buttons in a row and two rows of buttons", () => {
    expectOnly(
        view([["1", "2", "3", "4", "5", "6"].map((id) => action(id))]),
        "row-too-long"
    )
    expectOnly(
        view([[action("1")], [action("2")], [action("3")]]),
        "too-many-button-rows"
    )
    expectOnly(view([[]]), "row-empty")
})

test("link buttons go only to http(s) and carry no hand-written arrow", () => {
    for (const url of [
        "javascript:alert(1)",
        "steam://connect/1.2.3.4:27015",
        "ftp://x",
        "not a url",
    ])
        expectOnly(
            view([[{ kind: "link", url, label: "Připojit se" }]]),
            "link-not-http"
        )
    expectOnly(
        view([
            [{ kind: "link", url: "https://logi.app", label: "Odkaz ven ↗" }],
        ]),
        "link-label-arrow"
    )
    expectOnly(
        view([
            [
                {
                    kind: "link",
                    url: `https://logi.app/${"x".repeat(520)}`,
                    label: "Dlouhý",
                },
            ],
        ]),
        "url-too-long"
    )
})

test("labels and custom IDs follow Discord's limits and stay unique", () => {
    expectOnly(
        view([[{ ...action("a"), label: "x".repeat(81) } as MessageButton]]),
        "label-too-long"
    )
    expectOnly(
        view([[{ ...action("a"), label: " " } as MessageButton]]),
        "label-empty"
    )
    expectOnly(
        view([[{ ...action("a"), id: "x".repeat(101) } as MessageButton]]),
        "custom-id-invalid"
    )
    expectOnly(view([[action("same"), action("same")]]), "duplicate-custom-id")
})

test("selects respect option counts, text lengths and value ranges", () => {
    const select = (
        patch: Partial<
            Extract<MessageView["blocks"][number], { kind: "select" }>["select"]
        >
    ): MessageView => ({
        accent: "clan",
        header: { title: "Koho chceš nahlásit?" },
        blocks: [
            {
                kind: "select",
                select: {
                    id: "report:pick",
                    placeholder: "Vyber hráče",
                    options: [{ value: "1", label: "Hans_88" }],
                    ...patch,
                },
            },
        ],
    })
    assert.deepEqual(codes(select({})), [])
    assert.deepEqual(codes(select({ options: [] })), [
        "select-options",
        "select-values",
    ])
    expectOnly(
        select({
            options: Array.from({ length: 26 }, (_, i) => ({
                value: String(i),
                label: `Hráč ${i}`,
            })),
        }),
        "select-options"
    )
    expectOnly(
        select({ options: [{ value: "1", label: "x".repeat(101) }] }),
        "select-option-too-long"
    )
    expectOnly(
        select({ placeholder: "x".repeat(151) }),
        "select-placeholder-too-long"
    )
    expectOnly(select({ maxValues: 2 }), "select-values")
})

test("images are http(s) or attachments, galleries hold one to ten", () => {
    const gallery = (count: number, url = "https://logi.app/a.png") =>
        ({
            accent: "clan",
            blocks: [
                {
                    kind: "gallery",
                    items: Array.from({ length: count }, () => ({ url })),
                },
            ],
        }) satisfies MessageView
    assert.deepEqual(codes(gallery(10)), [])
    assert.deepEqual(codes(gallery(1, "attachment://map.webp")), [])
    expectOnly(gallery(11), "gallery-size")
    expectOnly(gallery(0), "gallery-size")
    expectOnly(gallery(1, "file:///etc/passwd"), "media-url")
    expectOnly(
        {
            accent: "clan",
            header: {
                title: "x",
                thumbnail: {
                    url: "https://logi.app/a.png",
                    description: "x".repeat(1025),
                },
            },
            blocks: [],
        },
        "media-description-too-long"
    )
})

test("the whole message stays within Discord's text and component limits", () => {
    expectOnly(
        {
            accent: "clan",
            header: { title: "Dlouhá zpráva" },
            blocks: [{ kind: "text", markdown: "x".repeat(4000) }],
        },
        "text-too-long"
    )
    expectOnly(
        {
            accent: "clan",
            header: { title: "Mnoho řádků" },
            blocks: Array.from({ length: 40 }, (_, i) => ({
                kind: "text" as const,
                markdown: `řádek ${i}`,
            })),
        },
        "too-many-components"
    )
})

test("a custom bar needs a hex colour and a message needs content", () => {
    expectOnly(
        { accent: { custom: "orange" }, header: { title: "x" }, blocks: [] },
        "accent-invalid"
    )
    expectOnly({ accent: "clan", blocks: [] }, "empty")
})

test("assertValidMessageView throws with every issue named", () => {
    assert.throws(
        () =>
            assertValidMessageView(
                view([[action("a", "primary"), action("a", "primary")]]),
                options
            ),
        (error: unknown) =>
            error instanceof InvalidMessageViewError &&
            error.issues.map((issue) => issue.code).join() ===
                "duplicate-custom-id,too-many-primary"
    )
    assert.doesNotThrow(() =>
        assertValidMessageView(errorCard({ title: "a", body: "b" }), options)
    )
})
