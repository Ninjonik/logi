import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_COMMAND_SETTINGS,
    resolveCommandSettings,
} from "../../../src/domain/discord-commands/command-settings"
import {
    buildCommandDefinitions,
    commandDefinitionsSignature,
    fallbackGuildLanguage,
} from "./definitions"

type Option = {
    name: string
    name_localizations?: Record<string, string> | null
    description: string
    description_localizations?: unknown
    required?: boolean
    max_length?: number
    autocomplete?: boolean
    choices?: Array<{
        name: string
        value: string
        name_localizations?: unknown
    }>
}

const byName = (language: string, settings = DEFAULT_COMMAND_SETTINGS) =>
    Object.fromEntries(
        buildCommandDefinitions({ language, settings }).map((command) => [
            command.name,
            command as typeof command & { options?: Option[] },
        ])
    )

test("eight English command names, guild-only, visible to everyone (M1-05, M1-B03, M1-06)", () => {
    const definitions = buildCommandDefinitions({
        language: "cs",
        settings: DEFAULT_COMMAND_SETTINGS,
    })
    assert.deepEqual(
        definitions.map((command) => command.name),
        [
            "close_application",
            "close_ticket",
            "help",
            "link",
            "notice",
            "player",
            "server-status",
            "stats",
        ]
    )
    for (const command of definitions) {
        assert.deepEqual(command.contexts, [0], `${command.name} guild only`)
        assert.equal(command.default_member_permissions, undefined)
        assert.equal(command.dm_permission, undefined)
        assert.equal(command.description_localizations, undefined)
        assert.equal(command.name_localizations, undefined)
    }
})

test("descriptions, options and choices are the clan language's for everyone (M1-B02, M1 1.4)", () => {
    const cs = byName("cs")
    assert.equal(
        cs.help!.description,
        "Příkazy, které můžeš použít, a odkaz na návod"
    )
    assert.equal(
        cs["server-status"]!.description,
        "Uložený stav herních serverů klanu (pro správce)"
    )
    const stats = cs.stats!.options!
    assert.deepEqual(
        stats.map((option) => [
            option.name,
            option.name_localizations?.cs,
            option.required ?? false,
        ]),
        [
            ["game", "hra", true],
            ["member", "člen", false],
            ["player", "hráč", false],
            ["period", "období", false],
            ["server", undefined, false],
            ["channel", "kanál", false],
        ],
        "the English key stays; every Discord locale shows the Czech name"
    )
    assert.equal(stats[0]!.name_localizations?.["en-US"], "hra")
    assert.equal(
        stats[3]!.description,
        "7, 30 nebo 90 dní, nebo celá historie (výchozí 30 dní)"
    )
    assert.deepEqual(
        stats[3]!.choices!.map((choice) => [choice.name, choice.value]),
        [
            ["7 dní", "7d"],
            ["30 dní", "30d"],
            ["90 dní", "90d"],
            ["Celá historie", "all"],
        ]
    )
    assert.equal(stats[3]!.choices![0]!.name_localizations, undefined)
    const outcome = cs.close_application!.options![0]!
    assert.equal(outcome.name_localizations?.cs, "výsledek")
    assert.equal(outcome.description, "Čím se uchazeč stane")
    assert.deepEqual(
        outcome.choices!.map((choice) => choice.name),
        ["Člen", "Rekrut", "Žoldák", "Čeká na rozhodnutí", "Zamítnuto"]
    )
    for (const reason of [
        cs.close_ticket!.options![0]!,
        cs.close_application!.options![1]!,
    ]) {
        assert.equal(reason.max_length, 500, "M1-B11")
        assert.equal(reason.name_localizations?.cs, "důvod")
    }
    assert.equal(
        cs.player!.options![0]!.description,
        "Hráč klanu, vyber z nabídky"
    )
    assert.equal(cs.player!.options![0]!.autocomplete, true)
    assert.equal(
        cs.notice!.options![0]!.description,
        "Akce, na kterou jsi přihlášený a která nezačala"
    )
})

test("German shows German choices, never English words (M3-37)", () => {
    const de = byName("de")
    assert.deepEqual(
        de.close_application!.options![0]!.choices!.map(
            (choice) => choice.name
        ),
        ["Mitglied", "Rekrut", "Söldner", "Weiter offen", "Abgelehnt"]
    )
    assert.equal(de.stats!.options![0]!.name_localizations?.de, "spiel")
    assert.equal(de.stats!.options![3]!.choices![3]!.name, "Gesamte Historie")
})

test("an English clan keeps the plain English option names", () => {
    const en = byName("en")
    assert.equal(en.stats!.options![0]!.name_localizations, undefined)
    assert.equal(
        en.help!.description,
        "Commands you can use and a link to the guide"
    )
})

test("the signature changes with the language and the managers' suffix, not otherwise", () => {
    const signature = (language: string, stored: unknown = {}) =>
        commandDefinitionsSignature(
            buildCommandDefinitions({
                language,
                settings: resolveCommandSettings(stored, true),
            })
        )
    assert.equal(signature("cs"), signature("cs"))
    assert.notEqual(signature("cs"), signature("de"))
    assert.notEqual(
        signature("cs"),
        signature("cs", { player: { audience: "logiAdmins" } })
    )
    assert.equal(
        signature("cs"),
        signature("cs", { player: { channelIds: ["200000000000000001"] } }),
        "channel limits do not change what Discord shows"
    )
})

test("a server without Logi uses its community language", () => {
    assert.equal(fallbackGuildLanguage("cs"), "cs")
    assert.equal(fallbackGuildLanguage("de"), "de")
    assert.equal(fallbackGuildLanguage("en-US"), "en")
    assert.equal(fallbackGuildLanguage(null), "en")
})
