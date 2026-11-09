import { discordPanelsPage_editor } from "./discord-panels-editor"
import { discordPanelsPage_list } from "./discord-panels-list"
export const discordPanelsMessages = {
    discordPanelsPage: {
        newPanel: "Neues Panel",
        time: {
            today: "heute um {time}",
            yesterday: "gestern um {time}",
            date: "{date} um {time}",
            now: "jetzt",
        },
        bot: {
            online: "Bot online",
            version: "Version {version} · letzter Kontakt {ago}",
            refreshEvery: "Panels werden alle 60 s aktualisiert",
            offlineTitle: "Der Bot antwortet nicht · letzter Kontakt {ago}.",
            offlineBody:
                "Panels werden gerade nicht aktualisiert und neue nicht gesendet. Prüfen Sie, ob der Bot läuft; starten Sie ihn nach einem Update neu.",
            outdatedTitle: "Der Bot läuft mit der älteren Version {version}.",
            outdatedBody:
                "Discord-Panels brauchen Version {required} oder neuer. Starten Sie den Bot nach dem Update neu; solange die alte Version läuft, werden Panels nicht aktualisiert.",
            unknownTitle: "Der Bot hat sich noch nicht gemeldet.",
            unknownBody:
                "Panels werden nicht aktualisiert und neue nicht gesendet, bis der Bot läuft. Starten Sie den Bot; sein Zustand erscheint hier innerhalb von 30 s.",
            notInServer:
                "Der Bot hat sich auf diesem Discord-Server seit über 3 Minuten nicht gemeldet. Prüfen Sie, ob der Logi-Bot auf den Server eingeladen ist; bis dahin werden keine Panels gesendet.",
        },
        sources: {
            title: "Datenquellen",
            link: "Spielserver",
            collecting: "Sammelt · letzte Daten {ago}",
            collectingNoData: "Sammelt · noch keine Daten",
            notCollecting:
                "Sammelt nicht · Sammeln unter Spielserver einschalten",
            stale: "Ältere Daten · letzte Daten {ago}",
            unavailable: "Antwortet nicht · letzte Daten {ago}",
            liveOk: "Live-Daten ✓",
            liveLimited: "Live-Daten gerade eingeschränkt",
            empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn unter Spielserver hinzu.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: discordPanelsPage_list,
        actions: {
            accepted: {
                publish:
                    "Zur Veröffentlichung gesendet. Der Bot übernimmt es innerhalb von 15 s.",
                refresh:
                    "Aktualisierung angefordert. Der Bot zeichnet das Panel innerhalb von 15 s neu.",
                pause: "Das Panel ist pausiert. Die Nachricht bleibt und wird nicht aktualisiert.",
                resume: "Das Panel läuft wieder. Der Bot zeichnet es innerhalb von 15 s neu.",
                retry: "Wir versuchen es innerhalb von 15 s erneut.",
                delete: "Die Nachricht wird innerhalb von 15 s aus Discord entfernt. Das Panel bleibt als nicht gesendet gespeichert.",
                remove: "Das Panel wird mit seinen Discord-Nachrichten entfernt.",
                control:
                    "Der Bot zeichnet die Nachricht Serversteuerung innerhalb von 15 s neu.",
            },
            failed: "Die Aktion hat nicht funktioniert. Versuchen Sie es erneut.",
            notSent: "Das Panel ist noch nicht in Discord.",
            removing: "Das Panel wird gerade entfernt.",
            notFound: "Das Panel existiert nicht mehr.",
        },
        editor: discordPanelsPage_editor,
    },
    discordPanelStatus: {
        states: {
            published: "Veröffentlicht",
            error: "Fehler",
            waiting: "Wartet auf den Bot",
            unsent: "Nicht gesendet",
            paused: "Pausiert",
        },
        botOnline: "Bot online",
        botVersion: "Version {version} · letzter Kontakt {ago}",
        refreshEvery: "Panels werden alle 60 s aktualisiert",
        botOffline:
            "Der Bot antwortet nicht · letzter Kontakt {ago}. Panels werden nicht aktualisiert und neue nicht gesendet. Prüft, ob der Bot läuft; startet ihn nach einem Update neu.",
        botNeverSeen:
            "Der Bot hat sich noch nicht gemeldet. Panels werden erst aktualisiert und gesendet, wenn der Bot läuft.",
        botOutdated:
            "Der Bot läuft mit der älteren Version {version}. Discord-Panels brauchen Version {required} oder neuer. Starten Sie den Bot nach dem Update neu; solange die alte Version läuft, werden Panels nicht aktualisiert.",
        permissions: {
            view_channel: "Kanal ansehen",
            send_messages: "Nachrichten senden",
            embed_links: "Links einbetten",
            attach_files: "Dateien anhängen",
            read_message_history: "Nachrichtenverlauf lesen",
        },
        errors: {
            bot_not_in_server: {
                title: "Der Bot ist nicht auf dem Discord-Server.",
                past: "Der Bot war nicht auf dem Discord-Server.",
                fix: "Ladet den Logi-Bot erneut auf den Server ein und klickt dann Erneut versuchen.",
            },
            channel_missing: {
                title: "Der Kanal {channel} existiert nicht mehr oder der Bot sieht ihn nicht.",
                past: "Der Kanal {channel} existierte nicht oder der Bot sah ihn nicht.",
                fix: "Wählt im Editor einen anderen Kanal und speichert.",
            },
            channel_type: {
                title: "In {channel} können keine Nachrichten gesendet werden.",
                past: "In {channel} konnten keine Nachrichten gesendet werden.",
                fix: "Wählt im Editor einen Text- oder Ankündigungskanal.",
            },
            missing_permissions: {
                title: "Dem Bot fehlt die Berechtigung {permissions} in {channel}.",
                past: "Dem Bot fehlte die Berechtigung {permissions} in {channel}.",
                fix: "Öffnet in Discord Kanal bearbeiten → Berechtigungen → Logi und aktiviert {permissions}. Klickt dann Erneut versuchen.",
            },
            delivery_uncertain: {
                title: "Discord hat nicht bestätigt, ob die Nachricht angekommen ist.",
                past: "Discord hat nicht bestätigt, ob die Nachricht angekommen ist.",
                fix: "Der Bot findet die Nachricht bei der nächsten Aktualisierung oder sendet sie erneut. Nichts zu tun.",
            },
            discord_unavailable: {
                title: "Discord antwortet gerade nicht.",
                past: "Discord hat nicht rechtzeitig geantwortet.",
                fix: "Der Bot versucht es selbst erneut. Dauert es lange, klickt Erneut versuchen.",
            },
            source_missing: {
                title: "Der Spielserver des Panels ist nicht mehr in Logi.",
                past: "Der Spielserver des Panels war nicht in Logi.",
                fix: "Wählt im Editor einen anderen Server oder löscht das Panel.",
            },
            source_not_collecting: {
                title: "Logi sammelt keine Daten vom Spielserver.",
                past: "Logi hat keine Daten vom Spielserver gesammelt.",
                fix: "Aktiviert die Sammlung unter Spielserver und klickt dann Erneut versuchen.",
            },
            provider_unreachable: {
                title: "Der Spielserver antwortet nicht.",
                past: "Der Spielserver hat nicht geantwortet.",
                fix: "Das Panel zeigt die letzten Daten. Prüft Adresse und Schlüssel unter Spielserver.",
            },
            provider_rate_limited: {
                title: "Der Datenanbieter lehnt gerade weitere Anfragen ab.",
                past: "Der Datenanbieter hat weitere Anfragen abgelehnt.",
                fix: "Das Panel zeigt die letzten Daten und versucht es erneut. Dauert es über eine Stunde, erhöht das Limit des Schlüssels oder ersetzt ihn unter Spielserver.",
            },
            render_failed: {
                title: "Das Panel konnte nicht erstellt werden.",
                past: "Das Panel konnte nicht erstellt werden.",
                fix: "Kürzt Titel oder Beschreibung des Panels. Bleibt der Fehler, meldet ihn dem Logi-Support.",
            },
            unsupported_kind: {
                title: "Der Bot kann diese Panelart noch nicht.",
                past: "Der Bot konnte diese Panelart nicht.",
                fix: "Aktualisiert den Bot und startet ihn neu.",
            },
            competition_missing: {
                title: "Der Wettbewerb des Panels existiert nicht mehr.",
                past: "Der Wettbewerb des Panels existierte nicht.",
                fix: "Wählt im Editor einen anderen Wettbewerb oder löscht das Panel.",
            },
            league_disabled: {
                title: "Wardogs League ist in den Einstellungen ausgeschaltet, daher hat der Bot die Nachrichten des Panels gelöscht.",
                past: "Wardogs League war in den Einstellungen ausgeschaltet.",
                fix: "Schaltet Wardogs League unter Einstellungen → Wardogs League ein; der Bot sendet dann beide Nachrichten neu.",
            },
            unknown: {
                title: "Die Nachricht konnte nicht gesendet werden.",
                past: "Die Nachricht konnte nicht gesendet werden.",
                fix: "Klickt Erneut versuchen. Bleibt der Fehler, meldet ihn dem Logi-Support.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "Der Kanal ist jetzt öffentlich, deshalb wurde das Passwort aus dem Panel entfernt. Verschiebt das Panel in einen privaten Kanal, damit es wieder erscheint.",
            live_data_unavailable:
                "Live-Daten sind gerade nicht verfügbar; das Panel zeigt die zuletzt gesammelten Daten.",
            attach_files_missing:
                "Dem Bot fehlt die Berechtigung Dateien anhängen, daher hat das Panel kein Bild.",
        },
    },
    discordPreview: {
        regionLabel: "Vorschau der Discord-Nachricht",
        appTag: "APP",
        edited: "(bearbeitet)",
        usedCommand: "{user} hat {command} verwendet",
        onlyYouCanSee: "Nur du kannst dies sehen",
        dismissMessage: "Nachricht verwerfen",
        buttons: "Schaltflächen der Nachricht",
        externalLink: "externer Link",
        unavailable: "nicht verfügbar",
        unknownUser: "Benutzer",
        unknownRole: "Rolle",
        unknownChannel: "Kanal",
    },
    joinPage: {
        metaTitle: "{name} beitreten",
        metaDescription: "Tritt dem Spielserver {name} bei.",
        opening: "Öffne {game}…",
        players: "{players} / {capacity} Spieler",
        queue: "Warteschlange {queue}",
        steamPrompt:
            "Steam fragt, ob der Link geöffnet werden soll. Bestätige Öffnen.",
        manualTitle: "Manuell beitreten",
        addressLabel: "Serveradresse",
        copy: "Kopieren",
        copied: "Kopiert",
        copyFailed:
            "Kopieren fehlgeschlagen. Markiere die Adresse und kopiere sie selbst.",
        steamInstructions:
            "In Steam: Ansicht → Spielserver → Favoriten → Server hinzufügen und die Adresse einfügen.",
        backToDiscord: "Zurück zu Discord",
        joinCodeTitle: "Beitrittscode",
        joinCodeLabel: "Code zum Beitreten des Spiels",
        joinCodeHelp:
            "Öffne im Spiel den Spielbeitritt und gib diesen Code ein.",
        noAddress:
            "Die Serveradresse ist noch nicht eingestellt. Frag einen Clan-Admin.",
        noJoinCode:
            "Der Beitrittscode ist noch nicht eingestellt. Frag einen Clan-Admin.",
        notFoundTitle: "Server nicht gefunden",
    },
} as const
