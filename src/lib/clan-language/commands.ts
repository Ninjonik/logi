import type { LogiCommand } from "../../domain/discord-commands/catalog"
import type { PluralForms } from "../../domain/discord-messages/format"
import { clanCopy, type ClanLanguage } from "./core"

/** A command option as Discord shows it: its name and description. */
export type CommandOptionCopy = { name: string; description: string }

/**
 * Slash command descriptions and replies of the commands workstream (boards
 * M1, M2, M3, N3): the registration texts, the one access-error vocabulary,
 * `/help`, `/player`, `/notice` and `/server-status`. `/stats` keeps its copy
 * in `src/domain/player-stats/stats-copy.ts`. Czech is verbatim from the
 * boards; bot copy says "ty" ("du").
 */
export type CommandMessages = {
    /** The outcomes of `/close_application` (W0 `shared.ts`). */
    commands: {
        outcomeDenied: string
        outcomePending: string
        outcomeRecruit: string
        outcomeMember: string
        outcomeMercenary: string
    }
    /** What Discord shows after "/" (M1 1.3, 1.4). */
    registry: {
        /** Without the managers' suffix; it is added per settings (N3-B07). */
        descriptions: Record<LogiCommand, string>
        managerSuffix: string
        options: {
            statsGame: CommandOptionCopy
            statsMember: CommandOptionCopy
            statsPlayer: CommandOptionCopy
            statsPeriod: CommandOptionCopy
            statsServer: CommandOptionCopy
            statsChannel: CommandOptionCopy
            playerPlayer: CommandOptionCopy
            noticeEvent: CommandOptionCopy
            closeTicketReason: CommandOptionCopy
            closeApplicationOutcome: CommandOptionCopy
            closeApplicationReason: CommandOptionCopy
            serverStatusGame: CommandOptionCopy
        }
        periods: { "7d": string; "30d": string; "90d": string; all: string }
    }
    /** "vypnuto", "nepovoleno" and "jinde" for every configurable command. */
    access: {
        disabledTitle: string
        disabledBody: string
        notAllowedTitle: { clanMembers: string; logiAdmins: string }
        notAllowedBody: { clanMembers: string; logiAdmins: string }
        extraRoles: string
        wrongChannelTitle: string
        wrongChannelBody: string
        verifyFailedTitle: string
        verifyFailedBody: string
        notConnectedTitle: string
        notConnectedBody: string
        aboutLogi: string
        and: string
        or: string
    }
    help: {
        label: string
        title: string
        lines: Record<Exclude<LogiCommand, "help">, string>
        channelsAll: string
        recruitmentLine: string
        ticketsLine: string
        signupLine: string
        staffTitle: string
        staffReason: {
            administrator: string
            adminRole: string
            support: string
            role: string
        }
        guide: string
        nothing: string
    }
    player: {
        label: string
        statuses: {
            member: string
            reserve_member: string
            mercenary: string
            recruit: string
            pending: string
            active: string
            paused: string
        }
        score: string
        matches: string
        kd: string
        averages: string
        recentTitle: string
        recentRow: string
        share: string
        source: string
        sourceSince: string
        matchCount: PluralForms
        sharedBy: string
        sharedSource: string
        noMatches: string
        notFoundTitle: string
        notFoundBody: string
        loadFailedTitle: string
        loadFailedBody: string
        sharedTitle: string
        viewMessage: string
        shareDeniedTitle: string
        shareDeniedBody: string
        shareFailedTitle: string
        shareFailedBody: string
        avatar: string
    }
    notice: {
        modalTitle: string
        modalNote: string
        reasonLabel: string
        reasonPlaceholder: string
        savedTitle: string
        savedNote: string
        notSignedUpTitle: string
        notSignedUpBody: string
        signupWhere: string
        startedTitle: string
        startedBody: string
        multipleTitle: string
        multipleBody: string
        eventFallback: string
    }
    serverStatus: {
        label: string
        title: PluralForms
        intro: string
        online: string
        offline: string
        stale: string
        staleOnly: string
        noData: string
        disabled: string
        disabledHint: string
        players: string
        link: string
        shown: PluralForms
        serversOf: { one: string; other: string }
        notAllowedTitle: string
        notAllowedBody: string
        liveScoreWhere: string
        noConnectionsTitle: string
        noConnectionsBody: string
        unavailableTitle: string
        unavailableBody: string
        providers: {
            hll_crcon: string
            wardogs_rcon: string
            wardogs_warcon: string
            wardogs_public_directory: string
        }
        unnamed: string
    }
}

const commandsMessages: Record<ClanLanguage, CommandMessages> = {
    en: {
        commands: {
            outcomeDenied: "Denied",
            outcomePending: "Still pending",
            outcomeRecruit: "Recruit",
            outcomeMember: "Member",
            outcomeMercenary: "Mercenary",
        },
        registry: {
            descriptions: {
                help: "Commands you can use and a link to the guide",
                stats: "Your Hell Let Loose or Wardogs statistics",
                player: "A clan player's profile: score and recent matches",
                link: "Link your game accounts: Steam, Epic, Xbox, PlayStation",
                notice: "Let the leads know you'll be late for an event",
                "server-status": "Stored status of the clan's game servers",
                close_ticket: "Close this ticket and send the author a summary",
                close_application:
                    "Decide the application in this thread and close it",
            },
            managerSuffix: " (managers)",
            options: {
                statsGame: {
                    name: "game",
                    description: "Hell Let Loose or Wardogs",
                },
                statsMember: {
                    name: "member",
                    description:
                        "A server member with a linked Steam account (default: you)",
                },
                statsPlayer: {
                    name: "player",
                    description: "Wardogs only: a player by name or Steam ID",
                },
                statsPeriod: {
                    name: "period",
                    description:
                        "7, 30 or 90 days, or all history (default 30 days)",
                },
                statsServer: {
                    name: "server",
                    description: "Wardogs only: one of the clan's servers",
                },
                statsChannel: {
                    name: "channel",
                    description: "Where Share posts the card",
                },
                playerPlayer: {
                    name: "player",
                    description: "A clan player, pick from the list",
                },
                noticeEvent: {
                    name: "event",
                    description:
                        "An event you signed up for that hasn't started",
                },
                closeTicketReason: {
                    name: "reason",
                    description: "The author sees it in the thread and by DM",
                },
                closeApplicationOutcome: {
                    name: "outcome",
                    description: "What the applicant becomes",
                },
                closeApplicationReason: {
                    name: "reason",
                    description:
                        "The applicant sees it in the thread and by DM",
                },
                serverStatusGame: {
                    name: "game",
                    description: "The game whose servers to show",
                },
            },
            periods: {
                "7d": "7 days",
                "30d": "30 days",
                "90d": "90 days",
                all: "All history",
            },
        },
        access: {
            disabledTitle: "{command} is switched off here",
            disabledBody:
                "A manager can switch it on in Logi → Settings → Commands.",
            notAllowedTitle: {
                clanMembers: "Only clan members can use {command}",
                logiAdmins: "Only Logi managers can use {command}",
            },
            notAllowedBody: {
                clanMembers:
                    "Clan members have the clan role from Logi. If you should have it, ask the managers.",
                logiAdmins:
                    "Managers have Discord's Administrator permission or the managers' role.",
            },
            extraRoles: "{roles} can use it too.",
            wrongChannelTitle: "{command} doesn't work here",
            wrongChannelBody: "Use it in {channels}.",
            verifyFailedTitle: "Your roles can't be checked right now",
            verifyFailedBody: "Discord didn't answer. Try again in a moment.",
            notConnectedTitle: "Logi isn't set up here yet",
            notConnectedBody:
                "A server manager connects Discord to Logi on the web. Then you'll see your commands here.",
            aboutLogi: "What is Logi",
            and: " and ",
            or: " or ",
        },
        help: {
            label: "Logi commands · Clan {clan}",
            title: "What you can use here",
            lines: {
                stats: "Your Hell Let Loose or Wardogs statistics. Only you see them until you share them.",
                player: "A clan player's profile: score and recent matches.",
                link: "Link your game accounts so Logi recognises you in game.",
                notice: "Let the leads know you'll be late for an event.",
                "server-status": "Stored status of the clan's game servers.",
                close_ticket:
                    "In a ticket thread, closes it and sends the author a summary.",
                close_application:
                    "In an application thread, decides on the applicant and adds roles.",
            },
            channelsAll:
                "Clan applications, tickets and match sign-ups are buttons in {recruitment}, {tickets} and {announcements}.",
            recruitmentLine:
                "You apply to the clan with the button in {channel}.",
            ticketsLine: "You open a ticket with the button in {channel}.",
            signupLine:
                "You sign up for matches with the buttons in {channel}.",
            staffTitle: "For managers",
            staffReason: {
                administrator:
                    "You see these because you have Discord's Administrator permission.",
                adminRole:
                    "You see these because you have the Logi managers' role.",
                support:
                    "You see these because you're support for a ticket or application category.",
                role: "You see these because the managers allowed your role.",
            },
            guide: "Guide on the web",
            nothing: "There are no commands for you here right now.",
        },
        player: {
            label: "{game} · Player profile",
            statuses: {
                member: "Member",
                reserve_member: "Reserve",
                mercenary: "Mercenary",
                recruit: "Recruit",
                pending: "Applicant",
                active: "active",
                paused: "paused",
            },
            score: "Clan score",
            matches: "Matches",
            kd: "K/D",
            averages:
                "Average per match: {kills} kills · {deaths} deaths · offense {offense} · defense {defense} · support {support}",
            recentTitle: "Recent matches",
            recentRow:
                "{day} · {map} · {kills} kills, {deaths} deaths · K/D {kd}",
            share: "Share",
            source: "Source: the clan's imported matches",
            sourceSince: "{count} since {date}",
            matchCount: { one: "{count} match", other: "{count} matches" },
            sharedBy: "Shared by {user} · as of {time}",
            sharedSource: "The clan's imported matches",
            noMatches:
                "No imported matches yet, so there's nothing to show or share.",
            notFoundTitle: "I can't find this player in the clan",
            notFoundBody:
                "Pick the player from the list that shows while you type the name.",
            loadFailedTitle: "The profile can't be loaded right now",
            loadFailedBody: "Try again in a moment.",
            sharedTitle: "Shared to {channel}",
            viewMessage: "View message",
            shareDeniedTitle: "You can't share to {channel} right now",
            shareDeniedBody:
                "You and the bot need permission to send messages and embed links in that channel.",
            shareFailedTitle: "Sharing couldn't be confirmed",
            shareFailedBody:
                "Check the channel before you share again, the profile may already be there.",
            avatar: "{name}'s avatar",
        },
        notice: {
            modalTitle: "Running late · {event}",
            modalNote: "Only the match leads will see it.",
            reasonLabel: "When will you arrive and why?",
            reasonPlaceholder: "E.g. around 20:30, I finish work late.",
            savedTitle: "The leads know you'll be late",
            savedNote:
                "You won't get attendance reminders for this match any more. You can change it with another /notice.",
            notSignedUpTitle: "You aren't signed up for any upcoming event",
            notSignedUpBody:
                "You can only send a notice for an event you signed up for that hasn't started.",
            signupWhere: "You sign up in {channel}.",
            startedTitle: "{event} has already started",
            startedBody: "Write to the leads directly in the match channel.",
            multipleTitle: "There are several such events",
            multipleBody:
                "Pick one from the list, it shows the day and time too.",
            eventFallback: "the event",
        },
        serverStatus: {
            label: "Game server status · {game}",
            title: {
                one: "{count} clan server",
                other: "{count} clan servers",
            },
            intro: "Stored status from data collection, not a live check.",
            online: "Online",
            offline: "Offline",
            stale: "stale",
            staleOnly: "Stale",
            noData: "No data",
            disabled: "Collection off",
            disabledHint: "Switch it on in Game servers",
            players: "{players} / {capacity} players",
            link: "Game servers in Logi",
            shown: {
                one: "Showing {shown} of {total} {servers}. At most 5, the full list is in Logi.",
                other: "Showing {shown} of {total} {servers}. At most 5, the full list is in Logi.",
            },
            serversOf: { one: "server", other: "servers" },
            notAllowedTitle: "Only Logi managers can see server status",
            notAllowedBody:
                "Managers have Discord's Administrator permission or the managers' role.",
            liveScoreWhere: "You'll find the live score in {channel}.",
            noConnectionsTitle: "The clan has no {game} server connected",
            noConnectionsBody: "Connect one in Logi → Game servers.",
            unavailableTitle: "Server status can't be loaded right now",
            unavailableBody:
                "Try again in a minute. This doesn't affect the game servers.",
            providers: {
                hll_crcon: "CRCON",
                wardogs_rcon: "RCON",
                wardogs_warcon: "Warcon",
                wardogs_public_directory: "Wardog Servers",
            },
            unnamed: "Game server",
        },
    },
    cs: {
        commands: {
            outcomeDenied: "Zamítnuto",
            outcomePending: "Čeká na rozhodnutí",
            outcomeRecruit: "Rekrut",
            outcomeMember: "Člen",
            outcomeMercenary: "Žoldák",
        },
        registry: {
            descriptions: {
                help: "Příkazy, které můžeš použít, a odkaz na návod",
                stats: "Tvoje statistiky z Hell Let Loose nebo Wardogs",
                player: "Profil hráče klanu: skóre a poslední zápasy",
                link: "Propoj své herní účty: Steam, Epic, Xbox, PlayStation",
                notice: "Dej velení vědět, že na akci přijdeš později",
                "server-status": "Uložený stav herních serverů klanu",
                close_ticket: "Uzavře tento ticket a pošle autorovi shrnutí",
                close_application:
                    "Rozhodne o přihlášce v tomto vlákně a uzavře ji",
            },
            managerSuffix: " (pro správce)",
            options: {
                statsGame: {
                    name: "hra",
                    description: "Hell Let Loose nebo Wardogs",
                },
                statsMember: {
                    name: "člen",
                    description:
                        "Člen serveru s propojeným Steamem (výchozí: ty)",
                },
                statsPlayer: {
                    name: "hráč",
                    description: "Jen Wardogs: hráč podle jména nebo Steam ID",
                },
                statsPeriod: {
                    name: "období",
                    description:
                        "7, 30 nebo 90 dní, nebo celá historie (výchozí 30 dní)",
                },
                statsServer: {
                    name: "server",
                    description: "Jen Wardogs: jeden ze serverů klanu",
                },
                statsChannel: {
                    name: "kanál",
                    description: "Kam Sdílet pošle kartu",
                },
                playerPlayer: {
                    name: "hráč",
                    description: "Hráč klanu, vyber z nabídky",
                },
                noticeEvent: {
                    name: "akce",
                    description:
                        "Akce, na kterou jsi přihlášený a která nezačala",
                },
                closeTicketReason: {
                    name: "důvod",
                    description: "Autor ho uvidí ve vlákně a v DM",
                },
                closeApplicationOutcome: {
                    name: "výsledek",
                    description: "Čím se uchazeč stane",
                },
                closeApplicationReason: {
                    name: "důvod",
                    description: "Uchazeč ho uvidí ve vlákně a v DM",
                },
                serverStatusGame: {
                    name: "hra",
                    description: "Hra, jejíž servery chceš vidět",
                },
            },
            periods: {
                "7d": "7 dní",
                "30d": "30 dní",
                "90d": "90 dní",
                all: "Celá historie",
            },
        },
        access: {
            disabledTitle: "Příkaz {command} je tu vypnutý",
            disabledBody:
                "Zapnout ho může správce v Logi → Nastavení → Příkazy.",
            notAllowedTitle: {
                clanMembers: "{command} smí použít jen členové klanu",
                logiAdmins: "{command} smí použít jen správci Logi",
            },
            notAllowedBody: {
                clanMembers:
                    "Členové klanu mají klanovou roli z Logi. Když ji máš mít, napiš správcům.",
                logiAdmins:
                    "Správci mají v Discordu oprávnění Administrator nebo Roli správců.",
            },
            extraRoles: "Smí ho použít i {roles}.",
            wrongChannelTitle: "{command} tady nejde použít",
            wrongChannelBody: "Použij ho v {channels}.",
            verifyFailedTitle: "Teď nejde ověřit tvoje role",
            verifyFailedBody: "Discord neodpověděl. Zkus to za chvíli znovu.",
            notConnectedTitle: "Logi tu ještě není nastavené",
            notConnectedBody:
                "Správce serveru propojí Discord s Logi na webu. Pak tu uvidíš svoje příkazy.",
            aboutLogi: "Co je Logi",
            and: " a ",
            or: " nebo ",
        },
        help: {
            label: "Příkazy Logi · Klan {clan}",
            title: "Co tady můžeš použít",
            lines: {
                stats: "Tvoje statistiky z Hell Let Loose nebo Wardogs. Vidíš je jen ty, dokud je nesdílíš.",
                player: "Profil hráče klanu: skóre a poslední zápasy.",
                link: "Propoj herní účty, ať tě Logi pozná ve hře.",
                notice: "Dej velení vědět, že na akci přijdeš později.",
                "server-status": "Uložený stav herních serverů klanu.",
                close_ticket:
                    "Ve vlákně ticketu ho uzavře a pošle autorovi shrnutí.",
                close_application:
                    "Ve vlákně přihlášky rozhodne o uchazeči a přidá role.",
            },
            channelsAll:
                "Přihláška do klanu, tickety a přihlašování na zápasy jsou tlačítka v kanálech {recruitment}, {tickets} a {announcements}.",
            recruitmentLine:
                "Přihlášku do klanu podáš tlačítkem v kanálu {channel}.",
            ticketsLine: "Ticket otevřeš tlačítkem v kanálu {channel}.",
            signupLine: "Na zápasy se přihlásíš tlačítky v kanálu {channel}.",
            staffTitle: "Pro správce",
            staffReason: {
                administrator:
                    "Vidíš je, protože máš v Discordu oprávnění Administrator.",
                adminRole: "Vidíš je, protože máš Roli správců Logi.",
                support:
                    "Vidíš je, protože patříš k podpoře kategorie ticketů nebo přihlášek.",
                role: "Vidíš je, protože je správci povolili tvé roli.",
            },
            guide: "Návod na webu",
            nothing: "Teď tu pro tebe nejsou žádné příkazy.",
        },
        player: {
            label: "{game} · Profil hráče",
            statuses: {
                member: "Člen",
                reserve_member: "Záložník",
                mercenary: "Žoldák",
                recruit: "Rekrut",
                pending: "Uchazeč",
                active: "aktivní",
                paused: "pozastavený",
            },
            score: "Skóre klanu",
            matches: "Zápasy",
            kd: "K/D",
            averages:
                "Průměr na zápas: {kills} zabití · {deaths} úmrtí · útok {offense} · obrana {defense} · podpora {support}",
            recentTitle: "Poslední zápasy",
            recentRow:
                "{day} · {map} · {kills} zabití, {deaths} úmrtí · K/D {kd}",
            share: "Sdílet",
            source: "Zdroj: importované zápasy klanu",
            sourceSince: "{count} od {date}",
            matchCount: {
                one: "{count} zápas",
                few: "{count} zápasy",
                other: "{count} zápasů",
            },
            sharedBy: "Sdílel {user} · stav k {time}",
            sharedSource: "Importované zápasy klanu",
            noMatches:
                "Zatím nemá žádné importované zápasy, takže tu není co ukázat ani sdílet.",
            notFoundTitle: "Tohoto hráče v klanu nenacházím",
            notFoundBody:
                "Vyber hráče z nabídky, která se ukáže při psaní jména.",
            loadFailedTitle: "Profil se teď nedá načíst",
            loadFailedBody: "Zkus to za chvíli znovu.",
            sharedTitle: "Sdíleno do {channel}",
            viewMessage: "Zobrazit zprávu",
            shareDeniedTitle: "Do {channel} teď sdílet nejde",
            shareDeniedBody:
                "Ty i bot potřebujete v kanálu právo psát zprávy a vkládat odkazy.",
            shareFailedTitle: "Sdílení se nepodařilo ověřit",
            shareFailedBody:
                "Než to zkusíš znovu, podívej se do kanálu, profil tam už může být.",
            avatar: "avatar hráče {name}",
        },
        notice: {
            modalTitle: "Přijdu později · {event}",
            modalNote: "Uvidí to jen velení zápasu.",
            reasonLabel: "Kdy dorazíš a proč?",
            reasonPlaceholder: "Např. kolem 20:30, končím v práci.",
            savedTitle: "Velení ví, že přijdeš později",
            savedNote:
                "Připomínky docházky k tomuto zápasu ti už chodit nebudou. Změnit to můžeš dalším /notice.",
            notSignedUpTitle: "Nejsi přihlášený na žádnou nadcházející akci",
            notSignedUpBody:
                "Omluvu pošleš jen k akci, na kterou jsi přihlášený a která ještě nezačala.",
            signupWhere: "Přihlásíš se v {channel}.",
            startedTitle: "{event} už začal",
            startedBody: "Napiš velení přímo do kanálu zápasu.",
            multipleTitle: "Takových akcí je víc",
            multipleBody: "Vyber jednu z nabídky, ukazuje i den a čas.",
            eventFallback: "Akce",
        },
        serverStatus: {
            label: "Stav herních serverů · {game}",
            title: {
                one: "{count} server klanu",
                few: "{count} servery klanu",
                other: "{count} serverů klanu",
            },
            intro: "Uložený stav ze sběru dat, ne živá kontrola.",
            online: "Online",
            offline: "Offline",
            stale: "zastaralé",
            staleOnly: "Zastaralé",
            noData: "Bez dat",
            disabled: "Sběr vypnutý",
            disabledHint: "Zapne se v Herních serverech",
            players: "{players} / {capacity} hráčů",
            link: "Herní servery v Logi",
            shown: {
                one: "Zobrazen {shown} {from} {total} {servers}. Nejvýš 5, celý seznam je v Logi.",
                few: "Zobrazeny {shown} {from} {total} {servers}. Nejvýš 5, celý seznam je v Logi.",
                other: "Zobrazeno {shown} {from} {total} {servers}. Nejvýš 5, celý seznam je v Logi.",
            },
            serversOf: { one: "serveru", other: "serverů" },
            notAllowedTitle: "Stav serverů vidí jen správci Logi",
            notAllowedBody:
                "Správci mají v Discordu oprávnění Administrator nebo Roli správců.",
            liveScoreWhere: "Živé skóre najdeš v {channel}.",
            noConnectionsTitle: "Pro {game} klan nemá připojený žádný server",
            noConnectionsBody: "Server připojíš v Logi → Herní servery.",
            unavailableTitle: "Stav serverů se teď nedá načíst",
            unavailableBody:
                "Zkus to za minutu. Na herní servery to nemá vliv.",
            providers: {
                hll_crcon: "CRCON",
                wardogs_rcon: "RCON",
                wardogs_warcon: "Warcon",
                wardogs_public_directory: "Wardog Servers",
            },
            unnamed: "Herní server",
        },
    },
    de: {
        commands: {
            outcomeDenied: "Abgelehnt",
            outcomePending: "Weiter offen",
            outcomeRecruit: "Rekrut",
            outcomeMember: "Mitglied",
            outcomeMercenary: "Söldner",
        },
        registry: {
            descriptions: {
                help: "Befehle, die du nutzen kannst, und ein Link zur Anleitung",
                stats: "Deine Statistiken aus Hell Let Loose oder Wardogs",
                player: "Profil eines Clan-Spielers: Score und letzte Matches",
                link: "Verknüpfe deine Spielkonten: Steam, Epic, Xbox, PlayStation",
                notice: "Sag der Leitung, dass du später zu einem Event kommst",
                "server-status": "Gespeicherter Status der Clan-Spielserver",
                close_ticket:
                    "Schließt dieses Ticket und schickt dem Autor eine Zusammenfassung",
                close_application:
                    "Entscheidet über die Bewerbung in diesem Thread und schließt sie",
            },
            managerSuffix: " (für Verwalter)",
            options: {
                statsGame: {
                    name: "spiel",
                    description: "Hell Let Loose oder Wardogs",
                },
                statsMember: {
                    name: "mitglied",
                    description:
                        "Ein Servermitglied mit verknüpftem Steam (Standard: du)",
                },
                statsPlayer: {
                    name: "spieler",
                    description: "Nur Wardogs: Spieler nach Name oder Steam-ID",
                },
                statsPeriod: {
                    name: "zeitraum",
                    description:
                        "7, 30 oder 90 Tage oder alles (Standard 30 Tage)",
                },
                statsServer: {
                    name: "server",
                    description: "Nur Wardogs: einer der Clan-Server",
                },
                statsChannel: {
                    name: "kanal",
                    description: "Wohin Teilen die Karte sendet",
                },
                playerPlayer: {
                    name: "spieler",
                    description: "Ein Clan-Spieler, aus der Liste wählen",
                },
                noticeEvent: {
                    name: "event",
                    description:
                        "Ein Event, für das du angemeldet bist und das noch nicht begonnen hat",
                },
                closeTicketReason: {
                    name: "grund",
                    description: "Der Autor sieht ihn im Thread und per DM",
                },
                closeApplicationOutcome: {
                    name: "ergebnis",
                    description: "Was der Bewerber wird",
                },
                closeApplicationReason: {
                    name: "grund",
                    description: "Der Bewerber sieht ihn im Thread und per DM",
                },
                serverStatusGame: {
                    name: "spiel",
                    description: "Das Spiel, dessen Server angezeigt werden",
                },
            },
            periods: {
                "7d": "7 Tage",
                "30d": "30 Tage",
                "90d": "90 Tage",
                all: "Gesamte Historie",
            },
        },
        access: {
            disabledTitle: "{command} ist hier ausgeschaltet",
            disabledBody:
                "Ein Verwalter kann ihn in Logi → Einstellungen → Befehle einschalten.",
            notAllowedTitle: {
                clanMembers: "{command} dürfen nur Clan-Mitglieder nutzen",
                logiAdmins: "{command} dürfen nur Logi-Verwalter nutzen",
            },
            notAllowedBody: {
                clanMembers:
                    "Clan-Mitglieder haben die Clan-Rolle aus Logi. Wenn du sie haben solltest, schreib den Verwaltern.",
                logiAdmins:
                    "Verwalter haben in Discord die Berechtigung Administrator oder die Verwalterrolle.",
            },
            extraRoles: "Auch {roles} darf ihn nutzen.",
            wrongChannelTitle: "{command} funktioniert hier nicht",
            wrongChannelBody: "Nutze ihn in {channels}.",
            verifyFailedTitle: "Deine Rollen lassen sich gerade nicht prüfen",
            verifyFailedBody:
                "Discord hat nicht geantwortet. Versuch es gleich noch einmal.",
            notConnectedTitle: "Logi ist hier noch nicht eingerichtet",
            notConnectedBody:
                "Ein Serververwalter verbindet Discord im Web mit Logi. Dann siehst du hier deine Befehle.",
            aboutLogi: "Was ist Logi",
            and: " und ",
            or: " oder ",
        },
        help: {
            label: "Logi-Befehle · Clan {clan}",
            title: "Was du hier nutzen kannst",
            lines: {
                stats: "Deine Statistiken aus Hell Let Loose oder Wardogs. Nur du siehst sie, bis du sie teilst.",
                player: "Profil eines Clan-Spielers: Score und letzte Matches.",
                link: "Verknüpfe deine Spielkonten, damit Logi dich im Spiel erkennt.",
                notice: "Sag der Leitung, dass du später zu einem Event kommst.",
                "server-status": "Gespeicherter Status der Clan-Spielserver.",
                close_ticket:
                    "Schließt im Ticket-Thread das Ticket und schickt dem Autor eine Zusammenfassung.",
                close_application:
                    "Entscheidet im Bewerbungs-Thread über den Bewerber und vergibt Rollen.",
            },
            channelsAll:
                "Clan-Bewerbung, Tickets und Match-Anmeldungen sind Buttons in {recruitment}, {tickets} und {announcements}.",
            recruitmentLine:
                "Beim Clan bewirbst du dich mit dem Button in {channel}.",
            ticketsLine: "Ein Ticket öffnest du mit dem Button in {channel}.",
            signupLine:
                "Für Matches meldest du dich mit den Buttons in {channel} an.",
            staffTitle: "Für Verwalter",
            staffReason: {
                administrator:
                    "Du siehst sie, weil du in Discord die Berechtigung Administrator hast.",
                adminRole:
                    "Du siehst sie, weil du die Logi-Verwalterrolle hast.",
                support:
                    "Du siehst sie, weil du zum Support einer Ticket- oder Bewerbungskategorie gehörst.",
                role: "Du siehst sie, weil die Verwalter sie deiner Rolle erlaubt haben.",
            },
            guide: "Anleitung im Web",
            nothing: "Hier gibt es gerade keine Befehle für dich.",
        },
        player: {
            label: "{game} · Spielerprofil",
            statuses: {
                member: "Mitglied",
                reserve_member: "Reserve",
                mercenary: "Söldner",
                recruit: "Rekrut",
                pending: "Bewerber",
                active: "aktiv",
                paused: "pausiert",
            },
            score: "Clan-Score",
            matches: "Matches",
            kd: "K/D",
            averages:
                "Schnitt pro Match: {kills} Kills · {deaths} Tode · Angriff {offense} · Verteidigung {defense} · Support {support}",
            recentTitle: "Letzte Matches",
            recentRow:
                "{day} · {map} · {kills} Kills, {deaths} Tode · K/D {kd}",
            share: "Teilen",
            source: "Quelle: importierte Matches des Clans",
            sourceSince: "{count} seit {date}",
            matchCount: { one: "{count} Match", other: "{count} Matches" },
            sharedBy: "Geteilt von {user} · Stand {time}",
            sharedSource: "Importierte Matches des Clans",
            noMatches:
                "Noch keine importierten Matches, daher gibt es nichts zu zeigen oder zu teilen.",
            notFoundTitle: "Diesen Spieler finde ich im Clan nicht",
            notFoundBody:
                "Wähle den Spieler aus der Liste, die beim Tippen des Namens erscheint.",
            loadFailedTitle: "Das Profil lässt sich gerade nicht laden",
            loadFailedBody: "Versuch es gleich noch einmal.",
            sharedTitle: "In {channel} geteilt",
            viewMessage: "Nachricht anzeigen",
            shareDeniedTitle: "In {channel} kannst du gerade nicht teilen",
            shareDeniedBody:
                "Du und der Bot braucht in dem Kanal das Recht, Nachrichten zu senden und Links einzubetten.",
            shareFailedTitle: "Das Teilen ließ sich nicht bestätigen",
            shareFailedBody:
                "Schau in den Kanal, bevor du erneut teilst, das Profil kann schon dort sein.",
            avatar: "Avatar von {name}",
        },
        notice: {
            modalTitle: "Komme später · {event}",
            modalNote: "Das sieht nur die Match-Leitung.",
            reasonLabel: "Wann kommst du und warum?",
            reasonPlaceholder: "Z. B. gegen 20:30, ich habe länger Arbeit.",
            savedTitle: "Die Leitung weiß, dass du später kommst",
            savedNote:
                "Für dieses Match bekommst du keine Anwesenheits-Erinnerungen mehr. Ändern kannst du es mit einem weiteren /notice.",
            notSignedUpTitle:
                "Du bist für kein bevorstehendes Event angemeldet",
            notSignedUpBody:
                "Eine Meldung geht nur für ein Event, für das du angemeldet bist und das noch nicht begonnen hat.",
            signupWhere: "Anmelden kannst du dich in {channel}.",
            startedTitle: "{event} hat schon begonnen",
            startedBody: "Schreib der Leitung direkt im Match-Kanal.",
            multipleTitle: "Es gibt mehrere solche Events",
            multipleBody:
                "Wähle eins aus der Liste, sie zeigt auch Tag und Uhrzeit.",
            eventFallback: "Event",
        },
        serverStatus: {
            label: "Spielserver-Status · {game}",
            title: {
                one: "{count} Clan-Server",
                other: "{count} Clan-Server",
            },
            intro: "Gespeicherter Status aus der Datenerfassung, keine Live-Prüfung.",
            online: "Online",
            offline: "Offline",
            stale: "veraltet",
            staleOnly: "Veraltet",
            noData: "Keine Daten",
            disabled: "Erfassung aus",
            disabledHint: "Einschalten unter Spielserver",
            players: "{players} / {capacity} Spieler",
            link: "Spielserver in Logi",
            shown: {
                one: "{shown} von {total} {servers} angezeigt. Höchstens 5, die ganze Liste ist in Logi.",
                other: "{shown} von {total} {servers} angezeigt. Höchstens 5, die ganze Liste ist in Logi.",
            },
            serversOf: { one: "Server", other: "Servern" },
            notAllowedTitle: "Den Serverstatus sehen nur Logi-Verwalter",
            notAllowedBody:
                "Verwalter haben in Discord die Berechtigung Administrator oder die Verwalterrolle.",
            liveScoreWhere: "Den Live-Score findest du in {channel}.",
            noConnectionsTitle:
                "Für {game} hat der Clan keinen Server verbunden",
            noConnectionsBody: "Verbinde einen in Logi → Spielserver.",
            unavailableTitle: "Der Serverstatus lässt sich gerade nicht laden",
            unavailableBody:
                "Versuch es in einer Minute. Auf die Spielserver hat das keinen Einfluss.",
            providers: {
                hll_crcon: "CRCON",
                wardogs_rcon: "RCON",
                wardogs_warcon: "Warcon",
                wardogs_public_directory: "Wardog Servers",
            },
            unnamed: "Spielserver",
        },
    },
}

/** The commands copy in the clan language; unknown languages read English. */
export const getCommandMessages = clanCopy(commandsMessages)
