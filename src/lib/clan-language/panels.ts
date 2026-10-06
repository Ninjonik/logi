import type { PanelMessagesCopy } from "../../domain/discord-publications/panel-copy"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * Messages the bot keeps in channels (boards L3, P4, P5, P6): live server
 * panels and "Naše servery", the private player list, result cards, the
 * calendar, competition tables and the private "Nahlásit hráče" flow, plus
 * the calendar links of events. Czech is verbatim from the boards; bot copy
 * says "ty" ("du").
 */
export type PanelMessages = PanelMessagesCopy & {
    calendar: {
        fallbackDetails: string
        fallbackLocation: string
        panelTitle: string
        panelEmpty: string
        panelCategories: string
        matchLabel: string
        trainingLabel: string
    }
}

/** Czech "1 výhra ze 2", "2 výhry ze 2", "0 výher ze 2". */
function czechWins(wins: number, matches: number) {
    const word =
        wins === 1 ? "výhra" : wins >= 2 && wins <= 4 ? "výhry" : "výher"
    const from =
        [2, 3, 4, 7].includes(matches % 100) ||
        (matches >= 12 && matches <= 14) ||
        matches === 17
            ? "ze"
            : "z"
    return `${wins} ${word} ${from} ${matches}`
}
function czechPlayers(count: string) {
    const n = Number(count.replace(/\s/g, ""))
    return n === 1 ? "hráč" : n >= 2 && n <= 4 ? "hráči" : "hráčů"
}

const panelsMessages: Record<ClanLanguage, PanelMessages> = {
    en: {
        calendar: {
            fallbackDetails: "Operation briefing from Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Calendar",
            panelEmpty: "No upcoming events are scheduled right now.",
            panelCategories: "Categories",
            matchLabel: "Match",
            trainingLabel: "Training",
        },
        live: {
            labelLive: "Live server",
            labelClan: "Clan server",
            labelStatus: "Server status",
            labelCombined: "Our servers",
            game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
            state: {
                live: "Live",
                online: "Online",
                empty: "Empty",
                seeding: "Seeding",
                offline: "Unavailable",
                paused: "Paused",
                stale: "Older data",
            },
            players: (count, capacity) => `${count} / ${capacity} players`,
            playersShort: (count, capacity) => `${count} / ${capacity}`,
            playerCount: (count) =>
                `${count} ${count === "1" ? "player" : "players"}`,
            queue: (count) => `queue ${count}`,
            timeLeft: (minutes) => `${minutes} min left`,
            liveFrom: (count) => `live from ${count}`,
            serverNotResponding: "server not responding",
            lastData: (time) => `last data ${time}`,
            pausedByAdmin: "an admin stopped the updates",
            offlineText:
                "The panel updates by itself as soon as the server answers again.",
            emptyText: "Nobody is playing on the server right now.",
            emptySeedHint: (channel) =>
                `When the admins start it up, the call comes to ${channel}.`,
            seedJoin: "Join and help get the server started.",
            seedRunning: (time) => `Seeding since ${time}.`,
            seedCallIn: (channel) => `The call is in ${channel}.`,
            allies: "Allies",
            axis: "Axis",
            topKills: "MOST KILLS",
            topCash: "MOST MONEY NOW",
            clanPlaying: (count) => `CLAN MEMBERS PLAYING · ${count}`,
            nextMap: (map) => `Next map: ${map}`,
            nextMapInline: (map) => `next map ${map}`,
            matchRunning: (time) => `running since ${time}`,
            address: "Address",
            password: "Password",
            joinCode: "Join code",
            points: "pts",
            newMap: "New map",
            combinedTitle: "Where we play",
            buttons: {
                join: "Join",
                players: "Show players",
                report: "Report player",
                openCall: "Open the call",
                joinServer: (name) => `Join: ${name}`,
            },
        },
        players: {
            label: "Players on the server",
            title: (map, players) =>
                `${map} · ${players} ${players === "1" ? "player" : "players"}`,
            titleNoMap: (players) =>
                `${players} ${players === "1" ? "player" : "players"}`,
            metaHll: (time) =>
                `Current round only · observed ${time} · kills / deaths`,
            metaWardogs: (time) =>
                `Current round only · observed ${time} · kills / money now`,
            sideHeader: (side, count) => `${side.toUpperCase()} · ${count}`,
            noSide: "No side",
            sortedNote: "Sorted by kills, 8 players per page",
            pageButton: (page, pages) => `${page} / ${pages}`,
            empty: "Nobody is playing on the server right now.",
            unavailableTitle: "The player list is not available right now",
            unavailableBody:
                "The server did not send the current round's players. Try again in a moment.",
            outdatedTitle: "This panel is out of date",
            outdatedBody: "Open the current panel in its channel.",
            previous: "Previous",
            next: "Next",
        },
        results: {
            label: "Result",
            corrected: "Corrected",
            outcomes: { win: "Win", loss: "Loss", draw: "Draw" },
            place: (place) => `${place}. place`,
            confirmedBy: (name) => `confirmed by ${name}`,
            correctedAt: (time, previous) =>
                `corrected ${time} · previously ${previous}`,
            match: (number) => `Match ${number}`,
            points: "pts",
            viewMatch: "View match",
        },
        calendarPanel: {
            label: (clan) => `Calendar · ${clan}`,
            title: "Upcoming events",
            next: "Next:",
            relative: (time) => time,
            signupUntil: (time) => `sign-ups until ${time}`,
            allDay: "all day",
            open: "Open calendar",
            timesNote: "Times in your time zone",
            empty: "No upcoming events are scheduled right now.",
            training: "Training",
            match: "Match",
        },
        competition: {
            title: "Standings",
            titleAfterRound: (round) => `Standings after round ${round}`,
            points: (points) => `${points} pts`,
            wins: (wins, matches) =>
                `${wins} ${wins === 1 ? "win" : "wins"} of ${matches}`,
            nextMatch: (team, details) => `Next match ${team}: ${details}`,
            round: (round) => `round ${round}`,
            open: "Open competition",
            rules: "Points by the ECL rules",
            empty: "No team is registered in this division yet.",
        },
        report: {
            pickerLabel: (server) => `Report player · ${server}`,
            pickerTitle: "Who do you want to report?",
            pickerMeta: (map, time) => `${map} · players observed ${time}`,
            pickerMetaNoMap: (time) => `Players observed ${time}`,
            pickerText:
                "Only the admins see the report, in a private thread. You can attach evidence there.",
            selectPlaceholder: "Choose a player",
            onServer: (side) => `${side} · on the server`,
            onServerNoSide: "on the server",
            otherPlayer: "Another player",
            otherPlayerHint: "you enter a name or ID, unverified",
            previous: "Previous",
            next: "Next",
            modalTitle: (player) => `Report player ${player}`,
            modalTitleOther: "Report player",
            playerField: "Player name or ID",
            reasonField: "What happened",
            reasonPlaceholder:
                "At least 10 characters. E.g. keeps killing teammates at spawn.",
            whenField: "Roughly when",
            whenPlaceholder: "E.g. around 20:35",
            evidenceField: "Link to evidence",
            evidencePlaceholder: "https://…",
            sentTitle: "Report sent",
            sentBody: (thread) =>
                `The admins have it in the private thread ${thread}. Attach videos and screenshots there.`,
            openThread: "Open thread",
            savedTitle: "Report saved",
            savedBody:
                "Your report is saved, but its private thread is still being set up. The admins will see it; you don't need to send it again.",
            cannotSendTitle: "The report can't be sent right now",
            limitBody:
                "You have 3 reports open; more at once isn't possible. Wait until the admins close them.",
            waitBody: "You can send another report in a minute.",
            tooManyFormsBody:
                "You have too many unfinished report forms. Try again in 15 minutes.",
            expiredBody:
                "The form expired or the panel changed. Open the report again from the current panel.",
            reasonBody: "Describe what happened in at least 10 characters.",
            evidenceBody: "The evidence link must start with https://.",
            playerBody: "Enter the player's name or ID.",
            noAccessBody:
                "You don't have access to the private reports. Message the clan admins.",
            unavailableBody:
                "The server's players can't be read right now. Try again in a moment.",
            threadName: (number, player) => `Report #${number} · ${player}`,
            cardLabel: (number) => `Player report #${number} · To review`,
            observedIdentity:
                "Name from the server data, Discord account not verified",
            manualIdentity: "Name entered by hand, not verified",
            reportedBy: (reporter) => `reported by ${reporter}`,
            when: "When",
            evidence: "Evidence",
            footer: "A report to review, not a proven violation. Close it with /close_ticket and a reason.",
        },
    },
    cs: {
        calendar: {
            fallbackDetails: "Briefing k operaci z Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Kalendář",
            panelEmpty:
                "Momentálně nejsou naplánované žádné nadcházející akce.",
            panelCategories: "Kategorie",
            matchLabel: "Zápas",
            trainingLabel: "Výcvik",
        },
        live: {
            labelLive: "Živý server",
            labelClan: "Klanový server",
            labelStatus: "Stav serveru",
            labelCombined: "Naše servery",
            game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
            state: {
                live: "Živě",
                online: "Online",
                empty: "Prázdný",
                seeding: "Seedujeme",
                offline: "Nedostupný",
                paused: "Pozastaveno",
                stale: "Starší data",
            },
            players: (count, capacity) =>
                `${count} / ${capacity} ${czechPlayers(capacity)}`,
            playersShort: (count, capacity) => `${count} / ${capacity}`,
            playerCount: (count) => `${count} ${czechPlayers(count)}`,
            queue: (count) => `fronta ${count}`,
            timeLeft: (minutes) => `zbývá ${minutes} min`,
            liveFrom: (count) => `živý od ${count}`,
            serverNotResponding: "server neodpovídá",
            lastData: (time) => `poslední data ${time}`,
            pausedByAdmin: "správce zastavil obnovování",
            offlineText: "Panel se obnoví sám, jakmile server zase odpoví.",
            emptyText: "Na serveru teď nikdo nehraje.",
            emptySeedHint: (channel) =>
                `Když ho správci rozjedou, výzva přijde do ${channel}.`,
            seedJoin: "Připoj se a pomoz server nastartovat.",
            seedRunning: (time) => `Seed běží od ${time}.`,
            seedCallIn: (channel) => `Výzva je v ${channel}.`,
            allies: "Spojenci",
            axis: "Osa",
            topKills: "NEJVÍC ZABITÍ",
            topCash: "NEJVÍC PENĚZ TEĎ",
            clanPlaying: (count) => `Z KLANU HRAJE · ${count}`,
            nextMap: (map) => `Další mapa: ${map}`,
            nextMapInline: (map) => `další mapa ${map}`,
            matchRunning: (time) => `probíhá od ${time}`,
            address: "Adresa",
            password: "Heslo",
            joinCode: "Join kód",
            points: "b.",
            newMap: "Nová mapa",
            combinedTitle: "Kde se hraje",
            buttons: {
                join: "Připojit se",
                players: "Zobrazit hráče",
                report: "Nahlásit hráče",
                openCall: "Otevřít výzvu",
                joinServer: (name) => `Připojit: ${name}`,
            },
        },
        players: {
            label: "Hráči na serveru",
            title: (map, players) =>
                `${map} · ${players} ${czechPlayers(players)}`,
            titleNoMap: (players) => `${players} ${czechPlayers(players)}`,
            metaHll: (time) =>
                `Jen aktuální kolo · zjištěno ${time} · zabití / úmrtí`,
            metaWardogs: (time) =>
                `Jen aktuální kolo · zjištěno ${time} · zabití / peníze teď`,
            sideHeader: (side, count) =>
                `${side.toLocaleUpperCase("cs-CZ")} · ${count}`,
            noSide: "Bez strany",
            sortedNote: "Řazeno podle zabití, 8 hráčů na stránku",
            pageButton: (page, pages) => `${page} / ${pages}`,
            empty: "Na serveru teď nikdo nehraje.",
            unavailableTitle: "Seznam hráčů teď není k dispozici",
            unavailableBody:
                "Server teď neposlal hráče aktuálního kola. Zkus to za chvíli znovu.",
            outdatedTitle: "Tenhle panel už není aktuální",
            outdatedBody: "Otevři aktuální panel v jeho kanálu.",
            previous: "Předchozí",
            next: "Další",
        },
        results: {
            label: "Výsledek",
            corrected: "Opraveno",
            outcomes: { win: "Výhra", loss: "Prohra", draw: "Remíza" },
            place: (place) => `${place}. místo`,
            confirmedBy: (name) => `potvrdil ${name}`,
            correctedAt: (time, previous) =>
                `opraveno ${time} · dřív ${previous}`,
            match: (number) => `Zápas ${number}`,
            points: "b.",
            viewMatch: "Zobrazit zápas",
        },
        calendarPanel: {
            label: (clan) => `Kalendář · ${clan}`,
            title: "Nejbližší akce",
            next: "Další:",
            relative: (time) => time,
            signupUntil: (time) => `přihlášky do ${time}`,
            allDay: "celý den",
            open: "Otevřít kalendář",
            timesNote: "Časy v tvém pásmu",
            empty: "Momentálně nejsou naplánované žádné nadcházející akce.",
            training: "Trénink",
            match: "Zápas",
        },
        competition: {
            title: "Tabulka",
            titleAfterRound: (round) => `Tabulka po ${round}. kole`,
            points: (points) => `${points} b.`,
            wins: czechWins,
            nextMatch: (team, details) => `Další zápas ${team}: ${details}`,
            round: (round) => `${round}. kolo`,
            open: "Otevřít soutěž",
            rules: "Body podle pravidel ECL",
            empty: "V této divizi zatím není žádný tým.",
        },
        report: {
            pickerLabel: (server) => `Nahlásit hráče · ${server}`,
            pickerTitle: "Koho chceš nahlásit?",
            pickerMeta: (map, time) => `${map} · hráči zjištění ${time}`,
            pickerMetaNoMap: (time) => `Hráči zjištění ${time}`,
            pickerText:
                "Hlášení uvidí jen správci v soukromém vlákně. Důkazy můžeš přiložit tam.",
            selectPlaceholder: "Vyber hráče",
            onServer: (side) => `${side} · na serveru`,
            onServerNoSide: "na serveru",
            otherPlayer: "Jiný hráč",
            otherPlayerHint: "zadáš jméno nebo ID, neověřené",
            previous: "Předchozí",
            next: "Další",
            modalTitle: (player) => `Nahlásit hráče ${player}`,
            modalTitleOther: "Nahlásit hráče",
            playerField: "Jméno nebo ID hráče",
            reasonField: "Co se stalo",
            reasonPlaceholder:
                "Aspoň 10 znaků. Např. opakovaně zabíjí spoluhráče na spawnu.",
            whenField: "Kdy přibližně",
            whenPlaceholder: "Např. kolem 20:35",
            evidenceField: "Odkaz na důkaz",
            evidencePlaceholder: "https://…",
            sentTitle: "Hlášení odesláno",
            sentBody: (thread) =>
                `Správci ho mají v soukromém vlákně ${thread}. Videa a snímky přilož tam.`,
            openThread: "Otevřít vlákno",
            savedTitle: "Hlášení je uložené",
            savedBody:
                "Hlášení máme, jen jeho soukromé vlákno ještě vzniká. Správci ho uvidí; znovu ho posílat nemusíš.",
            cannotSendTitle: "Hlášení teď nejde poslat",
            limitBody:
                "Máš otevřená 3 hlášení, víc najednou nejde. Počkej, až je správci uzavřou.",
            waitBody: "Další hlášení můžeš poslat za minutu.",
            tooManyFormsBody:
                "Máš rozpracovaných moc formulářů. Zkus to znovu za 15 minut.",
            expiredBody:
                "Formulář vypršel nebo se panel změnil. Otevři hlášení znovu z aktuálního panelu.",
            reasonBody: "Napiš, co se stalo, aspoň 10 znaků.",
            evidenceBody: "Odkaz na důkaz musí začínat https://.",
            playerBody: "Napiš jméno nebo ID hráče.",
            noAccessBody:
                "K soukromým hlášením nemáš přístup. Napiš správcům klanu.",
            unavailableBody:
                "Hráče na serveru teď nejde načíst. Zkus to za chvíli znovu.",
            threadName: (number, player) => `Hlášení #${number} · ${player}`,
            cardLabel: (number) => `Hlášení hráče #${number} · K prověření`,
            observedIdentity: "Jméno z dat serveru, účet v Discordu neověřený",
            manualIdentity: "Jméno zadané ručně, neověřené",
            reportedBy: (reporter) => `nahlásil ${reporter}`,
            when: "Kdy",
            evidence: "Důkaz",
            footer: "Hlášení k prověření, ne prokázané porušení. Uzavřete ho příkazem /close_ticket s důvodem.",
        },
    },
    de: {
        calendar: {
            fallbackDetails: "Einsatz-Briefing aus Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Kalender",
            panelEmpty: "Derzeit sind keine kommenden Events geplant.",
            panelCategories: "Kategorien",
            matchLabel: "Match",
            trainingLabel: "Training",
        },
        live: {
            labelLive: "Live-Server",
            labelClan: "Clan-Server",
            labelStatus: "Serverstatus",
            labelCombined: "Unsere Server",
            game: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
            state: {
                live: "Live",
                online: "Online",
                empty: "Leer",
                seeding: "Seeding",
                offline: "Nicht erreichbar",
                paused: "Pausiert",
                stale: "Ältere Daten",
            },
            players: (count, capacity) => `${count} / ${capacity} Spieler`,
            playersShort: (count, capacity) => `${count} / ${capacity}`,
            playerCount: (count) => `${count} Spieler`,
            queue: (count) => `Warteschlange ${count}`,
            timeLeft: (minutes) => `noch ${minutes} Min.`,
            liveFrom: (count) => `live ab ${count}`,
            serverNotResponding: "Server antwortet nicht",
            lastData: (time) => `letzte Daten ${time}`,
            pausedByAdmin: "ein Admin hat die Aktualisierung gestoppt",
            offlineText:
                "Das Panel aktualisiert sich von selbst, sobald der Server wieder antwortet.",
            emptyText: "Gerade spielt niemand auf dem Server.",
            emptySeedHint: (channel) =>
                `Wenn die Admins ihn starten, kommt der Aufruf in ${channel}.`,
            seedJoin: "Komm auf den Server und hilf, ihn zu starten.",
            seedRunning: (time) => `Seeding läuft seit ${time}.`,
            seedCallIn: (channel) => `Der Aufruf ist in ${channel}.`,
            allies: "Alliierte",
            axis: "Achse",
            topKills: "MEISTE KILLS",
            topCash: "MEISTES GELD GERADE",
            clanPlaying: (count) => `AUS DEM CLAN SPIELEN · ${count}`,
            nextMap: (map) => `Nächste Karte: ${map}`,
            nextMapInline: (map) => `nächste Karte ${map}`,
            matchRunning: (time) => `läuft seit ${time}`,
            address: "Adresse",
            password: "Passwort",
            joinCode: "Join-Code",
            points: "Pkt.",
            newMap: "Neue Karte",
            combinedTitle: "Wo gespielt wird",
            buttons: {
                join: "Beitreten",
                players: "Spieler anzeigen",
                report: "Spieler melden",
                openCall: "Aufruf öffnen",
                joinServer: (name) => `Beitreten: ${name}`,
            },
        },
        players: {
            label: "Spieler auf dem Server",
            title: (map, players) => `${map} · ${players} Spieler`,
            titleNoMap: (players) => `${players} Spieler`,
            metaHll: (time) =>
                `Nur aktuelle Runde · erfasst ${time} · Kills / Tode`,
            metaWardogs: (time) =>
                `Nur aktuelle Runde · erfasst ${time} · Kills / Geld gerade`,
            sideHeader: (side, count) =>
                `${side.toLocaleUpperCase("de-DE")} · ${count}`,
            noSide: "Ohne Seite",
            sortedNote: "Nach Kills sortiert, 8 Spieler pro Seite",
            pageButton: (page, pages) => `${page} / ${pages}`,
            empty: "Gerade spielt niemand auf dem Server.",
            unavailableTitle: "Die Spielerliste ist gerade nicht verfügbar",
            unavailableBody:
                "Der Server hat die Spieler der aktuellen Runde nicht geschickt. Versuch es gleich noch einmal.",
            outdatedTitle: "Dieses Panel ist nicht mehr aktuell",
            outdatedBody: "Öffne das aktuelle Panel in seinem Kanal.",
            previous: "Zurück",
            next: "Weiter",
        },
        results: {
            label: "Ergebnis",
            corrected: "Korrigiert",
            outcomes: {
                win: "Sieg",
                loss: "Niederlage",
                draw: "Unentschieden",
            },
            place: (place) => `${place}. Platz`,
            confirmedBy: (name) => `bestätigt von ${name}`,
            correctedAt: (time, previous) =>
                `korrigiert ${time} · vorher ${previous}`,
            match: (number) => `Match ${number}`,
            points: "Pkt.",
            viewMatch: "Match ansehen",
        },
        calendarPanel: {
            label: (clan) => `Kalender · ${clan}`,
            title: "Nächste Termine",
            next: "Als Nächstes:",
            relative: (time) => time,
            signupUntil: (time) => `Anmeldung bis ${time}`,
            allDay: "ganztägig",
            open: "Kalender öffnen",
            timesNote: "Zeiten in deiner Zeitzone",
            empty: "Derzeit sind keine kommenden Events geplant.",
            training: "Training",
            match: "Match",
        },
        competition: {
            title: "Tabelle",
            titleAfterRound: (round) => `Tabelle nach Runde ${round}`,
            points: (points) => `${points} Pkt.`,
            wins: (wins, matches) =>
                `${wins} ${wins === 1 ? "Sieg" : "Siege"} aus ${matches}`,
            nextMatch: (team, details) => `Nächstes Match ${team}: ${details}`,
            round: (round) => `Runde ${round}`,
            open: "Wettbewerb öffnen",
            rules: "Punkte nach den ECL-Regeln",
            empty: "In dieser Division ist noch kein Team.",
        },
        report: {
            pickerLabel: (server) => `Spieler melden · ${server}`,
            pickerTitle: "Wen willst du melden?",
            pickerMeta: (map, time) => `${map} · Spieler erfasst ${time}`,
            pickerMetaNoMap: (time) => `Spieler erfasst ${time}`,
            pickerText:
                "Die Meldung sehen nur die Admins in einem privaten Thread. Beweise kannst du dort anhängen.",
            selectPlaceholder: "Spieler wählen",
            onServer: (side) => `${side} · auf dem Server`,
            onServerNoSide: "auf dem Server",
            otherPlayer: "Anderer Spieler",
            otherPlayerHint: "du gibst Name oder ID ein, nicht geprüft",
            previous: "Zurück",
            next: "Weiter",
            modalTitle: (player) => `Spieler ${player} melden`,
            modalTitleOther: "Spieler melden",
            playerField: "Name oder ID des Spielers",
            reasonField: "Was ist passiert",
            reasonPlaceholder:
                "Mindestens 10 Zeichen. Z. B. tötet wiederholt Mitspieler am Spawn.",
            whenField: "Ungefähr wann",
            whenPlaceholder: "Z. B. gegen 20:35",
            evidenceField: "Link zum Beweis",
            evidencePlaceholder: "https://…",
            sentTitle: "Meldung gesendet",
            sentBody: (thread) =>
                `Die Admins haben sie im privaten Thread ${thread}. Videos und Screenshots hängst du dort an.`,
            openThread: "Thread öffnen",
            savedTitle: "Meldung gespeichert",
            savedBody:
                "Deine Meldung ist gespeichert, ihr privater Thread wird noch eingerichtet. Die Admins sehen sie; du musst sie nicht erneut senden.",
            cannotSendTitle: "Die Meldung kann gerade nicht gesendet werden",
            limitBody:
                "Du hast 3 offene Meldungen, mehr gleichzeitig geht nicht. Warte, bis die Admins sie schließen.",
            waitBody: "Die nächste Meldung kannst du in einer Minute senden.",
            tooManyFormsBody:
                "Du hast zu viele offene Formulare. Versuch es in 15 Minuten erneut.",
            expiredBody:
                "Das Formular ist abgelaufen oder das Panel hat sich geändert. Öffne die Meldung erneut aus dem aktuellen Panel.",
            reasonBody: "Beschreib in mindestens 10 Zeichen, was passiert ist.",
            evidenceBody: "Der Beweis-Link muss mit https:// beginnen.",
            playerBody: "Gib Name oder ID des Spielers ein.",
            noAccessBody:
                "Du hast keinen Zugriff auf private Meldungen. Schreib den Clan-Admins.",
            unavailableBody:
                "Die Spieler des Servers können gerade nicht gelesen werden. Versuch es gleich noch einmal.",
            threadName: (number, player) => `Meldung #${number} · ${player}`,
            cardLabel: (number) => `Spielermeldung #${number} · Zu prüfen`,
            observedIdentity:
                "Name aus den Serverdaten, Discord-Konto nicht geprüft",
            manualIdentity: "Name von Hand eingegeben, nicht geprüft",
            reportedBy: (reporter) => `gemeldet von ${reporter}`,
            when: "Wann",
            evidence: "Beweis",
            footer: "Eine Meldung zur Prüfung, kein bewiesener Verstoß. Schließt sie mit /close_ticket und einem Grund.",
        },
    },
}

/** The panels copy in the clan language; unknown languages read English. */
export const getPanelMessages = clanCopy(panelsMessages)
