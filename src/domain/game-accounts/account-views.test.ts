import assert from "node:assert/strict"
import test from "node:test"

import {
    foundPlayerDescription,
    guideView,
    invalidIdView,
    linkedAccountsView,
    linkFlowId,
    linkIdModalId,
    linkSearchModalId,
    linkStartView,
    parseLinkFlowId,
    parseLinkIdModalId,
    parseLinkSearchModalId,
    playedBeforeView,
    searchEmptyView,
    searchResultsView,
    staleLinkView,
    takenIdView,
    unlinkView,
} from "./account-views"
import {
    layoutForTest,
    viewButtons,
    viewText,
} from "@/infrastructure/testing/discord-view"
import { getGameAccountMessages } from "@/lib/clan-language/game-accounts"
import type { MessageView } from "@/domain/discord-messages/message-view"

const cs = getGameAccountMessages("cs")
const link = { kind: "link" } as const

function selectOf(view: MessageView) {
    const block = view.blocks.find((item) => item.kind === "select")
    assert.ok(block && block.kind === "select")
    return block.select
}

test("the guide's IDs round-trip and anything else reads as stale", () => {
    assert.equal(linkFlowId(link, "enter", "steam"), "link:l:enter:steam")
    assert.deepEqual(parseLinkFlowId("link:l:enter:steam"), {
        context: link,
        step: "enter",
        platform: "steam",
    })
    const application = { kind: "application", draftId: "k57abc" } as const
    assert.deepEqual(parseLinkFlowId(linkFlowId(application, "platform")), {
        context: application,
        step: "platform",
        platform: undefined,
    })
    assert.deepEqual(parseLinkIdModalId(linkIdModalId(link, "xbox")), {
        context: link,
        platform: "xbox",
    })
    assert.deepEqual(parseLinkSearchModalId(linkSearchModalId(link)), link)
    for (const stale of [
        "link:l:enter",
        "link:x:start",
        "link:l:nope",
        "link:l:enter:origin",
        "plink:start:l:_:_",
    ])
        assert.equal(parseLinkFlowId(stale), null, stale)
})

test("nothing linked: the platform select, the declaration and the web verification (L4-46..48)", () => {
    const view = linkStartView({
        copy: cs,
        context: link,
        verifySteamUrl: "https://logi.example/cs/dashboard/settings/user",
        emoji: { steam: "<:steam:123456789012345678>" },
    })
    const text = viewText(view)
    assert.match(text, /-# \*\*HERNÍ ÚČTY\*\*/)
    assert.match(text, /### Propoj svůj herní účet/)
    assert.match(
        text,
        /Podle ID tě Logi spáruje s tvými hrami, statistikami a přihláškou do klanu\./
    )
    assert.match(
        text,
        /Je to tvoje prohlášení, ne ověření vlastnictví\. Ověřený Steam propojíš v Logi → Můj účet\./
    )
    const select = selectOf(view)
    assert.equal(select.placeholder, "Vyber platformu")
    assert.deepEqual(
        select.options.map((option) => [option.label, option.description]),
        [
            ["Steam", "Steam64 ID, 17 číslic"],
            ["Epic Games", "Epic Account ID"],
            ["Xbox", "ID profilu Xbox"],
            ["PlayStation", "ID profilu PlayStation"],
        ]
    )
    assert.equal(select.options[0]?.emoji, "<:steam:123456789012345678>")
    assert.deepEqual(viewButtons(view), [
        {
            label: "Ověřit Steam na webu",
            link: "https://logi.example/cs/dashboard/settings/user",
        },
    ])
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan")
})

test("'Hrál jsi u nás?' offers the search or the manual ID (L4-49)", () => {
    const view = playedBeforeView({ copy: cs, context: link })
    assert.match(viewText(view), /### Hrál jsi už na serverech klanu\?/)
    const select = selectOf(view)
    assert.equal(select.placeholder, "Vyber jednu možnost")
    assert.deepEqual(
        select.options.map((option) => [option.label, option.description]),
        [
            ["Ano, najděte mě", "Najdeme tě podle jména ve hře"],
            ["Ne, zadám ID", "Vybereš platformu a ID zadáš sám"],
        ]
    )
})

test("search results name the platform, last game and server (L4-51)", () => {
    assert.equal(
        foundPlayerDescription(cs, {
            playerId: "76561198000000017",
            name: "Hráč 17",
            platform: "steam",
            lastSeen: "so 3. 10.",
            server: "Vlci #1",
        }),
        "Steam · naposledy so 3. 10. na Vlci #1"
    )
    const view = searchResultsView({
        copy: cs,
        context: link,
        players: [
            {
                playerId: "76561198000000017",
                name: "Hráč 17",
                platform: "steam",
                lastSeen: "so 3. 10.",
                server: "Vlci #1",
            },
            {
                playerId: "8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
                name: "Hrac17_CZ",
                platform: "epic",
                lastSeen: "12. 9.",
                server: "Vlci #2",
            },
        ],
    })
    const text = viewText(view)
    assert.match(text, /### Vyber se ze seznamu/)
    assert.match(text, /Hráči, kteří hráli na serverech klanu\./)
    const select = selectOf(view)
    assert.equal(select.placeholder, "Vyber svoje jméno")
    assert.deepEqual(select.options[1], {
        value: "8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
        label: "Hrac17_CZ",
        description: "Epic Games · naposledy 12. 9. na Vlci #2",
    })
    assert.deepEqual(
        viewButtons(view).map((button) => button.label),
        ["Hledat znovu", "Zadat ID ručně"]
    )
    const empty = searchEmptyView({ copy: cs, context: link })
    assert.match(viewText(empty), /### Na serverech klanu jsme tě nenašli/)
    assert.match(viewText(empty), /Zkus jiné jméno, nebo zadej ID ručně\./)
    assert.deepEqual(
        viewButtons(empty).map((button) => button.label),
        ["Hledat znovu", "Zadat ID ručně"]
    )
})

test("the Steam guide: what the ID is, three steps, enter, guide and back (L4-52)", () => {
    const view = guideView({
        copy: cs,
        context: link,
        platform: "steam",
        guideUrl: "https://help.steampowered.com/faq",
    })
    const text = viewText(view)
    assert.match(text, /-# \*\*HERNÍ ÚČTY · STEAM\*\*/)
    assert.match(text, /### Najdi své Steam64 ID/)
    assert.match(text, /Je to 17místné číslo, které začíná 7656119\./)
    assert.match(
        text,
        /1\. Otevři návod\.\n2\. Zkopíruj číslo u Steam64 ID\.\n3\. Vlož ho v dalším kroku\./
    )
    assert.deepEqual(viewButtons(view), [
        {
            label: "Zadat Steam64 ID",
            style: "primary",
            id: "link:l:enter:steam",
        },
        { label: "Návod", link: "https://help.steampowered.com/faq" },
        { label: "Zpět", style: "secondary", id: "link:l:back" },
    ])
})

test("inside the application the guide's button reads 'Zadat ID a pokračovat' (L4-60)", () => {
    const view = guideView({
        copy: cs,
        context: { kind: "application", draftId: "k57abc" },
        platform: "steam",
    })
    assert.equal(viewButtons(view)[0]?.label, "Zadat ID a pokračovat")
})

test("linked accounts: chip, rows, blurple add and red unlink (L4-54, M3-09)", () => {
    const accounts = ["steam:76561198000000017", "xbox:Hrac17CZ"]
    const view = linkedAccountsView({ copy: cs, context: link, accounts })
    const text = viewText(view)
    assert.match(text, /### Tvoje propojené účty/)
    assert.match(text, /🟢 \*\*Steam propojený\*\*/)
    assert.match(
        text,
        /\*\*Steam\*\* · 76561198000000017\n\*\*Xbox\*\* · Hrac17CZ/
    )
    assert.deepEqual(viewButtons(view), [
        { label: "Přidat další účet", style: "primary", id: "link:l:start" },
        { label: "Odpojit účet", style: "danger", id: "link:l:unlink" },
    ])

    const success = linkedAccountsView({
        copy: cs,
        context: link,
        accounts,
        justLinked: "steam",
    })
    const successText = viewText(success)
    assert.match(successText, /### Steam je propojený/)
    assert.match(
        successText,
        /Logi tě teď spáruje s tvými hrami a statistikami\./
    )
    assert.doesNotMatch(successText, /propojený\*\*/)
})

test("unlinking says what changes and warns about the application (L4-55, L4-B09)", () => {
    const view = unlinkView({
        copy: cs,
        context: link,
        accounts: ["xbox:Hrac17CZ", "steam:76561198000000017"],
        usedByApplication: new Set(["steam:76561198000000017"]),
    })
    assert.match(viewText(view), /### Který účet odpojit\?/)
    const select = selectOf(view)
    assert.equal(select.placeholder, "Vyber účet")
    assert.deepEqual(
        select.options.map((option) => [option.label, option.description]),
        [
            [
                "Xbox · Hrac17CZ",
                "Statistiky z tohoto účtu se přestanou párovat",
            ],
            [
                "Steam · 76561198000000017",
                "Používá ho tvoje přihláška do klanu",
            ],
        ]
    )
    assert.deepEqual(
        viewButtons(view).map((button) => button.label),
        ["Zpět"]
    )
})

test("errors: invalid Steam64, taken ID and a stale offer (L4-56, L4-58, M3-11, M3-12)", () => {
    const invalid = invalidIdView({
        copy: cs,
        context: link,
        platform: "steam",
        guideUrl: "https://help.steampowered.com/faq",
    })
    const text = viewText(invalid)
    assert.match(text, /### Tohle nevypadá jako Steam64 ID/)
    assert.match(
        text,
        /Má 17 číslic a začíná 7656119\. Najdeš ho podle návodu\./
    )
    assert.deepEqual(viewButtons(invalid), [
        { label: "Zadat znovu", style: "primary", id: "link:l:enter:steam" },
        { label: "Návod", link: "https://help.steampowered.com/faq" },
    ])
    assert.match(
        viewText(takenIdView({ copy: cs, context: link, platform: "steam" })),
        /Tohle ID už má propojené jiný hráč/
    )
    const stale = viewText(staleLinkView(cs))
    assert.match(stale, /### Tahle nabídka už neplatí/)
    assert.match(stale, /Spusť \/link znovu\./)
})

test("every /link card passes the board rules in all three languages", () => {
    for (const language of ["cs", "en", "de"] as const) {
        const copy = getGameAccountMessages(language)
        for (const platform of [
            "steam",
            "epic",
            "xbox",
            "playstation",
        ] as const) {
            layoutForTest(
                guideView({ copy, context: link, platform }),
                language
            )
            layoutForTest(
                invalidIdView({ copy, context: link, platform }),
                language
            )
            assert.ok(copy.platforms[platform].idName.length <= 45)
            assert.ok(copy.platforms[platform].modalTitle.length <= 45)
        }
        layoutForTest(linkStartView({ copy, context: link }), language)
        layoutForTest(
            linkedAccountsView({
                copy,
                context: link,
                accounts: ["steam:76561198000000017"],
            }),
            language
        )
        assert.ok(copy.search.modalTitle.length <= 45)
        assert.ok(copy.search.label.length <= 45)
    }
})
