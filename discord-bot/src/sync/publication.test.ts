import assert from "node:assert/strict"
import test from "node:test"

import { PublicationNotSent } from "../../../src/application/discord-publications/publish"
import { publicationDeliveryError } from "./publication"

test("a failed delivery is stored in the clan language, never as the English internal text", () => {
    const failure = new Error("Publication channel permissions missing.")
    assert.equal(
        publicationDeliveryError("cs", failure),
        "Zprávu se nepodařilo doručit do Discordu. Zkontrolujte, že bot smí v kanálu zobrazit kanál, posílat zprávy a číst historii. Logi to zkusí znovu samo."
    )
    assert.match(
        publicationDeliveryError("de", new PublicationNotSent("x")),
        /^Die Nachricht konnte nicht an Discord zugestellt werden/
    )
    for (const language of ["cs", "de"])
        assert.doesNotMatch(
            publicationDeliveryError(language, failure),
            /Discord delivery failed|permissions missing/
        )
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
