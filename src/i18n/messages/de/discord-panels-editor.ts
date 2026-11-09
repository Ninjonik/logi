export const discordPanelsPage_editor = {
    back: "Panels in Discord",
    newTitle: "Neues Panel",
    newStatus: "Neues Panel · noch nicht in Discord",
    statusChannel: "in {channel}",
    statusUpdated: "aktualisiert {ago}",
    statusNext: "nächste Aktualisierung {in}",
    openInDiscord: "Nachricht in Discord öffnen",
    notFound:
        "Panel nicht gefunden. Vielleicht wurde es inzwischen entfernt. Kehren Sie zur Panel-Liste zurück.",
    loading: "Panel wird geladen…",
    steps: {
        type: "Panel-Typ",
        server: "Server",
        servers: "Server",
        game: "Spiel",
        calendar: "Events",
        competition: "Wettbewerb",
        channel: "Kanal",
        content: "Inhalt",
        contentLeague: "Inhalt · WD League",
        look: "Aussehen",
        refresh: "Aktualisierung",
    },
    edit: "Bearbeiten",
    collapse: "Schließen",
    types: {
        server: {
            title: "Live-Server",
            text: "Ein Server: Karte, Spieler, Punktestand.",
        },
        servers: {
            title: "Unsere Server",
            text: "Mehrere Server in einer Nachricht.",
        },
        results: {
            title: "Ergebnisse",
            text: "Eine Karte nach jedem bestätigten Spiel.",
        },
        league: {
            title: "WD League",
            text: "Tabelle und nächste Spiele der Liga.",
        },
        calendar: {
            title: "Kalender",
            text: "Die nächsten Clan-Events.",
        },
        competition: {
            title: "Wettbewerbstabelle",
            text: "Gruppentabellen eines Logi-Wettbewerbs.",
        },
    },
    typeLocked:
        "Der Typ eines gesendeten Panels lässt sich nicht ändern. Erstellen Sie für einen anderen Typ ein neues Panel.",
    typeTaken: "Der Clan hat diesen Typ schon; bearbeiten Sie dieses Panel.",
    server: {
        label: "Spielserver",
        placeholder: "Server wählen",
        empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn hinzu unter",
        emptyLink: "Spielserver",
        healthCollecting: "Sammelt · letzte Daten {ago}",
        healthNoData: "Sammelt · noch keine Daten",
        healthNotCollecting: "Sammelt nicht",
        liveOk: "Live-Daten ✓",
        liveLimited: "Live-Daten gerade eingeschränkt, siehe Serverdaten",
    },
    servers: {
        order: "In dieser Reihenfolge in der Nachricht. Ziehen Sie, um die Reihenfolge zu ändern.",
        moveUp: "{server} nach oben",
        moveDown: "{server} nach unten",
        drag: "{server} ziehen",
    },
    game: {
        label: "Spiel",
        help: "Ergebnisse eines Spiels. Jedes Spiel hat höchstens ein Ergebnis-Panel; beim Erstellen sendet es die letzten 5 bestätigten.",
    },
    calendar: {
        label: "Event-Kategorien",
        help: "Ohne Auswahl zeigt das Panel alle Clan-Events.",
    },
    competition: {
        label: "Wettbewerb",
        placeholder: "Wettbewerb wählen",
        empty: "Der Clan spielt noch keinen Logi-Wettbewerb.",
    },
    channel: {
        label: "Panel-Kanal",
        placeholder: "Kanal wählen",
        verify: "Prüfen",
        verifying: "Wird geprüft…",
        has: "Hat:",
        missing: "Fehlt:",
        attachHint: "Ohne sie sendet das Panel nur Text, ohne Kartenbilder.",
        public: "Alle (@everyone) sehen den Kanal. Das Serverpasswort kann hier nicht angezeigt werden.",
        private: "Der Kanal ist privat ✓",
        privateRoles: "· nur {roles} und Admins sehen ihn.",
        privateAdmins: "· nur Admins sehen ihn.",
        privatePassword:
            "· @everyone sieht ihn nicht, das Passwort wird angezeigt.",
        role: "die Rolle {name}",
        unsupported:
            "In diesen Kanal kann keine Nachricht gesendet werden. Wählen Sie einen Text- oder Ankündigungskanal.",
        timedOut:
            "Der Bot hat auf dem Server ein Timeout und kann nicht schreiben. Heben Sie es in Discord auf.",
        failed: "Der Kanal konnte nicht geprüft werden. Versuchen Sie es erneut.",
        unverified:
            "Wählen Sie Prüfen: Logi prüft die Berechtigungen des Bots und ob alle den Kanal sehen.",
    },
    content: {
        show: "Was angezeigt wird",
        compact: {
            label: "Kompakte Ansicht",
            help: "Eine kürzere Ergebniskarte: der Spielstand ohne die Zeile mit den Seiten; eine Korrektur sagt nur, wann und was vorher stand.",
        },
        score: {
            label: "Punktestand",
            help: "Alliierte : Achse nach Sektoren.",
        },
        leaders: {
            label: "Beste Spieler",
            help: "Kills; der ganze Kanal sieht die Namen.",
        },
        nextMap: { label: "Nächste Karte", help: "" },
        queue: {
            label: "Warteschlange",
            help: "Nur wenn der Server sie meldet.",
        },
        connection: "Beitreten",
        address: {
            label: "IP:Port anzeigen",
            help: "Das Panel zeigt {address}. Die Adresse geben Sie hier ein; sie gilt für alle Panels dieses Servers.",
            helpCombined:
                "Bei HLL-Servern. Die Adressen geben Sie hier ein; jede gilt für alle Panels ihres Servers.",
            missing:
                "Noch ist keine Serveradresse gespeichert. Geben Sie sie hier ein.",
            field: "IP:Port · {server}",
            placeholder: "203.0.113.24:7777",
            clear: "Entfernen",
            clearFor: "IP:Port entfernen · {server}",
        },
        joinCode: {
            label: "Join-Code anzeigen",
            help: "Bei Wardogs-Servern.",
            field: "Join-Code · {server}",
            clear: "Entfernen",
            clearFor: "Join-Code entfernen · {server}",
        },
        joinButton: {
            label: "Schaltfläche Beitreten (über Logi)",
            help: "Öffnet {url}, die Steam startet.",
            helpWardogs: "Öffnet {url} mit dem Join-Code.",
            helpCombined: "Bei HLL-Servern; Wardogs tritt mit einem Code bei.",
        },
        password: {
            label: "Serverpasswort anzeigen",
            field: "Serverpasswort",
            fieldServer: "Passwort · {server}",
            help: "Wird verschlüsselt gespeichert. Logi zeigt es nur in einem privaten Kanal.",
            stored: "Ein Passwort ist verschlüsselt gespeichert. Ein neues ersetzt es.",
            clear: "Gespeichertes Passwort löschen",
            publicTitle:
                "Alle sehen den Kanal, das Passwort kann nicht angezeigt werden.",
            publicFix: "Wählen Sie einen Kanal, den @everyone nicht sieht.",
            unverified:
                "Das Passwort kann nur in einem Kanal angezeigt werden, den @everyone nicht sieht. Wählen Sie beim Kanal Prüfen.",
            combined:
                "Die Nachricht Unsere Server zeigt das Passwort nie; nur das eigene Panel des Servers zeigt es in einem privaten Kanal.",
        },
        buttons: "Schaltflächen",
        players: {
            label: "Spieler anzeigen",
            help: "Die Spielerliste sieht nur, wer klickt.",
        },
        report: {
            label: "Spieler melden",
            help: "Öffnet einen privaten Thread für die Admins.",
            category: "Ticket-Kategorie",
            categoryPlaceholder: "Kategorie wählen",
            note: "Kanal und Support stellen Sie ein unter",
            noCategories:
                "Tickets haben noch keine Kategorie mit privatem Kanal. Richten Sie sie ein unter",
            provider: "Meldungen gibt es nur bei CRCON- und Warcon-Servern.",
        },
        ticketsLink: "Tickets",
        seed: "Seed",
        seedProgress: {
            label: "Seed-Fortschritt anzeigen",
            help: "Während ein Seed läuft, zeigt das Panel die Spieler bis zum Live-Spiel.",
            helpCombined: "Beim Server, auf dem gerade ein Seed läuft.",
        },
        seedNote:
            "Die Schaltfläche Seed gibt es nur in der Nachricht Serversteuerung für Admins.",
        seedPlan: "Seed-Plan",
        noContent: "Dieser Panel-Typ hat keine weiteren Inhaltsschalter.",
    },
    league: {
        table: {
            label: "Tabelle",
            help: "Rangliste aller Ligateams. Logi berechnet die Punkte aus den Ergebnissen nach den Ligaregeln.",
        },
        fixtures: {
            label: "Nächste Spiele",
            help: "Teams, Fraktionen, Karte, Gastgeber und wie weit die Vorbereitung ist.",
        },
        recent: {
            label: "Letzte Ergebnisse",
            help: "Unter den nächsten Spielen.",
        },
        count: {
            label: "Anzahl der Spiele",
            help: "Wie viele nächste Spiele die Nachricht zeigt.",
        },
        note: "Alle Spiele der Liga, nicht nur unsere. Tabelle und nächste Spiele sind zwei Nachrichten untereinander in {channel} und werden alle 60 s aktualisiert. Eigene Ligakarten pro Spiel gibt es nicht mehr.",
        channelFallback: "einem Kanal",
    },
    look: {
        title: {
            label: "Name",
            help: "Wird als Titel der Nachricht angezeigt.",
        },
        description: {
            label: "Beschreibung",
            help: "Optional. Ein kurzer Satz unter dem Titel.",
        },
        banner: {
            label: "Banner",
            upload: "Banner hochladen",
            choose: "Hochgeladenes wählen",
            hide: "Hochgeladene ausblenden",
            remove: "Entfernen",
            help: "Kein Banner. Es ersetzt das Kartenbild. PNG, JPEG oder WebP bis 2 MiB.",
            set: "Eigenes Banner. Es ersetzt das Kartenbild. PNG, JPEG oder WebP bis 2 MiB.",
            uploading: "Banner wird hochgeladen…",
            uploaded: "Banner hochgeladen.",
            selected: "Banner gewählt.",
            libraryLoading: "Hochgeladene Banner werden geladen…",
            libraryEmpty: "Es wurden noch keine Banner hochgeladen.",
            libraryError:
                "Die hochgeladenen Banner konnten nicht geladen werden.",
            library: "Hochgeladene Banner",
            libraryItem: "Banner {width} × {height}, hochgeladen {date}",
            preview: "Banner-Vorschau",
        },
        accent: {
            label: "Balkenfarbe",
            clan: "Clanfarbe",
            custom: "Eigene Farbe",
            customHelp: "Nur für dieses Panel",
            picker: "Balkenfarbe wählen",
            field: "Balkenfarbe des Panels",
            invalid: "Geben Sie eine Farbe als #RRGGBB ein.",
        },
        style: {
            label: "Panel-Stil",
            clan: "Wie in Panel-Grafik",
            clanHelp: "Jetzt {style}",
            help: "Den Standardstil aller Panels stellen Sie ein unter",
            link: "Panel-Grafik",
        },
        summary: {
            title: "Name {title}",
            titleDefault: "Name vom Server",
            description: "Beschreibung ausgefüllt",
            noDescription: "ohne Beschreibung",
            banner: "eigenes Banner",
            noBanner: "ohne Banner",
            accentClan: "Clanfarbe",
            accentCustom: "eigene Farbe {color}",
            style: "{style}",
        },
    },
    refresh: {
        locked: "Alle 60 s · gleich für alle Panels",
        footer: {
            label: "In der Fußzeile anzeigen",
            help: "„Aktualisiert vor 6 s · wird alle 60 s aktualisiert“",
        },
        summaryFooter: "Alle 60 s · in der Fußzeile",
        summaryNoFooter: "Alle 60 s · ohne Fußzeile",
    },
    preview: {
        title: "Vorschau in {channel} · echte Daten von {server}",
        titleCombined:
            "Vorschau in {channel} · echte Daten von {count} Servern",
        titleLeague: "Vorschau in {channel} · zwei Nachrichten untereinander",
        titlePlain: "Vorschau in {channel}",
        noChannel: "dem Kanal",
        author: "heute um {time}",
        pending: "Die Vorschau erscheint, sobald die Serverdaten geladen sind.",
        noServer: "Wählen Sie einen Server, dann erscheint die Vorschau.",
        loading: "Serverdaten werden geladen…",
        leagueLoading: "Ligadaten werden geladen…",
        leagueFailed: "Die Ligadaten konnten nicht geladen werden.",
        resultsEmpty:
            "Die Karte erscheint nach dem ersten bestätigten Ergebnis. Die Vorschau zeigt das letzte Spiel mit Ergebnis.",
        resultsNone: "Der Clan hat noch kein Spiel mit Ergebnis.",
        calendarNote:
            "Vorschau aus den Events in Logi; die Links zu den Ankündigungen ergänzt der Bot.",
        competitionNote:
            "Die Gruppentabellen erstellt der Bot nach dem Speichern.",
        noAttach:
            "Dem Bot fehlt die Berechtigung {permission} in {channel}, daher sendet er das Panel nur als Text ohne Bilder, wie diese Vorschau.",
    },
    joinPage: {
        title: "Nach Klick auf Beitreten · Logi-Seite",
        players: "{game} · {map} · {players} / {capacity} Spieler",
        open: "In Steam öffnen",
        fallback:
            "Steam hat sich nicht geöffnet? Wählen Sie im Spiel Über IP beitreten und geben Sie {address} ein.",
        joinCode:
            "Öffnen Sie im Spiel den Beitritt und geben Sie den Code {code} ein.",
        noAddress:
            "Ohne Adresse sagt die Seite nur, dass der Spieler einen Admin fragen soll.",
        noJoinCode:
            "Ohne Beitrittscode sagt die Seite nur, dass der Spieler einen Admin fragen soll.",
        caption:
            "Discord erlaubt in einer Schaltfläche nur http(s)-Links. Diese Seite öffnet sofort steam://connect und zeigt sonst die IP.",
        captionJoinCode:
            "Discord erlaubt in einer Schaltfläche nur http(s)-Links. Diese Seite zeigt den Beitrittscode des Spiels und bietet an, ihn zu kopieren.",
    },
    data: {
        title: "Serverdaten",
        load: "Daten vom Server laden",
        loading: "Wird geladen…",
        help: "Derselbe Abruf, den der Bot macht.",
        loadedAgo: "Daten geladen {ago}.",
        result: "Daten geladen {ago} · {map} · {players}/{capacity}",
        perServer: "{server} · geladen {ago} · {map} · {players}/{capacity}",
        score: "Punktestand {score}",
        timeLeft: "noch {minutes} min",
        queue: "Warteschlange {count}",
        inStats: "{count} Spieler in der Statistik",
        nextMap: "nächste Karte {map}",
        seed: "Seed läuft · {players} von {liveFrom}",
        stale: "Der Server hat ältere Daten gesendet.",
        unavailable:
            "Der Server antwortet nicht. Das Panel zeigt die zuletzt gesammelten Daten.",
        busy: "Ein anderer Abruf des Servers läuft. Versuchen Sie es in {seconds} s erneut.",
        denied: "Der Schlüssel darf keine Live-Daten lesen. Ersetzen Sie ihn unter Spielserver.",
        failed: "Der Abruf ist fehlgeschlagen. Das Panel zeigt die zuletzt gesammelten Daten und versucht es erneut.",
        rateLimited:
            "{server} · {provider} lehnt gerade weitere Anfragen ab (Limit 429).",
        rateLimitedBody:
            "Das Panel zeigt die Daten von {ago} und versucht es in {seconds} s erneut. Dauert es über eine Stunde, erhöhen Sie das Limit des Schlüssels {providerIn} oder ersetzen Sie ihn unter Spielserver → {server}.",
        providerIn: {
            hll_crcon: "in CRCON",
            wardogs_warcon: "in Warcon",
        },
        snapshot:
            "Dieser Server hat keinen Live-Abruf; gezeigt werden die gesammelten Daten.",
        notCollecting: "Logi sammelt von diesem Server keine Daten.",
        requestFailed:
            "Die Daten konnten nicht geladen werden. Versuchen Sie es erneut.",
        notServerKind: "Serverdaten werden nur bei Server-Panels gelesen.",
    },
    source: {
        title: "Quelle · {server}",
        link: "Spielserver",
        collection: "Datensammlung",
        live: "Live-Daten",
        liveOk: "✓ letzter Abruf {ago}",
        liveNone: "noch nicht gelesen",
        liveLimited: "eingeschränkt, siehe Serverdaten",
        key: "Schlüssel",
        keySet: "verschlüsselt gespeichert",
        keyVerified: "geprüft {date}",
        keyNotVerified: "nicht geprüft",
        keyMissing: "fehlt",
        keyNotRequired: "nicht nötig",
        keyEnvironment: "vom Logi-Betreiber gesetzt",
        address: "Adresse",
        addressValue: "{origin} · Server {id}",
    },
    delivery: {
        title: "Zustellung",
        saved: "Gespeichert",
        claimed: "Bot übernommen",
        sent: "Gesendet",
        lastRefresh: "Letzte Aktualisierung",
        notYet: "noch nicht",
        none: "—",
        savedBy: "{when} · {name}",
        sentIn: "Nachricht in {channel}",
        refreshValue: "{ago} · nächste {in}",
        hint: "Nach In den Kanal senden werden die Schritte abgehakt, meist innerhalb von 15 s. Die Seite aktualisiert sich selbst.",
        lastError: "Letzter Fehler:",
        recovered: "Der nächste Versuch {after} später ging durch.",
        recoveredAfter: {
            second: {
                one: "eine Sekunde",
                few: "{count} Sekunden",
                many: "{count} Sekunden",
                other: "{count} Sekunden",
            },
            minute: {
                one: "eine Minute",
                few: "{count} Minuten",
                many: "{count} Minuten",
                other: "{count} Minuten",
            },
            hour: {
                one: "eine Stunde",
                few: "{count} Stunden",
                many: "{count} Stunden",
                other: "{count} Stunden",
            },
            day: {
                one: "einen Tag",
                few: "{count} Tage",
                many: "{count} Tage",
                other: "{count} Tage",
            },
        },
        stuck: {
            title: "Wenn die Zustellung hängt",
            lead: "Senden nicht bestätigt.",
            body: "Discord hat nicht bestätigt, dass es die Nachricht erhalten hat, und in {channel} haben wir sie nicht gefunden. Erneut versuchen sendet sie noch einmal.",
        },
    },
    bar: {
        adoptCalendar:
            "Der Kalender ist schon in {channel}. Speichern übernimmt ihn: Die Nachricht wird bearbeitet, keine neue gesendet.",
        editsMessage:
            "Speichern bearbeitet die Nachricht in {channel}; es wird keine neue gesendet.",
        notInDiscord: "Das Panel ist noch nicht in Discord.",
        pausedNote: "Das Panel ist pausiert; Speichern setzt es nicht fort.",
        delete: "Nachricht löschen",
        deleteConfirm:
            "Die Nachricht aus Discord löschen? Das Panel bleibt als nicht gesendet gespeichert.",
        removePanel: "Panel entfernen",
        removeConfirm:
            "Panel entfernen? Seine Nachrichten verschwinden aus Discord und die Einstellungen werden gelöscht.",
        pause: "Pausieren",
        resume: "Fortsetzen",
        refresh: "Jetzt aktualisieren",
        save: "Speichern",
        publish: "In den Kanal senden",
        saving: "Wird gespeichert…",
        discard: "Verwerfen",
        actions: "Panel-Aktionen",
    },
    saved: "Gespeichert.",
    savedSent:
        "Gespeichert und zur Veröffentlichung gesendet. Der Bot übernimmt es innerhalb von 15 s.",
    problems: {
        channel: "Wählen Sie einen Kanal.",
        server: "Wählen Sie einen Spielserver.",
        servers: "Wählen Sie mindestens einen Server.",
        reportCategory: "Wählen Sie eine Ticket-Kategorie.",
        accentColor: "Geben Sie eine Farbe als #RRGGBB ein.",
        competition: "Wählen Sie einen Wettbewerb.",
        fixtureCount: "Die Anzahl der Spiele muss 1 bis 10 sein.",
    },
    errors: {
        not_found: "Das Panel existiert nicht mehr.",
        conflict:
            "Jemand anderes hat das Panel inzwischen geändert. Laden Sie die Seite neu.",
        kind_locked: "Der Typ eines gesendeten Panels lässt sich nicht ändern.",
        removing: "Das Panel wird gerade entfernt.",
        source_not_found: "Der Spielserver ist nicht mehr in Logi.",
        game_mismatch: "Der Server gehört nicht zum Spiel des Panels.",
        report_destination_missing:
            "Die Ticket-Kategorie hat keinen privaten Kanal. Richten Sie sie unter Tickets ein.",
        report_provider: "Meldungen gibt es nur bei CRCON- und Warcon-Servern.",
        duplicate_channel: "Dieser Server hat in diesem Kanal schon ein Panel.",
        results_exists: "Dieses Spiel hat schon ein Ergebnis-Panel.",
        league_exists: "Der Clan hat schon ein WD-League-Panel.",
        calendar_exists: "Der Clan hat schon ein Kalender-Panel.",
        competition_not_found: "Der Wettbewerb existiert nicht mehr.",
        panel_limit: "Ein Clan kann höchstens 20 Panels haben.",
        asset_unavailable:
            "Das Banner ist nicht mehr verfügbar. Laden Sie es erneut hoch.",
        invalid_settings: "Eine Einstellung ist ungültig.",
        unavailable:
            "Das Speichern ist fehlgeschlagen. Versuchen Sie es erneut.",
        address:
            "Die Adresse muss IP:Port sein, zum Beispiel 203.0.113.24:7777.",
        joinCode:
            "Ein Join-Code darf nur Buchstaben, Ziffern und Bindestriche enthalten.",
        password: "Ein Passwort hat 1 bis 64 Zeichen ohne Steuerzeichen.",
        encryption_unavailable:
            "Das Passwort kann gerade nicht gespeichert werden: Die Verschlüsselung ist nicht aktiviert. Bitten Sie den Logi-Betreiber, den Schlüssel einzurichten.",
    },
} as const
