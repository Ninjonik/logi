export const integrationsMessages = {
    membershipIntegration: {
        title: "Integrationen für Discord-Mitgliedschaft",
        description:
            "Wähle die Discord-Rollen, die jede Integration lesen darf. Zusätzlich ist ein schreibgeschützter Schlüssel mit der Freigabe für Discord-Mitgliedschaft erforderlich. Die Website entscheidet über die Nutzung dieser Angaben.",
        enabled: "Mitgliedschaftsabfragen mit diesem Schlüssel erlauben",
        roles: "Erlaubte Rollen",
        rolesHelp:
            "Ohne Rollen werden nur Anwesenheit und Logi-Zuordnung geteilt. Änderungen werden beim Speichern wirksam.",
        empty: "Erstelle einen schreibgeschützten API-Schlüssel mit der Freigabe für Discord-Mitgliedschaft und aktualisiere die Liste.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        save: "Freigabe speichern",
        saved: "Freigabe für Mitgliedschaft gespeichert.",
        error: "Die Freigaben konnten nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        invalid:
            "Verwende gültige Discord-Rollen-IDs, höchstens 100 Rollen pro Spiel.",
    },
    websiteEventPolicies: {
        title: "Website-Befehle für Events",
        description:
            "Erlaube einer verbundenen Website, Events über ihren Dienstschlüssel zu erstellen, zu ändern oder abzusagen. Eine Richtlinie verbindet eine registrierte Single-Sign-on-Anwendung mit einem eingeschränkten API-Schlüssel und nennt je Spiel die Discord-Rollen, deren Mitglieder die Befehle nutzen dürfen.",
        application: "Single-Sign-on-Anwendung",
        applicationPlaceholder: "Anwendung wählen",
        noApplications:
            "Registriere zuerst eine Single-Sign-on-Anwendung. Die Richtlinie bindet die Befehle der Website an diese Anwendung.",
        noKeys: "Erstelle einen eingeschränkten API-Schlüssel für das Website-Backend und aktualisiere die Liste. Ältere uneingeschränkte Schlüssel können keine Befehlsrichtlinie tragen.",
        enabled: "Event-Befehle mit diesem Schlüssel erlauben",
        roles: "Erlaubte Rollen",
        rolesHelp:
            "Ein Spiel ohne Rollen bleibt schreibgeschützt. Das Speichern einer aktivierten Richtlinie gewährt Schreibzugriff für die Spiele mit Rollen; das Deaktivieren entzieht ihn.",
        granted: "Schreibzugriff gewährt für: {games}",
        notGranted: "Kein Schreibzugriff für Event-Befehle gewährt.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        save: "Richtlinie speichern",
        saved: "Richtlinie für Event-Befehle gespeichert.",
        error: "Die Richtlinie konnte nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        denied: "Die Richtlinie wurde abgelehnt. Verwende einen gültigen eingeschränkten Schlüssel dieses Arbeitsbereichs und eine darin registrierte Anwendung.",
        invalid:
            "Verwende gültige Discord-Rollen-IDs, höchstens 64 pro Spiel, für in diesem Arbeitsbereich aktivierte Spiele.",
    },
    apiKeys: {
        revokeTitle: "Schlüssel {name} widerrufen?",
        groupsLegend: "Bereiche",
        groups: {
            matches: {
                label: "Matches",
                short: "Matches",
                help: "Events, Matches, ihre Zusammenfassungen und Strat-Maps.",
            },
            rosters: {
                label: "Aufstellungen",
                short: "Aufstellungen",
                help: "Aufstellungen, Squads und Zuordnungen der Spieler.",
            },
            results: {
                label: "Ergebnisse",
                short: "Ergebnisse",
                help: "Bestätigte Ergebnisse, Spielerstatistiken und Spielverlauf.",
            },
            members: {
                label: "Mitglieder",
                short: "Mitglieder",
                help: "Clan-Mitglieder und ihr Status. Für das Lesen der Mitgliedschaft gelten zusätzlich eigene Regeln.",
            },
            servers: {
                label: "Spielserver",
                short: "Server",
                help: "Live-Zustand der Server, Warcon, HLL und Zustand der Verbindung.",
            },
            league: {
                label: "Liga und Teams",
                short: "Liga",
                help: "Matches der Wardogs League und der Teamkatalog.",
            },
        },
        partialGroup: "{group} (teilweise)",
        readOnlyShort: "nur lesen",
        everyGame: "alle Spiele",
        createdOn: "erstellt {date}",
        revokeDescription:
            "Alles, was diesen Schlüssel nutzt, etwa deine Website, bekommt sofort keine Daten mehr von Logi. Das lässt sich nicht rückgängig machen; für neuen Zugriff erstellst du einen neuen Schlüssel.",
        revokeConfirm: "Schlüssel widerrufen",
        emptyTitle: "Noch kein API-Schlüssel",
        emptyDescription:
            "Erstelle einen Schlüssel für den Server deiner Website. Wähle nur die Daten und Spiele, die sie braucht.",
        description:
            "Erstelle einen Integrationsschlüssel und bewahre ihn auf deinem Server auf. Wähle nur die benötigten Daten und Spiele.",
        name: "Schlüsselname",
        namePlaceholder: "Name der Website, z. B. Hauptseite",
        access: "Berechtigung",
        readOnly: "Nur lesen",
        fullAccess: "Vollzugriff (bisheriger Modus)",
        readOnlyHelp:
            "Kann nur ausgewählte Ressourcen und Spiele lesen. Kann keine Daten erstellen, ändern oder löschen.",
        fullAccessHelp:
            "Kann alle Clan-Daten für alle Spiele lesen und ändern. Nur für Integrationen verwenden, die Schreibzugriff benötigen.",
        resources: "Ressourcen",
        games: "Spiele",
        selectScope: "Wähle mindestens eine Ressource und ein Spiel.",
        privateData:
            "Vollständige Datensätze können private Betriebsdaten enthalten. Prüfe die Daten vor der Veröffentlichung.",
        createReadOnly: "Leseschlüssel erstellen",
        createFullAccess: "Schlüssel mit Vollzugriff erstellen",
        copyNow:
            "Kopiere den Schlüssel jetzt. Er kann nicht erneut angezeigt werden. Bewahre ihn auf deinem Server auf.",
        copy: "API-Schlüssel kopieren",
        copied: "API-Schlüssel kopiert.",
        copyFailed:
            "Kopieren fehlgeschlagen. Kopiere den Schlüssel manuell, bevor du ihn ausblendest.",
        hide: "Schlüssel ausblenden",
        createFailed:
            "Der Schlüssel konnte nicht erstellt werden. Prüfe deine Auswahl und versuche es erneut.",
        invalidKey:
            "Der Server hat einen ungültigen API-Schlüssel zurückgegeben.",
        revoke: "Widerrufen",
        revokeFailed:
            "Der Schlüssel konnte nicht widerrufen werden. Versuche es erneut.",
        revoked: "widerrufen",
        created: "erstellt",
        existingKeys: "Vorhandene Schlüssel",
        rotateHelp:
            "Erstelle zum Ändern der Berechtigungen einen Ersatzschlüssel, stelle die Integration um und widerrufe dann den alten Schlüssel.",
        allGames: "alle Spiele; Lesen und Schreiben",
        loading: "Schlüssel werden geladen…",
        loadFailed:
            "Schlüssel konnten nicht aktualisiert werden. Angezeigte Berechtigungen sind möglicherweise veraltet.",
        retry: "Erneut versuchen",
        empty: "Es wurden noch keine API-Schlüssel erstellt.",
        invalidPolicy:
            "Unbekannte Einschränkungen; der Backend-Zugriff wird verweigert.",
        resourceLabels: {
            "server-game-history":
                "Gespeicherte Serverspiele (Spielernamen und Steam-IDs)",
            "league-matches": "Öffentliche Wardogs League Spiele",
            "league-fixtures": "Verfolgte Wardogs League Spiele",
            "hll-live":
                "HLL Live-Scoreboard (mit Spielernamen und Plattform-IDs)",
            "warcon-data": "Warcon-Spieldaten (mit Spielernamen und Steam-IDs)",
            "member-summaries": "Mitgliederverzeichnis (nur lesen)",
            "roster-summaries":
                "Veröffentlichte Aufstellungen und Teilnahme (nur lesen)",
            "player-stat-summaries":
                "Verifizierte Spielerdaten aus erfassten Runden",
            "membership-summaries":
                "Discord-Mitgliedschaft (separate Freigabe erforderlich)",
            "server-snapshots": "Spielserver-Status",
            "integration-health": "Erfassungsstatus",
            "event-summaries": "Ereignisübersichten",
            "match-summaries": "Match-Übersichten",
            "result-summaries": "Übersichten geprüfter Ergebnisse",
            events: "Ereignisse (vollständige Datensätze)",
            matches: "Matches (Rohstatistiken)",
            groups: "Gruppen",
            rosters: "Aufstellungen",
            assignments: "Mitgliedszuordnungen",
            stratmaps: "Taktikkarten",
            teams: "Teamverzeichnis (aktive Teams, Namen und Logos)",
        },
    },
    verifiedPlatformLinks: {
        title: "Verifiziertes Steam-Konto",
        description:
            "Bestätige den Zugriff auf dein Steam-Konto durch eine Anmeldung bei Steam. Manuell eingetragene Profil-IDs sind nicht verifiziert.",
        loading: "Laden…",
        refresh: "Aktualisieren",
        error: "Die Steam-Verknüpfung ist nicht verfügbar. Aktualisiere die Übersicht oder versuche es später erneut.",
        callbackFailed:
            "Die Steam-Verifizierung wurde nicht abgeschlossen. Starte einen neuen Versuch.",
        verified: "Über Steam verifiziert",
        empty: "Kein verifiziertes Steam-Konto",
        verifiedAt: "Verifiziert",
        revokedAt: "Getrennt",
        link: "Mit Steam verifizieren",
        unlink: "Steam trennen",
        history: "Letzte Verknüpfungsänderungen",
        effect: "Das Trennen beendet zukünftige Spielerzuordnungen. Dieser Nachweis vergibt keine Discord-Rollen, bestätigt keinen Spielbesitz und veröffentlicht dein Profil nicht auf der Website.",
    },
    integrationSettings: {
        cancel: "Abbrechen",
        web: {
            stepKey: "API-Schlüssel für die Website",
            stepLogin: "Anmelden mit Logi",
            stepMembers: "Was die Website für Mitglieder tun darf",
            newKey: "Neuer Schlüssel",
            closeForm: "Schließen",
            keyShownOnce:
                "Ein Schlüssel wird nur einmal angezeigt, direkt nach dem Erstellen. Bewahre ihn auf dem Server deiner Website auf.",
            loginPage: "Anmeldeseite des Clans",
            ssoApps: "Anwendungen für Single Sign-on",
            addApplication: "Anwendung hinzufügen",
            membersRowHelp:
                "Über den Schlüssel {key}. Ein Mitglied braucht eine der Rollen.",
            saveRoles: "Rollen speichern",
            membersTitle: "Herausfinden, wer Mitglied ist",
            membersHelp:
                "Über einen Nur-Lese-Schlüssel mit Zugriff auf die Discord-Mitgliedschaft. Die Website sieht nur Mitglieder mit einer der gewählten Rollen.",
            eventsTitle: "Events anlegen und bearbeiten",
            eventsHelp:
                "Über eine Single-Sign-on-Anwendung und ihren Schlüssel. Nur Personen mit einer der gewählten Rollen.",
            footer: "Schlüssel und Anwendungen werden sofort gespeichert. Rollen speicherst du mit dem Button des jeweiligen Schlüssels.",
            rolesPlaceholder: "Rollen wählen",
            rolesUnavailable:
                "Die Discord-Rollen konnten nicht geladen werden. Lade die Seite neu.",
        },
        sso: {
            emptyTitle: "Noch keine Anmelde-Anwendung",
            emptyDescription:
                "Füge deine Website als Anwendung hinzu, damit sich Mitglieder dort über Logi mit ihrem Discord-Konto anmelden können.",
            redirects: "Rücksprungadressen nach der Anmeldung: {count}",
            clientId: "Client-ID",
            edit: "Bearbeiten",
            save: "Änderungen speichern",
            saved: "Anwendung gespeichert.",
            removeTitle: "{name} entfernen?",
            removeDescription:
                "Mitglieder können sich auf {website} nicht mehr mit Logi anmelden. Client-ID und Secret der Anwendung werden ungültig, und Event-Befehle der Website über diese Anwendung funktionieren nicht mehr. Das lässt sich nicht rückgängig machen.",
            removeConfirm: "Anwendung entfernen",
        },
        webhooks: {
            emptyTitle: "Noch keine Webhooks",
            emptyDescription:
                "Gib eine HTTPS-Adresse an, und Logi sendet Änderungen an Events, Aufstellungen, Artikeln und Einstellungen dorthin, signiert mit einem Secret.",
            deleteTitle: "Diesen Webhook löschen?",
            deleteDescription:
                "Logi sendet sofort keine Änderungen mehr an {url}, und das Signatur-Secret wird ungültig. Das lässt sich nicht rückgängig machen.",
            deleteConfirm: "Webhook löschen",
            loadFailed:
                "Webhooks konnten nicht geladen werden. Lade neu und versuche es erneut.",
            createFailed:
                "Der Webhook konnte nicht erstellt werden. Prüfe die Adresse und versuche es erneut.",
            actionFailed:
                "Die Änderung wurde nicht gespeichert. Versuche es erneut.",
            rotateFailed: "Das Signatur-Secret konnte nicht erneuert werden.",
            historyFailed: "Der Zustellverlauf konnte nicht geladen werden.",
        },
        calendar: {
            emptyTitle: "Noch kein Kalenderlink",
            emptyDescription:
                "Erstelle einen privaten Link und füge ihn in Google Kalender oder einer anderen Kalender-App hinzu. Wer den Link hat, sieht die Events des Clans.",
            rotateTitle: "Neuen Kalenderlink erstellen?",
            rotateDescription:
                "Der aktuelle Link funktioniert dann nicht mehr. Alle, die ihn abonniert haben, müssen den neuen Link hinzufügen.",
            rotateConfirm: "Neuen Link erstellen",
        },
        league: {
            title: "Wardogs League verfolgen",
            cadence:
                "Neue Spiele werden alle {scan} Minuten gesucht, verfolgte Details alle {refresh} Minuten aktualisiert. Website und Discord nutzen denselben Eintrag.",
            enable: "Wardogs League und Spiel-Links verfolgen",
            teamCodes: "Kürzel der verfolgten Teams (durch Komma getrennt)",
            scanEvery: "Neue Spiele suchen alle",
            refreshEvery: "Verfolgte Details aktualisieren alle",
            minutes: "{minutes} Minuten",
            scanNote:
                "Der gemeinsame Index-Scan läuft im kürzesten Intervall, das ein aktivierter Clan wünscht; dieser Clan übernimmt einen neuen Index erst nach seinem eigenen Intervall. Begrenzungen der Quelle können die Intervalle verlängern.",
            intakeChannel: "Kanal, in dem Leute Links posten",
            intakePlaceholder: "Kanal für Links wählen",
            panelsNote:
                "Tabelle und nächste Spiele der ganzen Liga gehen als Panel WD League unter Einstellungen → Panels in Discord in den Discord. Karten für einzelne Spiele werden nicht mehr gepostet. Wenn ihr das Verfolgen ausschaltet, löscht der Bot die Nachrichten des Panels.",
            intakeNote:
                "Nachrichten von Bots werden ignoriert. Damit Nachrichten von Leuten automatisch gelesen werden, muss der Betreiber des Bots Message Content aktivieren. Scan und manuelles Hinzufügen funktionieren auch ohne.",
            save: "Einstellungen speichern",
            saved: "Gespeichert.",
            saveFailed:
                "Speichern fehlgeschlagen. Prüfe Berechtigungen, Link und Kanaleinstellungen.",
            loadFailed:
                "Die Einstellungen zum Verfolgen konnten nicht geladen werden.",
            lastScan: "Letzter erfolgreicher Scan",
            nextScan: "Nächster Scan",
            incomplete:
                "Die Liste ist unvollständig; füge ein fehlendes Spiel manuell hinzu.",
            queueFull:
                "Die automatische Suche ist voll. Bestehende Spiele werden weiter aktualisiert; die restlichen Plätze bleiben für manuelles Hinzufügen frei.",
            sourceError:
                "Die Quelle ist nicht erreichbar. Die letzten gültigen Daten bleiben erhalten.",
            addByUrl: "Spiel über seinen League-Link hinzufügen",
            preview: "Vorschau laden",
            previewFailed: "Keine Vorschau verfügbar. Prüfe den Link.",
            track: "Dieses Spiel verfolgen",
            createNative: "Eigenes Spiel in Logi anlegen",
            states: {
                pending: "Wartet aufs Laden",
                tracked: "Wird verfolgt",
                paused: "Pausiert",
                ignored: "Ignoriert",
                archived: "Archiviert",
                unmatched: "Außerhalb des Filters",
            },
            refreshOnce: "Erneut laden",
            resume: "Fortsetzen",
            pause: "Pausieren",
            ignore: "Ignorieren",
            staleData: "Ältere Daten, zuletzt geladen {time}",
            linkedEvent: "Logi-Spiel zu dieser Begegnung",
            notLinked: "Nicht verknüpft",
            unknownEvent: "Verknüpftes Spiel, das nicht mehr gelistet ist",
            noEvents:
                "In Logi gibt es noch kein Wardogs-Spiel. Lege eins an und verknüpfe es dann hier.",
            saveLink: "Verknüpfung speichern",
            emptyTitle: "Noch kein verfolgtes Spiel",
            emptyDescription:
                "Spiele der verfolgten Teams erscheinen hier nach dem nächsten Scan. Du kannst oben auch eins über seinen Link hinzufügen.",
        },
    },
} as const
