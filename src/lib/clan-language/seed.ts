import type { SeedMessagesCopy } from "../../domain/discord-seed/seed-copy"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * The seed messages in Discord (board P5): the call, the pinned intro, the
 * "Ovládání serveru" control message and the private replies. Czech is
 * verbatim from the board; English and German keep the same keys. Bot copy
 * says "ty" ("du").
 */
export type SeedMessages = SeedMessagesCopy

/** Monday first, the way the boards list days. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const sorted = (days: readonly number[]) =>
    ORDER.filter((day) => days.includes(day))
const same = (days: readonly number[], expected: number[]) =>
    days.length === expected.length &&
    expected.every((day) => days.includes(day))

function joinList(items: readonly string[], and: string) {
    if (items.length <= 1) return items.join("")
    return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`
}

// --- Czech -------------------------------------------------------------------

function czechWord(count: string, one: string, few: string, many: string) {
    const n = Number(count.replace(/\s/g, ""))
    return n === 1 ? one : n >= 2 && n <= 4 ? few : many
}
const czechPlayers = (count: string) =>
    czechWord(count, "hráč", "hráči", "hráčů")
/** "v 18:25" but "ve 20:25" (ve dvacet, ve dvě, ve dvanáct …). */
function czechAt(time: string) {
    const hour = Number(time.split(":")[0])
    return [2, 3, 4, 12, 13, 14, 20, 21, 22, 23].includes(hour)
        ? `ve ${time}`
        : `v ${time}`
}
const CZECH_DAYS = [
    "v neděli",
    "v pondělí",
    "v úterý",
    "ve středu",
    "ve čtvrtek",
    "v pátek",
    "v sobotu",
]
function czechCooldown(minutes: number) {
    if (minutes % 60 === 0) {
        const hours = String(minutes / 60)
        return `${hours} ${czechWord(hours, "hodina", "hodiny", "hodin")}`
    }
    const value = String(minutes)
    return `${value} ${czechWord(value, "minuta", "minuty", "minut")}`
}

const cs: SeedMessages = {
    labels: { seed: "Seed", control: "Ovládání serveru" },
    game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
    weekdays: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"],
    units: { hours: "h", minutes: "min" },
    chips: {
        seeding: "Seedujeme",
        live: "Živě",
        ended: "Seed ukončen",
        empty: "Prázdný",
        filling: "Plní se",
        offline: "Nedostupný",
        unknown: "Bez dat",
    },
    call: {
        title: (server) => `Seedujeme ${server}`,
        liveTitle: "Server je živý",
        endedTitle: (server) => `Seed na ${server} skončil`,
        status: (players, capacity, liveFrom) =>
            `${players}${capacity ? ` / ${capacity}` : ""} ${czechPlayers(capacity ?? players)} · živý od ${liveFrom}`,
        liveStatus: (players, capacity, seeders) =>
            `${players}${capacity ? ` / ${capacity}` : ""} ${czechPlayers(capacity ?? players)}${
                seeders
                    ? ` · díky ${seeders} ${seeders === 1 ? "seederovi" : "seederům"}`
                    : ""
            }`,
        startingText: (liveFrom) =>
            `Připoj se a pomoz nastartovat server. Od ${liveFrom} hráčů hrajeme naostro.`,
        closeText: (missing) =>
            `Už jen ${missing} ${czechPlayers(String(missing))} do živé hry. Připoj se a dotáhni to s námi.`,
        missingLine: (missing) =>
            `Chybí ${missing} ${czechPlayers(String(missing))} do živé hry`,
        startedBy: {
            manual: (name) => `seed spustil ${name}`,
            schedule: (slot) => `seed spustil plán ${slot}`,
            auto: "seed se spustil automaticky",
        },
        liveText: (time) =>
            `Seed skončil v ${time}. Díky všem, kdo pomohli. Server už jede sám.`,
        endedText: {
            admin: (name) =>
                name
                    ? `Seed ukončil ${name}. Další ping už nepřijde.`
                    : "Seed ukončil správce. Další ping už nepřijde.",
            timeout: (liveFrom, duration) =>
                `Server nedosáhl ${liveFrom} hráčů ani po ${duration}. Seed skončil, nikoho dalšího neoznačíme.`,
            failed: "Seed skončil, protože server přestal odpovídat.",
        },
        duration: (duration) => `Seed trval ${duration}`,
        buttons: { join: "Připojit se", role: "Zvát mě na seed" },
    },
    intro: {
        title: (clan) => `Seed serverů ${clan}`,
        body: "Když je server prázdný, správci tu svolají seed. Kdo chce dostat ping, zapne si roli Seed. Vypnout ji jde stejným tlačítkem.",
        usually: (servers, when) =>
            when
                ? `Seedujeme hlavně ${servers}, obvykle ${when}`
                : `Seedujeme hlavně ${servers}`,
        days: (days) => {
            if (same(days, [0, 1, 2, 3, 4, 5, 6])) return "každý den"
            if (same(days, [1, 2, 3, 4, 5])) return "ve všední dny"
            if (same(days, [0, 6])) return "o víkendu"
            return joinList(
                sorted(days).map((day) => CZECH_DAYS[day]!),
                "a"
            )
        },
        partOfDay: (minutes) =>
            minutes < 9 * 60
                ? "ráno"
                : minutes < 12 * 60
                  ? "dopoledne"
                  : minutes < 18 * 60
                    ? "odpoledne"
                    : "večer",
        list: (items) => joinList(items, "a"),
        button: "Zvát mě na seed",
    },
    role: {
        onTitle: "Roli Seed máš zapnutou",
        onBody: "Při dalším seedu tě označíme. Vypnout ji můžeš stejným tlačítkem.",
        offTitle: "Roli Seed máš vypnutou",
        offBody: (channel) =>
            `Pingy na seed ti chodit nebudou. Výzvy v ${channel} uvidíš dál.`,
        unavailableTitle: "Tohle tlačítko už nefunguje",
        unavailableBody:
            "Správci roli Seed vypnuli nebo vyměnili. Použij tlačítko v nejnovější výzvě nebo v úvodní zprávě kanálu.",
        failedTitle: "Roli Seed teď nastavit nejde",
    },
    control: {
        status: (players, capacity, map) =>
            [
                `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} ${czechPlayers(capacity ?? players ?? "0")}`,
                map,
            ]
                .filter(Boolean)
                .join(" · "),
        seedingStatus: (players, capacity, liveFrom) =>
            `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} ${czechPlayers(capacity ?? players ?? "0")} · živý od ${liveFrom}`,
        footer: "Jen pro správce",
        buttons: {
            start: "Spustit seed",
            stop: "Ukončit seed",
            refresh: "Obnovit panel",
            pause: "Pozastavit panel",
            resume: "Pokračovat",
        },
    },
    replies: {
        startedTitle: (server) => `Seed na ${server} běží`,
        startedBody: (seedChannel, pinged, panelChannel) =>
            `Výzva je v ${seedChannel}${
                pinged
                    ? " a role Seed dostala ping."
                    : ", tentokrát bez pingu: role Seed ho nedávno dostala."
            }${panelChannel ? ` Panel v ${panelChannel} ukazuje průběh.` : ""}`,
        openCall: "Otevřít výzvu",
        cooldownTitle: "Seed teď spustit nejde",
        cooldownBody: (remaining, at, cooldownMinutes) =>
            `Seed lze znovu spustit za ${remaining}, ${czechAt(at)}. Mezi seedy jsou aspoň ${czechCooldown(cooldownMinutes)}, aby role Seed nedostávala pingy pořád.`,
        schedule: "Naplánovat v Logi",
        runningTitle: (server) => `Seed na ${server} už běží`,
        runningBody:
            "Výzvu najdeš v kanálu seedu. Ukončit ho můžeš tlačítkem Ukončit seed.",
        alreadyLiveTitle: "Server už je živý",
        alreadyLiveBody: (liveFrom) =>
            `Na serveru je aspoň ${liveFrom} hráčů, seed teď není potřeba.`,
        offlineTitle: "Server neodpovídá",
        offlineBody: "Seed spustíš, až bude server zase online.",
        disabledTitle: "Plán seedu je vypnutý",
        disabledBody: "Zapni ho v Logi v nastavení Seed serverů.",
        notConfiguredTitle: "Seed není nastavený",
        notConfiguredBody:
            "Vyber kanál pro výzvu v Logi v nastavení Seed serverů.",
        stoppedTitle: (server) => `Seed na ${server} ukončen`,
        stoppedBody:
            "Výzva dostala štítek Seed ukončen a panel se vrátil k běžnému stavu.",
        notRunningTitle: "Seed neběží",
        notRunningBody: "Na tomhle serveru teď žádný seed neběží.",
        forbiddenTitle: "Na tohle nemáš oprávnění",
        forbiddenBody:
            "Tlačítka Seed, Obnovit a Pozastavit smí použít jen Správci Logi.",
        panelPausedTitle: (server) => `Panel ${server} je pozastavený`,
        panelPausedBody: (channel) =>
            `V ${channel} ukazuje štítek Pozastaveno a poslední data. Tlačítko se změnilo na Pokračovat.`,
        panelResumedTitle: (server) => `Panel ${server} zase běží`,
        panelResumedBody: (channel) =>
            `V ${channel} se zase obnovuje každých 60 s. Tlačítko se změnilo na Pozastavit panel.`,
        panelRefreshedTitle: (server) => `Panel ${server} se překreslí`,
        panelRefreshedBody: "Bot ho překreslí hned, bez čekání na 60 s.",
        noPanelTitle: "Server nemá panel",
        noPanelBody: "Panel serveru přidáš v Logi v Panelech v Discordu.",
        panelNotSentTitle: "Panel ještě není v Discordu",
        panelNotSentBody:
            "Pošli ho v Logi v Panelech v Discordu tlačítkem Odeslat do kanálu.",
        openInLogi: "Otevřít v Logi",
    },
}

// --- English -----------------------------------------------------------------

const EN_DAYS = [
    "Sundays",
    "Mondays",
    "Tuesdays",
    "Wednesdays",
    "Thursdays",
    "Fridays",
    "Saturdays",
]
const enPlayers = (count: string) =>
    Number(count.replace(/[\s,]/g, "")) === 1 ? "player" : "players"
function enCooldown(minutes: number) {
    if (minutes % 60 === 0) {
        const hours = minutes / 60
        return `${hours} ${hours === 1 ? "hour" : "hours"}`
    }
    return `${minutes} minutes`
}

const en: SeedMessages = {
    labels: { seed: "Seed", control: "Server control" },
    game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    units: { hours: "h", minutes: "min" },
    chips: {
        seeding: "Seeding",
        live: "Live",
        ended: "Seed ended",
        empty: "Empty",
        filling: "Filling up",
        offline: "Unavailable",
        unknown: "No data",
    },
    call: {
        title: (server) => `Seeding ${server}`,
        liveTitle: "The server is live",
        endedTitle: (server) => `The seed on ${server} ended`,
        status: (players, capacity, liveFrom) =>
            `${players}${capacity ? ` / ${capacity}` : ""} ${enPlayers(capacity ?? players)} · live from ${liveFrom}`,
        liveStatus: (players, capacity, seeders) =>
            `${players}${capacity ? ` / ${capacity}` : ""} ${enPlayers(capacity ?? players)}${
                seeders
                    ? ` · thanks to ${seeders} ${seeders === 1 ? "seeder" : "seeders"}`
                    : ""
            }`,
        startingText: (liveFrom) =>
            `Join and help get the server going. From ${liveFrom} players we play for real.`,
        closeText: (missing) =>
            `Only ${missing} ${missing === 1 ? "player" : "players"} to go. Join and help us finish it.`,
        missingLine: (missing) =>
            `${missing} ${missing === 1 ? "player" : "players"} missing until the server is live`,
        startedBy: {
            manual: (name) => `seed started by ${name}`,
            schedule: (slot) => `seed started by the plan ${slot}`,
            auto: "seed started automatically",
        },
        liveText: (time) =>
            `The seed ended at ${time}. Thanks to everyone who helped. The server runs on its own now.`,
        endedText: {
            admin: (name) =>
                name
                    ? `${name} ended the seed. No further ping will come.`
                    : "An admin ended the seed. No further ping will come.",
            timeout: (liveFrom, duration) =>
                `The server did not reach ${liveFrom} players within ${duration}. The seed ended; nobody else will be pinged.`,
            failed: "The seed ended because the server stopped answering.",
        },
        duration: (duration) => `The seed took ${duration}`,
        buttons: { join: "Join", role: "Notify me about seeds" },
    },
    intro: {
        title: (clan) => `Server seeding ${clan}`,
        body: "When a server is empty, the admins call a seed here. If you want a ping, turn on the Seed role. The same button turns it off.",
        usually: (servers, when) =>
            when
                ? `We mostly seed ${servers}, usually ${when}`
                : `We mostly seed ${servers}`,
        days: (days) => {
            if (same(days, [0, 1, 2, 3, 4, 5, 6])) return "every day"
            if (same(days, [1, 2, 3, 4, 5])) return "on weekdays"
            if (same(days, [0, 6])) return "at weekends"
            return `on ${joinList(
                sorted(days).map((day) => EN_DAYS[day]!),
                "and"
            )}`
        },
        partOfDay: (minutes) =>
            minutes < 12 * 60
                ? "in the morning"
                : minutes < 18 * 60
                  ? "in the afternoon"
                  : "in the evening",
        list: (items) => joinList(items, "and"),
        button: "Notify me about seeds",
    },
    role: {
        onTitle: "The Seed role is on",
        onBody: "We will ping you at the next seed. The same button turns it off.",
        offTitle: "The Seed role is off",
        offBody: (channel) =>
            `You will not get seed pings. You can still see the calls in ${channel}.`,
        unavailableTitle: "This button no longer works",
        unavailableBody:
            "The admins turned the Seed role off or replaced it. Use the button in the latest call or in the channel's intro message.",
        failedTitle: "The Seed role cannot be changed right now",
    },
    control: {
        status: (players, capacity, map) =>
            [
                `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} ${enPlayers(capacity ?? players ?? "0")}`,
                map,
            ]
                .filter(Boolean)
                .join(" · "),
        seedingStatus: (players, capacity, liveFrom) =>
            `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} ${enPlayers(capacity ?? players ?? "0")} · live from ${liveFrom}`,
        footer: "Admins only",
        buttons: {
            start: "Start seed",
            stop: "End seed",
            refresh: "Refresh panel",
            pause: "Pause panel",
            resume: "Resume",
        },
    },
    replies: {
        startedTitle: (server) => `The seed on ${server} is running`,
        startedBody: (seedChannel, pinged, panelChannel) =>
            `The call is in ${seedChannel}${
                pinged
                    ? " and the Seed role was pinged."
                    : ", this time without a ping: the Seed role got one recently."
            }${panelChannel ? ` The panel in ${panelChannel} shows the progress.` : ""}`,
        openCall: "Open the call",
        cooldownTitle: "A seed cannot start right now",
        cooldownBody: (remaining, at, cooldownMinutes) =>
            `The next seed can start in ${remaining}, at ${at}. Seeds are at least ${enCooldown(cooldownMinutes)} apart so the Seed role is not pinged all the time.`,
        schedule: "Schedule in Logi",
        runningTitle: (server) => `The seed on ${server} is already running`,
        runningBody:
            "The call is in the seed channel. End it with the End seed button.",
        alreadyLiveTitle: "The server is already live",
        alreadyLiveBody: (liveFrom) =>
            `The server has at least ${liveFrom} players, so no seed is needed now.`,
        offlineTitle: "The server is not answering",
        offlineBody: "You can start a seed once the server is online again.",
        disabledTitle: "The seed plan is off",
        disabledBody: "Turn it on in Logi under Server seeding.",
        notConfiguredTitle: "Seeding is not set up",
        notConfiguredBody:
            "Choose the call channel in Logi under Server seeding.",
        stoppedTitle: (server) => `The seed on ${server} ended`,
        stoppedBody:
            "The call now shows Seed ended and the panel is back to normal.",
        notRunningTitle: "No seed is running",
        notRunningBody: "No seed is running on this server right now.",
        forbiddenTitle: "You are not allowed to do that",
        forbiddenBody:
            "Only Logi admins may use the Seed, Refresh and Pause buttons.",
        panelPausedTitle: (server) => `The ${server} panel is paused`,
        panelPausedBody: (channel) =>
            `In ${channel} it shows the Paused label and the last data. The button changed to Resume.`,
        panelResumedTitle: (server) => `The ${server} panel runs again`,
        panelResumedBody: (channel) =>
            `In ${channel} it refreshes every 60 s again. The button changed to Pause panel.`,
        panelRefreshedTitle: (server) => `The ${server} panel will be redrawn`,
        panelRefreshedBody:
            "The bot redraws it right away, without waiting 60 s.",
        noPanelTitle: "This server has no panel",
        noPanelBody: "Add the server's panel in Logi under Discord panels.",
        panelNotSentTitle: "The panel is not in Discord yet",
        panelNotSentBody:
            "Send it in Logi under Discord panels with Send to channel.",
        openInLogi: "Open in Logi",
    },
}

// --- German ------------------------------------------------------------------

const DE_DAYS = [
    "sonntags",
    "montags",
    "dienstags",
    "mittwochs",
    "donnerstags",
    "freitags",
    "samstags",
]
function deCooldown(minutes: number) {
    if (minutes % 60 === 0) {
        const hours = minutes / 60
        return `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`
    }
    return `${minutes} Minuten`
}

const de: SeedMessages = {
    labels: { seed: "Seed", control: "Serversteuerung" },
    game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
    weekdays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    units: { hours: "Std.", minutes: "Min." },
    chips: {
        seeding: "Seeding läuft",
        live: "Live",
        ended: "Seed beendet",
        empty: "Leer",
        filling: "Füllt sich",
        offline: "Nicht erreichbar",
        unknown: "Keine Daten",
    },
    call: {
        title: (server) => `Wir seeden ${server}`,
        liveTitle: "Der Server ist live",
        endedTitle: (server) => `Der Seed auf ${server} ist beendet`,
        status: (players, capacity, liveFrom) =>
            `${players}${capacity ? ` / ${capacity}` : ""} Spieler · live ab ${liveFrom}`,
        liveStatus: (players, capacity, seeders) =>
            `${players}${capacity ? ` / ${capacity}` : ""} Spieler${
                seeders
                    ? ` · danke an ${seeders} ${seeders === 1 ? "Seeder" : "Seeder"}`
                    : ""
            }`,
        startingText: (liveFrom) =>
            `Komm dazu und hilf, den Server zu starten. Ab ${liveFrom} Spielern spielen wir richtig.`,
        closeText: (missing) =>
            `Nur noch ${missing} Spieler bis zum Live-Spiel. Komm dazu und bring es mit uns ins Ziel.`,
        missingLine: (missing) => `Noch ${missing} Spieler bis zum Live-Spiel`,
        startedBy: {
            manual: (name) => `Seed gestartet von ${name}`,
            schedule: (slot) => `Seed gestartet vom Plan ${slot}`,
            auto: "Seed automatisch gestartet",
        },
        liveText: (time) =>
            `Der Seed endete um ${time}. Danke an alle, die geholfen haben. Der Server läuft jetzt von allein.`,
        endedText: {
            admin: (name) =>
                name
                    ? `${name} hat den Seed beendet. Es kommt kein weiterer Ping.`
                    : "Ein Admin hat den Seed beendet. Es kommt kein weiterer Ping.",
            timeout: (liveFrom, duration) =>
                `Der Server hat ${liveFrom} Spieler auch nach ${duration} nicht erreicht. Der Seed ist beendet, niemand wird mehr markiert.`,
            failed: "Der Seed ist beendet, weil der Server nicht mehr antwortet.",
        },
        duration: (duration) => `Der Seed dauerte ${duration}`,
        buttons: { join: "Beitreten", role: "Zum Seed einladen" },
    },
    intro: {
        title: (clan) => `Server-Seeding ${clan}`,
        body: "Wenn ein Server leer ist, rufen die Admins hier zum Seed auf. Wer einen Ping möchte, schaltet die Rolle Seed ein. Mit demselben Knopf schaltest du sie wieder aus.",
        usually: (servers, when) =>
            when
                ? `Wir seeden vor allem ${servers}, meist ${when}`
                : `Wir seeden vor allem ${servers}`,
        days: (days) => {
            if (same(days, [0, 1, 2, 3, 4, 5, 6])) return "täglich"
            if (same(days, [1, 2, 3, 4, 5])) return "werktags"
            if (same(days, [0, 6])) return "am Wochenende"
            return joinList(
                sorted(days).map((day) => DE_DAYS[day]!),
                "und"
            )
        },
        partOfDay: (minutes) =>
            minutes < 12 * 60
                ? "vormittags"
                : minutes < 18 * 60
                  ? "nachmittags"
                  : "abends",
        list: (items) => joinList(items, "und"),
        button: "Zum Seed einladen",
    },
    role: {
        onTitle: "Die Rolle Seed ist an",
        onBody: "Beim nächsten Seed markieren wir dich. Mit demselben Knopf schaltest du sie aus.",
        offTitle: "Die Rolle Seed ist aus",
        offBody: (channel) =>
            `Du bekommst keine Seed-Pings mehr. Die Aufrufe in ${channel} siehst du weiterhin.`,
        unavailableTitle: "Dieser Knopf funktioniert nicht mehr",
        unavailableBody:
            "Die Admins haben die Rolle Seed ausgeschaltet oder ersetzt. Nutze den Knopf im neuesten Aufruf oder in der Einleitung des Kanals.",
        failedTitle: "Die Rolle Seed lässt sich gerade nicht ändern",
    },
    control: {
        status: (players, capacity, map) =>
            [
                `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} Spieler`,
                map,
            ]
                .filter(Boolean)
                .join(" · "),
        seedingStatus: (players, capacity, liveFrom) =>
            `${players ?? "?"}${capacity ? ` / ${capacity}` : ""} Spieler · live ab ${liveFrom}`,
        footer: "Nur für Admins",
        buttons: {
            start: "Seed starten",
            stop: "Seed beenden",
            refresh: "Panel aktualisieren",
            pause: "Panel pausieren",
            resume: "Fortsetzen",
        },
    },
    replies: {
        startedTitle: (server) => `Der Seed auf ${server} läuft`,
        startedBody: (seedChannel, pinged, panelChannel) =>
            `Der Aufruf ist in ${seedChannel}${
                pinged
                    ? " und die Rolle Seed wurde gepingt."
                    : ", diesmal ohne Ping: Die Rolle Seed hat kürzlich einen bekommen."
            }${panelChannel ? ` Das Panel in ${panelChannel} zeigt den Fortschritt.` : ""}`,
        openCall: "Aufruf öffnen",
        cooldownTitle: "Ein Seed kann gerade nicht starten",
        cooldownBody: (remaining, at, cooldownMinutes) =>
            `Der nächste Seed kann in ${remaining} starten, um ${at}. Zwischen Seeds liegen mindestens ${deCooldown(cooldownMinutes)}, damit die Rolle Seed nicht ständig gepingt wird.`,
        schedule: "In Logi planen",
        runningTitle: (server) => `Der Seed auf ${server} läuft schon`,
        runningBody:
            "Der Aufruf steht im Seed-Kanal. Beende ihn mit dem Knopf Seed beenden.",
        alreadyLiveTitle: "Der Server ist schon live",
        alreadyLiveBody: (liveFrom) =>
            `Auf dem Server sind mindestens ${liveFrom} Spieler, ein Seed ist jetzt nicht nötig.`,
        offlineTitle: "Der Server antwortet nicht",
        offlineBody:
            "Du kannst den Seed starten, sobald der Server wieder online ist.",
        disabledTitle: "Der Seed-Plan ist aus",
        disabledBody: "Schalte ihn in Logi unter Server-Seeding ein.",
        notConfiguredTitle: "Seeding ist nicht eingerichtet",
        notConfiguredBody:
            "Wähle den Aufruf-Kanal in Logi unter Server-Seeding.",
        stoppedTitle: (server) => `Der Seed auf ${server} ist beendet`,
        stoppedBody:
            "Der Aufruf zeigt jetzt Seed beendet und das Panel ist wieder normal.",
        notRunningTitle: "Kein Seed läuft",
        notRunningBody: "Auf diesem Server läuft gerade kein Seed.",
        forbiddenTitle: "Das darfst du nicht",
        forbiddenBody:
            "Die Knöpfe Seed, Aktualisieren und Pausieren dürfen nur Logi-Admins benutzen.",
        panelPausedTitle: (server) => `Das Panel ${server} ist pausiert`,
        panelPausedBody: (channel) =>
            `In ${channel} zeigt es Pausiert und die letzten Daten. Der Knopf heißt jetzt Fortsetzen.`,
        panelResumedTitle: (server) => `Das Panel ${server} läuft wieder`,
        panelResumedBody: (channel) =>
            `In ${channel} aktualisiert es sich wieder alle 60 s. Der Knopf heißt jetzt Panel pausieren.`,
        panelRefreshedTitle: (server) =>
            `Das Panel ${server} wird neu gezeichnet`,
        panelRefreshedBody:
            "Der Bot zeichnet es sofort neu, ohne 60 s zu warten.",
        noPanelTitle: "Dieser Server hat kein Panel",
        noPanelBody:
            "Füge das Panel des Servers in Logi unter Panels in Discord hinzu.",
        panelNotSentTitle: "Das Panel ist noch nicht in Discord",
        panelNotSentBody:
            "Sende es in Logi unter Panels in Discord mit In den Kanal senden.",
        openInLogi: "In Logi öffnen",
    },
}

const seedMessages: Record<ClanLanguage, SeedMessages> = { en, cs, de }

export const getSeedMessages = clanCopy(seedMessages)
