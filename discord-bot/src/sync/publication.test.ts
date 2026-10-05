import assert from "node:assert/strict"
import test from "node:test"

import {
    PublicationPermissionError,
    publicationDeliveryError,
    publicationSource,
} from "./publication"
import { PublicationNotSent } from "../../../src/application/discord-publications/publish"

test("a failed delivery uses the errors channel's words, never the English internal text (L5-44)", () => {
    const failure = new PublicationPermissionError(
        ["SendMessages", "EmbedLinks"],
        "servery"
    )
    assert.equal(
        publicationDeliveryError("cs", failure, "panel:abc"),
        "Panel se neaktualizoval. Proč: Bot nemá v kanálu #servery oprávnění Posílat zprávy a Vkládat odkazy. Co udělat: V Discordu otevři #servery → Upravit kanál → Oprávnění → Logi a povol Posílat zprávy a Vkládat odkazy."
    )
    assert.match(
        publicationDeliveryError("cs", failure, "event:e1:announcement"),
        /^Ohlášení zápasu se neodeslalo\. Proč:/
    )
    assert.match(
        publicationDeliveryError(
            "cs",
            Object.assign(new PublicationNotSent("x"), {
                deliveryCause: { code: 10003 },
            }),
            "calendar"
        ),
        /^Kalendář se neaktualizoval\. Proč: Kanál z nastavení Logi už na serveru není\. Co udělat: Vyber nový kanál v Logi → Kanály a jazyk\.$/
    )
    assert.match(
        publicationDeliveryError("de", new PublicationNotSent("x")),
        /^Das Panel wurde nicht aktualisiert\. Warum: Discord hat die Aktion abgelehnt\./
    )
    for (const language of ["cs", "de"]) {
        const text = publicationDeliveryError(language, failure)
        assert.doesNotMatch(
            text,
            /Discord delivery failed|permissions missing|PublicationNotSent/
        )
        assert.ok(text.length <= 240)
    }
})

test("managed messages are named by their key", () => {
    assert.equal(publicationSource("event:e1:announcement"), "announcement")
    assert.equal(publicationSource("event:e1:roster"), "roster")
    assert.equal(publicationSource("event:e1:roster-changes"), "roster")
    assert.equal(publicationSource("ticket"), "ticketPanel")
    assert.equal(publicationSource("membership"), "applicationPanel")
    assert.equal(publicationSource("calendar"), "calendarPanel")
    assert.equal(publicationSource("league:1"), "publicPanel")
    assert.equal(publicationSource(undefined), "publicPanel")
})

test("an uncertain create says so in the clan language", () => {
    const uncertain = new Error(
        "Delivery uncertain: exact message marker not found in recent history. Operator reconciliation required."
    )
    assert.match(
        publicationDeliveryError("cs", uncertain),
        /^Není jisté, jestli zpráva do Discordu dorazila/
    )
    assert.match(
        publicationDeliveryError(undefined, uncertain),
        /^It is unclear whether the message reached Discord/
    )
})
