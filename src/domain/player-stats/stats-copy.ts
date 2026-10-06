import type { PluralForms } from "../discord-messages/format"

/**
 * The `/stats` replies (board M2 1.2) in the clan language, never the
 * member's Discord language. Czech is verbatim from the board; the bot says
 * "ty" ("du"). The command's description and options live with the other
 * registration texts in `src/lib/clan-language/commands.ts`.
 */
export type StatsCopy = {
    periodLabels: { "7d": string; "30d": string; "90d": string; all: string }
    periodPhrases: { "7d": string; "30d": string; "90d": string; all: string }
    /** The "období" choices as Discord shows them, for the next-step hint. */
    periodChoices: { "7d": string; "30d": string; "90d": string; all: string }
    games: { hll: string; wardogs: string }
    kills: string
    deaths: string
    kd: string
    wins: string
    matches: string
    winRate: string
    playtime: string
    cash: string
    coverage: string
    coverageNames: {
        killsKd: string
        kills: string
        deaths: string
        cashDelta: string
        seconds: string
    }
    hllDetail: string
    form: string
    stale: string
    recentTitle: string
    factionsTitle: string
    weaponsTitle: string
    mapsTitle: string
    results: { win: string; loss: string; draw: string; unknown: string }
    recentRow: string
    factionRow: string
    noItems: string
    overview: string
    recent: string
    factions: string
    weapons: string
    maps: string
    share: string
    hllProfile: string
    addSteam: string
    chooseSteam: string
    sourceWarcon: string
    sourceGames: string
    dataAt: string
    gamesCount: PluralForms
    sourceHll: string
    sharedBy: string
    sharedWarcon: string
    sharedHll: string
    missingTitle: string
    missingBody: string
    declared: string
    ambiguousTitle: string
    ambiguousBody: string
    otherMissingTitle: string
    otherMissingBody: string
    otherAmbiguousTitle: string
    otherAmbiguousBody: string
    otherFallbackName: string
    emptySelf: string
    emptyOther: string
    emptyNext: string
    emptyHll: string
    modalTitle: string
    modalLabel: string
    modalPlaceholder: string
    retry: string
    errors: {
        unavailableTitle: string
        unavailableWarcon: string
        unavailableHll: string
        blockedTitle: string
        blockedBody: string
        gameDisabledTitle: string
        gameDisabledBody: string
        invalidTitle: string
        invalidBody: string
        hllOnlyTitle: string
        hllOnlyBody: string
        busyTitle: string
        busyBody: string
        expiredTitle: string
        expiredBody: string
        ownOnlyTitle: string
        ownOnlyBody: string
        forbiddenTitle: string
        forbiddenBody: string
        incompleteTitle: string
        incompleteBody: string
        notConfiguredTitle: string
        notConfiguredBody: string
        linkChangedTitle: string
        linkChangedBody: string
        alreadyLinkedTitle: string
        alreadyLinkedBody: string
        invalidSteamTitle: string
        invalidSteamBody: string
        linkErrorTitle: string
        linkErrorBody: string
    }
    shareFlow: {
        promptTitle: string
        selectChannel: string
        back: string
        sharedTitle: string
        viewMessage: string
        deniedTitle: string
        deniedBody: string
        chooseOther: string
        failedTitle: string
        failedBody: string
        alreadyTitle: string
        alreadyBody: string
    }
}

const en: StatsCopy = {
    periodChoices: {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        all: "All history",
    },
    periodLabels: {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
        all: "All history",
    },
    periodPhrases: {
        "7d": "the last 7 days",
        "30d": "the last 30 days",
        "90d": "the last 90 days",
        all: "the whole history",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Kills",
    deaths: "Deaths",
    kd: "K/D",
    wins: "Wins",
    matches: "Games",
    winRate: "Win rate {rate} %",
    playtime: "played {hours} h",
    cash: "cash change {cash}",
    coverage: "We know {metrics} for {known} of {total} games.",
    coverageNames: {
        killsKd: "kills and K/D",
        kills: "kills",
        deaths: "deaths",
        cashDelta: "the cash change",
        seconds: "the playtime",
    },
    hllDetail: "Played {hours} h · infantry ELO {elo} · team kills {tk}",
    form: "Form: {rate} % wins in the last 100 games longer than 20 min",
    stale: "Showing the last data read; the source couldn't be refreshed just now.",
    recentTitle: "{name} · recent games",
    factionsTitle: "{name} · factions",
    weaponsTitle: "{name} · weapons",
    mapsTitle: "{name} · maps",
    results: { win: "Win", loss: "Loss", draw: "Draw", unknown: "No result" },
    recentRow: "{map} · {day} · {kills} kills, {deaths} deaths",
    factionRow: "{wins} of {matches} wins · {kills} kills",
    noItems: "No details yet.",
    overview: "Overview",
    recent: "Recent games",
    factions: "Factions",
    weapons: "Weapons",
    maps: "Maps",
    share: "Share",
    hllProfile: "Profile on HLL Records",
    addSteam: "Add Steam",
    chooseSteam: "Choose Steam",
    sourceWarcon: "Source: the clan's Warcon",
    sourceGames: "{games} on the clan's servers",
    dataAt: "data from {time}",
    gamesCount: { one: "{count} game", other: "{count} games" },
    sourceHll:
        "Source: HLL Records · tracked community servers only · + means at least",
    sharedBy: "Shared by {user} · as of {time}",
    sharedWarcon: "The clan's Warcon",
    sharedHll: "HLL Records",
    missingTitle: "You haven't added a Steam account",
    missingBody:
        "We look statistics up by Steam ID. Add it and we'll load them right away.",
    declared:
        "It's your statement for public statistics, not a verification. You link a verified Steam in Logi → My account.",
    ambiguousTitle: "You have several Steam accounts linked",
    ambiguousBody: "Choose the one to use for statistics.",
    otherMissingTitle: "{name} has no Steam linked",
    otherMissingBody: "They can add it themselves with /stats.",
    otherAmbiguousTitle: "{name} has several Steam accounts linked",
    otherAmbiguousBody: "They have to choose one themselves with /stats.",
    otherFallbackName: "This player",
    emptySelf: "You have no game on the clan's servers in {period}.",
    emptyOther: "No game on the clan's servers in {period}.",
    emptyNext: "Try a longer period: /stats game: {game} period: {next}.",
    emptyHll: "HLL Records has no game in {period}.",
    modalTitle: "Link Steam",
    modalLabel: "Steam ID or profile link",
    modalPlaceholder: "76561198… or steamcommunity.com/profiles/…",
    retry: "Enter again",
    errors: {
        unavailableTitle: "Statistics can't be loaded right now",
        unavailableWarcon:
            "The clan's Warcon isn't answering. Your Steam stays saved, try again in a few minutes.",
        unavailableHll:
            "HLL Records isn't answering. Your Steam stays saved, try again in a few minutes.",
        blockedTitle: "HLL Records isn't letting the bot in right now",
        blockedBody: "Open the profile yourself. Your Steam stays saved.",
        gameDisabledTitle: "{game} statistics are switched off here",
        gameDisabledBody:
            "A manager can switch them on in Logi → Settings → Commands.",
        invalidTitle: "Choose just one player",
        invalidBody:
            "Either a server member, or a Wardogs player from the suggestions.",
        hllOnlyTitle: "That works only for Wardogs",
        hllOnlyBody:
            "Player search and the server filter are for Wardogs. For Hell Let Loose choose a server member.",
        busyTitle: "Give it a moment",
        busyBody:
            "Your previous request is still running. Try again in a few seconds.",
        expiredTitle: "This offer is no longer valid",
        expiredBody: "Run /stats again.",
        ownOnlyTitle: "These buttons belong to someone else",
        ownOnlyBody: "Only the person who ran /stats can use them.",
        forbiddenTitle: "That isn't possible right now",
        forbiddenBody: "Run /stats again in a server you're a member of.",
        incompleteTitle: "The history couldn't be read completely",
        incompleteBody: "Try again or choose a shorter period.",
        notConfiguredTitle: "Logi isn't set up here yet",
        notConfiguredBody:
            "A server manager connects Discord to Logi on the web.",
        linkChangedTitle: "The link changed in the meantime",
        linkChangedBody: "Run /stats again.",
        alreadyLinkedTitle: "Another player already has this Steam",
        alreadyLinkedBody: "Ask the clan's managers to check the link.",
        invalidSteamTitle: "That doesn't look like a Steam ID",
        invalidSteamBody:
            "It has 17 digits and starts with 7656119, or it's a steamcommunity.com/profiles/… link.",
        linkErrorTitle: "Saving couldn't be confirmed",
        linkErrorBody:
            "Run /stats to check whether your Steam is linked. A manager can help.",
    },
    shareFlow: {
        promptTitle: "Where should the card go?",
        selectChannel: "Choose a channel",
        back: "Back",
        sharedTitle: "Shared to {channel}",
        viewMessage: "View message",
        deniedTitle: "You can't share to {channel} right now",
        deniedBody:
            "You and the bot need permission to send messages and embed links in that channel. Choose another channel.",
        chooseOther: "Choose another channel",
        failedTitle: "Sharing couldn't be confirmed",
        failedBody:
            "Check the channel before you share again, the card may already be there.",
        alreadyTitle: "This card is already shared",
        alreadyBody: "Run /stats again for a new card.",
    },
}

const cs: StatsCopy = {
    periodChoices: {
        "7d": "7 dní",
        "30d": "30 dní",
        "90d": "90 dní",
        all: "Celá historie",
    },
    periodLabels: {
        "7d": "Posledních 7 dní",
        "30d": "Posledních 30 dní",
        "90d": "Posledních 90 dní",
        all: "Celá historie",
    },
    periodPhrases: {
        "7d": "posledních 7 dní",
        "30d": "posledních 30 dní",
        "90d": "posledních 90 dní",
        all: "celou historii",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Zabití",
    deaths: "Úmrtí",
    kd: "K/D",
    wins: "Výhry",
    matches: "Hry",
    winRate: "Úspěšnost {rate} %",
    playtime: "odehráno {hours} h",
    cash: "změna cash {cash}",
    coverage: "{metrics} známe {from} {known} {fromTotal} {total} her.",
    coverageNames: {
        killsKd: "Zabití a K/D",
        kills: "Zabití",
        deaths: "Úmrtí",
        cashDelta: "Změnu cash",
        seconds: "Odehraný čas",
    },
    hllDetail:
        "Odehráno {hours} h · ELO pěchoty {elo} · zabití spoluhráčů {tk}",
    form: "Forma: {rate} % výher v posledních 100 hrách delších než 20 min",
    stale: "Ukazuju poslední načtená data, zdroj se teď nepodařilo obnovit.",
    recentTitle: "{name} · poslední hry",
    factionsTitle: "{name} · frakce",
    weaponsTitle: "{name} · zbraně",
    mapsTitle: "{name} · mapy",
    results: {
        win: "Výhra",
        loss: "Prohra",
        draw: "Remíza",
        unknown: "Bez výsledku",
    },
    recentRow: "{map} · {day} · {kills} zabití, {deaths} úmrtí",
    factionRow: "{wins} {from} {matches} výher · {kills} zabití",
    noItems: "Podrobnosti zatím nejsou k dispozici.",
    overview: "Přehled",
    recent: "Poslední hry",
    factions: "Frakce",
    weapons: "Zbraně",
    maps: "Mapy",
    share: "Sdílet",
    hllProfile: "Profil na HLL Records",
    addSteam: "Přidat Steam",
    chooseSteam: "Vybrat Steam",
    sourceWarcon: "Zdroj: Warcon klanu",
    sourceGames: "{games} na serverech klanu",
    dataAt: "data z {time}",
    gamesCount: {
        one: "{count} hra",
        few: "{count} hry",
        other: "{count} her",
    },
    sourceHll:
        "Zdroj: HLL Records · jen sledované komunitní servery · + znamená nejméně",
    sharedBy: "Sdílel {user} · stav k {time}",
    sharedWarcon: "Warcon klanu",
    sharedHll: "HLL Records",
    missingTitle: "Chybí ti Steam účet",
    missingBody:
        "Statistiky hledáme podle Steam ID. Přidej ho a hned je načteme.",
    declared:
        "Je to tvoje prohlášení pro veřejné statistiky, ne ověření. Ověřený Steam propojíš v Logi → Můj účet.",
    ambiguousTitle: "Máš propojených víc Steam účtů",
    ambiguousBody: "Vyber, který z nich se má pro statistiky použít.",
    otherMissingTitle: "{name} nemá propojený Steam",
    otherMissingBody: "Může si ho přidat sám přes /stats.",
    otherAmbiguousTitle: "{name} má propojených víc Steam účtů",
    otherAmbiguousBody: "Vybrat si ho musí sám přes /stats.",
    otherFallbackName: "Tento hráč",
    emptySelf: "Za {period} nemáš na serverech klanu žádnou hru.",
    emptyOther: "Za {period} nemá na serverech klanu žádnou hru.",
    emptyNext: "Zkus delší období: /stats hra: {game} období: {next}.",
    emptyHll: "HLL Records za {period} nemá žádnou hru.",
    modalTitle: "Propojit Steam",
    modalLabel: "Steam ID nebo odkaz na profil",
    modalPlaceholder: "76561198… nebo steamcommunity.com/profiles/…",
    retry: "Zadat znovu",
    errors: {
        unavailableTitle: "Statistiky se teď nedají načíst",
        unavailableWarcon:
            "Warcon klanu neodpovídá. Tvůj Steam zůstává uložený, zkus to za pár minut.",
        unavailableHll:
            "HLL Records neodpovídá. Tvůj Steam zůstává uložený, zkus to za pár minut.",
        blockedTitle: "HLL Records teď bota nepustí",
        blockedBody: "Profil si otevři sám. Tvůj Steam zůstává uložený.",
        gameDisabledTitle: "Statistiky {game} jsou tu vypnuté",
        gameDisabledBody:
            "Zapnout je může správce v Logi → Nastavení → Příkazy.",
        invalidTitle: "Vyber jen jednoho hráče",
        invalidBody: "Buď člena serveru, nebo hráče Wardogs z nabídky.",
        hllOnlyTitle: "Tohle jde jen u Wardogs",
        hllOnlyBody:
            "Hledání hráče a výběr serveru jsou pro Wardogs. U Hell Let Loose vyber člena serveru.",
        busyTitle: "Chvilku počkej",
        busyBody: "Předchozí požadavek ještě běží. Zkus to za pár sekund.",
        expiredTitle: "Tahle nabídka už neplatí",
        expiredBody: "Spusť /stats znovu.",
        ownOnlyTitle: "Tahle tlačítka patří někomu jinému",
        ownOnlyBody: "Použít je může jen ten, kdo spustil /stats.",
        forbiddenTitle: "Tohle teď nejde",
        forbiddenBody: "Spusť /stats znovu na serveru, kde jsi členem.",
        incompleteTitle: "Historii se nepodařilo načíst celou",
        incompleteBody: "Zkus to znovu nebo vyber kratší období.",
        notConfiguredTitle: "Logi tu ještě není nastavené",
        notConfiguredBody: "Správce serveru propojí Discord s Logi na webu.",
        linkChangedTitle: "Propojení se mezitím změnilo",
        linkChangedBody: "Spusť /stats znovu.",
        alreadyLinkedTitle: "Tenhle Steam už má jiný hráč",
        alreadyLinkedBody: "Požádej správce klanu, ať propojení zkontroluje.",
        invalidSteamTitle: "Tohle nevypadá jako Steam ID",
        invalidSteamBody:
            "Má 17 číslic a začíná 7656119, nebo je to odkaz steamcommunity.com/profiles/….",
        linkErrorTitle: "Uložení se nepodařilo ověřit",
        linkErrorBody:
            "Spusť /stats a podívej se, jestli je Steam propojený. Pomoct ti může správce.",
    },
    shareFlow: {
        promptTitle: "Kam kartu poslat?",
        selectChannel: "Vyber kanál",
        back: "Zpět",
        sharedTitle: "Sdíleno do {channel}",
        viewMessage: "Zobrazit zprávu",
        deniedTitle: "Do {channel} teď sdílet nejde",
        deniedBody:
            "Ty i bot potřebujete v kanálu právo psát zprávy a vkládat odkazy. Vyber jiný kanál.",
        chooseOther: "Vybrat jiný kanál",
        failedTitle: "Sdílení se nepodařilo ověřit",
        failedBody:
            "Než to zkusíš znovu, podívej se do kanálu, karta tam už může být.",
        alreadyTitle: "Tahle karta už je sdílená",
        alreadyBody: "Pro novou kartu spusť /stats znovu.",
    },
}

const de: StatsCopy = {
    periodChoices: {
        "7d": "7 Tage",
        "30d": "30 Tage",
        "90d": "90 Tage",
        all: "Gesamte Historie",
    },
    periodLabels: {
        "7d": "Letzte 7 Tage",
        "30d": "Letzte 30 Tage",
        "90d": "Letzte 90 Tage",
        all: "Gesamte Historie",
    },
    periodPhrases: {
        "7d": "den letzten 7 Tagen",
        "30d": "den letzten 30 Tagen",
        "90d": "den letzten 90 Tagen",
        all: "der gesamten Historie",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Kills",
    deaths: "Tode",
    kd: "K/D",
    wins: "Siege",
    matches: "Spiele",
    winRate: "Siegquote {rate} %",
    playtime: "gespielt {hours} h",
    cash: "Cash-Änderung {cash}",
    coverage: "{metrics} kennen wir aus {known} von {total} Spielen.",
    coverageNames: {
        killsKd: "Kills und K/D",
        kills: "Kills",
        deaths: "Tode",
        cashDelta: "Die Cash-Änderung",
        seconds: "Die Spielzeit",
    },
    hllDetail: "Gespielt {hours} h · Infanterie-ELO {elo} · Teamkills {tk}",
    form: "Form: {rate} % Siege in den letzten 100 Spielen über 20 min",
    stale: "Ich zeige die zuletzt gelesenen Daten, die Quelle ließ sich gerade nicht aktualisieren.",
    recentTitle: "{name} · letzte Spiele",
    factionsTitle: "{name} · Fraktionen",
    weaponsTitle: "{name} · Waffen",
    mapsTitle: "{name} · Karten",
    results: {
        win: "Sieg",
        loss: "Niederlage",
        draw: "Unentschieden",
        unknown: "Kein Ergebnis",
    },
    recentRow: "{map} · {day} · {kills} Kills, {deaths} Tode",
    factionRow: "{wins} von {matches} Siegen · {kills} Kills",
    noItems: "Noch keine Details.",
    overview: "Übersicht",
    recent: "Letzte Spiele",
    factions: "Fraktionen",
    weapons: "Waffen",
    maps: "Karten",
    share: "Teilen",
    hllProfile: "Profil auf HLL Records",
    addSteam: "Steam hinzufügen",
    chooseSteam: "Steam wählen",
    sourceWarcon: "Quelle: Warcon des Clans",
    sourceGames: "{games} auf den Clan-Servern",
    dataAt: "Daten von {time}",
    gamesCount: { one: "{count} Spiel", other: "{count} Spiele" },
    sourceHll:
        "Quelle: HLL Records · nur erfasste Community-Server · + heißt mindestens",
    sharedBy: "Geteilt von {user} · Stand {time}",
    sharedWarcon: "Warcon des Clans",
    sharedHll: "HLL Records",
    missingTitle: "Dir fehlt ein Steam-Konto",
    missingBody:
        "Statistiken suchen wir über die Steam-ID. Füg sie hinzu und wir laden sie sofort.",
    declared:
        "Das ist deine Angabe für öffentliche Statistiken, keine Verifizierung. Ein verifiziertes Steam verknüpfst du in Logi → Mein Konto.",
    ambiguousTitle: "Du hast mehrere Steam-Konten verknüpft",
    ambiguousBody: "Wähle, welches für Statistiken gelten soll.",
    otherMissingTitle: "{name} hat kein Steam verknüpft",
    otherMissingBody: "Er kann es selbst über /stats hinzufügen.",
    otherAmbiguousTitle: "{name} hat mehrere Steam-Konten verknüpft",
    otherAmbiguousBody: "Er muss selbst eins über /stats wählen.",
    otherFallbackName: "Dieser Spieler",
    emptySelf: "In {period} hast du auf den Clan-Servern kein Spiel.",
    emptyOther: "In {period} gibt es auf den Clan-Servern kein Spiel.",
    emptyNext:
        "Versuch einen längeren Zeitraum: /stats spiel: {game} zeitraum: {next}.",
    emptyHll: "HLL Records hat in {period} kein Spiel.",
    modalTitle: "Steam verknüpfen",
    modalLabel: "Steam-ID oder Profil-Link",
    modalPlaceholder: "76561198… oder steamcommunity.com/profiles/…",
    retry: "Erneut eingeben",
    errors: {
        unavailableTitle: "Statistiken lassen sich gerade nicht laden",
        unavailableWarcon:
            "Warcon des Clans antwortet nicht. Dein Steam bleibt gespeichert, versuch es in ein paar Minuten.",
        unavailableHll:
            "HLL Records antwortet nicht. Dein Steam bleibt gespeichert, versuch es in ein paar Minuten.",
        blockedTitle: "HLL Records lässt den Bot gerade nicht rein",
        blockedBody: "Öffne das Profil selbst. Dein Steam bleibt gespeichert.",
        gameDisabledTitle: "{game}-Statistiken sind hier ausgeschaltet",
        gameDisabledBody:
            "Ein Verwalter kann sie in Logi → Einstellungen → Befehle einschalten.",
        invalidTitle: "Wähle nur einen Spieler",
        invalidBody:
            "Entweder ein Servermitglied oder einen Wardogs-Spieler aus den Vorschlägen.",
        hllOnlyTitle: "Das geht nur bei Wardogs",
        hllOnlyBody:
            "Spielersuche und Serverfilter gelten für Wardogs. Bei Hell Let Loose wähle ein Servermitglied.",
        busyTitle: "Einen Moment",
        busyBody:
            "Deine vorige Anfrage läuft noch. Versuch es in ein paar Sekunden.",
        expiredTitle: "Dieses Angebot gilt nicht mehr",
        expiredBody: "Starte /stats erneut.",
        ownOnlyTitle: "Diese Buttons gehören jemand anderem",
        ownOnlyBody: "Nur wer /stats gestartet hat, kann sie nutzen.",
        forbiddenTitle: "Das geht gerade nicht",
        forbiddenBody:
            "Starte /stats erneut auf einem Server, dessen Mitglied du bist.",
        incompleteTitle: "Die Historie ließ sich nicht ganz lesen",
        incompleteBody: "Versuch es erneut oder wähle einen kürzeren Zeitraum.",
        notConfiguredTitle: "Logi ist hier noch nicht eingerichtet",
        notConfiguredBody:
            "Ein Serververwalter verbindet Discord im Web mit Logi.",
        linkChangedTitle: "Die Verknüpfung hat sich inzwischen geändert",
        linkChangedBody: "Starte /stats erneut.",
        alreadyLinkedTitle: "Dieses Steam gehört schon einem anderen Spieler",
        alreadyLinkedBody:
            "Bitte die Clan-Verwalter, die Verknüpfung zu prüfen.",
        invalidSteamTitle: "Das sieht nicht nach einer Steam-ID aus",
        invalidSteamBody:
            "Sie hat 17 Ziffern und beginnt mit 7656119, oder es ist ein Link steamcommunity.com/profiles/….",
        linkErrorTitle: "Das Speichern ließ sich nicht bestätigen",
        linkErrorBody:
            "Starte /stats und prüfe, ob dein Steam verknüpft ist. Ein Verwalter kann helfen.",
    },
    shareFlow: {
        promptTitle: "Wohin soll die Karte?",
        selectChannel: "Kanal wählen",
        back: "Zurück",
        sharedTitle: "In {channel} geteilt",
        viewMessage: "Nachricht anzeigen",
        deniedTitle: "In {channel} kannst du gerade nicht teilen",
        deniedBody:
            "Du und der Bot braucht in dem Kanal das Recht, Nachrichten zu senden und Links einzubetten. Wähle einen anderen Kanal.",
        chooseOther: "Anderen Kanal wählen",
        failedTitle: "Das Teilen ließ sich nicht bestätigen",
        failedBody:
            "Schau in den Kanal, bevor du erneut teilst, die Karte kann schon dort sein.",
        alreadyTitle: "Diese Karte ist schon geteilt",
        alreadyBody: "Starte /stats erneut für eine neue Karte.",
    },
}

/** The `/stats` copy in the clan language (`cs`, `de`, else English). */
export function statsCopy(language: string | null | undefined): StatsCopy {
    const value = (language ?? "").toLowerCase()
    return value.startsWith("cs") ? cs : value.startsWith("de") ? de : en
}
