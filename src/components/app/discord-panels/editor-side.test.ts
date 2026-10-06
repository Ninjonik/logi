import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import { getDictionary } from "@/i18n/dictionaries"

import { JoinPageMock } from "./editor-side"

/** The visible text, without markup. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ")

const mock = (
    locale: "cs" | "en" | "de",
    game: "hell_let_loose" | "wardogs",
    value: { address?: string | null; joinCode?: string | null } = {}
) =>
    textOf(
        renderToStaticMarkup(
            createElement(JoinPageMock, {
                url: "https://logi.app/join/vlci",
                name: game === "wardogs" ? "Vlci WD" : "Vlci #1",
                game,
                map: null,
                players: null,
                capacity: null,
                address: value.address ?? null,
                joinCode: value.joinCode ?? null,
                dictionary: getDictionary(locale),
            })
        )
    )

test("the HLL join page mock opens Steam and falls back to the IP (P2-28)", () => {
    const hll = mock("cs", "hell_let_loose", { address: "203.0.113.24:7777" })
    assert.match(hll, /Otevřít ve Steamu/)
    assert.match(hll, /zvolte Připojit přes IP a zadejte 203\.0\.113\.24:7777/)
    assert.match(hll, /steam:\/\/connect/)
})

test("a Wardogs join page mock shows the join code in the dashboard's formal tone, without Steam or IP", () => {
    const wardogs = mock("cs", "wardogs", { joinCode: "VLCI-7Q2" })
    assert.match(
        wardogs,
        /Ve hře otevřete připojení ke hře a zadejte kód VLCI-7Q2\./
    )
    assert.match(wardogs, /ukáže kód pro připojení do hry/)
    assert.doesNotMatch(wardogs, /steam:\/\/connect|IP|Steam/)
    // Informal "ty" forms do not mix in.
    assert.doesNotMatch(wardogs, /\b(otevři|zadej)\b/)
    assert.match(
        mock("cs", "wardogs"),
        /Bez kódu stránka jen napíše, ať se hráč zeptá správce\./
    )
    assert.match(
        mock("de", "wardogs", { joinCode: "VLCI-7Q2" }),
        /Öffnen Sie im Spiel den Beitritt und geben Sie den Code VLCI-7Q2 ein\./
    )
    assert.doesNotMatch(
        mock("en", "wardogs", { joinCode: "VLCI-7Q2" }),
        /steam:\/\/connect|IP/
    )
})
