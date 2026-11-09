export const teamsMessages = {
    teams: {
        title: "Teams",
        description:
            "Wähle Teams für Spiele aus, beantrage ein fehlendes Team oder schlage eine Änderung vor.",
        cancel: "Abbrechen",
        name: "Name",
        shortCode: "Kürzel",
        shortCodeHelp:
            "Optional, bis zu 16 Zeichen; wird angezeigt, wo wenig Platz ist.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG oder WebP bis 2 MiB. Das Bild wird auf ein Quadrat von 512×512 normalisiert.",
        upload: "Logo hochladen",
        uploading: "Wird hochgeladen…",
        removeLogo: "Logo entfernen",
        search: "Teams suchen…",
        loadMore: "Mehr laden",
        archivedBadge: "Archiviert",
        empty: "Der Katalog enthält für dieses Spiel noch keine Teams.",
        emptySearch: "Keine Teams entsprechen dieser Suche.",
        loading: "Teams werden geladen…",
        notAvailableForGame:
            "Der Teamkatalog ist für dieses Spiel nicht verfügbar.",
        gameDisabled:
            "Dieses Spiel ist in diesem Arbeitsbereich nicht aktiviert. Du kannst Teams durchsuchen und beantragen, in Matches lassen sie sich aber erst verwenden, wenn das Spiel in den Clan-Einstellungen aktiviert ist.",
        retry: "Erneut versuchen",
        requestNew: "Neues Team beantragen",
        suggestChange: "Änderung vorschlagen",
        suggestChangeTeam: "Änderung für {name} vorschlagen",
        teamLinks: "Links von {name}",
        errors: {
            invalid_team: "Prüfe die Teamangaben und versuche es erneut.",
            game_disabled:
                "Dieses Spiel ist für den Arbeitsbereich nicht aktiviert.",
            duplicate_name:
                "Ein Team mit diesem Namen ist für dieses Spiel bereits im Katalog.",
            revision_conflict:
                "Dieses Team wurde zwischenzeitlich geändert. Lade es neu und versuche es erneut.",
            idempotency_conflict:
                "Diese Anfrage wurde bereits mit anderen Angaben verwendet. Schließe den Dialog und beginne neu.",
            not_found: "Das Team existiert nicht mehr.",
            archived: "Das Team ist archiviert.",
            not_archived: "Das Team ist nicht archiviert.",
            asset_unavailable:
                "Das hochgeladene Logo ist nicht mehr verfügbar. Lade es erneut hoch.",
            limit_reached:
                "Der Katalog dieses Spiels hat sein Limit von 2000 Teams erreicht.",
            guild_already_linked:
                "Dieser Discord-Server ist bereits mit einem Team verbunden.",
            invalid_merge: "Diese Teams können nicht zusammengeführt werden.",
            forbidden: "Du hast hier keinen Zugriff auf den Teamkatalog.",
            unavailable: "Der Teamkatalog ist vorübergehend nicht verfügbar.",
            rate_limited:
                "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
        },
        uploadErrors: {
            unsupported_type:
                "Nur PNG-, JPEG- und WebP-Bilder werden akzeptiert.",
            type_mismatch:
                "Der Dateiinhalt passt nicht zum angegebenen Bildtyp.",
            bad_dimensions:
                "Das Bild muss mindestens 1×1 und höchstens 4096×4096 Pixel groß sein.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable: "Das Bild konnte nicht gelesen werden.",
            invalid_kind: "Dieser Upload ist kein Teamlogo.",
            invalid_asset:
                "Das hochgeladene Bild konnte nicht gespeichert werden.",
            too_large: "Das Bild überschreitet 2 MiB.",
            upload_limited:
                "Zu viele Uploads. Versuche es in {seconds} s erneut.",
            forbidden: "Du darfst hier keine Logos hochladen.",
            unavailable: "Uploads sind vorübergehend nicht verfügbar.",
        },
        picker: {
            title: "Teams",
            description:
                "Wähle die Teams, die dieses Match spielen, aus dem Logi-Teamkatalog. Jedes Team behält Name und Logo vom Zeitpunkt der Auswahl, bis du es aktualisierst.",
            slots: { a: "Team A", b: "Team B", c: "Team C" },
            team: "Team",
            side: "Seite",
            noTeam: "Kein Team",
            noSide: "Keine Seite",
            search: "Teams suchen…",
            noResults: "Keine aktiven Teams gefunden.",
            unknownTeam: "Teamdaten nicht verfügbar",
            savedSelections: "In diesem Match gespeichert",
            requestTeam: "Neues Team beantragen",
            requestNamed: "„{name}“ beantragen",
            requestHint:
                "Fehlt ein Team? Beantrage es; sobald ein Logi-Administrator es freigibt, kann es ausgewählt werden.",
            requestSent:
                "Antrag gesendet. Sobald ein Logi-Administrator das Team freigibt, kannst du es hier auswählen; die antragstellende Person erhält die Entscheidung per Discord-DM.",
            refreshSnapshot: "Schnappschuss aktualisieren",
            refreshing: "Wird aktualisiert…",
            snapshotRefreshed:
                "Schnappschuss aus dem Teamkatalog aktualisiert.",
            archivedSelection:
                "Archiviertes Team; der gespeicherte Schnappschuss bleibt bei diesem Match.",
            mergedBadge: "Zusammengeführt",
            mergedSelection:
                "Mit einem anderen Katalogteam zusammengeführt. Aktualisiere den Schnappschuss, um dieses Match auf das verbleibende Team umzustellen.",
            duplicateTeam: "Jedes Team kann nur einem Platz zugewiesen werden.",
            duplicateSide: "Jede Seite kann nur einem Team zugewiesen werden.",
            errors: {
                invalid_match_teams: "Die Teamzuweisung ist ungültig.",
                team_not_found: "Das Team existiert im Katalog nicht mehr.",
                team_archived:
                    "Das Team ist archiviert; wähle ein anderes Team.",
                team_game_mismatch: "Das Team gehört zu einem anderen Spiel.",
                match_concluded:
                    "Abgeschlossene Matches behalten ihre Teamschnappschüsse.",
                training_event: "Trainings haben keine Match-Teams.",
                forbidden: "Du darfst die Teams dieses Matches nicht ändern.",
                unavailable:
                    "Der Teamkatalog ist vorübergehend nicht verfügbar.",
                rate_limited:
                    "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
            },
        },
    },
    teamRequests: {
        title: "Eure Teamanträge",
        description:
            "Anträge aus diesem Arbeitsbereich. Logi-Administratoren geben jeden Antrag frei, führen ihn zusammen oder lehnen ihn ab; die antragstellende Person erhält die Entscheidung per Discord-DM. Ein Arbeitsbereich kann bis zu 20 offene Anträge haben.",
        empty: "Dieser Arbeitsbereich hat noch keine Teams beantragt.",
        loading: "Anträge werden geladen…",
        loadMore: "Mehr laden",
        retry: "Erneut versuchen",
        kinds: { create: "Neues Team", update: "Änderung" },
        statuses: {
            pending: "Offen",
            approved: "Freigegeben",
            merged: "Zusammengeführt",
            rejected: "Abgelehnt",
            cancelled: "Zurückgezogen",
        },
        requestedOn: "Beantragt am {date}",
        decidedOn: "Entschieden am {date}",
        note: "Deine Notiz",
        reason: "Begründung",
        resultTeam: "Resultierendes Team",
        resultTeamUnavailable: "Teamdaten nicht verfügbar",
        cancel: "Antrag zurückziehen",
        cancelRequest: "Antrag für {name} zurückziehen",
        cancelling: "Wird zurückgezogen…",
        cancelled: "Antrag zurückgezogen.",
        submitted:
            "Antrag gesendet. Logi-Administratoren prüfen ihn; die Entscheidung kommt per Discord-DM.",
        dialog: {
            createTitle: "Neues Team beantragen",
            updateTitle: "Änderung vorschlagen",
            createDescription:
                "{game} · Logi-Administratoren prüfen jeden Antrag. Nach der Freigabe kann das Team in Matches ausgewählt werden.",
            updateDescription:
                "{game} · Schlage neue Angaben für {name} vor. Logi-Administratoren prüfen die Änderung, bevor sie übernommen wird.",
            description: "Beschreibung",
            descriptionHelp: "Optional, bis zu 500 Zeichen.",
            links: "Links",
            linksHelp:
                "Bis zu 3 https-Links, zum Beispiel die Teamwebsite oder eine Discord-Einladung.",
            link: "Link {index}",
            addLink: "Link hinzufügen",
            removeLink: "Link {index} entfernen",
            note: "Notiz für die Administratoren",
            noteHelp:
                "Optional, bis zu 500 Zeichen. Nenne alles, was bei der Prüfung hilft.",
            submit: "Antrag senden",
            submitting: "Wird gesendet…",
            cancel: "Abbrechen",
            unchanged:
                "Ändere vor dem Senden mindestens eine Angabe des Teams.",
            duplicate:
                "{name} ist für dieses Spiel bereits im Katalog. Wähle das Team aus oder schlage eine Änderung dafür vor.",
        },
        validation: {
            nameRequired: "Gib den Teamnamen ein.",
            nameInvalid: "Verwende bis zu 120 Zeichen ohne Zeilenumbrüche.",
            shortCodeInvalid: "Verwende bis zu 16 Zeichen ohne Zeilenumbrüche.",
            descriptionInvalid:
                "Verwende bis zu 500 Zeichen ohne Steuerzeichen.",
            linksInvalid:
                "Jeder Link muss eine https-Adresse ohne Benutzername und Passwort sein.",
            linksDuplicate: "Jeder Link darf nur einmal vorkommen.",
            linksTooMany: "Gib höchstens 3 Links an.",
            noteInvalid: "Verwende bis zu 500 Zeichen ohne Steuerzeichen.",
            invalid: "Prüfe die Angaben des Antrags und versuche es erneut.",
        },
        errors: {
            invalid_request:
                "Prüfe die Angaben des Antrags und versuche es erneut.",
            not_found: "Der Antrag oder sein Team existiert nicht mehr.",
            not_pending:
                "Über diesen Antrag wurde bereits entschieden, oder er wurde zurückgezogen.",
            limit_reached:
                "Dieser Arbeitsbereich hat bereits 20 offene Anträge. Warte auf eine Entscheidung oder ziehe einen zurück.",
            idempotency_conflict:
                "Dieser Antrag wurde bereits mit anderen Angaben gesendet. Schließe den Dialog und stelle einen neuen Antrag.",
            team_archived:
                "Das Team ist archiviert; Änderungen können nicht mehr beantragt werden.",
            team_game_mismatch: "Das Team gehört zu einem anderen Spiel.",
            invalid_decision:
                "Diese Entscheidung ist für den Antrag nicht möglich.",
            forbidden: "Du darfst hier keine Teamanträge verwalten.",
            rate_limited:
                "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
            unavailable: "Teamanträge sind vorübergehend nicht verfügbar.",
        },
    },
    signupActivity: {
        title: "Anmeldeverlauf",
        description:
            "Sieh, wer sich für Matches und Trainings angemeldet, Rollen geändert oder abgemeldet hat.",
        empty: "Noch keine Anmeldeaktivitäten.",
        role: "Rolle",
        noRole: "Keine Rolle",
        actions: {
            signed_up: "hat sich angemeldet",
            changed_role: "hat die Rolle geändert",
            unsigned: "hat sich abgemeldet",
            declined: "hat abgesagt",
        },
        emptyTitle: "Noch keine Anmeldeaktivität",
        emptyDescription:
            "Anmeldungen, Rollenwechsel und Abmeldungen für Matches und Trainings erscheinen hier, sobald sie passieren.",
        limitNotice:
            "Es werden die letzten {count} Änderungen angezeigt. Ältere Änderungen erscheinen hier nicht.",
        filteredBy: "Nur {event}",
        showAll: "Alle Aktivitäten anzeigen",
    },
} as const
