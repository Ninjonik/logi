export const gameDataMessages = {
    wardogsMatchDetails: {
        ourTeam: "Dein Team",
        players: "Spieler",
        scoreTimeline: "Punktestand im Spielverlauf",
        noTimeline:
            "Für dieses Spiel wurde kein Punkteverlauf erfasst. Spielerstatistiken sind unten verfügbar.",
        factionCombat: "Kills und Tode nach Fraktion",
        factionMoney: "Geld nach Fraktion",
        killActivity: "Kill-Aktivität",
        killFeed: "Kill-Feed",
        killCauses: "Kills nach Ursache",
        noFeed: "Warcon hat für dieses Match keinen Kampf-Feed bereitgestellt.",
        time: "Zeit",
        killer: "Killer",
        victim: "Opfer",
        cause: "Ursache",
        distance: "Distanz",
        headshot: "Kopftreffer",
        minutes: "Minuten",
        search: "Spieler suchen",
        allFactions: "Alle Fraktionen",
        noPlayers: "Keine Spieler entsprechen diesen Filtern.",
        missingTitle: "Für dieses Match fehlt das Ergebnis",
        missingBody:
            "Wähle ein erfasstes Serverspiel und prüfe die Punkte vor der Bestätigung.",
        suggestion: "Könnte das euer Match sein?",
        openReport: "Matchdetails anzeigen",
        reviewResult: "Ergebnis prüfen",
        otherSource: "Nicht dieses Spiel? Wähle eine andere Quelle.",
    },
    gameHistory: {
        title: "Warcon-Spielhistorie",
        description:
            "Abgeschlossene Serverspiele in Logi. Fraktionen sind Spielseiten, keine Clans.",
        load: "Historie laden / aktualisieren",
        retentionTitle: "Aufbewahrung der Historie",
        retentionDescription:
            "Lege fest, wie lange aufbewahrte Serverspiele in diesem Arbeitsbereich bleiben. Spiele, die vor dem Zeitfenster endeten, werden in einem nächtlichen Lauf endgültig gelöscht; die Historienrevision rückt vor, damit Websites ihre Summen neu aufbauen.",
        retentionWindow: "Aufbewahrte Spiele behalten für",
        retentionIndefinite: "Unbegrenzt (Standard)",
        retentionDays: "{days} Tage",
        retentionSave: "Aufbewahrung speichern",
        retentionSaving: "Wird gespeichert…",
        retentionSaved:
            "Aufbewahrung gespeichert. Abgelaufene Spiele werden im Hintergrund entfernt.",
        retentionError:
            "Das Aufbewahrungsfenster konnte nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        loading: "Vollständigen Zeitraum laden…",
        error: "Historie unvollständig. Erneut versuchen oder kürzeren Zeitraum wählen. Keine Teilrangliste wird angezeigt.",
        period: "Zeitraum",
        all: "Alle gespeicherten Spiele",
        week: "7 Tage",
        month: "30 Tage",
        quarter: "90 Tage",
        map: "Karte (exakter Name, optional)",
        source: "Server",
        allSources: "Alle gespeicherten Server",
        minimum: "Mindestspielzeit in Minuten",
        games: "Spiele",
        decided: "Mit Gewinner",
        draw: "Unentschieden",
        no_result: "Ohne Ergebnis",
        unknown: "Unbekannt",
        feed: "Spiele mit Combat-Feed",
        faction: "Fraktion",
        factions: "Fraktionssiege",
        share: "Anteil entschiedener Spiele",
        players: "Spielerrangliste",
        coverage: "Abdeckung",
        lastCollected: "Letzter Spielimport in diesem Workspace",
        empty: "Keine abgeschlossenen Spiele in diesem Zeitraum. Historienerfassung für eine Warcon-Quelle oben aktivieren.",
        player: "Spieler",
        matches: "Spiele",
        wins: "Siege",
        losses: "Niederlagen",
        kills: "Kills",
        deaths: "Tode",
        cash: "Geld",
        cashHelp: "Im Spiel gewonnenes oder verlorenes Geld.",
        winRate: "Siegquote",
        kd: "K/D",
        sort: "Sortieren nach",
        history: "Gespeicherte Spiele",
        previous: "Zurück",
        next: "Weiter",
        details: "Spielerdetails",
        ended: "Beendet",
        unavailable: "Unbekannt",
        ratioHelp:
            "K/D erfordert vollständige Kills/Tode und mindestens einen Tod. Unbekannte Ergebnisse zählen nicht zur Siegquote. Summen enthalten nur bekannte Werte; x/y zeigt die Abdeckung.",
        retentionHelp:
            "Nur erfolgreich importierte abgeschlossene Spiele. Fehlende Anbieterhistorie und laufende Spiele sind ausgeschlossen. Die Erfassungszeit bestätigt keinen vollständigen Anbieterimport.",
    },
    gameData: {
        servers: {
            emptyTitle: "Noch kein Spielserver verbunden",
            emptyDescription:
                "Verbinde einen CRCON- oder Warcon-Server, damit Logi Ergebnisse und Statistiken sammelt. Der API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
            closeForm: "Schließen",
            card: {
                status: {
                    collecting: "Sammelt Daten",
                    stopped: "Durch Fehler pausiert",
                    off: "Sammelt nicht",
                    none: "Kein Sammeln",
                },
                key: {
                    set: "gespeichert",
                    missing: "fehlt",
                    not_required: "nicht nötig",
                    environment: "vom Logi-Betreiber gesetzt",
                    needs_operator: "erneut eingeben",
                },
                unverified: "nicht geprüft",
                changed: "geändert {date}",
                testOk: "in Ordnung",
                testFailed: "fehlgeschlagen",
                lastGame: "Letztes Spiel",
                noGame: "noch keins",
                serverNumber: "Server {id}",
                testKey: "Schlüssel testen",
                live: "Live-Punktestand",
                liveHide: "Live-Punktestand ausblenden",
                fixUnauthorized: {
                    crcon: "Der Server hat den Schlüssel abgelehnt. Erstelle in CRCON einen neuen Schlüssel, der Serverinformationen lesen darf, und gib ihn über Schlüssel ändern ein.",
                    other: "Der Server hat den Schlüssel abgelehnt. Erstelle beim Anbieter einen neuen Schlüssel und gib ihn über Schlüssel ändern ein.",
                },
                retentionKeep: "Gespielte Runden aufbewahren",
                retentionHelp:
                    "Ältere Runden werden nachts gelöscht und Websites berechnen ihre Summen neu.",
                browseHistory: "Gespielte Runden ansehen",
            },
            form: {
                type: "Servertyp",
                types: {
                    hll_crcon: "CRCON",
                    wardogs_warcon: "Warcon",
                    wardogs_rcon: "RCON",
                    wardogs_public_directory: "Öffentlich",
                },
                address: "Adresse",
                namePlaceholder: "Zum Beispiel Server 2",
                serverNumber: {
                    hll_crcon: "Servernummer in CRCON",
                    wardogs_warcon: "Server-ID in Warcon",
                    wardogs_rcon: "Server-ID in RCON",
                    wardogs_public_directory: "Server-ID in der Liste",
                },
                keyPlaceholder: "Schlüssel einfügen",
                help: "Das Spiel ergibt sich aus dem Servertyp. Der Schlüssel wird zuerst getestet und erst dann gespeichert.",
                testFirst: "Speichern geht nach einem erfolgreichen Test.",
                testPassed:
                    "Der Test war erfolgreich. Du kannst den Server speichern.",
                saveAndCollect: "Speichern und Sammeln starten",
            },
            keyLabel: "API-Schlüssel",
            lastTestLabel: "Letzter Test",
            notTested: "Noch nicht getestet",
            collectionLabel: "Sammeln",
            moreActions: "Weitere Aktionen für {name}",
            historyTitle: "Spielverlauf",
            title: "Spielserver",
            description:
                "Verbinde die Hell-Let-Loose-CRCON- oder Wardogs-Warcon-Server, von denen dieser Arbeitsbereich Daten sammelt: die HTTPS-Adresse des Servers, seine ID beim Anbieter und den API-Schlüssel. Logi testet die Verbindung und speichert den Schlüssel verschlüsselt. Ein gespeicherter Schlüssel kann weder angezeigt noch exportiert werden; um ihn zu ändern, gib einen neuen ein.",
            encryptionUnavailable:
                "Die verschlüsselte Schlüsselablage ist in dieser Logi-Installation noch nicht aktiviert. Du kannst einen Schlüssel testen, aber das Speichern ist deaktiviert, bis der Logi-Betreiber sie aktiviert.",
            none: "Mit diesem Arbeitsbereich ist noch kein Spielserver verbunden.",
            limit: "Höchstens {limit} Server pro Arbeitsbereich.",
            add: "Server verbinden",
            managed: {
                workspace: "In diesem Arbeitsbereich verwaltet",
                operator: "Vom Logi-Betreiber eingerichtet",
            },
            games: {
                hell_let_loose: "Hell Let Loose",
                wardogs: "Wardogs",
            },
            providers: {
                hll_crcon: "CRCON",
                wardogs_warcon: "Warcon-Panel",
                wardogs_rcon: "Wardogs RCON",
                wardogs_public_directory:
                    "Wardog-Servers-Verzeichnis (öffentlich)",
            },
            fields: {
                displayName: "Name",
                game: "Spiel",
                provider: "Anbieter",
                origin: "HTTPS-Adresse",
                serverId: "Server-ID beim Anbieter",
                key: "API-Schlüssel",
                newKey: "Neuer API-Schlüssel",
            },
            hints: {
                origin: "Nur die Adresse, zum Beispiel https://panel.example.com, ohne Pfad.",
                serverId: {
                    hll_crcon: "Die CRCON-Servernummer, meist 1.",
                    wardogs_warcon: "Die Server-UUID aus dem Warcon-Panel.",
                    wardogs_rcon: "Die Server-ID, die deine RCON-API meldet.",
                    wardogs_public_directory:
                        "Die Server-ID im Wardog-Servers-Verzeichnis.",
                },
                key: "Wird einmal gesendet, getestet und verschlüsselt gespeichert. Logi zeigt ihn nie wieder an.",
                keyOptional:
                    "Bei CRCON optional: Ohne Schlüssel liest Logi nur öffentliche Daten. Mit Schlüssel braucht dessen CRCON-Benutzer die Berechtigung, Verbindungsinformationen anzuzeigen.",
                keyNone:
                    "Das öffentliche Verzeichnis braucht keinen Schlüssel.",
            },
            enableAfterTest: "Nach erfolgreichem Test mit dem Sammeln beginnen",
            allowUnverified:
                "Auch bei fehlgeschlagenem Test speichern (das Sammeln stoppt, bis ein Test besteht)",
            actions: {
                test: "Verbindung testen",
                testing: "Wird getestet…",
                save: "Server speichern",
                saving: "Wird gespeichert…",
                testStored: "Gespeicherten Schlüssel testen",
                changeKey: "Schlüssel ändern",
                saveKey: "Schlüssel speichern",
                cancel: "Abbrechen",
                removeKey: "Schlüssel entfernen",
                rename: "Umbenennen",
                saveName: "Namen speichern",
                enable: "Sammeln starten",
                disable: "Sammeln stoppen",
                remove: "Server entfernen",
            },
            confirm: {
                removeKeyTitle: "Schlüssel für {name} entfernen?",
                removeTitle: "{name} entfernen?",
                cancel: "Abbrechen",
                removeKey:
                    "Sammeln, das den Schlüssel braucht, stoppt, bis ein neuer Schlüssel eingegeben wird.",
                remove: "Das Sammeln stoppt und der gespeicherte Schlüssel wird gelöscht. Gesammelter Verlauf bleibt erhalten.",
            },
            key: {
                set: "Schlüssel verschlüsselt gespeichert",
                missing: "Kein Schlüssel gespeichert",
                not_required: "Kein Schlüssel nötig",
                environment: "Schlüssel vom Logi-Betreiber gesetzt",
                needs_operator:
                    "Alter Schlüsselverweis: Gib den Schlüssel hier erneut ein oder bitte den Logi-Betreiber um die Migration",
            },
            keyChanged: "Schlüssel geändert {date}",
            verified: "Schlüssel hat den letzten Test bestanden",
            unverified: "Schlüssel nicht geprüft: Teste ihn vor dem Sammeln",
            failure: {
                key_unavailable:
                    "Der gespeicherte Schlüssel kann nicht verwendet werden, weil der Verschlüsselungsschlüssel des Betreibers fehlt. Wende dich an den Logi-Betreiber.",
                decrypt_failed:
                    "Der gespeicherte Schlüssel kann für diesen Server nicht gelesen werden. Gib den Schlüssel erneut ein.",
            },
            collection: {
                enabled: "Sammelt",
                disabled: "Sammelt nicht",
                none: "Kein Sammeln eingerichtet",
                lastSuccess: "Letztes erfolgreiches Sammeln {date}",
                never: "Noch kein erfolgreiches Sammeln",
            },
            lastTest: "Letzter Test {date}: {outcome}",
            saved: {
                created: "Server gespeichert, das Sammeln läuft.",
                draft: "Server als deaktivierter Entwurf gespeichert. Teste ihn und starte das Sammeln, sobald der Test besteht.",
                key: "Schlüssel gespeichert.",
                keyUnverified:
                    "Schlüssel gespeichert, aber der Test ist fehlgeschlagen, daher wurde das Sammeln gestoppt.",
                removedKey: "Schlüssel entfernt.",
                renamed: "Name gespeichert.",
                removed: "Server entfernt.",
                enabled: "Sammeln gestartet.",
                disabled: "Sammeln gestoppt.",
            },
            outcomes: {
                ok: "Die Verbindung funktioniert und der Schlüssel wird für diesen Server akzeptiert.",
                unauthorized: "Der Anbieter hat den Schlüssel abgelehnt.",
                server_mismatch:
                    "Der Anbieter hat geantwortet, aber nicht für diese Server-ID.",
                rate_limited:
                    "Der Anbieter drosselt Anfragen. Versuche es später erneut.",
                timeout: "Der Anbieter hat nicht rechtzeitig geantwortet.",
                network: "Der Anbieter ist nicht erreichbar.",
                invalid_response:
                    "Der Anbieter hat unerwartet geantwortet. Prüfe Adresse und Anbieter.",
                configuration:
                    "Diese Adresse ist nicht erlaubt (nur öffentliche HTTPS-Adressen) oder der Server ist nicht vollständig eingerichtet.",
                unsupported: "Der Anbieter unterstützt diese Prüfung nicht.",
                key_unavailable:
                    "Der gespeicherte Schlüssel kann nicht verwendet werden. Gib ihn erneut ein oder wende dich an den Logi-Betreiber.",
            },
            errors: {
                invalid_source:
                    "Prüfe die Felder: eine HTTPS-Adresse ohne Pfad und eine Server-ID im Format des Anbieters.",
                invalid_key:
                    "Der Schlüssel muss aus 8 bis 4096 sichtbaren Zeichen ohne Leerzeichen bestehen.",
                duplicate_name:
                    "Ein anderer Server in diesem Arbeitsbereich hat bereits diesen Namen.",
                duplicate_identity:
                    "Dieser Server ist in diesem Arbeitsbereich bereits verbunden.",
                limit_reached:
                    "Dieser Arbeitsbereich hat bereits die maximale Anzahl an Servern.",
                not_found:
                    "Dieser Server existiert nicht mehr. Aktualisiere die Liste.",
                revision_conflict:
                    "Jemand anderes hat diesen Server geändert. Aktualisiere und versuche es erneut.",
                operator_managed:
                    "Diesen Server richtet der Logi-Betreiber ein: Er kann hier weder umbenannt noch entfernt werden, und sein Schlüssel kann nur ersetzt werden.",
                key_required: "Dieser Anbieter braucht einen API-Schlüssel.",
                key_not_allowed:
                    "Das öffentliche Verzeichnis nimmt keinen Schlüssel an.",
                verification_required:
                    "Der Verbindungstest ist nicht bestanden. Behebe das Problem oder speichere den Schlüssel ausdrücklich als ungeprüft.",
                encryption_unavailable:
                    "Die verschlüsselte Schlüsselablage ist nicht verfügbar. Wende dich an den Logi-Betreiber.",
                rate_limited:
                    "Zu viele Verbindungstests. Versuche es in {seconds} s erneut.",
                unavailable:
                    "Spielserver konnten nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
            },
        },
        liveScoreboard: "Warcon Live-Scoreboard",
        scoreboardPolling:
            "Aktualisierung alle 15 Sekunden bei geöffneter Ansicht. Die Quelle kann verzögert sein.",
        scoreboardError:
            "Das Live-Scoreboard ist nicht verfügbar. Bitte später erneut versuchen.",
        scoreboardEmpty:
            "Bei der letzten Beobachtung waren keine Spieler verbunden.",
        scoreboardUnavailable: "Keine aktuellen Spielerdaten verfügbar.",
        playerObservation: "Spielerdaten vom",
        joinCode: "Beitrittscode",
        player: "Spieler",
        faction: "Fraktion",
        kills: "Kills",
        deaths: "Tode",
        cash: "Geld",
        ping: "Ping (ms)",
        collectedSessions: "Erfasste Spiele",
        historyObserved: "Letzter Verlaufimport",
        historyError: "Verlauferfassung",
        title: "Spielserver-Daten",
        description:
            "Sammle Serverdaten in Logi und teile ausgewählte Felder mit deiner Website. Verbinde oben einen Server; das Sammeln beginnt, sobald sein Verbindungstest besteht.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        enable: "Aktivieren / fortsetzen",
        disable: "Deaktivieren",
        disabled: "Deaktiviert",
        error: "Verbindungen konnten nicht geladen oder gespeichert werden. Erneut versuchen oder den Betreiber kontaktieren.",
        empty: "Für diesen Arbeitsbereich sammelt noch kein Spielserver Daten.",
        state: "Datenstatus",
        players: "Spieler",
        map: "Karte",
        observed: "Letzte Beobachtung",
        unknown: "Unbekannt",
        never: "Noch nicht erfasst",
        unconfirmed: "laufender Spielstand, unbestätigt",
        historySupported:
            "Die Quelle unterstützt Spielhistorie. Importierte Daten müssen vor der Ergebnisbestätigung geprüft werden.",
        historyUnsupported:
            "Diese Quelle bietet keine Erfassung der Spielhistorie.",
        freshness: {
            fresh: "Aktuell",
            stale: "Veraltet",
            unavailable: "Nicht verfügbar",
        },
        errors: {
            not_listed:
                "Der Server ist nicht gelistet; sein Zustand ist unbekannt.",
            timeout: "Die Quelle hat nicht rechtzeitig geantwortet.",
            network: "Die Quelle ist nicht erreichbar.",
            rate_limited: "Warten auf das Anfragelimit der Quelle.",
            unauthorized: "Erfassung pausiert: Zugriff verweigert.",
            invalid_response:
                "Die Quelle hat eine nicht unterstützte Antwort geliefert.",
            unsupported:
                "Erfassung pausiert: Die erforderliche Funktion ist nicht verfügbar.",
            configuration:
                "Sammeln pausiert: Prüfe Adresse und Schlüssel des Servers oder wende dich an den Logi-Betreiber.",
        },
    },
    gameCatalogue: {
        title: "Spiele",
        description:
            "Globale Spieledetails, Fähigkeiten und Event-Auswahlfelder.",
        addGame: "Spiel hinzufügen",
        newGameName: "Neues Spiel",
        gameId: "Spiel-ID",
        managedIconAssetId: "Verwaltete Icon-Asset-ID (optional)",
        displayName: "Anzeigename",
        eventSelectionLabel: "Beschriftung der Event-Auswahl",
        optionsOnePerLine: "Optionen (eine pro Zeile)",
        optionalTargetLabel: "Optionale Ziel-Beschriftung",
        targetIsOptional: "Ziel ist optional",
        defaultEventSelectionLabel: "Aktivität",
        saveGame: "Spiel speichern",
        saving: "Wird gespeichert…",
        saved: "Gespeichert.",
        saveFailed: "Dieses Spiel konnte nicht gespeichert werden.",
        capabilities: {
            title: "Fähigkeiten",
            maps: "Karten",
            stratmaps: "Taktische Karten",
            serverData: "Serverdaten",
            playerStats: "Spielerstatistiken",
            matchResults: "Matchergebnisse",
            competitions: "Wettbewerbe",
        },
    },
} as const
