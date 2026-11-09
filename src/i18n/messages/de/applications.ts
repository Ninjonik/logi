export const applicationsMessages = {
    membershipApplication: {
        title: "Clan-Bewerbung",
        description:
            "Ein Formular in mehreren Fenstern, erst am Ende abgeschickt. Danach ein privater Thread, Rollen und die Entscheidung.",
        breadcrumbParent: "Mitgliedschaft",
        enabled: "Bewerbungen an",
        tabsLabel: "Bereiche der Bewerbung",
        tabs: {
            application: "Bewerbung",
            categories: "Kategorien",
            scores: "Punkte für Anwesenheit",
            roleChanges: "Rollenänderungen",
        },
        categoryCount: {
            one: "{count} Kategorie",
            few: "{count} Kategorien",
            many: "{count} Kategorien",
            other: "{count} Kategorien",
        },
        panel: {
            title: "Panel und Kanäle",
            channel: "Kanal mit dem Panel",
            threads: "Wo Bewerbungs-Threads entstehen",
            channelOk: "Der Bot kann hier schreiben und Bilder einbetten.",
            channelBlocked:
                "Der Bot kann hier nicht schreiben oder keine Bilder einbetten. Gib ihm im Kanal Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen und Nachrichtenverlauf lesen.",
            threadsOk: "Der Bot kann hier private Threads erstellen.",
            threadsBlocked:
                "Der Bot kann hier keine privaten Threads erstellen. Gib ihm im Kanal Kanal ansehen, Private Threads erstellen, Nachrichten in Threads senden und Threads verwalten.",
            checking: "Berechtigungen des Bots werden geprüft…",
            checkUnavailable:
                "Die Berechtigungen des Bots lassen sich gerade nicht prüfen. Versuche es gleich noch einmal.",
            heading: "Titel",
            text: "Text",
            textHelp:
                "Die Kategorien werden unter dem Text automatisch aufgelistet.",
            image: "Bild",
            upload: "Bild hochladen",
            uploading: "Wird hochgeladen…",
            pick: "Hochgeladenes wählen",
            pickTitle: "Hochgeladene Panel-Bilder",
            pickDescription:
                "Bilder, die der Clan schon für seine Discord-Panels hochgeladen hat.",
            pickEmpty: "Noch kein hochgeladenes Bild.",
            pickUnavailable:
                "Die hochgeladenen Bilder lassen sich gerade nicht laden.",
            pickImage: "Bild {number} verwenden",
            removeImage: "Bild entfernen",
            imageHelp:
                "Optional, über dem Panel-Titel. PNG, JPEG oder WebP bis 2 MiB.",
            color: "Panel-Farbe",
            colorHint: "Leer = Clan-Farbe. Hex, z. B. #E8A33D.",
            colorInvalid: "Die Farbe muss hex sein, z. B. #E8A33D.",
            imageAlt: "Bild des Bewerbungs-Panels",
            attachFailed:
                "Das Bild konnte nicht verwendet werden. Versuche es noch einmal.",
            uploadErrors: {
                unsupported_type:
                    "Nur PNG-, JPEG- und WebP-Bilder werden angenommen.",
                type_mismatch: "Der Dateiinhalt passt nicht zu seinem Bildtyp.",
                bad_dimensions:
                    "Das Bild muss mindestens 1×1 und höchstens 4096×4096 Pixel groß sein.",
                animated: "Animierte Bilder werden nicht unterstützt.",
                undecodable: "Das Bild konnte nicht gelesen werden.",
                invalid_kind:
                    "Diese Datei kann nicht als Panel-Bild verwendet werden.",
                invalid_asset:
                    "Das hochgeladene Bild konnte nicht gespeichert werden.",
                too_large: "Das Bild ist größer als 2 MiB.",
                upload_limited:
                    "Zu viele Uploads. Versuche es in {seconds} s noch einmal.",
                forbidden: "Du darfst hier keine Bilder hochladen.",
                unavailable: "Das Hochladen ist vorübergehend nicht verfügbar.",
            },
            preview: "Vorschau in #{channel}",
            previewNoChannel: "Vorschau des Panels",
            previewEmpty:
                "Das Panel erscheint, sobald der Clan mindestens eine Kategorie hat.",
        },
        form: {
            title: "Formular: Fenster und Fragen",
            intro: "Eine Bewerbung in mehreren Fenstern. Fragetypen: Kurzer Text, Langer Text, Auswahl, Mehrfachauswahl, Ja/Nein und Zahl.",
            note: "Die Bewerber gehen die Fenster nacheinander durch und schicken erst nach der Kontrolle ab. Zwischen den Fenstern zeigt der Bot den Button Weiter, weil Discord kein Fenster direkt aus einem Fenster öffnen lässt. Die Feldanzahl gilt für die Bewerbung mit den meisten Fragen.",
            window: "Fenster {number} · {name}",
            windowNames: {
                about: "Über dich",
                accounts: "Spielkonten",
                questions: "Fragen des Clans",
            },
            fieldCount: "{count} von 5 Feldern",
            inPreview: "in der Vorschau",
            fixed: "festes Feld",
            fixedFields: {
                games: "Spiel",
                category: "Kategorie",
                name: "Spielname",
                steam: "Steam",
                epic: "Epic",
                xbox: "Xbox",
                playstation: "PlayStation",
            },
            gamesNote: "nur wenn der Clan mehrere Spiele spielt",
            categoryNote: "Kategorien des gewählten Spiels",
            accountsNote:
                "Die Felder erscheinen nur für das Spiel, das sie braucht. Konten, die schon in Logi stehen, sind vorausgefüllt.",
            requireSteam: "Bestätigtes Steam verlangen",
            requireSteamHelp:
                "Für HLL. Vor Fenster 2 schickt der Bot den Link Mit Steam bestätigen; eine eingetippte Steam-ID geht dann nicht.",
            addQuestion: "Frage hinzufügen",
            newQuestion: "Neue Frage",
            option: "Option {number}",
            edit: "Bearbeiten",
            editAria: "Frage {name} bearbeiten",
            close: "Schließen",
            move: "Frage {name} verschieben",
            moveHint:
                "Mit der Maus ziehen oder mit den Pfeiltasten nach oben und unten.",
            remove: "Frage {name} löschen",
            windowFull: "Das Fenster ist voll.",
            windowFullText:
                "Discord erlaubt höchstens 5 Felder pro Fenster. Die nächste Frage gehört in ein neues Fenster.",
            addWindow: "Fenster hinzufügen",
            noMoreWindows:
                "Es geht kein weiteres Fenster: Die Bewerbung hat höchstens die Fenster 3, 3b und 3c.",
            windowEmpty: "Dieses Fenster hat noch keine Fragen.",
            removeWindow: "Fenster {number} entfernen",
            types: {
                short_text: "Kurzer Text",
                long_text: "Langer Text",
                select: "Auswahl",
                multi_select: "Mehrfachauswahl",
                yes_no: "Ja/Nein",
                number: "Zahl",
                member: "Clan-Mitglied",
            },
            required: "Pflicht",
            bothGames: "Beide Spiele",
            allGames: "Alle Spiele",
            specializationCategories: "Kategorien laut Kategorie-Einstellung",
            gameShort: {
                hell_let_loose: "HLL",
                hell_let_loose_vietnam: "HLL: Vietnam",
                wardogs: "Wardogs",
                world_of_warcraft_forever: "WoW:F",
            },
            editor: {
                title: "Frage {name} bearbeiten",
                type: "Typ",
                typeFixed: "Der Typ dieser Frage ist fest.",
                required: "Pflicht",
                label: "Beschriftung",
                labelCount:
                    "{count} / 45 Zeichen · mehr erlaubt Discord nicht.",
                help: "Hilfe",
                helpHint: "Unter der Beschriftung, höchstens 100 Zeichen.",
                placeholder: "Platzhalter",
                options: "Optionen",
                optionInput: "Option {number}",
                removeOption: "Option {name} entfernen",
                moveOption: "Option {name} verschieben",
                addOption: "Option hinzufügen",
                maxOptions: "Höchstens 25 Optionen.",
                selectFrom: "Wählen von",
                selectTo: "bis",
                game: "Nur für Spiel",
                gameBoth: "Beide",
                gameAll: "Alle",
                category: "Nur für Kategorie",
                categoryHint: "Nichts angehakt heißt jede Kategorie.",
                categoryOtherGame:
                    "{game} · die Frage ist nur für {questionGame}",
                specializationNote:
                    "Nach der Spezialisierung fragt der Bot nur in Kategorien, bei denen sie in der Tabelle Kategorien unten eingeschaltet ist. Nur für HLL.",
                aboutNoFilters:
                    "Fenster 1 sieht jede Bewerbung: Dort werden Spiel und Kategorie gewählt.",
                done: "Fertig",
            },
            issues: {
                "window-full":
                    "Das Fenster hat mehr als 5 Felder. Verschiebe eine Frage in ein anderes Fenster.",
                "too-many-windows":
                    "Die Bewerbung hat höchstens die Fenster 3, 3b und 3c.",
                "label-empty": "Die Frage braucht eine Beschriftung.",
                "label-too-long": "Die Beschriftung ist länger als 45 Zeichen.",
                "help-too-long": "Die Hilfe ist länger als 100 Zeichen.",
                "placeholder-too-long":
                    "Der Platzhalter ist länger als 100 Zeichen.",
                "options-missing":
                    "Eine Auswahl braucht mindestens eine Option.",
                "options-too-many": "Die Auswahl hat mehr als 25 Optionen.",
                "option-empty": "Jede Option braucht einen Text.",
                "option-too-long": "Eine Option ist länger als 100 Zeichen.",
                "option-duplicate": "Zwei Optionen heißen gleich.",
                "values-range":
                    "Der Bereich Wählen von–bis passt nicht zur Anzahl der Optionen.",
                "duplicate-id": "Die Frage steht zweimal im Formular.",
                "type-invalid": "Dieser Typ passt nicht zur Frage.",
                "category-unknown":
                    "Die Frage ist auf eine Kategorie beschränkt, die es nicht mehr gibt.",
                "specialization-duplicate":
                    "Die Frage Spezialisierung steht zweimal im Formular.",
            },
            issuesTitle: "Das Formular lässt sich noch nicht speichern",
            windowPreview:
                "Vorschau von Fenster {number} in Discord · Bewerbung für {game}, {category}",
            windowPreviewNoCategory: "Vorschau von Fenster {number} in Discord",
            previewWindowPick: "Fenster in der Vorschau",
            modalLabel: "Bewerbungsfenster in Discord",
            modalClose: "Fenster schließen",
            modalCancel: "Abbrechen",
            modalSubmit: "Absenden",
            reviewPreview:
                "Kontrolle vor dem Absenden · nur für die Bewerbung sichtbar",
            sample: {
                name: "Spieler 17",
                shortText: "Antwort aus der Bewerbung",
                longText: "Ich suche ein Team für regelmäßige Matches…",
            },
        },
        categories: {
            title: "Kategorien",
            intro: "Was in Fenster 1 zur Wahl steht. Die Details einer Kategorie bearbeitest du im Tab Kategorien.",
            columns: {
                category: "Kategorie",
                game: "Spiel",
                roles: "Rollen nach Aufnahme · Rekrut → endgültig",
                thread: "Thread sichtbar für",
                specialization: "Nach Spezialisierung fragen",
                actions: "Aktionen",
            },
            noRecruit: "ohne Rekrut",
            noRole: "keine Rolle",
            admins: "nur Logi-Admins",
            edit: "Bearbeiten",
            editAria: "Kategorie {name} bearbeiten",
            specializationAria: "Nach Spezialisierung fragen: {name}",
            add: "Kategorie hinzufügen",
            note: "@{role} bekommt jeder Aufgenommene; einstellen unter Rollen und Zugriff. Spezialisierung gibt es nur bei HLL.",
            noteNoRole:
                "Die Clan-Rolle für jeden Aufgenommenen stellst du unter Rollen und Zugriff ein. Spezialisierung gibt es nur bei HLL.",
            empty: "Noch keine Kategorie. Ohne sie kann sich niemand bewerben.",
            specializationMissing:
                "Die Frage Spezialisierung ist nicht im Formular, deshalb stellt der Bot sie nicht.",
            restoreSpecialization: "Frage Spezialisierung zurückholen",
        },
        after: {
            title: "Nach dem Absenden",
            thread: "Privaten Thread in #{channel} erstellen",
            threadNoChannel: "Privaten Thread erstellen",
            threadHelp:
                "Immer. Am Anfang stehen die Antworten und die Begrüßung unten.",
            mention: "Support-Rollen der Kategorie im Thread erwähnen",
            mentionHelp:
                "Zum Beispiel @Rekrutierung; sonst sieht niemand den Thread.",
            recruit: "Rolle Rekrut gleich nach dem Absenden geben",
            recruitHelp: "Nur bei Kategorien mit einer Rekrut-Rolle.",
            dm: "Der Bewerbung eine Bestätigung per DM schicken",
            dmHelp: "Mit Link zum Thread.",
            keep: "Unfertige Bewerbung 24 h aufbewahren",
            keepHelp:
                "Danach wird der Entwurf gelöscht und die Bewerbung beginnt neu.",
            welcome: "Begrüßung im Thread",
            welcomePlaceholder:
                "{applicant}, danke für deine Bewerbung. {support_roles} meldet sich bald.",
            welcomeHelp:
                "Möglich sind {applicant}, {support_roles} und {category}.",
            decisionPreview:
                "Entscheidung im Thread · Buttons statt /close_application",
            tableCaption: "Was die Buttons bei der Kategorie {category} tun",
            table: {
                button: "Button",
                roles: "Rollenänderung",
                applicant: "Die Bewerbung bekommt",
            },
            outcomes: {
                member: "Als Mitglied aufnehmen",
                recruit: "Als Rekrut aufnehmen",
                mercenary: "Als Söldner aufnehmen",
                denied: "Ablehnen…",
                pending: "Noch nicht entschieden",
            },
            gets: {
                result: "Ergebnis und DM",
                reason: "Fenster für den Grund, Ergebnis und DM",
                pending: "Notiz auf der Karte, keine DM",
            },
            noRoleChange: "keine Änderung",
            mercenaryMissing: "Keine Söldner-Kategorie",
            mercenaryMissingNote:
                "Der Button Als Söldner aufnehmen bleibt in Discord deaktiviert, bis der Clan eine Söldner-Kategorie hat. Leg eine Kategorie mit dem Ergebnis Söldner an.",
            mercenaryCategoryNote:
                "Als Söldner aufnehmen vergibt die Rollen der Kategorie {category}, nicht die der Kategorie, die der Bewerber gewählt hat.",
            roleSyncOff:
                "Die Rollen-Synchronisierung ist aus, deshalb ändert Logi keine Rollen.",
            decisionNote:
                "Entscheiden dürfen der Support der Kategorie und die Logi-Admins. Der Befehl /close_application funktioniert weiter.",
        },
        web: {
            title: "Variante B · Ausfüllen im Web",
            switch: "Auch Ausfüllen im Web anbieten",
            help: "Das Panel bekommt einen zweiten Button Im Web ausfüllen. Dasselbe Formular auf einer Logi-Seite, ohne das Limit von 5 Feldern pro Fenster, nach der Anmeldung mit Discord. Die Bewerbung landet im selben Thread mit denselben Rollen.",
            note: "Praktisch für lange Formulare oder Bewerbungen am Handy, wo sich die Discord-Fenster schlechter ausfüllen lassen.",
            address: "Adresse des Formulars",
        },
        save: {
            changes: {
                one: "{count} ungespeicherte Änderung",
                few: "{count} ungespeicherte Änderungen",
                many: "{count} ungespeicherte Änderungen",
                other: "{count} ungespeicherte Änderungen",
            },
            note: "Das Panel in #{channel} aktualisiert sich nach dem Speichern selbst.",
            noteNoChannel:
                "Das Panel aktualisiert sich nach dem Speichern selbst.",
            discard: "Verwerfen",
            save: "Speichern",
            saved: "Die Bewerbung ist gespeichert.",
            error: "Die Bewerbung konnte nicht gespeichert werden.",
            formInvalid:
                "Das Formular hat einen Fehler. Korrigiere die markierten Fragen und speichere erneut.",
        },
    },
    applicationWeb: {
        brand: "Logi · Clan {clan}",
        signedInAs: "Mit Discord angemeldet als {name}",
        title: "Bewerbung bei {clan}",
        stepsLabel: "Schritte der Bewerbung",
        review: "Kontrolle",
        autosave: "Was du ausfüllst, wird automatisch gespeichert.",
        next: "Nächster Schritt",
        back: "Zurück",
        saving: "Wird gespeichert…",
        submit: "Bewerbung absenden",
        submitting: "Wird gesendet…",
        edit: "Bearbeiten",
        required: "Pflicht",
        chooseUpTo: "Wähle {min} bis {max}.",
        reviewTitle: "Prüfe deine Bewerbung",
        reviewNote: "Eine unfertige Bewerbung bewahren wir 24 h auf.",
        queued: "Die Bewerbung ist abgeschickt. Der Bot erstellt jetzt einen privaten Thread…",
        done: "Die Bewerbung ist abgeschickt. Die Rekrutierung meldet sich im Thread.",
        openThread: "Thread in Discord öffnen",
        failed: "Die Bewerbung konnte nicht gesendet werden. Versuche es noch einmal.",
        retry: "Noch einmal versuchen",
        expired:
            "Die unfertige Bewerbung ist nach 24 Stunden abgelaufen. Bitte fülle sie neu aus.",
        busy: "Die Bewerbung wird gerade gesendet. Warte bitte einen Moment.",
        unavailable:
            "Das Formular geht gerade nicht. Versuche es gleich noch einmal.",
        disabled: "Der Clan nimmt gerade keine Bewerbungen im Web an.",
        alreadyOpen: "Du hast schon eine offene Clan-Bewerbung.",
        member: "Du bist schon im Clan. Eine Bewerbung brauchst du nicht.",
        steamLocked:
            "Steam kommt nur aus der Steam-Bestätigung auf der Logi-Website.",
        memberHint:
            "Die Discord-Konto-ID des Mitglieds, das dich eingeladen hat.",
        fixErrors: "Korrigiere bitte die markierten Felder.",
    },
} as const
