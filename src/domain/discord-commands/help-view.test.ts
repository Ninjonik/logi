import assert from "node:assert/strict"
import test from "node:test"

import { validateMessageView } from "../discord-messages/message-validation"
import { layoutMessageView } from "../discord-messages/message-layout"
import { getCommandMessages } from "../../lib/clan-language/commands"
import type { MessageView } from "../discord-messages/message-view"
import { getSystemMessages } from "../../lib/clan-language/system"
import { buildHelpView, helpChannelsLine } from "./help-view"
import { notConnectedCard } from "./access-view"

const layout = (view: MessageView, language = "cs") => {
    const options = {
        copy: getSystemMessages(language).kit,
        locale: language === "cs" ? "cs-CZ" : "en-GB",
    }
    assert.deepEqual(validateMessageView(view, options), {
        ok: true,
        issues: [],
    })
    return layoutMessageView(view, options)
}
const text = (view: MessageView, language = "cs") =>
    JSON.stringify(layout(view, language).nodes)

const cs = getCommandMessages("cs")
const channels = {
    recruitment: "300000000000000001",
    tickets: "300000000000000002",
    announcements: "300000000000000003",
}

test("the member's /help lists their commands in the clan language with the guide link (M2-05..08)", () => {
    const view = buildHelpView({
        copy: cs.help,
        clanName: "Vlci",
        list: {
            members: ["stats", "player", "link", "notice"],
            staff: [],
            staffReason: null,
        },
        channels,
        guideUrl: "https://logi.example/wiki/configuration/commands",
    })
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan")
    const out = text(view)
    assert.match(out, /PŘÍKAZY LOGI · KLAN VLCI/)
    assert.match(out, /Co tady můžeš použít/)
    assert.match(
        out,
        /`\/stats`\\nTvoje statistiky z Hell Let Loose nebo Wardogs\. Vidíš je jen ty, dokud je nesdílíš\./
    )
    assert.match(out, /Propoj herní účty, ať tě Logi pozná ve hře\./)
    assert.match(
        out,
        /Přihláška do klanu, tickety a přihlašování na zápasy jsou tlačítka v kanálech <#300000000000000001>, <#300000000000000002> a <#300000000000000003>\./
    )
    assert.doesNotMatch(out, /PRO SPRÁVCE|close_ticket|server-status/)
    const buttons = view.blocks.find((block) => block.kind === "buttons")
    assert.deepEqual(buttons, {
        kind: "buttons",
        buttons: [
            {
                kind: "link",
                url: "https://logi.example/wiki/configuration/commands",
                label: "Návod na webu",
            },
        ],
    })
})

test("the admin's /help adds PRO SPRÁVCE with the reason (M2-09)", () => {
    const out = text(
        buildHelpView({
            copy: cs.help,
            clanName: "Vlci",
            list: {
                members: ["stats", "player", "link", "notice"],
                staff: ["close_ticket", "close_application", "server-status"],
                staffReason: "adminRole",
            },
            channels,
            guideUrl: "https://logi.example/wiki/configuration/commands",
        })
    )
    assert.match(out, /\*\*PRO SPRÁVCE\*\*/)
    assert.match(out, /Vidíš je, protože máš Roli správců Logi\./)
    assert.match(
        out,
        /`\/close_ticket`\\nVe vlákně ticketu ho uzavře a pošle autorovi shrnutí\./
    )
    assert.match(
        out,
        /`\/close_application`\\nVe vlákně přihlášky rozhodne o uchazeči a přidá role\./
    )
    assert.match(
        out,
        /`\/server-status`\\nUložený stav herních serverů klanu\./
    )
})

test("a partial set of channels gets one sentence per button", () => {
    assert.equal(
        helpChannelsLine(cs.help, { tickets: "300000000000000002" }),
        "Ticket otevřeš tlačítkem v kanálu <#300000000000000002>."
    )
    assert.equal(helpChannelsLine(cs.help, {}), undefined)
})

test("a server not connected to Logi gets the setup card with Co je Logi (M2-10)", () => {
    const view = notConnectedCard(cs.access, "https://logi.example")
    const out = text(view)
    assert.match(out, /Logi tu ještě není nastavené/)
    assert.match(
        out,
        /Správce serveru propojí Discord s Logi na webu\. Pak tu uvidíš svoje příkazy\./
    )
    assert.deepEqual(view.blocks.at(-1), {
        kind: "buttons",
        buttons: [
            { kind: "link", url: "https://logi.example", label: "Co je Logi" },
        ],
    })
})

test("/help is written in the clan language, also in English and German", () => {
    for (const language of ["en", "de"] as const) {
        const copy = getCommandMessages(language)
        const out = text(
            buildHelpView({
                copy: copy.help,
                clanName: "Wolves",
                list: { members: ["stats"], staff: [], staffReason: null },
                channels: {},
                guideUrl: "https://logi.example/wiki/configuration/commands",
            }),
            language
        )
        assert.match(out, new RegExp(copy.help.title))
        assert.doesNotMatch(out, /Co tady/)
    }
})
