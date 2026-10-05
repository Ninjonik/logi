import { clanCopy, type ClanLanguage } from "./core"

/** Slash command descriptions and replies, including player stats and /server-status. */
export type CommandMessages = {
    commands: {
        closeTicketDescription: string
        closeApplicationDescription: string
        linkDescription: string
        noticeDescription: string
        noticeEventOptionDescription: string
        reasonOptionDescription: string
        noticeReasonLabel: string
        noticeModalTitle: string
        noticeNoMatch: string
        noticeMultipleMatches: string
        noticeSaved: string
        linkDmSent: string
        linkDmFailed: string
        outcomeOptionDescription: string
        outcomeDenied: string
        outcomePending: string
        outcomeRecruit: string
        outcomeMember: string
        outcomeMercenary: string
        playerDescription: string
        playerOptionDescription: string
        playerServerOnly: string
        playerNotFound: string
    }
    playerStats: {
        clanScore: string
        matches: string
        performance: string
        kills: string
        deaths: string
        offense: string
        defense: string
        support: string
        recentMatches: string
        noMatchHistory: string
        profileImage: string
    }
    serverStatus: {
        description: string
        gameOption: string
        title: string
        intro: string
        noConnections: string
        forbidden: string
        invalidGame: string
        unavailable: string
        server: string
        state: string
        map: string
        players: string
        observed: string
        provider: string
        fresh: string
        stale: string
        unknown: string
        online: string
        offline: string
        noData: string
        disabled: string
        shown: string
    }
}

const commandsMessages: Record<ClanLanguage, CommandMessages> = {
    en: {
        commands: {
            closeTicketDescription: "Close the current ticket thread.",
            closeApplicationDescription:
                "Close the current membership application thread.",
            linkDescription: "Open a one-time page to link your platform ID.",
            noticeDescription: "Submit a late notice for an upcoming event.",
            noticeEventOptionDescription:
                "Choose one of your upcoming signed-up events.",
            reasonOptionDescription: "Reason shown to the user in DMs.",
            noticeReasonLabel: "Why will you be late?",
            noticeModalTitle: "Late notice",
            noticeNoMatch:
                "I couldn't find one of your signed-up events that has not concluded and has not started yet.",
            noticeMultipleMatches:
                "That matches multiple eligible events. Pick the event from autocomplete.",
            noticeSaved: "Your late notice has been saved.",
            linkDmSent:
                "I sent you a DM with a direct link to submit your platform ID. Open it here: {link}. Submit it there and I will confirm when it is saved.",
            linkDmFailed:
                "I could not DM you. Use this one-time link to submit your platform ID: {link}",
            outcomeOptionDescription:
                "What the applicant should become after closing.",
            outcomeDenied: "Denied",
            outcomePending: "Pending",
            outcomeRecruit: "Recruit",
            outcomeMember: "Member",
            outcomeMercenary: "Mercenary",
            playerDescription: "Search clan players and view their stats.",
            playerOptionDescription: "Pick a player from this clan.",
            playerServerOnly: "This command can only be used in a server.",
            playerNotFound: "Player not found in this clan.",
        },
        playerStats: {
            clanScore: "Clan score",
            matches: "Matches",
            performance: "Performance",
            kills: "Kills",
            deaths: "Deaths",
            offense: "Offense",
            defense: "Defense",
            support: "Support",
            recentMatches: "Recent matches",
            noMatchHistory: "No imported match history.",
            profileImage: "profile image",
        },
        serverStatus: {
            description:
                "Show stored HLL or Wardogs server status (server managers).",
            gameOption: "Game whose configured servers to show.",
            title: "Game server status",
            intro: "Stored observations, not a live server check. Older player/map values remain historical.",
            noConnections:
                "No stored connection for this game. Configure a game data source in Logi settings.",
            forbidden:
                "Use this command in a server where you have Manage Server permission.",
            invalidGame: "Choose Hell Let Loose or Wardogs.",
            unavailable:
                "Stored server status is currently unavailable. Try again later.",
            server: "Game server",
            state: "State",
            map: "Map",
            players: "Players",
            observed: "Observed",
            provider: "Source",
            fresh: "Fresh",
            stale: "Stale",
            unknown: "Unknown",
            online: "Online",
            offline: "Offline",
            noData: "Unavailable",
            disabled: "Collection disabled",
            shown: "Showing {shown} of {total} stored connections. Full list in Logi settings.",
        },
    },
    cs: {
        commands: {
            closeTicketDescription: "Uzavře aktuální ticket vlákno.",
            closeApplicationDescription:
                "Uzavře aktuální vlákno členské přihlášky.",
            linkDescription:
                "Otevře jednorázovou stránku pro propojení vašeho platform ID.",
            noticeDescription:
                "Odešle notice o pozdním příchodu na nadcházející akci.",
            noticeEventOptionDescription:
                "Vyberte jednu ze svých nadcházejících přihlášených akcí.",
            reasonOptionDescription: "Důvod zobrazený uživateli v DM.",
            noticeReasonLabel: "Proč přijdete pozdě?",
            noticeModalTitle: "Late notice",
            noticeNoMatch:
                "Nepodařilo se najít žádnou vaši přihlášenou akci, která ještě neskončila a ještě nezačala.",
            noticeMultipleMatches:
                "Dotaz odpovídá více vhodným akcím. Vyberte akci z autocomplete nabídky.",
            noticeSaved: "Vaše notice byla uložena.",
            linkDmSent:
                "Poslal jsem vám DM s přímým odkazem pro zadání vašeho platform ID. Otevřete ho tady: {link}. Vyplňte ho tam a já potvrdím, až bude uložené.",
            linkDmFailed:
                "Nepodařilo se mi vám poslat DM. Použijte tento jednorázový odkaz pro zadání vašeho platform ID: {link}",
            outcomeOptionDescription: "Čím se má žadatel po uzavření stát.",
            outcomeDenied: "Zamítnuto",
            outcomePending: "Čekající",
            outcomeRecruit: "Rekrut",
            outcomeMember: "Člen",
            outcomeMercenary: "Žoldák",
            playerDescription:
                "Vyhledejte hráče klanu a zobrazte jeho statistiky.",
            playerOptionDescription: "Vyberte hráče z tohoto klanu.",
            playerServerOnly: "Tento příkaz lze použít pouze na serveru.",
            playerNotFound: "Hráč nebyl v tomto klanu nalezen.",
        },
        playerStats: {
            clanScore: "Skóre klanu",
            matches: "Zápasy",
            performance: "Výkon",
            kills: "Zabití",
            deaths: "Úmrtí",
            offense: "Útok",
            defense: "Obrana",
            support: "Podpora",
            recentMatches: "Poslední zápasy",
            noMatchHistory: "Žádná importovaná historie zápasů.",
            profileImage: "profilový obrázek",
        },
        serverStatus: {
            description:
                "Zobrazí uložený stav HLL nebo Wardogs serverů (pro správce).",
            gameOption: "Hra, jejíž nakonfigurované servery chceš zobrazit.",
            title: "Stav herních serverů",
            intro: "Uložená pozorování, nikoli živá kontrola serveru. Starší počty hráčů a mapy jsou historické.",
            noConnections:
                "Žádný uložený zdroj pro tuto hru. Přidej zdroj herních dat v nastavení Logiho.",
            forbidden:
                "Příkaz použij na serveru, kde máš oprávnění Spravovat server.",
            invalidGame: "Vyber Hell Let Loose nebo Wardogs.",
            unavailable:
                "Uložený stav serverů je nyní nedostupný. Zkus to později.",
            server: "Herní server",
            state: "Stav",
            map: "Mapa",
            players: "Hráči",
            observed: "Pozorováno",
            provider: "Zdroj",
            fresh: "Aktuální",
            stale: "Zastaralé",
            unknown: "Neznámý",
            online: "Online",
            offline: "Offline",
            noData: "Nedostupné",
            disabled: "Sběr vypnutý",
            shown: "Zobrazeno {shown} z {total} uložených zdrojů. Celý seznam je v nastavení Logiho.",
        },
    },
    de: {
        commands: {
            closeTicketDescription: "Schließt den aktuellen Ticket-Thread.",
            closeApplicationDescription:
                "Schließt den aktuellen Bewerbungs-Thread.",
            linkDescription:
                "Öffnet eine einmalige Seite zur Verknüpfung Ihrer Platform ID.",
            noticeDescription:
                "Reicht eine Verspätungsmeldung für ein kommendes Event ein.",
            noticeEventOptionDescription:
                "Wählen Sie eines Ihrer kommenden angemeldeten Events.",
            reasonOptionDescription:
                "Grund, der dem Nutzer in DMs angezeigt wird.",
            noticeReasonLabel: "Warum werden Sie sich verspäten?",
            noticeModalTitle: "Verspätungsmeldung",
            noticeNoMatch:
                "Ich konnte keines Ihrer angemeldeten Events finden, das noch nicht beendet ist und noch nicht begonnen hat.",
            noticeMultipleMatches:
                "Das trifft auf mehrere passende Events zu. Wählen Sie das Event aus der Autovervollständigung.",
            noticeSaved: "Ihre Verspätungsmeldung wurde gespeichert.",
            linkDmSent:
                "Ich habe Ihnen eine DM mit einem direkten Link zur Eingabe Ihrer Platform ID gesendet. Öffnen Sie ihn hier: {link}. Reichen Sie sie dort ein, und ich bestätige, sobald sie gespeichert ist.",
            linkDmFailed:
                "Ich konnte Ihnen keine DM senden. Nutzen Sie diesen einmaligen Link zur Eingabe Ihrer Platform ID: {link}",
            outcomeOptionDescription:
                "Was der Bewerber nach dem Schließen werden soll.",
            outcomeDenied: "Abgelehnt",
            outcomePending: "Ausstehend",
            outcomeRecruit: "Recruit",
            outcomeMember: "Member",
            outcomeMercenary: "Mercenary",
            playerDescription: "Clan-Spieler suchen und deren Stats ansehen.",
            playerOptionDescription:
                "Wählen Sie einen Spieler aus diesem Clan.",
            playerServerOnly:
                "Dieser Befehl kann nur auf einem Server verwendet werden.",
            playerNotFound: "Spieler in diesem Clan nicht gefunden.",
        },
        playerStats: {
            clanScore: "Clan-Score",
            matches: "Matches",
            performance: "Leistung",
            kills: "Kills",
            deaths: "Tode",
            offense: "Angriff",
            defense: "Verteidigung",
            support: "Unterstützung",
            recentMatches: "Letzte Matches",
            noMatchHistory: "Keine importierte Match-Historie.",
            profileImage: "Profilbild",
        },
        serverStatus: {
            description:
                "Zeigt gespeicherten HLL- oder Wardogs-Serverstatus (für Serververwalter).",
            gameOption:
                "Spiel, dessen konfigurierte Server angezeigt werden sollen.",
            title: "Spielserverstatus",
            intro: "Gespeicherte Beobachtungen, keine Live-Prüfung. Ältere Spielerzahlen und Karten sind historisch.",
            noConnections:
                "Keine gespeicherte Verbindung für dieses Spiel. Konfiguriere eine Datenquelle in den Logi-Einstellungen.",
            forbidden:
                "Nutze diesen Befehl auf einem Server mit der Berechtigung Server verwalten.",
            invalidGame: "Wähle Hell Let Loose oder Wardogs.",
            unavailable:
                "Der gespeicherte Serverstatus ist derzeit nicht verfügbar. Versuche es später erneut.",
            server: "Spielserver",
            state: "Status",
            map: "Karte",
            players: "Spieler",
            observed: "Beobachtet",
            provider: "Quelle",
            fresh: "Aktuell",
            stale: "Veraltet",
            unknown: "Unbekannt",
            online: "Online",
            offline: "Offline",
            noData: "Nicht verfügbar",
            disabled: "Erfassung deaktiviert",
            shown: "{shown} von {total} gespeicherten Verbindungen. Vollständige Liste in den Logi-Einstellungen.",
        },
    },
}

/** The commands copy in the clan language; unknown languages read English. */
export const getCommandMessages = clanCopy(commandsMessages)
