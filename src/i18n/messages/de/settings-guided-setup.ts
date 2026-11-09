export const settingsHub_guidedSetup = {
    metaTitle: "Einrichtungsassistent",
    workspace: "Einrichtung des Bereichs",
    exit: "Assistent beenden",
    progressLabel: "Fortschritt des Assistenten",
    stepsLabel: "Schritte des Assistenten",
    reopenHint: "Einen erledigten Schritt kannst du jederzeit wieder öffnen.",
    required: "Pflicht",
    optional: "Optional",
    optionalSuffix: "optional",
    stepOf: "Schritt {number} von {total}",
    doneMark: "Erledigt",
    back: "Zurück",
    skip: "Überspringen",
    continue: "Weiter",
    finish: "Abschließen",
    saving: "Wird gespeichert…",
    saveError: "Speichern fehlgeschlagen. Versuch es noch einmal.",
    discordUnavailable:
        "Logi kann die Kanäle und Rollen gerade nicht von Discord lesen. Prüf den Bot in Schritt 1.",
    steps: {
        bot: {
            heading: "Lade den Logi-Bot auf Discord ein",
            description:
                "Der Bot kündigt Events an, legt Squad-Kanäle an und achtet auf Rollen. Er muss auf dem Server deines Clans sein.",
            ready: "Der Bot ist auf dem Server und sieht Kanäle und Rollen.",
            checking:
                "Der Bot ist auf dem Server. Es wird geprüft, was er sieht…",
            blind: "Der Bot ist auf dem Server, sieht aber keine Kanäle und Rollen. Gib ihm auf Discord die Berechtigungen „Kanäle ansehen“ und „Rollen verwalten“.",
            missing: "Der Bot ist noch nicht auf dem Server deines Clans.",
            invite: "Bot einladen",
            checkAgain: "Erneut prüfen",
        },
        games: {
            heading: "Welche Spiele spielt dein Clan?",
            description: "Wähle die Spiele, die dein Clan spielt.",
            groupLabel: "Spiele des Clans",
            required: "Wähle mindestens ein Spiel.",
        },
        profile: {
            heading: "Stell den Clan vor",
            description:
                "Name und Logo erscheinen auf der Logi-Website und in den Nachrichten des Bots.",
            name: "Clan-Name",
            namePlaceholder: "Clan-Name",
            logo: "Logo",
            logoAlt: "Clan-Logo",
            upload: "Logo hochladen",
            uploading: "Wird hochgeladen…",
            formats: "PNG oder JPG",
            about: "Beschreibung",
            aboutPlaceholder: "Ein paar Sätze über den Clan",
            nameRequired: "Gib den Clan-Namen ein.",
            logoRequired: "Lade das Clan-Logo hoch.",
        },
        channels: {
            heading: "Wo soll der Bot schreiben?",
            description:
                "Wähle Kanäle auf deinem Discord. Für einzelne Spiele kannst du sie später anders einstellen.",
            announcements: "Ankündigungen",
            announcementsHelp: "Neue Events und Kaderänderungen.",
            eventResults: "Event-Ergebnisse",
            eventResultsHelp:
                "Bestätigte Spielstände und Statistiklinks. Optional; für alle Spiele.",
            eventInfo: "Event-Informationen",
            eventInfoHelp: "Event-Details und Anmeldungen.",
            errors: "Bot-Fehler",
            errorsHelp: "Nur für Admins, wenn etwas schiefgeht.",
            choose: "Kanal wählen",
            none: "Keiner",
        },
        roles: {
            heading: "Wer gehört zum Clan und wer verwaltet ihn?",
            description:
                "An den Discord-Rollen erkennt Logi Clan-Mitglieder und Admins.",
            clanRole: "Clan-Rolle",
            clanRoleHelp:
                "Wer diese Rolle hat, ist Clan-Mitglied. Erstelle die Rolle in den Discord-Servereinstellungen → Rollen und lade Logi neu.",
            adminRole: "Rolle der Logi-Admins",
            adminRoleHelp:
                "Personen mit dieser Rolle sehen die Einstellungen und können sie ändern.",
            choose: "Rolle wählen",
            none: "Keine Rolle",
            noResults: "Keine Rolle gefunden.",
        },
        gameServers: {
            heading: "Verbinde einen Spielserver",
            description:
                "Logi kann Ergebnisse und Spielerstatistiken von deinem CRCON- oder Warcon-Server sammeln. Der API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
            empty: "Noch kein Server. Das Verbinden dauert etwa eine Minute: Adresse, Server-ID und API-Schlüssel.",
            connect: "Server verbinden",
        },
    },
    finished: {
        title: "Einrichtungsassistent beendet.",
        description:
            "Prüfe die Checkliste unter Einstellungen. Offene Pflichtschritte stehen unten.",
        openSettings: "Einstellungen öffnen",
        again: "Noch einmal durchgehen",
    },
} as const
