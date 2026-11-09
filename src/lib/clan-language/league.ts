import type {
    LeagueCopy,
    LeagueDay,
} from "../../domain/wardogs-league/league-copy"
import { polishNoun, polishPlayers } from "../../domain/localization/polish"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * The WD League panels ("tabulka", "nejbližší zápasy" with the recent
 * results) and the reply to a posted League link (boards P6 and L3). Czech is
 * verbatim from the boards; bot copy says "ty" ("du").
 */
export type LeagueMessages = LeagueCopy

/** Czech plural: one, 2–4, the rest. */
function czech(n: number, one: string, few: string, many: string) {
    return n === 1 ? one : n >= 2 && n <= 4 ? few : many
}
const placeList = (
    points: readonly number[],
    place: (position: number, value: number) => string
) => points.map((value, index) => place(index + 1, value)).join(" · ")

const leagueMessages: Record<ClanLanguage, LeagueMessages> = {
    pl: {
        standings: {
            label: (season) => `Wardogs League · sezon ${season}`,
            title: "WD League · tabela",
            played: (matches) =>
                matches === 1 ? "Po 1 meczu" : `Po ${matches} meczach`,
            rule: (points) =>
                `punktacja: ${placeList(points, (position, value) => `${position}. miejsce: ${value}`)}`,
            mixedRule: "punktacja według zasad poszczególnych meczów",
            columns: {
                rank: "#",
                team: "Drużyna",
                points: "P",
                played: "M",
                first: "1.",
                second: "2.",
                third: "3.",
                name: "Nazwa",
            },
            legend: "P punkty · M mecze · 1. 2. 3. liczba zajętych miejsc · › nasza drużyna",
            waiting: "Tabela pojawi się po pierwszych wynikach",
            moreTeams: (count) =>
                `… i jeszcze ${count} ${polishNoun(count, "drużyna", "drużyny", "drużyn")}`,
            open: "Otwórz ligę",
            footer: "Logi zlicza punkty z wyników na wardogsleague.net",
        },
        fixtures: {
            label: "Wardogs League · mecze całej ligi",
            title: "WD League · następne mecze",
            meta: (shown) =>
                `${shown} ${polishNoun(shown, "najbliższy mecz", "najbliższe mecze", "najbliższych meczów")} · godziny w Twojej strefie czasowej`,
            members: (count) =>
                `${count} ${polishNoun(count, "członek", "członków", "członków")}`,
            host: (team) => `Gospodarz: ${team}`,
            hostLeague: "Organizowany przez ligę",
            mapAfterVote: "Mapa po głosowaniu",
            live: "Na żywo",
            chips: {
                rules: (picked, total) => `Zasady ${picked}/${total}`,
                rulesUnknown: "Zasady",
                voteRunning: "Głosowanie na mapę",
                voteCloses: (time) => `koniec ${time}`,
                voteFrom: (date) => `Głosowanie na mapę od ${date}`,
                votePending: "Nie rozpoczęło się głosowanie na mapę",
                voteDone: "Głosowanie na mapę zakończone",
                moderatorDone: "Przypisano moderatora",
                moderatorPending: "Nie ma jeszcze moderatora",
                readyPending: "Nie rozpoczęto sprawdzania gotowości",
                readyRunning: "Trwa sprawdzanie gotowości",
                readyDone: "Sprawdzenie gotowości zakończone",
                notStarted: "Przygotowanie jeszcze się nie rozpoczęło",
            },
            detail: "Szczegóły na wardogsleague.net",
            more: (count) =>
                `… i jeszcze ${count} ${polishNoun(count, "mecz", "mecze", "meczów")} na stronie ligi`,
            empty: "W lidze nie ma obecnie żadnych nadchodzących meczów.",
            all: "Wszystkie mecze na stronie ligi",
            footer: "Dane z wardogsleague.net",
            mapAlt: (map) => `Mapa ${map}`,
            stale: "Strona ligi nie odpowiada",
            lastData: (time) => `ostatnie dane ${time}`,
        },
        recent: {
            label: (range) => `Wardogs League · ${range}`,
            title: "WD League · ostatnie wyniki",
            heading: "Najnowsze wyniki",
            range: (from: LeagueDay, to: LeagueDay) =>
                from.month === to.month
                    ? `${from.day}–${to.day} ${to.monthShort}`
                    : `${from.day} ${from.monthShort}–${to.day} ${to.monthShort}`,
            empty: "Brak wyników ligowych w ciągu ostatnich 7 dni.",
            waiting:
                "Wyniki pojawią się po pierwszych rozegranych meczach ligi",
            link: "Wyniki na stronie ligi",
        },
        pausedReason: "administrator wstrzymał aktualizacje",
        reply: {
            label: (fixture) => `Wardogs League · nowy mecz ${fixture}`,
            body: (channel) =>
                `Logi śledzi ten mecz. Kartę, która sama się aktualizuje, znajdziesz w ${channel}.`,
            openPanel: "Otwórz kartę",
            openLeague: "Otwórz na stronie ligi",
        },
    },
    fr: {
        standings: {
            label: (season) => `Wardogs League · saison ${season}`,
            title: "WD League · classement",
            played: (matches) =>
                matches === 1 ? "Après 1 match" : `Après ${matches} matchs`,
            rule: (points) =>
                `points : ${placeList(points, (position, value) => `${position}${position === 1 ? "er" : position === 2 ? "e" : position === 3 ? "e" : "e"} place ${value}`)}`,
            mixedRule: "points selon le barème propre à chaque match",
            columns: {
                rank: "#",
                team: "Équipe",
                points: "P",
                played: "M",
                first: "1er",
                second: "2e",
                third: "3e",
                name: "Nom",
            },
            legend: "P points · M matchs · 1er 2e 3e nombre de fois à cette place · › notre équipe",
            waiting: "Le classement apparaîtra après les premiers résultats",
            moreTeams: (count) =>
                count === 1 ? "… et 1 autre équipe" : `… et ${count} autres équipes`,
            open: "Ouvrir la ligue",
            footer: "Logi calcule les points à partir des résultats de wardogsleague.net",
        },
        fixtures: {
            label: "Wardogs League · matchs de toute la ligue",
            title: "WD League · prochains matchs",
            meta: (shown) =>
                `${shown === 1 ? "1 match à venir" : `${shown} matchs à venir`} · horaires dans ton fuseau horaire`,
            members: (count) => (count === 1 ? "1 membre" : `${count} membres`),
            host: (team) => `Organisé par ${team}`,
            hostLeague: "Organisé par la ligue",
            mapAfterVote: "Carte après le vote",
            live: "En direct",
            chips: {
                rules: (picked, total) => `Règles ${picked}/${total}`,
                rulesUnknown: "Règles",
                voteRunning: "Vote de carte",
                voteCloses: (time) => `clôture ${time}`,
                voteFrom: (date) => `Vote de carte à partir de ${date}`,
                votePending: "Vote de carte non commencé",
                voteDone: "Vote de carte terminé",
                moderatorDone: "Modérateur désigné",
                moderatorPending: "Aucun modérateur pour le moment",
                readyPending: "Vérification de disponibilité non commencée",
                readyRunning: "Vérification de disponibilité en cours",
                readyDone: "Vérification de disponibilité terminée",
                notStarted: "La préparation n’a pas encore commencé",
            },
            detail: "Détails sur wardogsleague.net",
            more: (count) =>
                count === 1
                    ? "… et 1 autre match sur le site de la ligue"
                    : `… et ${count} autres matchs sur le site de la ligue`,
            empty: "La ligue n’a aucun match à venir pour le moment.",
            all: "Tous les matchs sur le site de la ligue",
            footer: "Données de wardogsleague.net",
            mapAlt: (map) => `carte ${map}`,
            stale: "Le site de la ligue ne répond pas",
            lastData: (time) => `dernières données ${time}`,
        },
        recent: {
            label: (range) => `Wardogs League · ${range}`,
            title: "WD League · derniers résultats",
            heading: "Derniers résultats",
            range: (from: LeagueDay, to: LeagueDay) =>
                from.month === to.month
                    ? `${from.day}–${to.day} ${to.monthShort}`
                    : `${from.day} ${from.monthShort}–${to.day} ${to.monthShort}`,
            empty: "Aucun résultat de ligue au cours des 7 derniers jours.",
            waiting: "Les résultats apparaîtront après les premiers matchs de ligue",
            link: "Résultats sur le site de la ligue",
        },
        pausedReason: "un administrateur a suspendu les mises à jour",
        reply: {
            label: (fixture) => `Wardogs League · nouveau match ${fixture}`,
            body: (channel) =>
                `Logi suit ce match. Tu trouveras la fiche mise à jour automatiquement dans ${channel}.`,
            openPanel: "Ouvrir la fiche",
            openLeague: "Ouvrir sur le site de la ligue",
        },
    },
    en: {
        standings: {
            label: (season) => `Wardogs League · season ${season}`,
            title: "WD League · table",
            played: (matches) =>
                matches === 1 ? "After 1 match" : `After ${matches} matches`,
            rule: (points) =>
                `points: ${placeList(points, (position, value) => `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} place ${value}`)}`,
            mixedRule: "points by each match's own rule",
            columns: {
                rank: "#",
                team: "Team",
                points: "P",
                played: "M",
                first: "1st",
                second: "2nd",
                third: "3rd",
                name: "Name",
            },
            legend: "P points · M matches · 1st 2nd 3rd times in that place · › our team",
            waiting: "The table appears after the first results",
            moreTeams: (count) =>
                count === 1 ? "… and 1 more team" : `… and ${count} more teams`,
            open: "Open the league",
            footer: "Logi counts the points from results on wardogsleague.net",
        },
        fixtures: {
            label: "Wardogs League · matches of the whole league",
            title: "WD League · next matches",
            meta: (shown) =>
                `${shown === 1 ? "1 next match" : `${shown} next matches`} · times in your time zone`,
            members: (count) => (count === 1 ? "1 member" : `${count} members`),
            host: (team) => `Hosted by ${team}`,
            hostLeague: "Hosted by the league",
            mapAfterVote: "Map after the vote",
            live: "Live",
            chips: {
                rules: (picked, total) => `Rules ${picked}/${total}`,
                rulesUnknown: "Rules",
                voteRunning: "Map vote",
                voteCloses: (time) => `closes ${time}`,
                voteFrom: (date) => `Map vote from ${date}`,
                votePending: "Map vote not started",
                voteDone: "Map vote closed",
                moderatorDone: "Moderator assigned",
                moderatorPending: "No moderator yet",
                readyPending: "Ready check not started",
                readyRunning: "Ready check running",
                readyDone: "Ready check done",
                notStarted: "Preparation has not started yet",
            },
            detail: "Details on wardogsleague.net",
            more: (count) =>
                count === 1
                    ? "… and 1 more match on the league site"
                    : `… and ${count} more matches on the league site`,
            empty: "The league has no upcoming matches right now.",
            all: "All matches on the league site",
            footer: "Data from wardogsleague.net",
            mapAlt: (map) => `map ${map}`,
            stale: "League site not responding",
            lastData: (time) => `last data ${time}`,
        },
        recent: {
            label: (range) => `Wardogs League · ${range}`,
            title: "WD League · recent results",
            heading: "Recent results",
            range: (from: LeagueDay, to: LeagueDay) =>
                from.month === to.month
                    ? `${from.day}–${to.day} ${to.monthShort}`
                    : `${from.day} ${from.monthShort}–${to.day} ${to.monthShort}`,
            empty: "No league results in the last 7 days.",
            waiting: "Results appear after the first league results",
            link: "Results on the league site",
        },
        pausedReason: "an admin paused updates",
        reply: {
            label: (fixture) => `Wardogs League · new match ${fixture}`,
            body: (channel) =>
                `Logi is tracking this match. You'll find the card that updates itself in ${channel}.`,
            openPanel: "Open card",
            openLeague: "Open on the league site",
        },
    },
    cs: {
        standings: {
            label: (season) => `Wardogs League · sezóna ${season}`,
            title: "WD League · tabulka",
            played: (matches) =>
                matches === 1 ? "Po 1 zápase" : `Po ${matches} zápasech`,
            rule: (points) =>
                `body: ${placeList(points, (position, value) => `${position}. místo ${value}`)}`,
            mixedRule: "body podle pravidla každého zápasu",
            columns: {
                rank: "#",
                team: "Tým",
                points: "B",
                played: "Z",
                first: "1.",
                second: "2.",
                third: "3.",
                name: "Název",
            },
            legend: "B body · Z zápasy · 1. 2. 3. kolikrát na tom místě · › náš tým",
            waiting: "Tabulka se zobrazí po prvních výsledcích",
            moreTeams: (count) =>
                czech(
                    count,
                    "… a další 1 tým",
                    `… a další ${count} týmy`,
                    `… a dalších ${count} týmů`
                ),
            open: "Otevřít ligu",
            footer: "Body počítá Logi z výsledků na wardogsleague.net",
        },
        fixtures: {
            label: "Wardogs League · zápasy celé ligy",
            title: "WD League · nejbližší zápasy",
            meta: (shown) =>
                `${czech(shown, "1 nejbližší zápas", `${shown} nejbližší zápasy`, `${shown} nejbližších zápasů`)} · časy v tvém pásmu`,
            members: (count) =>
                czech(count, "1 člen", `${count} členové`, `${count} členů`),
            host: (team) => `Hostuje ${team}`,
            hostLeague: "Hostuje liga",
            mapAfterVote: "Mapa po hlasování",
            live: "Živě",
            chips: {
                rules: (picked, total) => `Pravidla ${picked}/${total}`,
                rulesUnknown: "Pravidla",
                voteRunning: "Hlasování o mapě",
                voteCloses: (time) => `končí ${time}`,
                voteFrom: (date) => `Hlasování o mapě od ${date}`,
                votePending: "Hlasování o mapě nezačalo",
                voteDone: "Hlasování o mapě skončilo",
                moderatorDone: "Moderátor přidělen",
                moderatorPending: "Moderátor zatím není",
                readyPending: "Ready check nezačal",
                readyRunning: "Ready check běží",
                readyDone: "Ready check hotový",
                notStarted: "Příprava ještě nezačala",
            },
            detail: "Detail na wardogsleague.net",
            more: (count) =>
                czech(
                    count,
                    "… a další zápas na webu ligy",
                    `… a další ${count} zápasy na webu ligy`,
                    `… a dalších ${count} zápasů na webu ligy`
                ),
            empty: "Liga teď nemá žádné nadcházející zápasy.",
            all: "Všechny zápasy na webu ligy",
            footer: "Data z wardogsleague.net",
            mapAlt: (map) => `mapa ${map}`,
            stale: "Web ligy neodpovídá",
            lastData: (time) => `poslední data ${time}`,
        },
        recent: {
            label: (range) => `Wardogs League · ${range}`,
            title: "WD League · poslední výsledky",
            heading: "Poslední výsledky",
            range: (from: LeagueDay, to: LeagueDay) =>
                from.month === to.month
                    ? `${from.day}.–${to.day}. ${to.month}.`
                    : `${from.day}. ${from.month}.–${to.day}. ${to.month}.`,
            empty: "Za posledních 7 dní nejsou žádné výsledky ligy.",
            waiting: "Výsledky se zobrazí po prvních výsledcích ligy",
            link: "Výsledky na webu ligy",
        },
        pausedReason: "správce zastavil obnovování",
        reply: {
            label: (fixture) => `Wardogs League · nový zápas ${fixture}`,
            body: (channel) =>
                `Logi zápas sleduje. Kartu, která se sama obnovuje, najdeš v ${channel}.`,
            openPanel: "Otevřít kartu",
            openLeague: "Otevřít na webu ligy",
        },
    },
    de: {
        standings: {
            label: (season) => `Wardogs League · Saison ${season}`,
            title: "WD League · Tabelle",
            played: (matches) =>
                matches === 1 ? "Nach 1 Spiel" : `Nach ${matches} Spielen`,
            rule: (points) =>
                `Punkte: ${placeList(points, (position, value) => `${position}. Platz ${value}`)}`,
            mixedRule: "Punkte nach der Regel des jeweiligen Spiels",
            columns: {
                rank: "#",
                team: "Team",
                points: "P",
                played: "S",
                first: "1.",
                second: "2.",
                third: "3.",
                name: "Name",
            },
            legend: "P Punkte · S Spiele · 1. 2. 3. wie oft auf diesem Platz · › unser Team",
            waiting: "Die Tabelle erscheint nach den ersten Ergebnissen",
            moreTeams: (count) =>
                count === 1
                    ? "… und 1 weiteres Team"
                    : `… und ${count} weitere Teams`,
            open: "Liga öffnen",
            footer: "Die Punkte berechnet Logi aus den Ergebnissen auf wardogsleague.net",
        },
        fixtures: {
            label: "Wardogs League · Spiele der ganzen Liga",
            title: "WD League · nächste Spiele",
            meta: (shown) =>
                `${shown === 1 ? "1 nächstes Spiel" : `${shown} nächste Spiele`} · Zeiten in deiner Zeitzone`,
            members: (count) =>
                count === 1 ? "1 Mitglied" : `${count} Mitglieder`,
            host: (team) => `Gastgeber ${team}`,
            hostLeague: "Gastgeber ist die Liga",
            mapAfterVote: "Karte nach der Abstimmung",
            live: "Live",
            chips: {
                rules: (picked, total) => `Regeln ${picked}/${total}`,
                rulesUnknown: "Regeln",
                voteRunning: "Kartenabstimmung",
                voteCloses: (time) => `endet ${time}`,
                voteFrom: (date) => `Kartenabstimmung ab ${date}`,
                votePending: "Kartenabstimmung nicht gestartet",
                voteDone: "Kartenabstimmung beendet",
                moderatorDone: "Moderator zugeteilt",
                moderatorPending: "Noch kein Moderator",
                readyPending: "Ready-Check nicht gestartet",
                readyRunning: "Ready-Check läuft",
                readyDone: "Ready-Check erledigt",
                notStarted: "Vorbereitung hat noch nicht begonnen",
            },
            detail: "Details auf wardogsleague.net",
            more: (count) =>
                count === 1
                    ? "… und 1 weiteres Spiel auf der Liga-Website"
                    : `… und ${count} weitere Spiele auf der Liga-Website`,
            empty: "Die Liga hat gerade keine anstehenden Spiele.",
            all: "Alle Spiele auf der Liga-Website",
            footer: "Daten von wardogsleague.net",
            mapAlt: (map) => `Karte ${map}`,
            stale: "Liga-Website antwortet nicht",
            lastData: (time) => `letzte Daten ${time}`,
        },
        recent: {
            label: (range) => `Wardogs League · ${range}`,
            title: "WD League · letzte Ergebnisse",
            heading: "Letzte Ergebnisse",
            range: (from: LeagueDay, to: LeagueDay) =>
                from.month === to.month
                    ? `${from.day}.–${to.day}.${to.month}.`
                    : `${from.day}.${from.month}.–${to.day}.${to.month}.`,
            empty: "Keine Liga-Ergebnisse in den letzten 7 Tagen.",
            waiting:
                "Die Ergebnisse erscheinen nach den ersten Liga-Ergebnissen",
            link: "Ergebnisse auf der Liga-Website",
        },
        pausedReason: "ein Admin hat die Aktualisierung angehalten",
        reply: {
            label: (fixture) => `Wardogs League · neues Spiel ${fixture}`,
            body: (channel) =>
                `Logi verfolgt dieses Spiel. Die Karte, die sich selbst aktualisiert, findest du in ${channel}.`,
            openPanel: "Karte öffnen",
            openLeague: "Auf der Liga-Website öffnen",
        },
    },
}

export const getLeagueMessages = clanCopy(leagueMessages)
