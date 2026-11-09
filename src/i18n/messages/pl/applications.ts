export const applicationsMessages = {
    membershipApplication: {
        title: "Zgłoszenie do klanu",
        description:
            "Jeden formularz w kilku oknach, wysyłany dopiero na końcu. Potem wątek prywatny, role i decyzja.",
        breadcrumbParent: "Członkostwo",
        enabled: "Zgłoszenia włączone",
        tabsLabel: "Części zgłoszenia",
        tabs: {
            application: "Zgłoszenie",
            categories: "Kategorie",
            scores: "Punkty obecności",
            roleChanges: "Zmiany ról",
        },
        categoryCount: {
            one: "{count} kategoria",
            few: "{count} kategorie",
            many: "{count} kategorii",
            other: "{count} kategorii",
        },
        panel: {
            title: "Panel i kanały",
            channel: "Kanał panelu",
            threads: "Miejsce tworzenia wątków zgłoszenia",
            channelOk: "Bot może tutaj publikować i osadzać obrazy.",
            channelBlocked:
                "Bot nie może tutaj publikować ani osadzać obrazów. Daj mu opcję Wyświetl kanał, wysyłaj wiadomości, osadzaj linki, dołączaj pliki i czytaj historię wiadomości na tym kanale.",
            threadsOk: "Bot może tutaj tworzyć prywatne wątki.",
            threadsBlocked:
                "Bot nie może tutaj tworzyć prywatnych wątków. Daj mu możliwość przeglądania kanału, tworzenia prywatnych wątków, wysyłania wiadomości w wątkach i zarządzania wątkami na tym kanale.",
            checking: "Sprawdzam uprawnienia bota…",
            checkUnavailable:
                "Nie można teraz sprawdzić uprawnień bota. Spróbuj ponownie za chwilę.",
            heading: "Tytuł",
            text: "Tekst",
            textHelp: "Kategorie są automatycznie wyświetlane pod tekstem.",
            image: "Obraz",
            upload: "Prześlij obraz",
            uploading: "Przesyłanie…",
            pick: "Wybierz przesłane",
            pickTitle: "Przesłane obrazy paneli",
            pickDescription:
                "Obrazy, które klan już przesłał do swoich paneli Discord.",
            pickEmpty: "Nie przesłano jeszcze obrazu.",
            pickUnavailable: "Nie można teraz załadować przesłanych obrazów.",
            pickImage: "Użyj obrazu {number}",
            removeImage: "Usuń obraz",
            imageHelp:
                "Opcjonalnie, nad tytułem panelu. PNG, JPEG lub WebP do 2 MiB.",
            color: "Kolor panelu",
            colorHint: "Pusty = kolor klanu. Szesnastkowy, np. #E8A33D.",
            colorInvalid: "Kolor musi być szesnastkowy, np. #E8A33D.",
            imageAlt: "Obraz panelu zgłoszenia",
            attachFailed: "Nie można użyć obrazu. Spróbuj ponownie.",
            uploadErrors: {
                unsupported_type:
                    "Akceptowane są wyłącznie obrazy w formacie PNG, JPEG i WebP.",
                type_mismatch:
                    "Zawartość pliku nie jest zgodna z typem obrazu.",
                bad_dimensions:
                    "Obraz musi mieć wymiary co najmniej 1×1 i maksymalnie 4096×4096 pikseli.",
                animated: "Animowane obrazy nie są obsługiwane.",
                undecodable: "Nie można odczytać obrazu.",
                invalid_kind: "Tego pliku nie można używać jako obrazu panelu.",
                invalid_asset: "Nie można zapisać przesłanego obrazu.",
                too_large: "Obraz jest większy niż 2 MiB.",
                upload_limited:
                    "Za dużo przesłanych plików. Spróbuj ponownie za {seconds}.",
                forbidden: "Nie masz uprawnień do przesyłania tutaj zdjęć.",
                unavailable: "Przesyłanie jest chwilowo niedostępne.",
            },
            preview: "Podgląd w #{channel}",
            previewNoChannel: "Podgląd panelu",
            previewEmpty:
                "Panel pojawia się, gdy klan posiada co najmniej jedną kategorię.",
        },
        form: {
            title: "Formularz : okna i pytania",
            intro: "Jedna zgłoszenie w kilku oknach. Typy pytań: krótki tekst, długi tekst, wybierz, wielokrotny wybór, tak/nie i liczba.",
            note: "Zgłaszający przechodzi przez okna w kolejności i wysyła dopiero po sprawdzeniu. Pomiędzy oknami bot wyświetla przycisk Kontynuuj, ponieważ Discord nie pozwala na otwarcie okna bezpośrednio z okna. Liczba pól dotyczy wnioskodawcy, który widzi najwięcej pytań.",
            window: "Okno {number} · {name}",
            windowNames: {
                about: "O Tobie",
                accounts: "Konta gier",
                questions: "Pytania klanowe",
            },
            fieldCount: "{count} z 5 polami",
            inPreview: "w podglądzie",
            fixed: "Pole stałe",
            fixedFields: {
                games: "Gra",
                category: "Kategoria",
                name: "Nick w grze",
                steam: "Steam",
                epic: "Epic Games",
                xbox: "Xbox",
                playstation: "PlayStation",
            },
            gamesNote: "tylko wtedy, gdy klan gra w więcej niż jedną grę",
            categoryNote: "Kategorie wybranej gry",
            accountsNote:
                "Pola pojawiają się tylko w grze, która ich potrzebuje. Konta, które wnioskodawca posiada już w Logi, są wstępnie wypełnione.",
            requireSteam: "Wymagaj zweryfikowanego Steam",
            requireSteamHelp:
                "dla HLL. Przed oknem 2 bot wysyła łącze Sprawdź za pomocą Steam; wpisany identyfikator Steam nie jest wówczas akceptowany.",
            addQuestion: "Dodaj pytanie",
            newQuestion: "Nowe pytanie",
            option: "Opcja {number}",
            edit: "Edytuj",
            editAria: "Edytuj pytanie {name}",
            close: "Zamknij",
            move: "Przenieś pytanie {name}",
            moveHint:
                "Przeciągnij myszą lub użyj klawiszy strzałek w górę i w dół.",
            remove: "Usuń pytanie {name}",
            windowFull: "Okno jest pełne.",
            windowFullText:
                "Discord umożliwia maksymalnie 5 pól w jednym oknie. Umieść następne pytanie w nowym oknie.",
            addWindow: "Dodaj okno",
            noMoreWindows:
                "Nie można dodać więcej okien: zgłoszenie ma co najwyżej okna 3, 3b i 3c.",
            windowEmpty: "W tym oknie nie ma jeszcze żadnych pytań.",
            removeWindow: "Usuń okno {number}",
            types: {
                short_text: "Krótki tekst",
                long_text: "Długi tekst",
                select: "Wybierz",
                multi_select: "Wybór wielokrotny",
                yes_no: "Tak/nie",
                number: "Liczba",
                member: "Członek klanu",
            },
            required: "Wymagane",
            bothGames: "Obie gry",
            allGames: "Wszystkie gry",
            specializationCategories:
                "Kategorie ustawione dla każdej kategorii",
            gameShort: {
                hell_let_loose: "HLL",
                hell_let_loose_vietnam: "HLL: Vietnam",
                wardogs: "Wardogs",
                world_of_warcraft_forever: "WoW:F",
            },
            editor: {
                title: "Edycja pytania {name}",
                type: "Typ",
                typeFixed: "Typ tego pytania został ustalony.",
                required: "Wymagane",
                label: "Etykieta",
                labelCount:
                    "{count} / 45 znaków · Discord nie pozwala na więcej.",
                help: "Pomoc",
                helpHint: "Pod etykietą maksymalnie 100 znaków.",
                placeholder: "Podpowiedź w polu",
                options: "Opcje",
                optionInput: "Opcja {number}",
                removeOption: "Usuń opcję {name}",
                moveOption: "Przesuń opcję {name}",
                addOption: "Dodaj opcję",
                maxOptions: "Maksymalnie 25 opcji.",
                selectFrom: "Wybierz z",
                selectTo: "do",
                game: "Tylko do gry",
                gameBoth: "Obydwa",
                gameAll: "Wszystkie",
                category: "Tylko dla kategorii",
                categoryHint:
                    "Nic nie jest zaznaczone, co oznacza każdą kategorię.",
                categoryOtherGame:
                    "{game} · pytanie dotyczy tylko {questionGame}",
                specializationNote:
                    "Bot pyta o specjalizację tylko w kategoriach, dla których jest ona włączona w poniższej tabeli Kategorie. Tylko HLL.",
                aboutNoFilters:
                    "Każdy zgłaszający widzi okno 1: wybiera grę i kategorię.",
                done: "Gotowe",
            },
            issues: {
                "window-full":
                    "Okno zawiera więcej niż 5 pól. Przenieś pytanie do innego okna.",
                "too-many-windows":
                    "Zgłoszenie ma co najwyżej Windows 3, 3b i 3c.",
                "label-empty": "Pytanie wymaga etykiety.",
                "label-too-long": "Etykieta jest dłuższa niż 45 znaków.",
                "help-too-long": "Pomoc jest dłuższa niż 100 znaków.",
                "placeholder-too-long":
                    "Symbol zastępczy jest dłuższy niż 100 znaków.",
                "options-missing": "Wybór wymaga co najmniej jednej opcji.",
                "options-too-many": "Wybór ma ponad 25 opcji.",
                "option-empty": "Każda opcja wymaga tekstu.",
                "option-too-long": "Opcja jest dłuższa niż 100 znaków.",
                "option-duplicate": "Dwie opcje mają tę samą nazwę.",
                "values-range":
                    "Zakres Wybierz od–do nie pasuje do liczby opcji.",
                "duplicate-id": "Pytanie występuje w formularzu dwukrotnie.",
                "type-invalid": "Ten typ nie pasuje do pytania.",
                "category-unknown":
                    "Pytanie jest ograniczone do kategorii, która już nie istnieje.",
                "specialization-duplicate":
                    "Pytanie dotyczące specjalizacji występuje w formularzu dwukrotnie.",
            },
            issuesTitle: "Nie można jeszcze zapisać formularza",
            windowPreview:
                "Podgląd okna {number} w Discord · wnioskodawca dla {game}, {category}",
            windowPreviewNoCategory: "Podgląd okna {number} w Discord",
            previewWindowPick: "Okno w podglądzie",
            modalLabel: "Formularz rekrutacyjny na Discordzie",
            modalClose: "Zamknij okno",
            modalCancel: "Anuluj",
            modalSubmit: "Prześlij",
            reviewPreview:
                "Przegląd przed wysłaniem · widzi to tylko osoba składająca wniosek",
            sample: {
                name: "Gracz 17",
                shortText: "Odpowiedź wnioskodawcy",
                longText: "Szukam drużyny na regularne mecze…",
            },
        },
        categories: {
            title: "Kategorie",
            intro: "Co wnioskodawca wybiera w oknie 1. Edytuj szczegóły kategorii na karcie Kategorie.",
            columns: {
                category: "Kategoria",
                game: "Gra",
                roles: "Role po akceptacji · rekrutacja → ostateczna",
                thread: "Wątek widoczny dla",
                specialization: "Zapytaj o specjalizację",
                actions: "Działania",
            },
            noRecruit: "brak rekruta",
            noRole: "brak roli",
            admins: "Logi tylko dla administratorów",
            edit: "Edytuj",
            editAria: "Edytuj kategorię {name}",
            specializationAria: "Zapytaj o specjalizację: {name}",
            add: "Dodaj kategorię",
            note: "@{role} jest rozdawane wszystkim zaakceptowanym; ustaw to w Rolach i dostępie. Specjalizacja dotyczy wyłącznie HLL.",
            noteNoRole:
                "Ustaw rolę klanu dla wszystkich zaakceptowanych w Rolach i dostępie. Specjalizacja dotyczy wyłącznie HLL.",
            empty: "Nie ma jeszcze kategorii. Bez niego nikt nie może złożyć wniosku.",
            specializationMissing:
                "Pytanie dotyczące specjalizacji nie znajduje się w formularzu, więc bot go nie zadaje.",
            restoreSpecialization: "Przywróć pytanie o specjalizację",
        },
        after: {
            title: "Po wysłaniu",
            thread: "Utwórz wątek prywatny w #{channel}",
            threadNoChannel: "Utwórz wątek prywatny",
            threadHelp:
                "Zawsze. Otwiera się odpowiedziami i powitaniem poniżej.",
            mention: "Wspomnij w wątku o rolach pomocniczych kategorii",
            mentionHelp: "Na przykład @Recruiting; nikt inny nie widzi wątku.",
            recruit: "Nadaj rolę Rekruta zaraz po wysłaniu",
            recruitHelp: "Tylko dla kategorii z rolą Rekrut.",
            dm: "Wyślij wnioskodawcy potwierdzenie w wiadomości prywatnej",
            dmHelp: "Z linkiem do wątku.",
            keep: "Przechowuj niedokończony wniosek przez 24 godziny",
            keepHelp:
                "Następnie wersja robocza zostaje usunięta, a wnioskodawca zaczyna od nowa.",
            welcome: "Witamy w wątku",
            welcomePlaceholder:
                "{applicant}, dziękujemy za złożenie wniosku. {support_roles} wkrótce się z Tobą skontaktuje.",
            welcomeHelp:
                "Można używać {applicant}, {support_roles} i {category}.",
            decisionPreview:
                "Decyzja w wątku · przyciski zamiast /close_application",
            tableCaption: "Do czego służą przyciski kategorii {category}",
            table: {
                button: "Przycisk",
                roles: "Zmiany ról",
                applicant: "Wnioskodawca otrzymuje",
            },
            outcomes: {
                member: "Przyjmij jako członka",
                recruit: "Przyjmij jako rekruta",
                mercenary: "Przyjmij jako najemnika",
                denied: "Odrzuć…",
                pending: "Jeszcze nie podjęto decyzji",
            },
            gets: {
                result: "Wynik i DM",
                reason: "Okno z powodem, wynikiem i DM",
                pending: "Notatka na karcie, brak wiadomości prywatnej",
            },
            noRoleChange: "bez zmian",
            mercenaryMissing: "Brak kategorii najemnika",
            mercenaryMissingNote:
                "Przycisk Zaakceptuj jako najemnik pozostaje wyłączony w Discord, dopóki klan nie będzie miał kategorii najemnika. Dodaj kategorię z wynikiem Najemnik.",
            mercenaryCategoryNote:
                "Zaakceptuj jako najemnik podaje role kategorii {category}, a nie kategorii wybranej przez kandydata.",
            roleSyncOff:
                "Synchronizacja ról jest wyłączona, więc Logi nie zmienia ról.",
            decisionNote:
                "Wsparcie kategorii i administratorzy Logi mogą zdecydować. Polecenie /close_application nadal działa.",
        },
        web: {
            title: "Wariant B · wypełnienie w internecie",
            switch: "Oferuj również wypełnianie w Internecie",
            help: "Na panelu znajduje się drugi przycisk „Wypełnij w Internecie”. Ten sam formularz na stronie Logi, bez limitu 5 pól w oknie, po zalogowaniu się za pomocą Discord. Aplikacja kończy się w tym samym wątku z tymi samymi rolami.",
            note: "Przydatne w przypadku długich formularzy lub wniosków na telefonie, gdzie trudniej jest wypełnić okna Discord.",
            address: "Adres formularza",
        },
        save: {
            changes: {
                one: "{count} niezapisana zmiana",
                few: "{count} niezapisane zmiany",
                many: "{count} niezapisanych zmian",
                other: "{count} niezapisanych zmian",
            },
            note: "Panel w #{channel} aktualizuje się sam po zapisaniu.",
            noteNoChannel: "Panel aktualizuje się sam po zapisaniu.",
            discard: "Odrzuć zmiany",
            save: "Zapisz",
            saved: "Zgłoszenie zapisane.",
            error: "Nie można zapisać zgłoszenia.",
            formInvalid:
                "Formularz zawiera błąd. Popraw zaznaczone pytania i zapisz ponownie.",
        },
    },
    applicationWeb: {
        brand: "Logi · Klan {clan}",
        signedInAs: "Zalogowano się za pomocą Discord jako {name}",
        title: "Zgłoszenie do {clan}",
        stepsLabel: "Kroki zgłoszenia",
        review: "Sprawdź",
        autosave: "Twoje postępy są zapisywane automatycznie.",
        next: "Następny krok",
        back: "Wstecz",
        saving: "Zapisywanie…",
        submit: "Wyślij zgłoszenie",
        submitting: "Wysyłanie…",
        edit: "Edytuj",
        required: "wymagany",
        chooseUpTo: "Wybierz {min} do {max}.",
        reviewTitle: "Sprawdź swoje zgłoszenie",
        reviewNote: "Nieukończony wniosek przechowujemy przez 24 godziny.",
        queued: "Zgłoszenie zostało wysłane. Bot tworzy teraz prywatny wątek…",
        done: "Zgłoszenie zostało wysłane. Rekrutacja odpowie w wątku.",
        openThread: "Otwórz wątek na Discordzie",
        failed: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
        retry: "Spróbuj ponownie",
        expired:
            "Niedokończone zgłoszenie wygasło po 24 godzinach. Wypełnij je ponownie.",
        busy: "Zgłoszenie jest właśnie wysyłane. Proszę chwilę poczekać.",
        unavailable:
            "Nie można teraz użyć formularza. Spróbuj ponownie za chwilę.",
        disabled: "Klan nie przyjmuje obecnie zgłoszeń w Internecie.",
        alreadyOpen: "Masz już otwarte zgłoszenie do klanu.",
        member: "Jesteś już w klanie. Nie musisz wysyłać zgłoszenia.",
        steamLocked:
            "Steam pochodzi wyłącznie z weryfikacji Steam na stronie internetowej Logi.",
        memberHint: "Identyfikator konta Discord członka, który Cię zaprosił.",
        fixErrors: "Popraw zaznaczone pola.",
    },
} as const
