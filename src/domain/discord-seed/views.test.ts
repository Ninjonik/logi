import assert from "node:assert/strict"
import test from "node:test"

import { renderedView } from "@/infrastructure/testing/message-views"
import { getSeedMessages } from "@/lib/clan-language/seed"

import {
    formatSeedDuration,
    seedActionReplyView,
    seedCallLead,
    seedCallView,
    seedControlView,
    seedIntroView,
    seedReplyView,
    seedRoleReplyView,
    seedSlotLabel,
    seedStarterText,
    seedUsualTime,
    type SeedCallInput,
} from "./views"
import { startSeedRun, type SeedRun } from "./run"

const cs = getSeedMessages("cs")
const START = Date.parse("2026-10-10T15:40:00Z")
const ROLE = "333333333333333333"
const JOIN = "https://logi.app/join/vlci-1"
const MAP = "https://logi.app/maps/foy.webp"

function run(overrides: Partial<SeedRun> = {}): SeedRun {
    return {
        ...startSeedRun({
            trigger: {
                kind: "manual",
                actor: { id: "100000000000000001", name: "Kowalski" },
                via: "discord",
                channelId: null,
            },
            now: START,
            plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
            ping: { kind: "role", roleId: ROLE },
            observation: {
                players: 12,
                capacity: 100,
                map: "Foy",
                observedAt: START,
            },
        }),
        callPostedAt: START,
        ...overrides,
    }
}
const call = (overrides: Partial<SeedCallInput> = {}) =>
    seedCallView({
        run: run(),
        server: { name: "Vlci #1", gameId: "hell_let_loose" },
        mapLine: "Foy · Warfare · Den",
        template: null,
        roleButton: { roleId: ROLE },
        joinUrl: JOIN,
        thumbnail: { url: MAP, description: "mapa Foy" },
        updatedAt: START + 30_000,
        timeZone: "Europe/Prague",
        locale: cs.locale,
        copy: cs,
        ...overrides,
    })

test("the call while seeding matches P5-07..10", () => {
    const view = call()
    const shown = renderedView(view, "cs")
    assert.deepEqual(shown.validation, { ok: true, issues: [] })
    assert.match(shown.text, /SEED · HELL LET LOOSE/)
    assert.match(shown.text, /Seedujeme Vlci #1/)
    assert.match(shown.text, /\*\*Seedujeme\*\*/)
    assert.match(shown.text, /12 \/ 100 hráčů · živý od 40/)
    assert.match(shown.text, /▰▰▰▱▱▱▱▱▱▱ \*\*12 \/ 40\*\*/)
    assert.match(
        shown.text,
        /Připoj se a pomoz nastartovat server\. Od 40 hráčů hrajeme naostro\./
    )
    assert.match(shown.text, /Foy · Warfare · Den · seed spustil Kowalski/)
    assert.match(
        shown.text,
        /Aktualizováno <t:\d+:R> · obnovuje se každých 60 s · Spravováno v Logi/
    )
    assert.deepEqual(
        shown.buttons.map((button) => [button.kind, button.label]),
        [
            ["link", "Připojit se"],
            ["action", "Zvát mě na seed"],
        ]
    )
    assert.equal(
        shown.buttons[1]!.kind === "action" && shown.buttons[1]!.style,
        "secondary"
    )
    assert.deepEqual(shown.media, [MAP])
    assert.equal(view.accent, "clan")
})

test("progress near the threshold uses the close text (P5-11)", () => {
    const shown = renderedView(
        call({
            run: run({
                players: { ...run().players, latest: 31, peak: 31 },
            }),
        }),
        "cs"
    )
    assert.match(shown.text, /▰▰▰▰▰▰▰▰▱▱ \*\*31 \/ 40\*\*/)
    assert.match(shown.text, /31 \/ 100 hráčů · živý od 40/)
    assert.match(
        shown.text,
        /Už jen 9 hráčů do živé hry\. Připoj se a dotáhni to s námi\./
    )
})

test("the admin's own text fills its placeholders under the missing line (P3-16, P3-19)", () => {
    const shown = renderedView(
        call({
            template:
                "Server se rozjíždí. Připoj se a pomoz ho naplnit; jakmile bude {hranice} hráčů, hraje se naostro.",
        }),
        "cs"
    )
    assert.match(shown.text, /Chybí 28 hráčů do živé hry/)
    assert.match(shown.text, /jakmile bude 40 hráčů, hraje se naostro\./)
})

test("the live call thanks the seeders and drops the role button (P5-13, P5-14)", () => {
    const live = run({
        status: "live",
        endedAt: START + 45 * 60_000,
        players: {
            start: 25,
            latest: 43,
            peak: 43,
            end: 43,
            capacity: 100,
            map: "Foy",
            observedAt: START + 45 * 60_000,
        },
    })
    const view = call({
        run: live,
        server: { name: "Vlci #1 · Public", gameId: "hell_let_loose" },
    })
    const shown = renderedView(view, "cs")
    assert.deepEqual(shown.validation.ok, true)
    assert.match(shown.text, /Server je živý/)
    assert.match(shown.text, /\*\*Živě\*\*/)
    assert.match(shown.text, /43 \/ 100 hráčů · díky 18 seederům/)
    assert.match(
        shown.text,
        /Seed skončil v <t:\d+:t>\. Díky všem, kdo pomohli\. Server už jede sám\./
    )
    assert.match(shown.text, /Vlci #1 · Public · Foy · Warfare · Den/)
    assert.match(shown.text, /Seed trval 45 min · Spravováno v Logi/)
    assert.deepEqual(
        shown.buttons.map((button) => button.label),
        ["Připojit se"]
    )
    assert.equal(seedCallLead(live), null, "the @Seed line goes")
    assert.deepEqual(seedCallLead(run()), {
        roleId: ROLE,
        markdown: `<@&${ROLE}>`,
    })
    assert.equal(
        seedCallLead(run({ ping: { kind: "silent", reason: "no_role" } })),
        null
    )
})

test("an admin-ended call gets the Seed ukončen chip (P5-19)", () => {
    const shown = renderedView(
        call({
            run: run({
                status: "ended_admin",
                endedAt: START + 20 * 60_000,
                endedBy: {
                    id: "100000000000000001",
                    name: "Hráč 01",
                    via: "web",
                },
            }),
        }),
        "cs"
    )
    assert.match(shown.text, /\*\*Seed ukončen\*\*/)
    assert.match(shown.text, /Seed ukončil Hráč 01\./)
    assert.match(shown.text, /Seed trval 20 min/)
    assert.equal(shown.validation.ok, true)
    const timeout = renderedView(
        call({
            run: run({
                status: "ended_timeout",
                endedAt: START + 120 * 60_000,
            }),
        }),
        "cs"
    )
    assert.match(timeout.text, /Server nedosáhl 40 hráčů ani po 2 h\./)
})

test("who started a seed reads like the boards", () => {
    assert.equal(
        seedStarterText(
            {
                kind: "schedule",
                days: [1, 2, 3, 4, 5],
                time: "17:00",
                occurrence: "2026-10-05T17:00",
            },
            cs
        ),
        "seed spustil plán Po–Pá 17:00"
    )
    assert.equal(
        seedStarterText({ kind: "auto", below: 20 }, cs),
        "seed se spustil automaticky"
    )
    assert.equal(
        seedSlotLabel({ days: [6, 0], time: "10:00" }, cs.weekdays),
        "So–Ne 10:00"
    )
})

test("durations read as on the history table", () => {
    assert.equal(formatSeedDuration(42, cs.units), "42 min")
    assert.equal(formatSeedDuration(65, cs.units), "1 h 05 min")
    assert.equal(formatSeedDuration(120, cs.units), "2 h")
    assert.equal(formatSeedDuration(-3, cs.units), "0 min")
})

test("the control message per server matches P5-26..28", () => {
    const control = (
        overrides: Partial<Parameters<typeof seedControlView>[0]> = {}
    ) =>
        seedControlView({
            connectionId: "gameDataConnections:vlci1",
            server: { name: "Vlci #1 · Public", gameId: "hell_let_loose" },
            status: "below_start",
            seeding: false,
            players: 3,
            capacity: 100,
            mapName: "Carentan",
            liveFrom: 40,
            panel: { paused: false },
            locale: cs.locale,
            copy: cs,
            ...overrides,
        })
    const empty = renderedView(control(), "cs")
    assert.equal(empty.validation.ok, true)
    assert.match(empty.text, /OVLÁDÁNÍ SERVERU · HELL LET LOOSE/)
    assert.match(empty.text, /\*\*Prázdný\*\* · 3 \/ 100 hráčů · Carentan/)
    assert.match(empty.text, /Jen pro správce · Spravováno v Logi/)
    assert.deepEqual(
        empty.buttons.map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [
            ["Spustit seed", "primary"],
            ["Obnovit panel", "secondary"],
            ["Pozastavit panel", "secondary"],
        ]
    )
    const live = renderedView(
        control({ status: "live", players: 36, mapName: "Foy" }),
        "cs"
    )
    assert.match(live.text, /\*\*Živě\*\* · 36 \/ 100 hráčů · Foy/)
    assert.equal(
        live.buttons[0]!.kind === "action" && live.buttons[0]!.style,
        "secondary",
        "not primary when live"
    )
    const seeding = renderedView(
        control({
            server: { name: "Vlci WD", gameId: "wardogs" },
            seeding: true,
            status: "below_start",
            players: 9,
            capacity: 98,
        }),
        "cs"
    )
    assert.match(seeding.text, /OVLÁDÁNÍ SERVERU · WARDOGS/)
    assert.match(seeding.text, /\*\*Seedujeme\*\* · 9 \/ 98 hráčů · živý od 40/)
    assert.deepEqual(
        seeding.buttons.map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [
            ["Ukončit seed", "danger"],
            ["Obnovit panel", "secondary"],
            ["Pozastavit panel", "secondary"],
        ]
    )
    const paused = renderedView(control({ panel: { paused: true } }), "cs")
    assert.equal(paused.buttons[2]!.label, "Pokračovat")
    const noPanel = renderedView(control({ panel: null }), "cs")
    assert.equal(
        noPanel.buttons[1]!.kind === "action" && noPanel.buttons[1]!.disabled,
        true
    )
})

test("the pinned intro offers the role toggle (P5-20, P5-21)", () => {
    const shown = renderedView(
        seedIntroView({
            clanName: "Vlci",
            servers: [
                {
                    name: "Vlci #1 · Public",
                    schedule: {
                        enabled: true,
                        slots: [{ days: [5, 6], time: "15:00" }],
                    },
                },
            ],
            roleId: ROLE,
            copy: cs,
        }),
        "cs"
    )
    assert.equal(shown.validation.ok, true)
    assert.match(shown.text, /Seed serverů Vlci/)
    assert.match(
        shown.text,
        /Když je server prázdný, správci tu svolají seed\. Kdo chce dostat ping, zapne si roli Seed\. Vypnout ji jde stejným tlačítkem\./
    )
    assert.match(
        shown.text,
        /Seedujeme hlavně Vlci #1 · Public, obvykle v pátek a v sobotu odpoledne/
    )
    assert.deepEqual(
        shown.buttons.map((button) => [
            button.label,
            button.kind === "action" ? button.style : "link",
        ]),
        [["Zvát mě na seed", "primary"]]
    )
    assert.match(shown.text, /Spravováno v Logi/)
    assert.equal(
        seedUsualTime(
            [
                {
                    enabled: true,
                    slots: [{ days: [1, 2, 3, 4, 5], time: "17:00" }],
                },
            ],
            cs
        ),
        "ve všední dny odpoledne"
    )
    assert.equal(seedUsualTime([{ enabled: false, slots: [] }], cs), null)
})

test("private replies are ephemeral cards with at most one button (P5-23, P5-24, P5-30)", () => {
    const on = renderedView(seedRoleReplyView("on", cs, "<#1>"), "cs")
    assert.match(on.text, /Roli Seed máš zapnutou/)
    assert.match(
        on.text,
        /Při dalším seedu tě označíme\. Vypnout ji můžeš stejným tlačítkem\./
    )
    const off = renderedView(seedRoleReplyView("off", cs, "<#1>"), "cs")
    assert.match(off.text, /Roli Seed máš vypnutou/)
    assert.match(
        off.text,
        /Pingy na seed ti chodit nebudou\. Výzvy v <#1> uvidíš dál\./
    )
    const started = seedReplyView({
        title: cs.replies.startedTitle("Vlci #1"),
        body: cs.replies.startedBody("<#1>", true, "<#2>"),
        action: {
            kind: "link",
            url: "https://discord.com/channels/1/1/1",
            label: cs.replies.openCall,
        },
    })
    assert.equal(started.ephemeral, true)
    const shown = renderedView(started, "cs")
    assert.match(shown.text, /Seed na Vlci #1 běží/)
    assert.match(
        shown.text,
        /Výzva je v <#1> a role Seed dostala ping\. Panel v <#2> ukazuje průběh\./
    )
    assert.equal(shown.validation.ok, true)
})

const reply = (
    result: Parameters<typeof seedActionReplyView>[0]["result"],
    overrides: Partial<Parameters<typeof seedActionReplyView>[0]> = {}
) =>
    renderedView(
        seedActionReplyView({
            result,
            server: "Vlci #1",
            panelChannel: "<#555555555555555555>",
            callUrl: "https://discord.com/channels/1/2/3",
            planUrl: "https://logi.app/cs/dashboard/servers/s/settings/seed",
            cooldownMinutes: 120,
            liveFrom: 40,
            now: Date.parse("2026-10-10T17:05:00Z"),
            timeZone: "Europe/Prague",
            locale: cs.locale,
            copy: cs,
            ...overrides,
        }),
        "cs"
    )

test("the control replies read as on the board (P5-30..32)", () => {
    const started = reply({
        status: "started",
        channelId: "111111111111111111",
        pinged: true,
    })
    assert.match(started.text, /Seed na Vlci #1 běží/)
    assert.match(
        started.text,
        /Výzva je v <#111111111111111111> a role Seed dostala ping\. Panel v <#555555555555555555> ukazuje průběh\./
    )
    assert.deepEqual(
        started.buttons.map((button) => [button.kind, button.label]),
        [["link", "Otevřít výzvu"]]
    )
    const cooldown = reply({
        status: "cooldown",
        retryAt: "2026-10-10T18:25:00.000Z",
    })
    assert.match(cooldown.text, /Seed teď spustit nejde/)
    assert.match(
        cooldown.text,
        /Seed lze znovu spustit za 1 h 20 min, ve 20:25\. Mezi seedy jsou aspoň 2 hodiny, aby role Seed nedostávala pingy pořád\./
    )
    assert.deepEqual(
        cooldown.buttons.map((button) => button.label),
        ["Naplánovat v Logi"]
    )
    const paused = reply(
        { status: "panel", action: "pause" },
        { server: "Vlci #2" }
    )
    assert.match(paused.text, /Panel Vlci #2 je pozastavený/)
    assert.match(
        paused.text,
        /V <#555555555555555555> ukazuje štítek Pozastaveno a poslední data\. Tlačítko se změnilo na Pokračovat\./
    )
    assert.match(
        reply({ status: "forbidden" }).text,
        /Na tohle nemáš oprávnění/
    )
    assert.match(reply({ status: "stopped" }).text, /Seed na Vlci #1 ukončen/)
    assert.match(
        reply({ status: "unavailable", reason: "already_live" }).text,
        /Server už je živý/
    )
    assert.match(reply({ status: "panel_missing" }).text, /Server nemá panel/)
    for (const result of [
        { status: "running" },
        { status: "duplicate" },
        { status: "unavailable", reason: "disabled" },
        { status: "unavailable", reason: "not_configured" },
        { status: "unavailable", reason: "offline" },
        { status: "unavailable", reason: "not_running" },
        { status: "not_found" },
        { status: "panel", action: "refresh" },
        { status: "panel", action: "resume" },
        { status: "panel_not_sent" },
    ] as const) {
        const shown = reply(result)
        assert.equal(shown.validation.ok, true, JSON.stringify(result))
        assert.ok(shown.buttons.length <= 1)
    }
    assert.match(
        reply({
            status: "started",
            channelId: "111111111111111111",
            pinged: false,
        }).text,
        /tentokrát bez pingu/
    )
    assert.deepEqual(
        reply(
            {
                status: "started",
                channelId: "111111111111111111",
                pinged: true,
            },
            { callUrl: null }
        ).buttons,
        []
    )
})
