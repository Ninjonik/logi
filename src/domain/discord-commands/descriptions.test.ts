import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_COMMAND_SETTINGS,
    resolveCommandSettings,
} from "./command-settings"
import { COMMAND_DESCRIPTION_MAX, describeCommand } from "./descriptions"
import { getCommandMessages } from "@/lib/clan-language/commands"
import { czechFrom, joinNatural } from "./text"
import { LOGI_COMMANDS } from "./catalog"

/** The descriptions of board M1 1.3 in cs, en and de, word for word. */
const BOARD: Record<string, Record<string, string>> = {
    cs: {
        help: "Příkazy, které můžeš použít, a odkaz na návod",
        stats: "Tvoje statistiky z Hell Let Loose nebo Wardogs",
        player: "Profil hráče klanu: skóre a poslední zápasy",
        link: "Propoj své herní účty: Steam, Epic, Xbox, PlayStation",
        notice: "Dej velení vědět, že na akci přijdeš později",
        "server-status": "Uložený stav herních serverů klanu (pro správce)",
        close_ticket: "Uzavře tento ticket a pošle autorovi shrnutí",
        close_application: "Rozhodne o přihlášce v tomto vlákně a uzavře ji",
    },
    en: {
        help: "Commands you can use and a link to the guide",
        stats: "Your Hell Let Loose or Wardogs statistics",
        player: "A clan player's profile: score and recent matches",
        link: "Link your game accounts: Steam, Epic, Xbox, PlayStation",
        notice: "Let the leads know you'll be late for an event",
        "server-status": "Stored status of the clan's game servers (managers)",
        close_ticket: "Close this ticket and send the author a summary",
        close_application: "Decide the application in this thread and close it",
    },
    de: {
        help: "Befehle, die du nutzen kannst, und ein Link zur Anleitung",
        stats: "Deine Statistiken aus Hell Let Loose oder Wardogs",
        player: "Profil eines Clan-Spielers: Score und letzte Matches",
        link: "Verknüpfe deine Spielkonten: Steam, Epic, Xbox, PlayStation",
        notice: "Sag der Leitung, dass du später zu einem Event kommst",
        "server-status":
            "Gespeicherter Status der Clan-Spielserver (für Verwalter)",
        close_ticket:
            "Schließt dieses Ticket und schickt dem Autor eine Zusammenfassung",
        close_application:
            "Entscheidet über die Bewerbung in diesem Thread und schließt sie",
    },
}

test("the descriptions match board M1 in cs, en and de (M1-26..33, N3-23)", () => {
    for (const language of ["cs", "en", "de"] as const) {
        const copy = getCommandMessages(language).registry
        for (const command of LOGI_COMMANDS)
            assert.equal(
                describeCommand(copy, command, DEFAULT_COMMAND_SETTINGS),
                BOARD[language]![command],
                `${language} ${command}`
            )
    }
})

test("the managers' suffix follows the settings (N3-B07)", () => {
    const copy = getCommandMessages("cs").registry
    const settings = resolveCommandSettings(
        {
            player: { audience: "logiAdmins" },
            serverStatus: { audience: "clanMembers" },
        },
        true
    )
    assert.equal(
        describeCommand(copy, "player", settings),
        "Profil hráče klanu: skóre a poslední zápasy (pro správce)"
    )
    assert.equal(
        describeCommand(copy, "server-status", settings),
        "Uložený stav herních serverů klanu"
    )
})

test("every description and option fits Discord's limits", () => {
    for (const language of ["cs", "en", "de"] as const) {
        const copy = getCommandMessages(language).registry
        for (const text of Object.values(copy.descriptions))
            assert.ok(
                `${text}${copy.managerSuffix}`.length <= COMMAND_DESCRIPTION_MAX
            )
        for (const option of Object.values(copy.options)) {
            assert.match(option.name, /^[-_\p{Ll}\p{Lo}\p{N}]{1,32}$/u)
            assert.ok(option.description.length <= 100)
        }
    }
})

test("Czech uses ze before dvou, tří, čtyř, šesti, sedmi, as the boards write", () => {
    assert.deepEqual([3, 4, 7, 12, 21, 23, 5].map(czechFrom), [
        "ze",
        "ze",
        "ze",
        "z",
        "z",
        "z",
        "z",
    ])
    assert.equal(joinNatural(["a", "b", "c"], " a "), "a, b a c")
    assert.equal(joinNatural(["a"], " a "), "a")
})
