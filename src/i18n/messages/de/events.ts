export const eventsMessages = {
    event: {
        signupStatusSignedUpAs: "Du bist angemeldet als: {type}.",
        signupStatusGeneral: "allgemeiner Teilnehmer",
        signupStatusDeclined: "Du hast angegeben, dass du nicht teilnimmst.",
        signupStatusNotSignedUp:
            "Du hast dich noch nicht für dieses Event angemeldet.",
        infoTitle: "Event-Informationen",
        infoDescription: "Zeitplan, Anmeldungen und Discord-Einstellungen.",
        listDescription: "Kommende und vergangene Clan-Events.",
        createTitle: "Event erstellen",
        created: "Event erstellt.",
        saved: "Event gespeichert.",
        createDescription:
            "Richte Event-Details, Zeitplan und Discord-Optionen ein, bevor du es an deinen Clan veröffentlichst.",
        createPageDescription:
            "Lege Zeitplan, Anmelderegeln und Discord-Kanäle fest.",
        relatedRoster: "Zugehöriges Roster",
        showRoster: "Roster anzeigen",
        rosterPublishedHint: "Die Aufstellung ist veröffentlicht.",
        rosterDraftHint:
            "Ein Roster ist zugewiesen, aber noch vor regulären Mitgliedern verborgen.",
        rosterMissingHint: "Keine Aufstellung zugewiesen.",
        detailMetaTitle: "Event-Details",
        requiredLabel: "Erforderlich",
        optionalLabel: "Optional",
        noPreset: "Kein Preset",
        topicPreset: "Themen-Preset",
        topicPresetCompleteMatch: "Vollständige Übereinstimmung",
        topicPresetPartialMatch: "Teilweise Übereinstimmung",
        resyncTopicThread: "Themen-Thread neu syncen",
        topicThreadResyncQueued: "Themen-Thread-Resync eingereiht.",
        generalSignupDescription:
            "Aktiviere einen allgemeinen Anmelde-Button, der Spieler ihrer primären Gruppe zuweist, wenn sie für dieses Match verfügbar ist, sonst den Reserven.",
        signupGroupsDescription:
            "Wähle, welche gruppenspezifischen Anmelde-Buttons für dieses Match gezeigt werden sollen.",
        allowedSignupStatusesDescription:
            "Leer lassen, um jedem Clan-Mitgliedsstatus die Anmeldung zu erlauben. Sonst können sich nur die gewählten Status für dieses Match anmelden.",
        allowedSignupStatusesAll: "Alle Clan-Mitgliedsstatus",
        signupReminderStatusesDescription:
            "Sendet die vollständige Match-Anmeldung alle 24 Stunden per DM, beginnend 24 Stunden nach Erstellung bis zum Anmeldeschluss. Keine Auswahl deaktiviert die Erinnerung.",
        signupReminderDisabled:
            "Tägliche Anmeldeerinnerungen sind deaktiviert.",
        createForumChannelDescription:
            "Erstelle den Discord-Forums-Channel und Briefing-Themen für dieses Event.",
        conclude: "Event abschließen",
        submitMatchResults: "Match-Ergebnisse einreichen",
        submitMatchResultsDescription:
            "Füge einen Match-Link ein, der mit /games/[id] endet. Die App importiert das Scoreboard und speichert Spielerstatistiken.",
        importEvents: "Events importieren",
        importEventsDescription:
            "Füge Event-Links im selben Format wie Match-Ergebnis-Importe ein. Kommas und Zeilenumbrüche werden beide unterstützt.",
        importEventsHint: "{count} Link(s) bereit zum Import.",
        importEventsSuccess:
            "{events} Event(s) und {players} Spielerdatensätze importiert.",
        importEventsPartial:
            "{failed} Link(s) konnten nicht importiert werden.",
        importEventPlayers: "Spieler importieren und abgleichen",
        importEventPlayersDescription:
            "Gleiche importierte HLL-Spieler mit der Datenbank ab, verknüpfe fehlende Plattform-IDs und erstelle bei Bedarf neue Spieler.",
        importEventPlayersHint:
            "Spielernamen werden nach Entfernen des Clan-Tags, Kleinschreibung und Entfernen von Sonderzeichen verglichen.",
        matchLink: "Match-Link",
        matchLinks: "Event-Links",
        matchResultsImported:
            "{players} Spielerdatensätze importiert. Event-Ergebnis: {result}.",
        resultSaved: "gespeichert",
        resultSkipped: "übersprungen",
        resultVictory: "Sieg",
        resultDefeat: "Niederlage",
        resultDraw: "Unentschieden",
        resultColumn: "Ergebnis",
        matchColumn: "Match",
        openMatch: "Match öffnen",
        matchDetailTitle: "Match-Details",
        matchDetailDescription:
            "Roh importiertes Scoreboard, Spielerleistung und Team-Aufschlüsselungen für dieses Event.",
        rawSource: "Quelle",
        importedAt: "Importiert",
        playedAt: "Gespielt",
        duration: "Dauer",
        players: "Spieler",
        score: "Score",
        overviewTab: "Übersicht",
        playersTab: "Spieler",
        weaponsTab: "Waffen",
        killsByTypeTab: "Kills nach Typ",
        noMatchLinked:
            "Noch kein importiertes Match mit diesem Event verknüpft.",
        alliedTeam: "Alliierte",
        axisTeam: "Achse",
        teamUnknown: "Unbekannt",
        topWeapons: "Top-Waffen",
        deathsByWeapon: "Tode durch Waffe",
        playerBreakdowns: "Spieler-Aufschlüsselungen",
        standoutAwards: "Herausragende Auszeichnungen",
        topRivalries: "Top-Rivalitäten",
        encounters: "Begegnungen",
        encountersDescription:
            "Abgeleitet aus importierten Spieler-Aggregaten wie „meist getötet“ und „Tod durch“.",
        killsByWeaponForPlayer: "Kills nach Waffe",
        deathsByWeaponForPlayer: "Tode nach Waffe",
        badges: "Abzeichen",
        killed: "Getötet",
        diedTo: "Gestorben durch",
        plusMinus: "+/-",
        noDerivedData: "Keine abgeleiteten Daten",
        performanceScatter: "Kills vs. Tode",
        rawStats: "Roh-Statistiken",
        concludedSuccess: "Event abgeschlossen",
        trainingCompletionTitle: "Training abschließen",
        trainingCompletionDescription:
            "Lege vor Abschluss des Trainings für jeden anwesenden Teilnehmer ein Bestanden- oder Nicht-bestanden-Ergebnis fest.",
        trainingCompletionEmpty:
            "Derzeit sind keine anwesenden Teilnehmer für dieses Training angemeldet.",
        trainingCompletionSuccess:
            "Training abgeschlossen. Belohnt: {rewarded}. DMs gesendet: {dmed}.",
        trainingPassed: "Bestanden",
        trainingFailed: "Nicht bestanden",
        trainingCompleteAction: "Speichern und abschließen",
        saveHelp:
            "Name und die vier Zeitlinienfelder sind erforderlich. Alles andere ist optional.",
        saveError: "Event konnte nicht gespeichert werden.",
        writeForbidden:
            "Nur Administratoren des Arbeitsbereichs können dieses Event ändern. Melde dich erneut an, falls deine Sitzung abgelaufen ist.",
        notices: {
            announcementsTitle: "Ankündigungs-Channel ist nicht gesetzt",
            announcementsDescription:
                "Event-Ankündigungsnachrichten werden nicht in Discord gepostet oder aktualisiert, bis ein Ankündigungs-Channel für diesen Clan konfiguriert ist.",
            forumTitle: "Forums-Kategorie ist nicht gesetzt",
            forumDescription:
                "Dieses Event soll einen Discord-Forums-Channel erstellen, aber keine Forums-Kategorie ist konfiguriert. Forums-Channel und Briefing-Themen werden übersprungen, bis diese Einstellung ausgefüllt ist.",
            meetingAutomationTitle:
                "Meeting-Sprachautomatisierung ist deaktiviert",
            meetingAutomationDescription:
                "Discord-geplante Events und Roster-Anwesenheitsbestätigung aus dem Meeting-VC hängen beide von der Clan-Meeting-Sprachchannel-Einstellung ab.",
            openClanSettings: "Clan-Einstellungen öffnen",
        },
        statuses: {
            registration: "Anmeldung",
            closed: "Geschlossen",
            starting: "Startet",
            concluded: "Abgeschlossen",
        },
        fields: {
            name: "Name",
            kind: "Typ",
            matchType: "Event-Kategorie",
            description: "Beschreibung",
            thumbnail: "Thumbnail",
            image: "Embed-Bild",
            announcementChannelId: "Event-Anmelde-Channel",
            eventInfoChannelId: "Event-Info-Channel",
            meetingChannelId: "Meeting-VC / Ort",
            server: "Server",
            serverPassword: "Server-Passwort",
            map: "Map",
            mapVariant: "Tageszeit / Wetter",
            mapMode: "Spielmodus",
            mapPresetCode: "Map-Preset-Code",
            side: "Seite",
            capMode: "Mittlerer Cap-Point",
            registrationStart: "Start der Anmeldeankündigung",
            registrationEnd: "Anmeldeschluss",
            meetingStart: "Meeting-Beginn",
            gameStart: "Spielbeginn",
            gameEnd: "Spielende",
            notes: "Notizen",
            stratmaps: "Stratmaps",
            requiredRoleIds: "Erforderliche Rollen-IDs",
            rewardRoleIds: "Belohnungs-Rollen-IDs",
            signupGroupIds: "Sichtbare Anmeldegruppen",
            allowedSignupStatuses: "Erlaubte Anmeldestatus",
            signupReminderStatuses: "Empfänger täglicher Anmeldeerinnerungen",
            useGeneralSignup: "Allgemeine Anmeldung aktivieren",
            allowRankedSignup: "Alternative Gruppen erlauben",
            pingClan: "Clan pingen",
            pingMode: "Ankündigungs-Ping",
            pingRoleIds: "Zu pingende Rollen",
            createForumChannel: "Forums-Channel erstellen",
            createSquadVoiceChannels:
                "Squad-Sprachkanäle beim Meeting-Beginn erstellen",
            squadVoiceCategory:
                "Squad-Sprachkategorie (leer nutzt den Serverstandard)",
            conclusionReserveHelp:
                "Das Event wird 15 Minuten nach dieser Dauer automatisch abgeschlossen.",
        },
        channelRoutingCreateHelp:
            "Startet mit den Clan-Einstellungen als Voreinstellung. Diese Wahl ist nach Erstellung gesperrt, um Discord-Nachrichten stabil zu halten.",
        channelRoutingSharedHelp:
            "Wähle den Anmelde-Channel. Wenn der Event-Info-Channel leer bleibt, wird der Anmelde-Channel für beide Nachrichten genutzt.",
        channelRoutingLockedHelp:
            "Dieses Routing ist nach Erstellung gesperrt, um Discord-Nachrichten-IDs stabil zu halten.",
        pingNone: "Niemanden pingen",
        pingClanOption: "Clan-Rolle pingen",
        pingRolesOption: "Gewählte Rollen pingen",
        quickScheduleTitle: "Schnellplanung",
        quickScheduleDescription:
            "Lege die vier Schlüsselzeiten für dieses Match fest. Du kannst die generierte Zeitlinie jederzeit überarbeiten.",
        registrationHoursBefore:
            "Stunden vor Headcount zum Schließen der Anmeldung",
        meetingMinutesBefore: "Minuten vor Start für das Meeting",
        durationHours: "Dauer (Stunden)",
        durationMinutes: "Match-Dauer (Minuten)",
        quickEventStart: "Match-Startdatum und -zeit",
        applyQuickSchedule: "Zeitplan anwenden",
        quickScheduleApplied: "Zeitplan angewendet.",
        recurringMatch: "Daraus ein wiederkehrendes Match machen",
        recurringMatches: "Wiederkehrende Matches",
        recurringMatchesDescription:
            "Verwalte die Match-Serien, die sich nach Zeitplan wiederholen.",
        noRecurringMatches:
            "Es wurden noch keine wiederkehrenden Matches erstellt.",
        recurrenceHelp:
            "Das erstellte Match ist das erste Match dieser Serie. Seine Details und Zeit werden für künftige Vorkommen genutzt.",
        recurrenceFrequency: "Wiederholen",
        recurrenceWeekly: "Wöchentlich",
        recurrenceMonthlyDate: "Monatlich an einem Datum",
        recurrenceMonthlyNthWeekday: "Monatlich an einem Wochentag",
        recurrenceInterval: "Alle (Intervall)",
        recurrenceWeekdays: "Wochentage",
        recurrenceMonthDay: "Tag des Monats",
        recurrenceNth: "Woche des Monats",
        recurrenceWeekday: "Wochentag",
        editSchedule: "Zeitplan bearbeiten",
        quickScheduleStepLabel: "Schritt {step} von 4",
        wizardBack: "Zurück",
        wizardNext: "Weiter",
        discordPreview: "Discord-Vorschau",
        previewUntitled: "Event ohne Titel",
        previewNoDescription: "Deine Event-Beschreibung erscheint hier.",
        createMatchAction: "Match erstellen",
        createTrainingAction: "Training erstellen",
        recurrenceEditHelp:
            "Schalte die Wiederholung aus, um die Serie zu beenden. Bereits angelegte Matches bleiben.",
    },
    presets: {
        topicTitle: "Themen-Presets",
        topicDescription:
            "Wiederverwendbare Briefing-Themen. Änderungen an der Vorlage ändern keine bestehenden Spiele.",
        squadTitle: "Squad-Presets",
        squadDescription:
            "Wiederverwendbare Squads, Rollen und Plätze für neue Aufstellungen.",
        createTopicTitle: "Themen-Preset erstellen",
        createTopicDescription: "Füge Briefing-Themen und ihre Inhalte hinzu.",
        createSquadTitle: "Squad-Preset erstellen",
        createSquadDescription: "Füge Squads, Rollen und Plätze hinzu.",
        presetDetails: "Preset-Details",
        presetCreateMode:
            "Erstellungsmodus startet direkt im Bearbeitungsmodus.",
        squadPresetPageDescription:
            "Preset-Squads und Rollen, die in Event-Roster kopiert werden können.",
        squadPresetMetaDescription: "Preset-Squad-Struktur für neue Roster.",
        topicPresetMetaDescription:
            "Wiederverwendbare Briefing-Vorlagen, die bei Bedarf in Events kopiert werden.",
        topics: "Themen",
        squadStructure: "Squad-Struktur",
        presetSetup: "Preset-Setup",
        presetSetupDescription: "Squads, Rollen und Plätze.",
        addTopic: "Thema hinzufügen",
        role: "Rolle",
        roleNote: "Rollennotiz",
        addRole: "Rolle hinzufügen",
        squadBlock: "Squad-Block",
        presetName: "Preset-Name",
        topicEditorDescription: "Themennamen und Briefing-Nachrichten.",
        attachmentPlaceholder: "Eine Anhang-URL pro Zeile",
        attachmentCountSuffix: "Anhang/Anhänge",
        newTopic: "Neues Thema",
        newSquad: "Neuer Squad",
        newRole: "Neue Rolle",
        importStarterTemplate: "Start-Vorlage importieren",
        starterTemplateName: "HLL Standard-Aufstellung",
        wowForeverStarterTemplateName: "WoW:F-Schlachtzug für 20 Spieler",
        shortNote: "Notiz",
        untitledPreset: "Unbenanntes Preset",
        topicPresetMetaFallback: "Themen-Preset",
        topicPresetPageDescription:
            "Briefing-Themen zur Wiederverwendung in Spielen.",
        squadPresetMetaFallback: "Squad-Preset",
        fields: {
            name: "Name",
            map: "Map",
            side: "Seite",
            cap: "Cap",
            notes: "Notizen",
        },
        table: {
            preset: "Preset",
            topics: "Themen",
            groups: "Gruppen",
            roleSlots: "Rollen-Slots",
            squads: "Squads",
        },
        emptySquadTitle: "Noch keine Squad-Presets",
        emptySquadAdmin:
            "Ein Squad-Preset ist die Ausgangsform einer Aufstellung: Squads, Rollen und Plätze. Lege eines an, und neue Aufstellungen übernehmen es.",
        emptyTopicTitle: "Noch keine Themen-Presets",
        emptyTopicAdmin:
            "Ein Themen-Preset enthält Briefing-Themen, die ein Match in sein Discord-Forum übernimmt.",
        emptyMember:
            "Die Admins deines Clans haben noch keine Presets angelegt.",
        delete: {
            action: "Preset löschen",
            title: "Preset {name} löschen?",
            squadConsequence:
                "Bestehende Aufstellungen behalten ihre Squads. Neue Aufstellungen können nicht mehr mit diesem Preset starten.",
            topicConsequence:
                "Abgeschlossene Matches behalten die bereits geposteten Themen. Ein nicht abgeschlossenes Match, das dieses Preset nutzt, verhindert das Löschen.",
            confirm: "Löschen",
            done: "Preset gelöscht.",
            inUse: "Offene Matches, die dieses Preset noch nutzen: {count}. Wähle dort zuerst ein anderes.",
            forbidden:
                "Nur Clan-Admins können Presets löschen. Melde dich neu an, falls deine Sitzung abgelaufen ist.",
            failed: "Das Preset konnte nicht gelöscht werden.",
        },
    },
    groups: {
        title: "Gruppen",
        manageAction: "Gruppen verwalten",
        refreshAction: "Gruppen aktualisieren",
        newTab: "öffnet sich in einem neuen Tab",
        refreshFailed:
            "Die Gruppen konnten nicht geladen werden. Speichere deine Änderungen und lade die Seite neu.",
        description:
            "Gruppen sind wiederverwendbare Clan-Spezialisierungen für Spieler und Squad-Presets. Roster kopieren die Namen, damit ältere Events intakt bleiben.",
        createTitle: "Gruppe erstellen",
        createDescription:
            "Erstelle eine wiederverwendbare Clan-Spezialisierung mit Farbe und Kurzbeschreibung.",
        name: "Gruppenname",
        color: "Farbe",
        descriptionLabel: "Beschreibung",
        order: "Reihenfolge",
        parent: "Übergeordnete Gruppe",
        none: "Keine",
        reset: "Hilfsdaten zurücksetzen",
        initialize: "Standard-Presets importieren",
        resetConfirm:
            "Dies löscht Gruppen, Squad-Presets und Themen-Presets für diesen Clan. Events, Roster und Spieler bleiben erhalten. Fortfahren?",
        initializeConfirm:
            "Dies setzt Gruppen, Squad-Presets und Themen-Presets zurück und erstellt dann das Standard-Gruppen-Preset und das Start-Squad-Preset neu. Fortfahren?",
        resetSuccess: "Hilfsdaten-Reset abgeschlossen.",
        initializeSuccess: "Standard-Presets importiert.",
        usedByPlayers: "Primäre Spieler",
        starterDescription:
            "Start-Clan-Spezialisierungen abgestimmt auf das Standard-HLL-Squad-Setup.",
        created: "Gruppe erstellt.",
        saved: "Gruppe gespeichert.",
        saveFailed:
            "Die Gruppe konnte nicht gespeichert werden. Versuch es noch einmal.",
        duplicateName: "Eine Gruppe mit diesem Namen gibt es schon.",
        deleteAction: "Gruppe löschen",
        deleteTitle: "Gruppe „{name}“ löschen?",
        deleteDescription:
            "Spieler verlieren diese Gruppe. Roster und vergangene Events behalten den kopierten Gruppennamen. Das lässt sich nicht rückgängig machen.",
        deleteImpact:
            "{primary} Spieler haben sie als Hauptgruppe und {secondary} als zusätzliche Gruppe.",
        deleted: "Gruppe gelöscht.",
        deleteFailed:
            "Die Gruppe konnte nicht gelöscht werden. Versuch es noch einmal.",
        emptyTitle: "Noch keine Gruppen",
        emptyDescription:
            "Gruppen sind Clan-Spezialisierungen wie Panzerfahrer oder Kommandeure. Squad-Presets und Spieler nutzen sie.",
    },
} as const
