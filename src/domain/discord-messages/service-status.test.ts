import assert from "node:assert/strict"
import test from "node:test"

import {
    formatOutageDuration,
    nextServiceStates,
    serviceChangeView,
    serviceStatusView,
} from "./service-status"
import { getSystemMessages } from "../../lib/clan-language/system"
import { validateMessageView } from "./message-validation"
import { layoutMessageView } from "./message-layout"

const cs = getSystemMessages("cs")
const copy = cs.serviceStatus
const locale = cs.locale
const layout = { copy: cs.kit, locale }
const CHECKED = "2026-10-11T12:16:00.000Z"
const unix = (iso: string) => Date.parse(iso) / 1000
const text = (view: ReturnType<typeof serviceStatusView>) =>
    layoutMessageView(view, layout)
        .nodes.map((node) => ("content" in node ? node.content : ""))
        .join("\n")

const services = (bot: boolean) => [
    { name: "Dashboard", online: true },
    { name: "Convex", online: true },
    { name: "Discord bot", online: bot },
]

test("all services up reads 'Všechno běží' with a chip per service (L5-34)", () => {
    const view = serviceStatusView({
        copy,
        locale,
        services: services(true),
        checkedAt: CHECKED,
    })
    assert.equal(view.accent, "system")
    assert.equal(view.header?.label, "Služby Logi")
    assert.equal(view.header?.title, "Všechno běží")
    const rendered = text(view)
    assert.match(
        rendered,
        new RegExp(
            `Kontrola každých 30 s · naposledy dnes v <t:${unix(CHECKED)}:t>`
        )
    )
    for (const name of ["Dashboard", "Convex", "Discord bot"])
        assert.match(
            rendered,
            new RegExp(`\\*\\*${name}\\*\\* · 🟢 \\*\\*V provozu\\*\\*`)
        )
    assert.match(rendered, /-# Změny stavu jsou ve vlákně · Spravováno v Logi$/)
    assert.equal(validateMessageView(view, layout).ok, true)
})

test("an outage names the service and its chip turns 'Nedostupné' (L5-35)", () => {
    const view = serviceStatusView({
        copy,
        locale,
        services: services(false),
        checkedAt: CHECKED,
    })
    assert.equal(view.header?.title, "Discord bot nefunguje")
    assert.match(text(view), /\*\*Discord bot\*\* · 🔴 \*\*Nedostupné\*\*/)
    assert.equal(
        serviceStatusView({
            copy,
            locale,
            services: [
                { name: "Dashboard", online: false },
                { name: "Convex", online: false },
            ],
            checkedAt: CHECKED,
        }).header?.title,
        "Dashboard a Convex nefungují"
    )
})

test("a silent monitor reads 'Stav teď neznáme' (L5-36)", () => {
    const view = serviceStatusView({
        copy,
        locale,
        services: null,
        checkedAt: CHECKED,
    })
    assert.equal(view.header?.title, "Stav teď neznáme")
    assert.deepEqual(view.header?.chips, [
        { label: "Monitoring neodpovídá", tone: "neutral" },
    ])
    assert.match(
        text(view),
        /Služby můžou běžet normálně\. Stav se ukáže, jakmile monitoring zase odpoví\./
    )
})

test("changes carry the outage start and its length (L5-37, L5-B06)", () => {
    const first = nextServiceStates(
        null,
        services(true),
        "2026-10-11T12:00:00.000Z"
    )
    assert.deepEqual(first.changes, [])
    const down = nextServiceStates(
        first.states,
        services(false),
        "2026-10-11T12:02:00.000Z"
    )
    assert.deepEqual(down.changes, [
        {
            name: "Discord bot",
            online: false,
            startedAt: "2026-10-11T12:02:00.000Z",
        },
    ])
    const still = nextServiceStates(
        down.states,
        services(false),
        "2026-10-11T12:05:00.000Z"
    )
    assert.deepEqual(still.changes, [])
    assert.equal(
        still.states.find((item) => item.name === "Discord bot")?.since,
        "2026-10-11T12:02:00.000Z"
    )
    const up = nextServiceStates(
        still.states,
        services(true),
        "2026-10-11T12:09:00.000Z"
    )
    assert.deepEqual(up.changes, [
        {
            name: "Discord bot",
            online: true,
            startedAt: "2026-10-11T12:02:00.000Z",
            endedAt: "2026-10-11T12:09:00.000Z",
        },
    ])
    const downCard = serviceChangeView({
        copy,
        locale,
        change: down.changes[0]!,
    })
    assert.equal(downCard.accent, "system")
    assert.equal(downCard.header?.title, "Discord bot nefunguje")
    assert.match(
        text(downCard),
        new RegExp(
            `Výpadek začal v <t:${unix("2026-10-11T12:02:00.000Z")}:t>\\.`
        )
    )
    const upCard = serviceChangeView({ copy, locale, change: up.changes[0]! })
    assert.equal(upCard.header?.title, "Discord bot zase běží")
    assert.match(text(upCard), /Výpadek trval 7 minut\./)
    assert.match(
        text(
            serviceChangeView({
                copy,
                locale,
                change: { name: "Convex", online: true },
            })
        ),
        /Jak dlouho výpadek trval, nevíme\./
    )
})

test("outage lengths read naturally in the clan language", () => {
    const minute = 60_000
    assert.equal(formatOutageDuration(copy, locale, 20_000), "méně než minutu")
    assert.equal(formatOutageDuration(copy, locale, minute), "1 minutu")
    assert.equal(formatOutageDuration(copy, locale, 3 * minute), "3 minuty")
    assert.equal(formatOutageDuration(copy, locale, 7 * minute), "7 minut")
    assert.equal(
        formatOutageDuration(copy, locale, 125 * minute),
        "2 hodiny a 5 minut"
    )
    assert.equal(formatOutageDuration(copy, locale, 60 * minute), "1 hodinu")
    assert.equal(
        formatOutageDuration(copy, locale, (49 * 60 + 10) * minute),
        "2 dny a 1 hodinu"
    )
    const en = getSystemMessages("en")
    assert.equal(
        formatOutageDuration(en.serviceStatus, en.locale, 7 * minute),
        "7 minutes"
    )
})
