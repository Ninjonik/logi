export const competitionsMessages = {
    competitionEnrollment: {
        title: "Wettbewerbe",
        description:
            "Melde die Teams deines Clans an oder verwalte ihre Bewerbungen.",
        noTeams:
            "Kein Team ist mit diesem Clan verknüpft. Beantrage ein Team oder bitte einen Logi-Administrator, dein bestehendes Team zu verknüpfen.",
        teamsLink: "Teams verwalten",
        noCompetitions: "Noch keine Wettbewerbe verfügbar.",
        players: "Bei Logi angemeldete Clanmitglieder: {count}",
        minimum: "Mindestens angemeldete Spieler: {count}",
        noMinimum: "Keine Mindestspielerzahl",
        closed: "Anmeldung geschlossen",
        approval: "Genehmigung durch Administrator erforderlich",
        automatic: "Automatische Anmeldung",
        enroll: "Team anmelden",
        withdraw: "Zurückziehen",
        pending: "Genehmigung ausstehend",
        approved: "Angemeldet",
        rejected: "Nicht genehmigt",
        withdrawn: "Zurückgezogen",
        saved: "Gespeichert",
        error: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
        registration_closed:
            "Die Anmeldung für diesen Wettbewerb ist geschlossen.",
        minimum_players:
            "Dein Clan erreicht die Mindestzahl bei Logi angemeldeter Spieler nicht.",
        team_not_owned: "Dieses Team ist nicht mit deinem Clan verknüpft.",
        modeTitle: "Wie möchtest du Logi nutzen?",
        modeDescription:
            "Wähle alle Clanwerkzeuge oder ein einfacheres Menü für Wettbewerbe und Spieler. Du kannst dies später in den Claneinstellungen ändern.",
        full: "Vollständiges Logi",
        competitions: "Nur Wettbewerbe",
        modeSave: "Modus speichern",
        modeLabel: "Arbeitsbereichsmodus",
        policy: "Teamanmeldung",
        minimumLabel: "Mindestens bei Logi angemeldete Clanmitglieder",
        minimumHelp:
            "Leer lassen für keine Mindestzahl. Gezählt werden eindeutige Clanmitglieder, die sich bei Logi angemeldet haben; Steam-Verifizierung ist nicht erforderlich.",
        approve: "Genehmigen",
        reject: "Ablehnen",
        publicLink: "Wettbewerb ansehen",
    },
    competition: {
        title: "Wettbewerbe",
        description:
            "Offizielle Wettbewerbsinfos und Ergebnisse, erfasst in Logi.",
        back: "Zurück zu Logi",
        standings: "Tabelle und Ergebnisse ansehen",
        rules: "Offizielles Regelwerk",
        website: "Offizielle Website",
        seasonSummary:
            "{season}-Saison · Tabelle und Ergebnisse erfasst von Logi",
        divisions: {
            one: "{count} Division · Live-Tabelle und erfasste Ergebnisse",
            few: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
            many: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
            other: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
        },
        results: "Ergebnisse",
        statistics: "Match-Statistiken",
        statisticsUnavailable: "Statistiken nicht verfügbar",
        noCompetitions:
            "Es wurden noch keine öffentlichen Wettbewerbe erstellt.",
        capScore: "Cap-Score",
        regularWins: "Reguläre Siege",
        totalWins: "Siege gesamt",
        regularMatches: "Reguläre Matches",
        totalMatches: "Matches gesamt",
        team: "Team",
        withdrawn: "(zurückgezogen)",
        noTeams: "Noch keine Teams registriert.",
        phases: {
            league: "Liga",
            playoff: "Playoff",
            relegation: "Relegation",
        },
        fixtureStatus: {
            scheduled: "Geplant",
            final: "Endgültig",
            forfeit: "Forfeit",
        },
    },
    competitionAdmin: {
        chooseTeams: "Teams auswählen",
        selectedTeams: "{count} Teams ausgewählt",
        registerSelected: "{count} Teams anmelden",
        selectAllMatching: "Alle Treffer auswählen",
        clearSelection: "Auswahl aufheben",
        doneSelecting: "Fertig",
        retryTeams: "Erneut versuchen",

        breadcrumb: "Brotkrumennavigation",
        round: "Runde",
        roundHelp: "Optional, 1–99. Spiele werden nach Runde gruppiert.",
        roundHeading: "{round}. Runde",
        noRound: "Ohne Runde",
        noFixturesInView:
            "In dieser Division und Phase gibt es noch keine Spiele.",
        linkWithMatch: "Mit Spiel verknüpfen",
        clanMatch: "Spiel von {clan}",
        clanMatchUnknown: "Verknüpftes Clan-Spiel",
        awaitingConfirmation: "Wartet auf Bestätigung durch den Clan",
        played: "Gespielt",
        editFixtureNamed: "Spiel {teams} bearbeiten",
        linkPanelTitle: "{teams} verknüpfen",
        linkPanelDescription:
            "Das Ergebnis wird dann automatisch übernommen, sobald der Clan es bestätigt. Angeboten werden die Clan-Spiele beider Teams um den Termin.",
        searchMatches: "Spiel nach Namen suchen",
        candidateClan: "Clan {clan}",
        noCandidateResults: "Kein Spiel passt zur Suche.",
        manualEventId: "Spiel-ID manuell eingeben",
        deleteFixture: "Spiel löschen",
        listDescription:
            "Erstelle und betreue Wettbewerbe für Hell Let Loose und Wardogs mit Teams aus dem globalen Katalog.",
        newCompetition: "Neuer Wettbewerb",
        createTitle: "Wettbewerb erstellen",
        createDescription:
            "Wähle zuerst das Spiel – es lässt sich später nicht ändern. Der Wettbewerb startet unveröffentlicht.",
        game: "Spiel",
        name: "Name",
        season: "Saison",
        slug: "Adresse (Slug)",
        slugHelp:
            "2–64 Kleinbuchstaben, Ziffern und Bindestriche; wird in der öffentlichen Adresse verwendet.",
        description: "Beschreibung",
        published: "Veröffentlicht",
        publishedHelp:
            "Unveröffentlichte Wettbewerbe sind auf den öffentlichen Seiten und in der öffentlichen API verborgen.",
        publishedBadge: "Veröffentlicht",
        draftBadge: "Unveröffentlicht",
        create: "Erstellen",
        creating: "Wird erstellt…",
        cancel: "Abbrechen",
        save: "Speichern",
        saving: "Speichert…",
        saved: "Gespeichert.",
        manage: "Verwalten",
        openPublic: "Öffentliche Seite",
        back: "Alle Wettbewerbe",
        noCompetitions: "Noch keine Wettbewerbe.",
        countDivisions: {
            one: "{count} Division",
            few: "{count} Divisionen",
            many: "{count} Divisionen",
            other: "{count} Divisionen",
        },
        countTeams: {
            one: "{count} Team",
            few: "{count} Teams",
            many: "{count} Teams",
            other: "{count} Teams",
        },
        countFixtures: {
            one: "{count} Spiel",
            few: "{count} Spiele",
            many: "{count} Spiele",
            other: "{count} Spiele",
        },
        sectionsLabel: "Bereiche des Wettbewerbs",
        legacyTitle: "Migration ausstehend",
        legacyDescription:
            "{count} Wettbewerbsdatensätze verweisen noch auf Logi-Workspaces statt auf globale Teams. Sie bleiben sichtbar, lassen sich aber erst bearbeiten oder verknüpfen, wenn der Plattformbetreiber die einmalige Wettbewerbsmigration ausführt.",
        legacyBadge: "Migration ausstehend",
        detailsTitle: "Details",
        detailsDescription:
            "Name, öffentliche Adresse, Saison, Beschreibung und Sichtbarkeit. Das Spiel ist festgelegt.",
        divisionsTitle: "Divisionen",
        divisionsDescription:
            "Divisionen erscheinen in dieser Reihenfolge auf der öffentlichen Seite. Eine Division kann nur gelöscht werden, wenn sie weder Teams noch Spiele hat.",
        divisionName: "Name der Division",
        addDivision: "Division hinzufügen",
        addDivisionFirst:
            "Füge eine Division hinzu, bevor du Teams registrierst.",
        rename: "Umbenennen",
        moveUp: "Nach oben",
        moveDown: "Nach unten",
        delete: "Löschen",
        confirmDeleteDivision: "Division „{name}“ löschen?",
        confirmDeleteDivisionDescription:
            "Die Division verschwindet von der öffentlichen Seite. Das kann nicht rückgängig gemacht werden.",
        noDivisions: "Noch keine Divisionen.",
        teamsTitle: "Teams",
        teamsDescription:
            "Registriere aktive Teams aus dem globalen Katalog, die zum Spiel dieses Wettbewerbs gehören. Ein Team kann nur entfernt werden, solange es keine Spiele hat; ziehe es sonst zurück, damit seine Ergebnisse erhalten bleiben.",
        team: "Team",
        division: "Division",
        unassigned: "Keine Division",
        chooseTeam: "Team wählen",
        searchTeams: "Teams suchen…",
        loadingTeams: "Teams werden geladen…",
        noTeamResults: "Kein passendes aktives, noch nicht registriertes Team.",
        register: "Registrieren",
        withdraw: "Zurückziehen",
        reinstate: "Wieder aufnehmen",
        remove: "Entfernen",
        moveTo: "Division",
        confirmRemoveTeam: "{name} aus diesem Wettbewerb entfernen?",
        confirmRemoveTeamDescription:
            "Die Anmeldung des Teams wird gelöscht. Um seine Ergebnisse zu behalten, ziehe das Team stattdessen zurück.",
        noTeams: "Keine Teams in dieser Division.",
        withdrawnBadge: "Zurückgezogen",
        archivedBadge: "Archiviert",
        fixturesTitle: "Spiele",
        fixturesDescription:
            "Endgültige Ergebnisse und Forfeits mit beiden Punktständen zählen für die Tabelle, geplante Spiele nicht.",
        allDivisions: "Alle Divisionen",
        addFixture: "Spiel hinzufügen",
        editFixture: "Spiel bearbeiten",
        noFixtures: "Noch keine Spiele.",
        fixtureHelp:
            "Ligaspiele bestreiten zwei Teams der gewählten Division; Playoff- und Relegationsspiele dürfen divisionsübergreifend sein.",
        invalidFixture:
            "Wähle eine Division und zwei verschiedene Teams und gib bei einem endgültigen Ergebnis oder Forfeit beide Punktstände als ganze Zahlen ein.",
        confirmDeleteFixture: "Dieses Spiel löschen?",
        confirmDeleteFixtureDescription:
            "{teams}: Das Spiel und sein Ergebnis verschwinden aus der Tabelle. Das kann nicht rückgängig gemacht werden.",
        phase: "Phase",
        phases: {
            league: "Liga",
            playoff: "Playoff",
            relegation: "Relegation",
        },
        status: "Status",
        statuses: {
            scheduled: "Geplant",
            final: "Endgültig",
            forfeit: "Forfeit",
        },
        teamA: "Team A",
        teamB: "Team B",
        teamC: "Team C",
        scoreA: "Punkte Team A",
        scoreB: "Punkte Team B",
        scoreC: "Punkte Team C",
        resultConflict: "Ergebnisabweichung",
        score: "Ergebnis",
        scheduledAt: "Termin",
        event: "Match-Event",
        actions: "Aktionen",
        linkEvent: "Match-Event verknüpfen",
        linkEventTitle: "Logi-Match-Event verknüpfen",
        linkEventDescription:
            "Für das verknüpfte Match importierte Ergebnisse aktualisieren dieses Spiel. Das Match muss zum selben Spiel gehören, und wenn ihm Teams zugeordnet sind, müssen beide Teams dieses Spiels darunter sein.",
        linked: "Derzeit verknüpft mit {name}.",
        candidates: "Matches aus den verknüpften Workspaces der Teams",
        loadingCandidates: "Matches werden geladen…",
        noCandidates:
            "In den verknüpften Workspaces der Teams wurden keine Matches gefunden.",
        teamsMatch: "beide Teams zugeordnet",
        teamsUnassigned: "Seiten nicht zugeordnet",
        hasResult: "Ergebnis importiert",
        eventId: "Event-ID",
        eventIdHelp:
            "Oder füge die Event-ID aus der Dashboard-Adresse des Matches ein.",
        link: "Verknüpfen",
        unlink: "Verknüpfung lösen",
        errors: {
            invalid_competition:
                "Prüfe die eingegebenen Werte und versuche es erneut.",
            not_found:
                "Dieser Wettbewerbsdatensatz existiert nicht mehr. Lade die Seite neu.",
            duplicate_slug:
                "Ein anderer Wettbewerb verwendet diese Adresse bereits.",
            duplicate_division:
                "Dieser Wettbewerb hat bereits eine Division mit diesem Namen.",
            division_not_found:
                "Die Division existiert nicht mehr. Lade die Seite neu.",
            division_not_empty:
                "Verschiebe oder entferne ihre Teams und Spiele, bevor du die Division löschst.",
            invalid_order:
                "Die Divisionen haben sich inzwischen geändert. Lade die Seite neu und versuche es erneut.",
            limit_reached: "Dieser Wettbewerb hat seine Größengrenze erreicht.",
            team_not_found: "Das Team existiert nicht mehr im Katalog.",
            team_archived:
                "Archivierte oder zusammengeführte Teams können nicht registriert werden.",
            team_game_mismatch:
                "Das Team gehört zu einem anderen Spiel als der Wettbewerb.",
            already_registered:
                "Dieses Team ist bereits im Wettbewerb registriert.",
            registration_has_fixtures:
                "Das Team hat Spiele. Lösche sie zuerst oder ziehe das Team stattdessen zurück.",
            team_not_registered:
                "Beide Teams müssen in diesem Wettbewerb registriert sein.",
            division_mismatch:
                "Ligaspiele brauchen zwei Teams, die in der gewählten Division registriert sind.",
            event_not_found: "Es gibt kein Logi-Event mit dieser ID.",
            event_not_match:
                "Nur Match-Events können verknüpft werden, keine Trainings.",
            event_game_mismatch:
                "Das Match gehört zu einem anderen Spiel als der Wettbewerb.",
            event_already_linked:
                "Dieses Match ist bereits mit einem anderen Spiel verknüpft.",
            event_team_mismatch:
                "Die zugeordneten Teams des Matches enthalten nicht beide Teams dieses Spiels.",
            migration_pending:
                "Alte Datensätze müssen zuerst zu globalen Teams migriert werden.",
            forbidden:
                "Nur globale Logi-Administratoren können Wettbewerbe verwalten.",
            unavailable:
                "Der Wettbewerbsdienst ist nicht verfügbar. Versuche es erneut.",
        },
    },
    leagueMatch: {
        title: "Wardogs League Spiel",
        description:
            "Füge einen öffentlichen Spiellink ein, um Termin, Teams und Vorbereitung anzuzeigen. Das Lesen erstellt kein Ereignis.",
        url: "Öffentliche Spiel-URL",
        load: "Spiel laden",
        loading: "Wird geladen…",
        unknown: "Nicht verfügbar",
        error: "Das Spiel konnte nicht geladen werden. Prüfe die öffentliche Wardogs League URL.",
        unavailable:
            "Die Quelle ist vorübergehend nicht verfügbar. Kein gespeichertes Spiel vorhanden.",
        nextCheck: "Nächste Aktualisierung ab",
        source: "Quellspiel öffnen",
        stale: "Das gespeicherte Spiel ist möglicherweise veraltet. Lade den Link erneut, sobald eine Aktualisierung erlaubt ist.",
        fetched: "Abgerufen",
        scheduled: "Spieltermin (Prag)",
        map: "Karte",
        zone: "Zone",
        lighting: "Beleuchtung",
        hosting: "Hosting",
        moderator: "Moderator",
        ready: "Ready Check",
        points: "Punkteregel",
        membersNote:
            "Angezeigte Teammitglieder, nicht die Aufstellung oder Spielerzahl des Spiels.",
        team: "Team",
        faction: "Fraktion",
        nations: "Nationen",
        members: "Teammitglieder",
        teamsUnavailable: "Die Quelle hat keine Teamdetails bereitgestellt.",
        vote: "Kartenabstimmung",
        closes: "Abstimmungsende (Prag)",
        rules: "Regeln",
        progress: "Spielablauf",
        resultsNote:
            "Ergebnisse und Platzierungen werden nicht importiert. Punkteregeln sind keine vergebenen Punkte.",
        partial:
            "Einige Felder oder dieser Spielstatus konnten nicht geprüft werden. Prüfe die Quellseite.",
        age: "Alter des Datensatzes: {seconds} Sekunden",
        timezone:
            "Zeiten in Europe/Prague. Daten werden fünf Minuten zwischengespeichert.",
        done: "Erledigt",
        current: "Aktueller Schritt",
        not_started: "Nicht begonnen",
    },
} as const
