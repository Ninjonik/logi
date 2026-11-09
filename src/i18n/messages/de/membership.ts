export const membershipMessages = {
    ticketSettings: {
        questionsTitle: "Fragen im Formular",
        questionsCount: "{count} von {max}",
        edit: "Bearbeiten",
        doneEditing: "Fertig",
        removeQuestion: "Frage entfernen",
        requiredShort: "Pflicht",
        optionalShort: "optional",
        untitledQuestion: "Frage ohne Titel",
        noQuestionsShort:
            "Keine Fragen: Der Thread öffnet sich direkt nach dem Klick.",
        enabledLabel: "An",
        enabledAria: "Tickets an",
        flowLabel: "So läuft ein Ticket ab",
        flow: {
            pick: "Ein Mitglied wählt eine Kategorie im Panel",
            form: "Füllt ein kurzes Formular aus",
            thread: "Ein privater Thread mit dem Support öffnet sich",
            close: "Der Support schließt ihn und die Person bekommt eine DM",
        },
        panelSection: "Panel",
        panelChannel: "Kanal mit dem Panel",
        threadChannel: "Wo Threads entstehen",
        threadChannelHint:
            "Der Bot muss hier private Threads erstellen können.",
        threadChannelOk: "Der Bot kann hier private Threads anlegen",
        categoriesShort: "Kategorien",
        categoriesEditorNote: "Jede Kategorie ist ein Button im Panel.",
        headingLabel: "Überschrift",
        textLabel: "Text",
        imageOptional: "optional",
        previewTitle: "Vorschau in Discord",
        panelColor: "Panelfarbe",
        panelColorHint: "Leer = Clanfarbe. Hex, z. B. #E8A33D.",
        panelColorInvalid: "Die Farbe muss hex sein, z. B. #E8A33D.",
        threadTitle: "Titel der Karte im Thread",
        threadTitlePlaceholder: "{author} meldet einen Spieler",
        threadTitleHint:
            "{author} ist der Name des Autors, {category} die Kategorie. Leer ergibt „{author} · {category}“.",
        columns: {
            button: "Button",
            handledBy: "Wer antwortet",
            questions: "Fragen",
            actions: "Aktionen",
        },
        nobodyAdmins: "niemand, nur Logi-Administratoren",
        removeCategory: "Kategorie entfernen",
        untitledCategory: "Kategorie ohne Titel",
        noCategoriesDescription:
            "Jede Kategorie wird ein Button im Panel, zum Beispiel Spieler melden oder Problem mit dem Bot.",
        saveNote: "Speichert die Ticket-Einstellungen.",
        saveAndRefresh: "Speichern und Panel aktualisieren",
        discard: "Verwerfen",
        unsaved: "Ungespeicherte Änderungen",
        title: "Ticket-Einstellungen",
        pageDescription:
            "Konfiguriere Ticket-Panel, Kategorien, Staff-Rollen und Modal-Fragen für Discord-Tickets.",
        enableTitle: "Ticket-System aktivieren",
        enableDescription:
            "Poste ein konfigurierbares Ticket-Panel in Discord und öffne private Ticket-Threads über seine Kategorie-Buttons.",
        submitChannel: "Ticket-Channel einreichen",
        parentChannel: "Ticket-Thread-Eltern-Channel",
        panelTitle: "Panel-Embed-Titel",
        panelDescription: "Panel-Embed-Beschreibung",
        panelDescriptionPlaceholder:
            "Erkläre, wie Mitglieder dieses Ticket-Panel nutzen sollen.",
        image: "Thumbnail-Bild",
        embedLimitNotice: "Der Paneltext in Discord nutzt derzeit",
        embedLimitExceeded:
            "(zu lang, kürze einige Kategoriebeschreibungen vor dem Speichern).",
        categoriesTitle: "Ticket-Kategorien",
        categoriesDescription:
            "Jede Kategorie wird ein Button und kann optional vor Erstellung des Ticket-Threads ein Discord-Modal öffnen.",
        addCategory: "Kategorie hinzufügen",
        categoryLabel: "Kategorie",
        buttonText: "Button-Text",
        buttonTextPlaceholder: "Spieler melden",
        emoji: "Emoji",
        pickServerEmoji: "Server-Emoji wählen",
        typeAnyEmoji: "oder ein beliebiges Emoji tippen",
        categoryDescription: "Beschreibung",
        categoryDescriptionPlaceholder:
            "Steht im Panel hinter dem Kategorienamen, z. B. „Verhalten auf dem Server“.",
        supportRoles: "Support-Rollen für dieses Ticket",
        modalQuestions: "Modal-Fragen",
        modalQuestionsDescription:
            "Discord unterstützt bis zu 5 Texteingaben pro Modal.",
        addQuestion: "Frage hinzufügen",
        questionLabel: "Frage",
        questionText: "Frage-Label",
        questionTextPlaceholder: "Was ist passiert?",
        inputStyle: "Eingabestil",
        shortInput: "Kurz",
        paragraphInput: "Absatz",
        placeholder: "Platzhalter",
        required: "Erforderlich",
        noQuestions:
            "Noch keine Modal-Fragen. Wenn du dies leer lässt, erstellt der Button-Klick sofort das Ticket.",
        noCategories: "Noch keine Ticket-Kategorien.",
        defaultPanelTitle: "Brauchst du Hilfe?",
        defaultPanelDescription:
            "Wähle, wobei du Hilfe brauchst. Es öffnet sich ein privater Thread, den nur du und die Admins sehen.",
        incompleteTitle: "Ticket-Panel-Setup ist unvollständig",
        incompleteDescription:
            "Das Ticket-System ist aktiviert, aber das Discord-Ticket-Panel wird nicht gepostet und Ticket-Threads können nicht geöffnet werden, bis du fertigstellst: {items}.",
        routingInfoTitle: "So funktioniert Ticket-Routing",
        routingInfoDescription:
            "Kategorie-Support-Rollen werden automatisch in neue Ticket-Threads eingeladen. Dashboard-Administratoren können Tickets verwalten, werden aber nicht jedem Thread hinzugefügt.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Logi-ID (Discord nicht verknüpft)",
        title: "Änderungen der Mitgliedsrollen",
        refresh: "Aktualisieren",
        loading: "Laden…",
        description:
            "Die letzten 100 Verwaltungs- oder Bewerbungsvorgänge für alle Spiele. Das Speichern stellt eine Änderung in die Warteschlange; erst die Discord-Prüfung bestätigt sie. Abgelehnte, ersetzte und fehlgeschlagene Vorgänge werden 30 Tage nach ihrem Ende gelöscht.",
        error: "Rollenvorgänge sind nicht verfügbar. Bitte erneut aktualisieren.",
        empty: "Noch keine Änderungen verwalteter Rollen.",
        target: "Discord-ID des Mitglieds",
        actor: "Discord-ID des Auftraggebers",
        origin: "Quelle",
        version: "Version",
        updated: "Aktualisiert",
        audit: "Versuchsverlauf",
        auditDescription:
            "Die letzten 5 Versuche werden angezeigt; maximal 20 je Vorgang gespeichert. Eine tägliche Prüfung, die die Rollen bestätigt, fügt keinen Versuch hinzu. Zeiten in UTC. Grundcodes helfen bei der Fehlerdiagnose.",
        reason: "Grund",
        status: {
            pending: "Ausstehend",
            running: "In Bearbeitung",
            retry_scheduled: "Wiederholung geplant",
            applied: "Angewendet",
            denied: "Abgelehnt",
            superseded: "Ersetzt",
            failed: "Fehlgeschlagen",
        },
        provenance: {
            dashboard: "Administrator",
            recruitment: "Rekrutierungsteam",
            application: "Mitgliedsbewerbung",
            rollback: "Bewerbung zurückgenommen",
        },
        hint: {
            pending: "Der Bot prüft vor der Rollenänderung die Berechtigungen.",
            running:
                "Der Bot prüft Discord und bearbeitet den aktuellen Auftrag.",
            retry_scheduled:
                "Der Bot wiederholt den Versuch nach der Wartezeit automatisch.",
            applied:
                "Die Discord-Rollen entsprachen beim letzten Prüfen dem Auftrag. Der Bot prüft einmal täglich erneut.",
            denied: "Zugang des Auftraggebers, Mitgliedschaft, Bot-Rechte und Rollenhierarchie prüfen, dann einen neuen Mitgliedsauftrag speichern.",
            superseded:
                "Zuweisung oder Regeln wurden geändert. Der neue Zustand benötigt einen neuen berechtigten Auftrag.",
            failed: "Automatische Versuche wurden beendet. Ursache beheben und einen neuen Mitgliedsauftrag speichern.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "Clan-Rolle fehlt",
        applicationsTitle: "Beitrittsanfragen",
        applicationsChannel: "Der Bewerben-Button in #{channel}",
        applicationsNoChannel:
            "Wähle den Kanal für das Panel unter Panel und Threads.",
        roleSyncToggleTitle: "Rollen-Synchronisierung",
        roleSyncToggleDescription:
            "Logi vergibt und entzieht Rollen nach dem Status des Mitglieds. Sie wird zusammen mit den Beitrittsanfragen ein- und ausgeschaltet.",
        roleSyncOn: "An",
        roleSyncOff: "Aus",
        roleSyncSwitchDescription:
            "Logi vergibt und entzieht Rollen nach dem Mitgliedsstatus. Das funktioniert auch, wenn Bewerbungen ausgeschaltet sind.",
        skipPendingCategoryTitle:
            "Warten überspringen und direkt als Rekrut aufnehmen",
        skipPendingCategoryHelp: "Nur für Hauptmitglieder.",
        categoryDescriptionHelp:
            "Im Panel steht sie nach Name und Spiel, in Fenster 1 unter dem Namen der Kategorie.",
        addRole: "Rolle",
        addRoleAria: "Rolle hinzufügen: {status}",
        removeRole: "Rolle {role} entfernen",
        roleSearch: "Rolle suchen",
        roleEmpty: "Keine weitere Rolle.",
        tabsLabel: "Bereiche der Mitgliedschaft",
        tabs: {
            categories: "Kategorien",
            panel: "Panel und Threads",
            scores: "Punkte für Anwesenheit",
            roleChanges: "Rollenänderungen",
        },
        categoryButtonTitle: "Im Panel und in Fenster 1",
        categoryText: "Name",
        categoryDescriptionLabel: "Beschreibung",
        resultTitle: "Nach der Aufnahme wird der Spieler",
        rolesByStatus: "Rollen nach Status",
        statusPending: "Wartet auf Entscheidung",
        statusRecruit: "Rekrut",
        noRoles: "keine Rollen",
        includeClanRoleTitle: "Clan-Rolle geben",
        includeClanRoleRecruitHelp:
            "Gibt die Clan-Rolle, solange diese Kategorie Rekrut ist.",
        includeClanRoleFinalHelp:
            "Gibt die Clan-Rolle nach der Aufnahme dieser Kategorie, auch Söldnern.",
        handledBy: "Wer Anfragen bearbeitet",
        handledByAdmins: "und Logi-Administratoren",
        clanRoleNote:
            "{role} ist die Clan-Rolle aus Rollen und Zugriff. Unten wird sie für jede Kategorie und jeden Status getrennt eingestellt.",
        clanRoleMissingNote:
            "Die Clan-Rolle ist noch nicht gesetzt. Wähle sie unter Rollen und Zugriff; sie gilt für jede Kategorie.",
        clanRoleLink: "Rollen und Zugriff öffnen",
        missingFinalRole: "endgültige Rolle fehlt",
        missingRecruitRole: "Rekrutenrolle fehlt",
        removeCategory: "Kategorie entfernen",
        noCategoriesDescription:
            "Jede Kategorie ist eine Option in der Bewerbung, zum Beispiel Hauptmitglied, Reserve oder Söldner.",
        rolePlaceholder: "Rolle hinzufügen",
        saveNote: "Speichert die Mitgliedschaftseinstellungen.",
        discard: "Verwerfen",
        saveShort: "Speichern",
        unsaved: "Ungespeicherte Änderungen",
        title: "Mitgliedschaftseinstellungen",
        pageDescription:
            "Konfiguriere das Discord-Bewerbungs-Embed, erforderliche Bewerbungskategorien und Standardzuweisung für neue Clan-Mitglieder.",
        enableTitle: "Mitgliedsbewerbungen aktivieren",
        enableDescription:
            "Poste ein Clan-Bewerbungs-Embed in Discord und öffne Staff-verwaltete private Threads daraus.",
        submitChannel: "Embed-Channel einreichen",
        parentChannel: "Bewerbungs-Thread-Eltern",
        skipPendingTitle: "Pending-Phase überspringen",
        skipPendingDescription:
            "Neue Mitgliederbewerbungen starten sofort nach Einreichung als Rekruten.",
        inviteSupportMembersIndividuallyTitle:
            "Mitglieder der Support-Rolle einzeln hinzufügen",
        inviteSupportMembersIndividuallyDescription:
            "Ein: Logi fügt alle mit den Support-Rollen der Kategorie einzeln zum Thread jeder Bewerbung hinzu. Aus: Logi fügt sie nicht hinzu, und sie kommen nur über die Erwähnung ihrer Support-Rolle in den Thread; Discord macht das nur bei Rollen mit weniger als 100 Mitgliedern. Logi-Admins können Bewerbungen in Logi bearbeiten, ohne im Thread zu sein.",
        panelTitle: "Panel-Titel",
        panelDescription: "Panel-Beschreibung",
        welcomeMessage: "Begrüßungsnachricht im Bewerbungs-Thread",
        welcomeMessageDescription:
            "Wird über der Bewerbungsübersicht in jedem privaten Thread gepostet. Verwende {applicant}, {support_roles} und {category} für Discord-Erwähnungen und die gewählte Kategorie.",
        welcomeMessagePlaceholder:
            "Hallo {applicant}, danke für deine Bewerbung. {support_roles} meldet sich in Kürze.",
        image: "Thumbnail-Bild",
        applicationThumbnail: "Bewerbungs-Thumbnail",
        specializationTitle: "Spezialisierung abfragen",
        specializationDescription:
            "Zeigt Infanterie und Panzer als Schritt im Discord-Bewerbungsassistenten. Bei Wardogs wird dieser Schritt nie angezeigt.",
        categoryGame: "Spiel",
        categoryDetails: "Kategorie-Details",
        categoryRoles: "Rollen und Zugriff",
        categoryRolesDescription:
            "Wähle die Rollen, die Logi nach der Genehmigung verwaltet, und das Team mit Zugriff auf den Bewerbungs-Thread.",
        categoriesTitle: "Bewerbungskategorien",
        categoriesDescription:
            "Jede Kategorie wird ein Button. Modal-Fragen sind optional und folgen demselben Muster wie Tickets.",
        addCategory: "Kategorie hinzufügen",
        buttonLabel: "Button-Label",
        applicationResult: "Bewerbungsergebnis",
        recruitRole: "Rekruten-Rolle für diese Kategorie",
        recruitRolePlaceholder: "Rekruten-Rolle",
        finalRole: "Finale Rolle für diese Kategorie",
        finalRolePlaceholder: "Finale Rolle",
        modalQuestionsDescription: "Bis zu 5 Textfelder.",
        noQuestions:
            "Noch keine Modal-Fragen. Leer lassen, wenn die Kategorie den Thread sofort nach dem Precheck öffnen soll.",
        noCategories: "Noch keine Bewerbungskategorien.",
        embedFieldUsage: "Embed-Feldnutzung: {length} / {max}",
        embedFieldTooLong:
            "(zu lang, kürze Kategoriebeschreibungen vor dem Speichern)",
        incompleteTitle: "Mitglieds-Panel-Setup ist unvollständig",
        incompleteDescription:
            "Bewerbungen sind aktiviert, aber das Discord-Mitglieds-Panel wird nicht gepostet und Bewerbungs-Threads können nicht geöffnet werden, bis du {items} setzt.",
        roleSyncTitle: "So funktioniert Mitglieds-Rollen-Sync",
        roleSyncDescription:
            "Ausstehende Bewerbungen weisen keine Mitgliedsrollen zu. Rekruten-Status nutzt die Clan-Rolle plus die Kategorie-Rekruten-Rolle, und Aktiv-Status nutzt die Clan-Rolle plus die Kategorie-Finalrolle, wenn diese Rollen konfiguriert sind. Mitgliedsrollen werden über eine Warteschlange geändert; das Ergebnis steht in den Mitgliedschaftseinstellungen unter Rollenvorgänge.",
        rosterScoreDescription:
            "Lege Score-Änderungen pro Server nach Event-Abschluss fest. Alles auf 0 lassen deaktiviert automatische Score-Bewegung.",
        rosterScoreNoCategory: "Keine Kategorie / keine Reaktion",
        rosterScorePresentRoster: "Reagiert und im Roster anwesend",
        rosterScorePresentReserve: "Reagiert und in Reserven anwesend",
        rosterScoreAbsentRoster: "Reagiert und im Roster abwesend",
        rosterScoreAbsentReserve: "Reagiert und in Reserven abwesend",
        rosterScoreExcusedAbsence: "Reagiert, abwesend, aber entschuldigt",
        rolesMissingTitle: "Manche Mitgliedsrollen sind nicht konfiguriert",
        rolesMissingClanRole: "Die Basis-Clan-Rolle ist nicht gesetzt. ",
        rolesMissingRecruitRole: "Rekrutenrolle fehlt: {categories}. ",
        rolesMissingFinalRole: "Endgültige Rolle fehlt: {categories}. ",
        rolesMissingSummary:
            "In diesen Fällen verfolgt Logi den Bewerbungsstatus weiter, aber Discord-Rollenänderungen werden teilweise oder gar nicht durchgeführt.",
        save: "Mitgliedschaftseinstellungen speichern",
        saved: "Mitgliedschaftseinstellungen gespeichert.",
        saveError:
            "Mitgliedschaftseinstellungen konnten nicht gespeichert werden.",
    },
    userManagement: {
        previousPage: "Zurück",
        nextPage: "Weiter",
        canAddMemberOrMercenary:
            "Kann als Mitglied, Reservemitglied oder Söldner hinzugefügt werden.",
        mercenaryOnly:
            "Gehört bereits einem anderen Clan an; kann nur als Söldner hinzugefügt werden.",
        missingPlayerLink:
            "Spieler fehlt? Bitte ihn, /link in Discord auszuführen, um sich bei Logi zu registrieren. Bereits zugewiesene Spieler werden ausgeblendet.",
        missingPlayerApplication:
            "Er kann auch eine Clanmitgliedschaft beantragen.",

        grantAdminAccess: "Zum Admin machen",
        removeAdminAccess: "Admin-Zugriff entziehen",
        adminAccessGranted: "Spieler ist jetzt Admin.",
        adminAccessRemoved: "Spieler-Admin-Zugriff entfernt.",
        recheckDisplayName: "Anzeigenamen prüfen",
        recheckingDisplayName: "Anzeigename wird geprüft…",
        displayNameUpdated: "Anzeigename aktualisiert.",
        displayNameUnchanged: "Anzeigename ist bereits aktuell.",
        displayNameRecheckFailed:
            "Anzeigename konnte nicht geprüft werden. Prüfe, ob der Spieler auf dem Discord-Server ist und der Bot auf ihn zugreifen kann.",
        adminAccessUpdateFailed:
            "Spieler-Admin-Zugriff konnte nicht aktualisiert werden.",
        title: "Spieler",
        description: "Verwalte Clanmitglieder und Söldner.",
        addMember: "Als Mitglied hinzufügen",
        addReserveMember: "Als Reservemitglied hinzufügen",
        addMerc: "Als Mercenary hinzufügen",
        removeMember: "Mitglied entfernen",
        removeMerc: "Mercenary entfernen",
        memberLabel: "Hauptmitglied",
        reserveMemberLabel: "Reservemitglied",
        mercLabel: "Mercenary",
        eligibleMembers: "Für Mitglied geeignet",
        eligibleMercs: "Für Mercenary geeignet",
        blocked: "Nicht geeignet",
        searchPlaceholder: "Discord-Name, Server-Anzeigename oder Discord-ID",
        noResults: "Keine passenden Spieler im System gefunden.",
        rulesTitle: "Zuweisungsregeln",
        rulesMember:
            "Ein Spieler kann nur Hauptmitglied werden, wenn er nicht bereits zu einem anderen Haupt-Clan gehört.",
        rulesMerc:
            "Ein Spieler kann Mercenary für andere Clans sein, aber nicht gleichzeitig Mitglied und Mercenary im selben Clan.",
        rulesSystem:
            "Die Suche findet Spieler mit einem bestehenden Logi-Konto.",
        tablePlayer: "Spieler",
        tableType: "Typ",
        tableGroup: "Gruppe",
        tableStatus: "Status",
        tableScore: "Score",
        platformId: "Plattform-ID",
        playerNote: "Spielernotiz",
        platformNotConnected: "Plattform-ID nicht gesetzt",
        platformConnectedAs: "Plattform-ID gesetzt als {platformId}",
        platformIdNoSpaces: "Plattform-ID darf keine Leerzeichen enthalten.",
        platformAlreadyLinked:
            "Diese Plattform-ID ist bereits mit einem anderen Spieler verknüpft.",
        paused: "Pausiert",
        active: "Aktiv",
        membershipStatus: "Mitgliedsstatus",
        pendingLabel: "Ausstehend",
        recruitLabel: "Rekrut",
        addPlayer: "Spieler hinzufügen",
        autoLinkPlatformIds: "Plattform-IDs automatisch verknüpfen",
        autoLinkPlatformIdsDescription:
            "Durchsuche importierte Event-Scoreboards, entferne deinen Clan-Tag aus Spielernamen und fülle passende Plattform-IDs automatisch aus.",
        autoLinkPlatformIdsHint:
            "Gib den Clan-Tag genau so ein, wie er vor Spielernamen in importierten Events erscheint. Beispiel: VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "{linked} Plattform-IDs aus {players} passenden Spielereinträgen verknüpft.",
        autoLinkPlatformIdsPartial:
            "Manche Ergebnisse übersprungen: {ambiguous} mehrdeutig, {conflicts} Konflikte, {failed} fehlgeschlagene Events.",
        dedupePlayerStats: "Spielerstatistiken deduplizieren",
        dedupePlayerStatsDescription:
            "Entferne doppelte importierte Match-Zeilen für Events dieses Clans und behalte möglichst die bessere Nicht-Unbekannt-Kopie.",
        dedupePlayerStatsHint:
            "Dies bereinigt nur importierte Spielerstatistiken für Events dieses Clans. Matches anderer Clans werden nicht berührt.",
        dedupePlayerStatsSuccess:
            "{matches} doppelte Match-Zeilen bei {users} Spielern entfernt.",
        refreshPerformanceHistory: "Clan- & Spielerstatistiken aktualisieren",
        refreshPerformanceHistorySuccess:
            "Clan- und Spielerstatistiken aktualisiert.",
        refreshPerformanceHistoryError:
            "Clan- und Spielerstatistiken konnten nicht aktualisiert werden.",
        mergeUsers: "Nutzer zusammenführen",
        mergeUsersDescription:
            "Führe zwei Konten vollständig zusammen. Das primäre Konto gewinnt bei überlappenden Daten.",
        mergeUsersPrimary: "Primäres Konto",
        mergeUsersSecondary: "Sekundäres Konto",
        mergeUsersPickPrimary: "Wähle das zu behaltende Konto",
        mergeUsersPickSecondary: "Wähle das hineinzuführende Konto",
        mergeUsersHint:
            "Dies schreibt Spielerstatistiken, importierte Matches, Zuweisungen, Roster und eingebettete Event-Referenzen auf das primäre Konto um.",
        mergeUsersConfirm: "Konten zusammenführen",
        mergeUsersSuccess: "Konten zusammengeführt.",
        clanTag: "Clan-Tag",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Discord-Mitglieder importieren",
        importDiscordMembersDescription:
            "Importiere alle mit einer gewählten Discord-Rolle in die Spielerverwaltung.",
        importDiscordMembersHint:
            "Importierte Spieler erhalten keine primäre Gruppe. Passende Discord-pflichtige Gruppenrollen werden als sekundäre Gruppen hinzugefügt.",
        membershipMigration: "Mitgliedschaft per Rolle migrieren",
        membershipMigrationDescription:
            "Wähle eine Discord-Rolle und den Mitgliedsstatus, auf den sie für bestehende Clan-Zuweisungen abgebildet werden soll.",
        membershipMigrationTarget: "Ziel-Mitgliedsstatus",
        membershipMigrationHint:
            "Nur bereits in diesem Clan zugewiesene Spieler werden aktualisiert. Nicht zugewiesene Discord-Mitglieder werden übersprungen.",
        membershipMigrationSuccess:
            "{updated} Spieler auf {status} aktualisiert.",
        membershipMigrationSkippedUnassigned:
            "{count} Discord-Mitglieder ohne Clan-Zuweisung übersprungen.",
        membershipMigrationSkippedUnchanged:
            "{count} Spieler bereits in diesem Mitgliedsstatus übersprungen.",
        linkMissingDiscordIds: "Fehlende Discord-IDs verknüpfen",
        linkMissingDiscordIdsDescription:
            "Gleiche importierte Spieler ohne Discord-IDs mit Mitgliedern einer gewählten Discord-Rolle ab.",
        linkMissingDiscordIdsHint:
            "Namen werden vor dem Abgleich normalisiert und das erste passende Discord-Mitglied wird verknüpft.",
        linkMissingDiscordIdsSuccess:
            "{linked} importierte Spieler aus {scanned} Kandidaten verknüpft.",
        linkMissingDiscordIdsMerged:
            "{count} importierte Spielerdatensätze in bestehende Discord-verknüpfte Nutzer zusammengeführt.",
        discordSourceRole: "Discord-Quellrolle",
        discordImportSuccess:
            "{players} Spieler aus {matched} passenden Discord-Mitgliedern importiert.",
        discordImportSkipped:
            "{count} passende Discord-Mitglieder wurden übersprungen, weil sie mit dem gewählten Zuweisungstyp nicht importiert werden konnten.",
        editAssignment: "Zuweisung bearbeiten",
        playerSearch: "Spielersuche",
        assignmentType: "Zuweisungstyp",
        primaryGroup: "Primäre Gruppe",
        secondaryGroups: "Sekundäre Gruppen",
        noGroup: "Keine primäre Gruppe",
        noSecondaryGroups: "Keine sekundären Gruppen",
        pauseMembership: "Mitgliedschaft pausieren",
        pauseHelp:
            "Nutze dies für Inaktivität oder vorübergehende Abwesenheit.",
        pauseNote: "Pausennotiz",
        pauseNoteRequired:
            "Füge eine Pausennotiz hinzu, wenn die Mitgliedschaft pausiert ist.",
        pickPlayerFirst: "Wähle zuerst einen Spieler aus der System-Suchliste.",
        currentAssignment: "Aktuelle Zuweisung",
        mainClan: "Haupt-Clan",
        none: "Keine",
        assignmentDescription:
            "Bearbeite Zuweisungstyp, Gruppe, pausierten Mitgliedsstatus oder entferne den Spieler aus diesem Clan.",
        assignmentMetaDescription:
            "Bearbeite Clan-Mitgliedschaft, Mercenary-Rolle, Gruppe und Pausenstatus.",
        assignmentTitleSuffix: "Zuweisung",
        averageDescription: "Durchschnitt über die letzten {count} Matches.",
        storedAverageDescription:
            "Durchschnitt über {count} importierte Matches.",
        averageKills: "Ø Kills",
        averageKd: "Ø K/D",
        averageDeaths: "Ø Tode",
        averageOffense: "Ø Offense",
        averageDefense: "Ø Defense",
        averageSupport: "Ø Support",
        matchKills: "Kills",
        matchKd: "K/D",
        matchDeaths: "Tode",
        matchOffense: "Offense",
        matchDefense: "Defense",
        matchSupport: "Support",
        matchHistorySearch: "Match-Historie suchen...",
        matchHistoryEvent: "Event",
        matchHistoryPlayedAt: "Gespielt",
        removePlayerFromClan: "Entferne den Spieler aus diesem Clan.",
        removePlayerConfirm:
            "Diesen Spieler aus dem Clan entfernen? Dies löscht seine Zuweisung.",
        saveError: "Spielerzuweisung konnte nicht gespeichert werden.",
        deleteError: "Spielerzuweisung konnte nicht gelöscht werden.",
        assignmentSaved: "Spielerzuweisung gespeichert.",
        assignmentCreated: "Spielerzuweisung erstellt.",
        assignmentDeleted: "Spielerzuweisung gelöscht.",
        primaryGroupRequired: "Wähle vor dem Speichern eine primäre Gruppe.",
        alreadyAssigned: "Dieser Spieler ist diesem Clan bereits zugewiesen.",
        mercenaryRecruitStatusError:
            "Mercenaries können den Rekruten-Status nicht nutzen.",
        reserveMemberRecruitStatusError:
            "Reservemitglieder können den Rekruten-Status nicht nutzen.",
        roleSyncTitle: "So funktioniert Mitglieds-Rollen-Sync",
        roleSyncDescription:
            "Gruppenverknüpfte Discord-Rollen syncen aus den gewählten primären und sekundären Gruppen. Mitgliedsrollen syncen nur für nicht-ausstehende Mitglieder, und Rekruten- oder Aktiv-Status hängt von Clan-Rolle plus verknüpften Mitglieds-Kategorierollen ab, wenn verfügbar. Mitgliedsrollen werden über eine Warteschlange geändert; das Ergebnis steht in den Mitgliedschaftseinstellungen unter Rollenvorgänge.",
        missingClanRoleTitle: "Clan-Rolle ist nicht konfiguriert",
        missingClanRoleDescription:
            "Dieser Spieler kann in Logi weiterhin als Rekrut oder aktiv markiert werden, aber in Discord wird keine Basis-Clan-Rolle hinzugefügt, bis die Clan-Rolle in den Clan-Einstellungen gesetzt ist.",
        missingMembershipCategoryTitle:
            "Diese Zuweisung ist mit keiner Mitglieds-Kategorie verknüpft",
        missingMembershipCategoryDescription:
            "Rekruten- und Final-Kategorierollen können für manuelle Zuweisungen ohne verknüpfte Mitglieds-Bewerbungskategorie nicht gesynct werden. In Discord können nur Clan-Rolle und gruppenverknüpfte Rollen angewendet werden.",
        missingCategoryRolesTitle:
            "Mitglieds-Kategorierollen sind unvollständig",
        missingRecruitRoleDescription:
            "Diese Kategorie hat keine Rekruten-Rolle konfiguriert. ",
        missingFinalRoleDescription:
            "Diese Kategorie hat keine finale Rolle konfiguriert. ",
        missingCategoryRolesSummary:
            "Logi behält den Mitgliedsstatus hier, aber die passende Discord-Rolle wird für diese Stufe nicht hinzugefügt.",
        platformIdsHint:
            "Trenne mehrere IDs mit Kommas. Eine Steam-ID hat 17 Ziffern und beginnt mit 7656119; schreib Xbox- und PlayStation-IDs als xbox:… oder psn:….",
        platformIdsInvalid:
            "Korrigiere die markierten Plattform-IDs vor dem Speichern.",
        platformIssues: {
            steam_format:
                "Keine Steam-ID: Sie muss 17 Ziffern haben und mit 7656119 beginnen.",
            epic_format: "Keine Epic-Games-ID.",
            too_long: "Zu lang für eine Plattform-ID.",
            duplicate: "Doppelt angegeben; wird einmal gespeichert.",
            linked_elsewhere: "Bereits mit {name} verknüpft.",
        },
        grantAdminTitle: "{name} zum Admin machen?",
        grantAdminDescription:
            "{name} kann dann im Logi-Dashboard die Einstellungen, Matches, Roster und Mitglieder dieses Clans ändern. Du kannst den Zugriff später wieder entfernen.",
        removeAdminTitle: "{name} den Admin-Zugriff entziehen?",
        removeAdminDescription:
            "{name} bleibt im Clan, kann ihn aber nicht mehr im Dashboard verwalten, außer eine Discord-Rolle gewährt weiterhin Zugriff.",
        removePlayerTitle: "{name} aus dem Clan entfernen?",
        removePlayerDescription:
            "Zuordnung, Gruppen und Mitgliedsstatus in diesem Clan werden gelöscht, und Logi entfernt die von ihm verwalteten Discord-Rollen. Der Match-Verlauf bleibt.",
    },
} as const
