export const panelGraphicsMessages = {
    panelGraphicsPage: {
        breadcrumbParent: "Panels in Discord",
        unnamedServer: "Server ohne Namen",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Panel-Stil",
            description:
                "Wie Server-Panels in Discord aussehen. Gilt für alle Panels ohne eigenen Stil.",
            defaultLabel: "Standardstil",
            logiDefault: "Standard",
            options: {
                a: {
                    title: "Stil A · Bild",
                    description:
                        "Der Bot zeichnet ein Punktestand-Bild und lädt es höchstens alle 60 s neu hoch.",
                },
                b: {
                    title: "Stil B · Banner und Miniatur",
                    description:
                        "Server-Banner oben, Kartenminiatur rechts, Zeichen und Spieleranzeige.",
                },
                c: {
                    title: "Stil C · Kompakt",
                    description:
                        "Nur Text mit Zeichen und Spieleranzeige. Die kürzeste Nachricht.",
                },
            },
            perPanel: "Einen anderen Stil für ein Panel legen Sie im",
            perPanelLink: "Panel-Editor fest",
        },
        banners: {
            title: "Server-Banner",
            description:
                "Das Bild oben im Panel im Stil B und der Hintergrund des Punktestand-Bilds im Stil A. Eines pro Server.",
            empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn in den Einstellungen Spielserver hinzu.",
            emptyLink: "Spielserver",
            customChip: "Eigenes Banner",
            mapChip: "Kartenbild",
            noneChip: "Kein Banner",
            mapOverlay: "Kartenbild",
            liveServer: "Live-Server",
            banner: "Banner",
            upload: "Banner hochladen",
            uploading: "Wird hochgeladen…",
            remove: "Entfernen",
            help: "PNG, JPG oder WebP · Verhältnis 3 : 1, zum Beispiel 1200 × 400 · höchstens 2 MB.",
            uploadedFile: "Hochgeladen {name} · {width} × {height} · {size}.",
            uploadedBanner: "Hochgeladen · {width} × {height} · {size}.",
            withoutBanner:
                "Ohne Banner erscheint das Bild der aktuellen Karte, jetzt {map}.",
            withoutBannerUnknownMap:
                "Ohne Banner erscheint das Bild der aktuellen Karte.",
            withoutBannerOff: "Ohne Banner hat das Panel oben kein Bild.",
            crop: "Ausschnitt",
            crops: { top: "Oben", center: "Mitte", bottom: "Unten" },
            useMapImage: "Kartenbild verwenden, wenn das Banner fehlt",
            barColor: "Leistenfarbe",
            barColorInput: "Leistenfarbe als Hexadezimalwert",
            clanColor: "Clanfarbe",
            clanColorNote: "Clanfarbe",
            barColorInvalid: "Geben Sie die Farbe als #RRGGBB ein.",
        },
        maps: {
            title: "Kartenbilder",
            description:
                "Die Miniatur im Panel und der Hintergrund des Punktestand-Bilds, wenn der Server kein eigenes Banner hat. Logi hat eingebaute Bilder; der Clan kann sie ersetzen.",
            customCount: {
                one: "{count} eigenes",
                few: "{count} eigene",
                many: "{count} eigene",
                other: "{count} eigene",
            },
            search: "Karte suchen",
            searchPlaceholder: "Kartenname",
            game: "Spiel",
            all: "Alle",
            builtinChip: "Logi-Standard",
            customChip: "Eigenes",
            noneChip: "Kein Bild",
            replace: "Durch eigenes ersetzen",
            restore: "Standard wiederherstellen",
            upload: "Bild hochladen",
            uploading: "Wird hochgeladen…",
            imageAlt: "Karte {name}",
            footer: "{shown} von {total} Karten angezeigt · eigenes Bild: PNG, JPG oder WebP, quadratisch mindestens 160 × 160, höchstens 2 MB.",
            noResults: "Keine Karte passt zur Suche.",
        },
        factions: {
            title: "Fraktionssymbole",
            description:
                "Fest, sie lassen sich nicht ändern. Der Bot lädt sie selbst als App-Emoji in Discord hoch und verwendet sie in allen Panels, Ergebnissen und in der Liga.",
            uploaded: "In Discord hochgeladen ✓ · {count} Emoji",
            pending: "In Discord hochgeladen {ready} von {total} Emoji",
            hllTitle: "Hell Let Loose · Nationen",
            hllChip: "eigene Logi-Symbole",
            nations: {
                us: { name: "USA", side: "Alliierte" },
                gb: { name: "Großbritannien", side: "Alliierte" },
                sov: { name: "Sowjetunion", side: "Alliierte" },
                cw: { name: "Commonwealth", side: "Alliierte" },
                ger: { name: "Deutschland", side: "Achse" },
                dak: { name: "Afrikakorps", side: "Achse" },
                allies: {
                    name: "Alliierte",
                    side: "wenn der Server keine Nation nennt",
                },
                axis: {
                    name: "Achse",
                    side: "wenn der Server keine Nation nennt",
                },
            },
            wardogsTitle: "Wardogs · Fraktionen",
            wardogsChip: "Wardogs-Symbole, MIT-Lizenz",
            wardogsHint:
                "auf dunklem Hintergrund, wie Sie sie in Discord sehen",
            wardogs: {
                valkyra: { name: "Valkyra", role: "Fraktion" },
                manticore: { name: "Manticore", role: "Fraktion" },
                lonestar: { name: "Lonestar", role: "Fraktion" },
                wardogs: { name: "Wardogs", role: "Spielzeichen" },
            },
            note: "Die HLL-Nationszeichen sind unsere eigenen einfachen Symbole, keine Spielgrafik.",
        },
        status: {
            title: "Statussymbole und Spieleranzeige",
            description:
                "Ebenfalls fest; der Bot lädt sie zusammen mit den Fraktionssymbolen hoch. Neben dem Symbol steht immer ein Wort.",
            states: {
                live: { name: "Live", hint: "der Server läuft" },
                seeding: {
                    name: "Seeding",
                    hint: "unter 40 Spielern, Seed läuft",
                },
                empty: { name: "Leer", hint: "niemand spielt" },
                offline: {
                    name: "Nicht erreichbar",
                    hint: "der Server antwortet nicht",
                },
            },
            gauge: {
                players: {
                    name: "Spieler",
                    hint: "ein Segment = ein Zehntel der Kapazität",
                },
                queue: { name: "Warteschlange", hint: "nach einer Lücke" },
                free: { name: "Freier Platz", hint: "" },
            },
            sample: "Beispiel im Panel",
            sampleQueue: "{count} / {capacity} Spieler, Warteschlange {queue}",
            sampleSeed: "{count} / {capacity} Spieler, Seed bis {target}",
        },
        saveNote:
            "Banner und Stil gelten ab der nächsten Aktualisierung der Panels, spätestens nach 60 s",
        saved: "Panel-Grafik gespeichert.",
        reload: "Neu laden",
        errors: {
            conflict:
                "Jemand anderes hat die Grafik inzwischen geändert. Laden Sie die Seite neu und wiederholen Sie Ihre Änderungen.",
            asset_unavailable:
                "Das Bild ist nicht mehr verfügbar. Bitte laden Sie es erneut hoch.",
            unknown_server:
                "Der Spielserver existiert nicht mehr. Laden Sie die Seite neu.",
            invalid_request: "Ein Wert ist ungültig.",
            forbidden: "Sie dürfen die Panel-Grafik nicht ändern.",
            unavailable: "Speichern fehlgeschlagen. Versuchen Sie es erneut.",
        },
        uploadErrors: {
            unsupported_type:
                "Nur PNG-, JPG- und WebP-Bilder werden akzeptiert.",
            type_mismatch: "Der Dateiinhalt passt nicht zu seinem Bildtyp.",
            bad_dimensions:
                "Das Bild ist zu klein oder zu groß. Ein Kartenbild braucht mindestens 160 × 160 Pixel, kein Bild mehr als 4096 × 4096.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable: "Das Bild konnte nicht gelesen werden.",
            invalid_kind: "Dieses Bild kann hier nicht hochgeladen werden.",
            invalid_asset:
                "Das hochgeladene Bild konnte nicht gespeichert werden.",
            too_large: "Das Bild ist größer als 2 MB.",
            upload_limited:
                "Zu viele Uploads. Versuchen Sie es in {seconds} s erneut.",
            forbidden: "Sie dürfen keine Bilder hochladen.",
            unavailable: "Hochladen ist vorübergehend nicht verfügbar.",
        },
    },
    publicPanelAppearance: {
        title: "Darstellung",
        description:
            "Layout, Akzentfarbe, Banner und Fraktions-Emojis dieses Panels. Panels, die vor Einführung dieser Einstellungen gespeichert wurden, behalten ihr bisheriges Aussehen, bis du sie hier änderst.",
        mapArtwork: "Kartenbild",
        layout: "Layout",
        showMap: "Kartenname und Kartenbild anzeigen",
        showScoreboard: "Punktestand anzeigen",
        showPlayerCount: "Spielerzahl anzeigen",
        compact: "Kompakte Kopfzeile",
        layoutHelp:
            "Kompakt nutzt eine zweizeilige Kopfzeile, Punktestände in einer Zeile und keine Trennlinien. Das Kartenbild erfordert zusätzlich die Einstellung Kartenbild.",
        resultsLayoutHelp:
            "Ergebnismeldungen nutzen die Karten- und Kompakt-Einstellung; Punktestand und Spielerzahl gelten für Live-Panels.",
        accentColor: "Akzentfarbe",
        accentColorPicker: "Akzentfarbe wählen",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Ersetzt das Grün des Live-Panels; veraltete oder pausierte Panels behalten die orange Warnfarbe. Leer lassen für die Standardfarbe.",
        accentColorReset: "Standardfarbe",
        accentColorInvalid: "Gib eine Farbe im Format #RRGGBB ein.",
        banner: "Banner",
        bannerHelp:
            "PNG, JPEG oder WebP bis 2 MiB und 4096 × 4096 px. Logi wandelt es in WebP mit höchstens 1920 × 1080 px um. Ein Banner ersetzt das Kartenvorschaubild.",
        bannerUpload: "Banner hochladen",
        bannerUploading: "Wird hochgeladen…",
        bannerRemove: "Banner entfernen",
        bannerPreview: "Bannervorschau",
        bannerNone:
            "Kein Banner. Das Panel zeigt das Kartenbild, sofern aktiviert.",
        bannerUploaded:
            "Banner hochgeladen. Speichere das Panel, um es zu veröffentlichen.",
        bannerSelected:
            "Banner ausgewählt. Speichere das Panel, um es zu veröffentlichen.",
        bannerLibrary: "Hochgeladene Banner",
        bannerLibraryShow: "Hochgeladenes Banner wählen",
        bannerLibraryHide: "Hochgeladene Banner ausblenden",
        bannerLibraryLoading: "Hochgeladene Banner werden geladen…",
        bannerLibraryEmpty:
            "In diesem Workspace wurden noch keine Banner hochgeladen.",
        bannerLibraryError:
            "Hochgeladene Banner konnten nicht geladen werden. Versuche es später erneut.",
        bannerLibraryItem: "Banner {width} × {height} px vom {date} verwenden",
        factionEmoji: "Fraktions-Emojis",
        factionEmojiHelp:
            "Ein Unicode-Emoji oder ein eigenes Discord-Emoji im Format <:name:id> (animiert: <a:name:id>). Eigene Emojis müssen zu einem Server gehören, auf dem der Bot ist, oder zur Bot-Anwendung. Leer lassen, um den als Platzhalter gezeigten Standard zu behalten.",
        factionEmojiInvalid: "Gib ein Emoji oder <:name:id> ein.",
        noDefaultEmoji: "Keins",
        factions: {
            allies: "Alliierte",
            axis: "Achsenmächte",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid:
            "Korrigiere vor dem Speichern die markierten Darstellungseinstellungen.",
        errors: {
            invalid_kind:
                "Dieser Bildtyp kann nicht als Banner verwendet werden.",
            unsupported_type: "Verwende ein PNG-, JPEG- oder WebP-Bild.",
            type_mismatch:
                "Der Dateiinhalt passt nicht zum Dateityp. Exportiere die Datei erneut als PNG, JPEG oder WebP.",
            bad_dimensions:
                "Das Bild darf höchstens 4096 × 4096 Pixel groß sein.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable:
                "Das Bild konnte nicht gelesen werden. Exportiere es erneut und versuche es noch einmal.",
            invalid_asset:
                "Das Bild konnte nicht gespeichert werden. Lade es erneut hoch.",
            forbidden: "Nur Workspace-Administratoren können Banner hochladen.",
            too_large: "Das Bild ist größer als 2 MiB.",
            upload_limited:
                "Zu viele Uploads. Versuche es in {seconds} s erneut.",
            unavailable:
                "Bild-Uploads sind derzeit nicht verfügbar. Versuche es später erneut.",
            asset_unavailable:
                "Das Banner ist für diesen Workspace nicht mehr verfügbar. Lade es erneut hoch oder entferne es und speichere dann.",
        },
    },
} as const
