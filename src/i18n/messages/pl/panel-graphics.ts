export const panelGraphicsMessages = {
    panelGraphicsPage: {
        breadcrumbParent: "Panele Discord",
        unnamedServer: "Nienazwany serwer",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Styl panelu",
            description:
                "Jak wyglądają panele serwerowe w Discord. Dotyczy każdego panelu bez własnego stylu.",
            defaultLabel: "Domyślny styl",
            logiDefault: "Domyślnie",
            options: {
                a: {
                    title: "Styl A · Obraz",
                    description:
                        "Bot generuje grafikę wyniku i aktualizuje ją najwyżej raz na 60 sekund.",
                },
                b: {
                    title: "Styl B · Baner i miniatura",
                    description:
                        "Baner serwera na górze, miniaturka mapy po prawej stronie, znaki i pasek gracza.",
                },
                c: {
                    title: "Styl C · Kompaktowy",
                    description:
                        "Tylko tekst ze znakami i paskiem gracza. Najkrótsza wiadomość.",
                },
            },
            perPanel: "Ustaw inny styl dla jednego panelu w pliku",
            perPanelLink: "edytor panelu",
        },
        banners: {
            title: "Banery serwerów",
            description:
                "Obraz u góry panelu w stylu B i tło grafiki wyniku w stylu A. Jeden baner na serwer.",
            empty: "Nie ma jeszcze serwera gry. Dodaj jeden w ustawieniach serwerów gier.",
            emptyLink: "Serwery gier",
            customChip: "Własny baner",
            mapChip: "Obraz mapy",
            noneChip: "Brak banera",
            mapOverlay: "obraz mapy",
            liveServer: "Serwer na żywo",
            banner: "Baner",
            upload: "Prześlij baner",
            uploading: "Przesyłanie…",
            remove: "Usuń",
            help: "PNG, JPG lub WebP · współczynnik 3 : 1, na przykład 1200 × 400 · maksymalnie 2 MB.",
            uploadedFile: "Przesłano {name} · {width} × {height} · {size}.",
            uploadedBanner: "Przesłano · {width} × {height} · {size}.",
            withoutBanner:
                "Bez banera wyświetlany jest bieżący obraz mapy, teraz {map}.",
            withoutBannerUnknownMap:
                "Bez banera wyświetlany jest bieżący obraz mapy.",
            withoutBannerOff:
                "Bez banera panel nie będzie miał obrazu na górze.",
            crop: "Przytnij",
            crops: { top: "Góra", center: "Środek", bottom: "Dół" },
            useMapImage: "Użyj obrazu mapy, gdy brakuje banera",
            barColor: "Kolor paska",
            barColorInput: "Kolor paska w formacie szesnastkowym",
            clanColor: "Kolor klanu",
            clanColorNote: "kolor klanu",
            barColorInvalid: "Wprowadź kolor jako #RRGGBB.",
        },
        maps: {
            title: "Obrazy map",
            description:
                "Miniatura w panelu i tło grafiki wyniku, gdy serwer nie ma własnego banera. Logi udostępnia domyślne obrazy map, które klan może zastąpić własnymi.",
            customCount: {
                one: "Własne obrazy: {count}",
                few: "Własne obrazy: {count}",
                many: "Własne obrazy: {count}",
                other: "Własne obrazy: {count}",
            },
            search: "Przeszukaj mapy",
            searchPlaceholder: "Nazwa mapy",
            game: "Gra",
            all: "Wszystkie",
            builtinChip: "Wartość domyślna Logi",
            customChip: "Własny",
            noneChip: "Brak obrazu",
            replace: "Zamień na własne",
            restore: "Przywróć domyślne",
            upload: "Prześlij obraz",
            uploading: "Przesyłanie…",
            imageAlt: "Mapa {name}",
            footer: "Wyświetlanie {shown} map {total} · własny obraz: PNG, JPG lub WebP, kwadrat o wymiarach co najmniej 160 × 160, maksymalnie 2 MB.",
            noResults: "Żadna mapa nie pasuje do wyszukiwania.",
        },
        factions: {
            title: "Ikony frakcji",
            description:
                "Naprawiono, nie można ich zmienić. Bot sam przesyła je do Discord jako emoji aplikacji i używa ich w każdym panelu, wyniku i lidze.",
            uploaded: "Przesłano do Discord ✓ · Emoji {count}",
            pending: "Przesłano do Discord {ready} emoji {total}",
            hllTitle: "Hell Let Loose · narody",
            hllChip: "Własne ikony Logi",
            nations: {
                us: { name: "USA", side: "Alianci" },
                gb: { name: "Wielka Brytania", side: "Alianci" },
                sov: { name: "Związek Radziecki", side: "Alianci" },
                cw: { name: "Commonwealth", side: "Alianci" },
                ger: { name: "Niemcy", side: "Oś" },
                dak: { name: "Afrikakorps", side: "Oś" },
                allies: {
                    name: "Alianci",
                    side: "gdy serwer nie wymienia żadnego narodu",
                },
                axis: {
                    name: "Oś",
                    side: "gdy serwer nie wymienia żadnego narodu",
                },
            },
            wardogsTitle: "Wardogs · frakcje",
            wardogsChip: "Ikony Wardogs, licencja MIT",
            wardogsHint: "na ciemnym tle, tak jak je zobaczysz w Discord",
            wardogs: {
                valkyra: { name: "Valkyra", role: "frakcja" },
                manticore: { name: "Manticore", role: "frakcja" },
                lonestar: { name: "Lonestar", role: "frakcja" },
                wardogs: { name: "Wardogs", role: "znak gry" },
            },
            note: "Znaki narodów HLL są naszymi własnymi prostymi ikonami, a nie grafiką gry.",
        },
        status: {
            title: "Ikony stanu i pasek gracza",
            description:
                "Naprawiono również; bot przesyła je razem z ikonami frakcji. Obok ikony zawsze stoi słowo.",
            states: {
                live: { name: "Na żywo", hint: "serwer gra" },
                seeding: {
                    name: "Seeding",
                    hint: "poniżej 40 graczy, działa seeding",
                },
                empty: { name: "Pusty", hint: "nikt nie gra" },
                offline: {
                    name: "Offline",
                    hint: "serwer nie odpowiada",
                },
            },
            gauge: {
                players: {
                    name: "Gracze",
                    hint: "jedna sztuka = ​​jedna dziesiąta pojemności",
                },
                queue: { name: "Kolejka", hint: "po przerwie" },
                free: { name: "Wolne miejsce", hint: "" },
            },
            sample: "Przykład w panelu",
            sampleQueue: "Gracze {count} / {capacity}, kolejka {queue}",
            sampleSeed: "Gracze {count} / {capacity}, seeding do {target}",
        },
        saveNote:
            "banery i styl obowiązują przy następnym odświeżeniu panelu, w ciągu 60 sekund",
        saved: "Grafika panelu została zapisana.",
        reload: "Wczytaj ponownie",
        errors: {
            conflict:
                "W międzyczasie ktoś inny zmienił grafikę. Załaduj ponownie stronę i powtórz zmiany.",
            asset_unavailable:
                "Obraz nie jest już dostępny. Prześlij go ponownie.",
            unknown_server:
                "Serwer gry już nie istnieje. Załaduj ponownie stronę.",
            invalid_request: "Wartość jest nieprawidłowa.",
            forbidden: "Niedozwolona jest zmiana grafiki panelu.",
            unavailable: "Zapisywanie nie powiodło się. Spróbuj ponownie.",
        },
        uploadErrors: {
            unsupported_type:
                "Akceptowane są wyłącznie obrazy w formacie PNG, JPG i WebP.",
            type_mismatch: "Zawartość pliku nie jest zgodna z typem obrazu.",
            bad_dimensions:
                "Obraz jest za mały lub za duży. Obraz mapy musi mieć wymiary co najmniej 160 × 160 pikseli, żaden obraz nie może być większy niż 4096 × 4096.",
            animated: "Animowane obrazy nie są obsługiwane.",
            undecodable: "Nie można odczytać obrazu.",
            invalid_kind: "Tego obrazu nie można tutaj przesłać.",
            invalid_asset: "Nie można zapisać przesłanego obrazu.",
            too_large: "Obraz jest większy niż 2 MB.",
            upload_limited:
                "Za dużo przesłanych plików. Spróbuj ponownie za {seconds}.",
            forbidden: "Nie możesz przesyłać obrazów.",
            unavailable: "Przesyłanie jest chwilowo niedostępne.",
        },
    },
    publicPanelAppearance: {
        title: "Wygląd",
        description:
            "Układ, kolor akcentu, baner i emoji frakcji dla tego panelu. Panele zapisane przed wprowadzeniem tych ustawień zachowują swój poprzedni wygląd, dopóki ich tutaj nie zmienisz.",
        mapArtwork: "Grafika mapy",
        layout: "Układ",
        showMap: "Pokaż nazwę mapy i grafikę",
        showScoreboard: "Pokaż tablicę wyników",
        showPlayerCount: "Pokaż liczbę graczy",
        compact: "Kompaktowy nagłówek",
        layoutHelp:
            "Widok kompaktowy ma dwuwierszowy nagłówek, wyniki w jednym wierszu i brak separatorów. Aby pokazać grafikę mapy, włącz również tę opcję.",
        resultsLayoutHelp:
            "Ogłoszenia wyników wykorzystują mapę i ustawienia kompaktowe; tablica wyników i liczba graczy dotyczą paneli na żywo.",
        accentColor: "Kolor akcentujący",
        accentColorPicker: "Wybierz kolor akcentujący",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Zastępuje żywy kolor zielony; nieaktualne lub wstrzymane panele wyświetlają bursztynowe ostrzeżenie. Pozostaw puste dla wartości domyślnych.",
        accentColorReset: "Domyślny kolor",
        accentColorInvalid: "Użyj koloru w formacie #RRGGBB.",
        banner: "Baner",
        bannerHelp:
            "PNG, JPEG lub WebP do 2 MiB i 4096 × 4096 pikseli. Logi konwertuje go do WebP o maksymalnej rozdzielczości 1920 × 1080 pikseli. Baner zastępuje miniaturę mapy.",
        bannerUpload: "Prześlij baner",
        bannerUploading: "Przesyłanie…",
        bannerRemove: "Usuń baner",
        bannerPreview: "Podgląd banera",
        bannerNone:
            "Brak banera. Panel wyświetla grafikę mapy, gdy jest ona włączona.",
        bannerUploaded: "Baner przesłany. Zapisz panel, aby go opublikować.",
        bannerSelected: "Wybrano baner. Zapisz panel, aby go opublikować.",
        bannerLibrary: "Przesłane banery",
        bannerLibraryShow: "Wybierz przesłany baner",
        bannerLibraryHide: "Ukryj przesłane banery",
        bannerLibraryLoading: "Ładowanie przesłanych banerów…",
        bannerLibraryEmpty:
            "W tym obszarze roboczym nie przesłano jeszcze żadnych banerów.",
        bannerLibraryError:
            "Nie można załadować przesłanych banerów. Spróbuj ponownie później.",
        bannerLibraryItem: "Użyj banera {width} × {height} px przesłane {date}",
        factionEmoji: "Emoji frakcji",
        factionEmojiHelp:
            "Jeden emoji Unicode lub niestandardowy emoji Discord zapisany jako <:name:id> (animowany: <a:name:id>). Niestandardowy emoji musi należeć do serwera, na którym znajduje się bot, lub do aplikacji bota. Pozostaw puste, aby zachować wartość domyślną wyświetlaną jako symbol zastępczy.",
        factionEmojiInvalid: "Użyj jednego emoji lub <:name:id>.",
        noDefaultEmoji: "Brak",
        factions: {
            allies: "Alianci",
            axis: "Oś",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid: "Napraw wyróżnione ustawienia wyglądu przed zapisaniem.",
        errors: {
            invalid_kind: "Tego typu obrazu nie można używać jako banera.",
            unsupported_type: "Użyj obrazu PNG, JPEG lub WebP.",
            type_mismatch:
                "Zawartość pliku nie jest zgodna z jego typem. Wyeksportuj go ponownie jako PNG, JPEG lub WebP.",
            bad_dimensions: "Obraz musi mieć maksymalnie 4096 × 4096 pikseli.",
            animated: "Animowane obrazy nie są obsługiwane.",
            undecodable:
                "Nie można odczytać obrazu. Wyeksportuj go ponownie i spróbuj ponownie.",
            invalid_asset: "Nie można zapisać obrazu. Ponów próbę przesłania.",
            forbidden:
                "Tylko administratorzy obszaru roboczego mogą przesyłać banery.",
            too_large: "Obraz jest większy niż 2 MiB.",
            upload_limited:
                "Za dużo przesłanych plików. Spróbuj ponownie za {seconds} s.",
            unavailable:
                "Przesyłanie obrazów jest niedostępne. Spróbuj ponownie później.",
            asset_unavailable:
                "Baner nie jest już dostępny w tym obszarze roboczym. Prześlij go ponownie lub usuń, a następnie zapisz.",
        },
    },
} as const
