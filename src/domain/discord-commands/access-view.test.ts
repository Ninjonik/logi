import assert from "node:assert/strict"
import test from "node:test"

import { commandDecisionCard, verifyFailedCard } from "./access-view"
import { getCommandMessages } from "@/lib/clan-language/commands"
import { viewText } from "@/infrastructure/testing/discord-view"

const cs = getCommandMessages("cs").access

test("a switched-off command says who can switch it on (N3-B04)", () => {
    const view = commandDecisionCard(
        { kind: "disabled" },
        { command: "player", copy: cs }
    )
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan")
    assert.match(
        viewText(view),
        /Příkaz \/player je tu vypnutý\nZapnout ho může správce v Logi → Nastavení → Příkazy\./
    )
})

test("nepovoleno names the group and any extra roles (M3-07)", () => {
    assert.match(
        viewText(
            commandDecisionCard(
                {
                    kind: "notAllowed",
                    audience: "clanMembers",
                    roleIds: ["100000000000000005", "100000000000000006"],
                },
                { command: "stats", copy: cs }
            )
        ),
        /\/stats smí použít jen členové klanu\nČlenové klanu mají klanovou roli z Logi\. Když ji máš mít, napiš správcům\. Smí ho použít i <@&100000000000000005> nebo <@&100000000000000006>\./
    )
})

test("jinde names the channels where it works (N3-B05)", () => {
    assert.match(
        viewText(
            commandDecisionCard(
                {
                    kind: "wrongChannel",
                    channelIds: ["300000000000000001", "300000000000000002"],
                },
                { command: "stats", copy: cs }
            )
        ),
        /\/stats tady nejde použít\nPoužij ho v <#300000000000000001> nebo <#300000000000000002>\./
    )
})

test("an unanswered role check never guesses (M3-33's wording)", () => {
    assert.match(
        viewText(verifyFailedCard(cs)),
        /Teď nejde ověřit tvoje role\nDiscord neodpověděl\. Zkus to za chvíli znovu\./
    )
})

test("no English words reach Czech or German readers", () => {
    for (const language of ["cs", "de"] as const) {
        const copy = getCommandMessages(language).access
        const text = viewText(
            commandDecisionCard(
                { kind: "disabled" },
                { command: "help", copy }
            ),
            language
        )
        assert.doesNotMatch(text, /switched off|Settings/)
    }
})
