import assert from "node:assert/strict"
import test from "node:test"

import {
    noticeModalTitle,
    noticeMultipleCard,
    noticeNotSignedUpCard,
    noticeOptionLabel,
    noticeSavedView,
    noticeStartedCard,
} from "./notice-view"
import { getCommandMessages } from "@/lib/clan-language/commands"
import { viewText } from "@/infrastructure/testing/discord-view"

const cs = getCommandMessages("cs").notice
const match = {
    name: "VLK vs ROG",
    categoryLabel: "Přátelák",
    gameStart: "2026-10-11T18:00:00Z",
}

test("the autocomplete labels show name, category, weekday, date and time in the clan zone (M3-15)", () => {
    assert.equal(
        noticeOptionLabel(match, "cs-CZ", "Europe/Prague"),
        "VLK vs ROG · Přátelák · ne 11. 10. · 20:00"
    )
    assert.equal(
        noticeOptionLabel(
            { name: "Trénink obrany", gameStart: "2026-10-13T17:30:00Z" },
            "cs-CZ",
            "Europe/Prague"
        ),
        "Trénink obrany · út 13. 10. · 19:30"
    )
    assert.ok(
        noticeOptionLabel({ ...match, name: "x".repeat(140) }, "cs-CZ")
            .length <= 100
    )
})

test("the window's title names the event within Discord's 45 characters (M3-16)", () => {
    assert.equal(
        noticeModalTitle(cs, "VLK vs ROG"),
        "Přijdu později · VLK vs ROG"
    )
    assert.equal(noticeModalTitle(cs, null), "Přijdu později · Akce")
    const long = noticeModalTitle(
        cs,
        "Velmi dlouhý název zápasu, který se nevejde"
    )
    assert.equal(long.length, 45)
    assert.ok(long.endsWith("…"))
    assert.equal(cs.modalNote, "Uvidí to jen velení zápasu.")
    assert.equal(cs.reasonLabel, "Kdy dorazíš a proč?")
    assert.equal(cs.reasonPlaceholder, "Např. kolem 20:30, končím v práci.")
})

test("the confirmation quotes the reason and says reminders stop (M3-17, M3-B03)", () => {
    const view = noticeSavedView({
        copy: cs,
        event: match,
        reason: "Kolem 20:30, končím v práci.",
        locale: "cs-CZ",
        timeZone: "Europe/Prague",
    })
    assert.equal(view.ephemeral, true)
    const text = viewText(view)
    assert.match(text, /### Velení ví, že přijdeš později/)
    assert.match(text, /VLK vs ROG · Přátelák · ne <t:\d+:d> · <t:\d+:t>/)
    assert.match(text, /> Kolem 20:30, končím v práci\./)
    assert.match(
        text,
        /Připomínky docházky k tomuto zápasu ti už chodit nebudou\. Změnit to můžeš dalším \/notice\./
    )
})

test("a reason cannot ping or format", () => {
    const text = viewText(
        noticeSavedView({
            copy: cs,
            event: match,
            reason: "@everyone **hi**\n<@&1>",
            locale: "cs-CZ",
        })
    )
    assert.doesNotMatch(text, /(^|[^\\])\*\*hi/)
    assert.match(text, /\\<@&1\\>/)
})

test("not signed up, already started and several matches are short cards (M3-18..20)", () => {
    assert.match(
        viewText(noticeNotSignedUpCard(cs, "300000000000000003")),
        /Nejsi přihlášený na žádnou nadcházející akci\nOmluvu pošleš jen k akci, na kterou jsi přihlášený a která ještě nezačala\. Přihlásíš se v <#300000000000000003>\./
    )
    assert.match(
        viewText(noticeStartedCard(cs, "VLK vs ROG")),
        /VLK vs ROG už začal\nNapiš velení přímo do kanálu zápasu\./
    )
    assert.match(
        viewText(noticeMultipleCard(cs)),
        /Takových akcí je víc\nVyber jednu z nabídky, ukazuje i den a čas\./
    )
})
