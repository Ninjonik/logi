export const seedingMessages = {
    seedPage: {
        breadcrumbParent: "Panels in Discord",
        back: "Panels in Discord",
        title: "Server-Seeding",
        description:
            "Wenn ein Server leer ist, ruft Logi Spieler zusammen: Es sendet einen Aufruf, markiert die Rolle Seed und zeigt im Panel, wie viele Spieler fehlen. Starten dürfen ihn nur Logi-Admins.",
        serversLabel: "Die Spielserver des Clans",
        noServers:
            "Der Clan hat noch keinen Spielserver. Fügen Sie ihn unter Spielserver hinzu und richten Sie dann hier das Seeding ein.",
        gameServersLink: "Spielserver",
        unavailable:
            "Das Seeding konnte gerade nicht geladen werden. Laden Sie die Seite neu.",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        status: {
            now: "Jetzt {players} / {capacity} Spieler",
            nowNoCapacity: "Jetzt {players} Spieler",
            noData: "Keine aktuellen Serverdaten",
            chips: {
                live: "Live",
                below_start: "Unter der Startgrenze",
                filling: "Füllt sich",
                offline: "Nicht erreichbar",
                unknown: "Keine Daten",
            },
            running: "Seed läuft",
            idle: "Kein Seed läuft",
            lastData: "letzte Daten {time}",
            nextSeed: "nächster geplanter Seed {time}",
            lastSeed: "letzter Seed {time}",
            progress: "{players} / {liveFrom} bis zum Live-Spiel",
            startNow: "Jetzt seeden",
            stopNow: "Seed beenden",
            busy: "Wird ausgeführt…",
            started: "Der Seed läuft. Der Aufruf steht in {channel}.",
            stopped: "Der Seed ist beendet.",
        },
        actionErrors: {
            cooldown:
                "Ein Seed kann jetzt nicht starten. Der nächste kann {time} starten.",
            running: "Ein Seed läuft bereits.",
            duplicate: "Dieser Seed läuft bereits.",
            not_configured:
                "Wählen Sie zuerst den Aufruf-Kanal und speichern Sie den Plan.",
            offline:
                "Der Server antwortet nicht. Starten Sie den Seed, sobald er online ist.",
            already_live:
                "Der Server ist bereits live, ein Seed ist nicht nötig.",
            not_running: "Gerade läuft kein Seed.",
            not_found: "Der Server wurde nicht gefunden.",
            forbidden: "Dafür fehlt Ihnen die Berechtigung.",
            unsaved: "Speichern Sie zuerst die Änderungen am Plan.",
            unavailable:
                "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
        },
        time: {
            today: "heute um {time}",
            yesterday: "gestern um {time}",
            tomorrow: "morgen um {time}",
            other: "{date} um {time}",
        },
        plan: {
            title: "Seed-Plan · {server}",
            enabled: "An",
            enabledLabel: "Seed-Plan an",
            liveFrom: "Der Server ist live ab",
            liveFromUnit: "Spielern",
            liveFromHint: "Dann endet der Seed.",
            startBelow: "Ein Seed startet unter",
            startBelowUnit: "Spielern",
            startBelowHint: "Darüber sendet der Plan nichts.",
            when: "Wann",
            manual: "Manuell",
            manualText:
                "mit Jetzt seeden hier oder in der Nachricht Serversteuerung. Immer möglich.",
            schedule: "Zeitplan",
            scheduleHint:
                "Nur wenn der Server in dem Moment unter der Startgrenze ist.",
            scheduleDays: "Tage des Zeitplans",
            at: "um",
            time: "Uhrzeit",
            addSlot: "Weitere Uhrzeit hinzufügen",
            removeSlot: "Uhrzeit entfernen",
            weekdays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
            auto: "Automatisch",
            autoHint: "Wenn sich der Server im Laufe des Tages leert.",
            autoBelow: "wenn er unter",
            autoBetween: "Spieler fällt, zwischen",
            autoAnd: "und",
            seedChannel: "Aufruf-Kanal",
            seedChannelPlaceholder: "Kanal wählen",
            seedChannelOk: "Der Bot kann schreiben und {role} markieren.",
            seedChannelOkNoRole: "Der Bot kann in den Kanal schreiben.",
            role: "Rolle, die der Aufruf markiert",
            rolePlaceholder: "Keine Rollenmarkierung",
            createRole: "Rolle Seed erstellen",
            createRoleBusy: "Rolle wird erstellt…",
            createRoleHint:
                "Logi erstellt in Discord eine markierbare Rolle Seed und wählt sie aus. Sie können auch eine vorhandene Rolle wählen.",
            roleCreated: "Die Rolle @Seed wurde erstellt und ausgewählt.",
            roleReused:
                "Der Server hat bereits eine Rolle @Seed; sie ist jetzt ausgewählt.",
            rolePermission:
                "Die Rolle konnte nicht erstellt werden. Geben Sie der Logi-Rolle in Discord die Berechtigung Rollen verwalten.",
            roleUnavailable:
                "Discord antwortet gerade nicht. Versuchen Sie es gleich noch einmal.",
            roleMembers: {
                one: "{count} Mitglied",
                few: "{count} Mitglieder",
                many: "{count} Mitglieder",
                other: "{count} Mitglieder",
            },
            selfService: "Spieler schalten die Rolle selbst per Knopf ein",
            selfServiceHint:
                "Der Aufruf bekommt den Knopf Zum Seed einladen; ein weiterer Klick entfernt die Rolle wieder.",
            protection: "Schutz",
            pingWindow: "Höchstens 1 Rollenmarkierung pro",
            hoursUnit: "Std.",
            pingWindowHint:
                "Startet ein Seed früher, geht der Aufruf ohne Rollenmarkierung raus.",
            cooldown: "Mindestens zwischen Seeds",
            cooldownHint:
                "Früher startet weder der Knopf noch der Plan einen weiteren Seed.",
            template: "Aufruftext",
            insert: "Einfügen:",
            templateHint: "Titel, Fortschritt und Knöpfe ergänzt Logi selbst.",
            templateDefault:
                "Ein leeres Feld verwendet den Standardtext des Aufrufs.",
            atThreshold: "An der Grenze",
            endEdit:
                "Nachricht auf „Der Server ist live“ ändern und den Seed beenden",
            endEditHint:
                "Niemand weiteres wird markiert. Der Fortschritt verschwindet auch aus dem Serverpanel.",
            endDelete: "Nachricht löschen und den Seed beenden",
            maxDuration: "Höchstens",
            maxDurationHint:
                "Dann endet der Seed, auch wenn der Server die Grenze nicht erreicht.",
        },
        previews: {
            title: "Vorschau des Aufrufs",
            call: "Vorschau des Aufrufs in {channel} · live nach dem Text links",
            live: "Bei {count} Spielern · dieselbe Nachricht, bearbeitet",
            note: "Die Nachricht wird alle 60 s aktualisiert. Das Serverpanel zeigt währenddessen denselben Fortschritt.",
            control: "Vorschau in {channel} · die Nachricht für diesen Server",
            noChannel: "#kanal",
            author: "heute um {time}",
            deleted:
                "Bei {count} Spielern löscht Logi den Aufruf und beendet den Seed. Niemand wird mehr erwähnt.",
        },
        control: {
            title: "Steuerung in Discord",
            channel: "Steuerkanal",
            channelPlaceholder: "Privaten Kanal wählen",
            private: "Der Kanal ist privat ✓",
            privateHint: "nur Admins sehen ihn.",
            public: "Den Kanal sehen alle",
            publicHint:
                "der Bot sendet die Steuerung nicht dorthin. Wählen Sie einen privaten Kanal.",
            checking: "Kanäle werden in Discord geprüft…",
            note: "Die Knöpfe Seed, Aktualisieren und Pausieren dürfen nur Logi-Admins benutzen. Wer sonst klickt, bekommt eine private Antwort, dass er das nicht darf. Öffentliche Panels haben keinen Seed-Knopf.",
        },
        problems: {
            seed_channel_unpublishable:
                "Der Bot kann nicht in den Aufruf-Kanal schreiben. Geben Sie ihm dort Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen und Nachrichtenverlauf lesen.",
            seed_role_missing:
                "Die gewählte Rolle gibt es in Discord nicht mehr.",
            seed_role_not_mentionable:
                "Der Bot kann die Rolle nicht markieren. Schalten Sie „Jedem erlauben, diese Rolle zu @erwähnen“ ein oder geben Sie dem Bot @everyone erwähnen.",
            seed_role_unmanageable:
                "Der Bot kann die Rolle nicht vergeben. Geben Sie ihm Rollen verwalten und schieben Sie seine Rolle über die gewählte Rolle.",
            control_channel_unpublishable:
                "Der Bot kann nicht in den Steuerkanal schreiben. Geben Sie ihm dort Kanal ansehen, Nachrichten senden und Nachrichtenverlauf lesen.",
            control_channel_public:
                "Den Steuerkanal sehen alle. Wählen Sie einen Kanal, den @everyone nicht sieht.",
            verification_unavailable:
                "Discord antwortet nicht, die Kanäle lassen sich nicht prüfen. Versuchen Sie es gleich noch einmal.",
        },
        issues: {
            invalid: "Prüfen Sie diesen Wert.",
            start_below_not_under_live:
                "Die Startgrenze muss niedriger sein als die Live-Grenze.",
            auto_below_above_start:
                "Der automatische Start darf höchstens bei der Startgrenze liegen.",
            auto_window_empty:
                "Beginn und Ende des Fensters müssen verschieden sein.",
            schedule_without_slots:
                "Fügen Sie dem Zeitplan mindestens eine Uhrzeit hinzu.",
            duplicate_day: "Ein Tag steht zweimal im Zeitplan.",
            duplicate_slot:
                "Dieser Tag und diese Uhrzeit stehen schon im Zeitplan.",
            seed_channel_required:
                "Ein eingeschalteter Plan braucht einen Aufruf-Kanal.",
            control_channel_same_as_seed:
                "Der Steuerkanal muss sich vom Aufruf-Kanal unterscheiden.",
            unknown_placeholder:
                "Der Text enthält ein unbekanntes Feld in geschweiften Klammern.",
            live_above_capacity:
                "Der Server hat weniger Plätze als die Live-Grenze.",
        },
        save: {
            note: "Speichert den Plan {server} und den Steuerkanal.",
            unsaved: {
                one: "{count} ungespeicherte Änderung",
                few: "{count} ungespeicherte Änderungen",
                many: "{count} ungespeicherte Änderungen",
                other: "{count} ungespeicherte Änderungen",
            },
            discard: "Verwerfen",
            save: "Speichern",
            saving: "Wird gespeichert…",
            saved: "Der Plan ist gespeichert.",
            reload: "Neu laden",
            conflict:
                "Jemand anderes hat den Plan inzwischen geändert. Laden Sie die Seite neu und ändern Sie ihn erneut.",
            failed: "Der Plan konnte nicht gespeichert werden.",
        },
        history: {
            title: "Seed-Verlauf · {server}",
            summary:
                "Letzte {days} Tage · {count} · im Schnitt {average} bis zum Live-Spiel",
            summaryNoLive: "Letzte {days} Tage · {count}",
            seeds: {
                one: "{count} Seed",
                few: "{count} Seeds",
                many: "{count} Seeds",
                other: "{count} Seeds",
            },
            empty: "In den letzten 30 Tagen gab es hier keinen Seed.",
            columns: {
                start: "Beginn",
                trigger: "Gestartet von",
                players: "Spieler zu Beginn → am Ende",
                result: "Ergebnis",
                duration: "Dauer",
                pinged: "Markiert",
            },
            trigger: {
                schedule: "Plan {slot}",
                auto: "Automatisch · unter {count}",
                web: "{name} · manuell im Web",
                discord: "{name} · Knopf in {channel}",
                discordNoChannel: "{name} · Knopf in Discord",
            },
            outcome: {
                live: "Live",
                timeout: "Grenze nicht erreicht",
                admin: "Von einem Admin beendet",
                failed: "Fehlgeschlagen",
                running: "Läuft",
            },
            endedSuffix: "beendet",
            pinged: "{count} · {role}",
            silentWindow: "0 · Schutz {hours} Std.",
            silentNoRole: "0 · ohne Rolle",
            unknownRole: "@rolle",
            units: { hours: "Std.", minutes: "Min." },
        },
    },
} as const
