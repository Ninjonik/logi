export const teamsMessages = {
    teams: {
        title: "Drużyny",
        description:
            "Wybierz drużyny na mecze, poproś o brakującą drużynę lub zaproponuj zmianę.",
        cancel: "Anuluj",
        name: "Nazwa",
        shortCode: "Tag drużyny",
        shortCodeHelp:
            "Opcjonalnie, do 16 znaków; pokazano, gdzie jest mało miejsca.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG lub WebP do 2 MiB. Obraz jest normalizowany do kwadratu o wymiarach 512×512.",
        upload: "Prześlij logo",
        uploading: "Przesyłanie…",
        removeLogo: "Usuń logo",
        search: "Wyszukaj drużyny…",
        loadMore: "Załaduj więcej",
        archivedBadge: "Zarchiwizowane",
        empty: "W katalogu nie ma jeszcze drużyn do tej gry.",
        emptySearch: "Żadna drużyna nie pasuje do wyszukiwania.",
        loading: "Ładowanie drużyn…",
        notAvailableForGame: "Katalog drużyn nie jest dostępny dla tej gry.",
        gameDisabled:
            "Ta gra nie jest włączona w tym obszarze roboczym. Możesz przeglądać drużyny i zamawiać je, ale można ich używać w meczach dopiero po włączeniu gry w ustawieniach klanu.",
        retry: "Spróbuj ponownie",
        requestNew: "Zgłoś nową drużynę",
        suggestChange: "Zaproponuj zmianę",
        suggestChangeTeam: "Zaproponuj zmianę na {name}",
        teamLinks: "Linki do {name}",
        errors: {
            invalid_team: "Sprawdź szczegóły drużyny i spróbuj ponownie.",
            game_disabled: "Ta gra nie jest włączona w obszarze roboczym.",
            duplicate_name:
                "Drużyna o tej nazwie znajduje się już w katalogu tej gry.",
            revision_conflict:
                "W międzyczasie skład drużyny się zmienił. Załaduj go ponownie i spróbuj ponownie.",
            idempotency_conflict:
                "To żądanie zostało już wykorzystane z innymi szczegółami. Zamknij okno dialogowe i zacznij od nowa.",
            not_found: "Drużyna już nie istnieje.",
            archived: "Drużyna jest zarchiwizowana.",
            not_archived: "Drużyna nie jest zarchiwizowana.",
            asset_unavailable:
                "Przesłane logo nie jest już dostępne. Prześlij go ponownie.",
            limit_reached: "Katalog tej gry osiągnął limit 2000 drużyn.",
            guild_already_linked:
                "Ten serwer Discord jest już połączony z drużyną.",
            invalid_merge: "Drużyn tych nie można łączyć.",
            forbidden: "Nie masz tutaj dostępu do katalogu drużyny.",
            unavailable: "Katalog drużyny jest chwilowo niedostępny.",
            rate_limited:
                "Zbyt wiele żądań; poczekaj chwilę i spróbuj ponownie.",
        },
        uploadErrors: {
            unsupported_type:
                "Akceptowane są wyłącznie obrazy w formacie PNG, JPEG i WebP.",
            type_mismatch: "Zawartość pliku nie jest zgodna z typem obrazu.",
            bad_dimensions:
                "Obraz musi mieć wymiary co najmniej 1×1 i maksymalnie 4096×4096 pikseli.",
            animated: "Animowane obrazy nie są obsługiwane.",
            undecodable: "Nie można odczytać obrazu.",
            invalid_kind: "To przesłane zdjęcie nie jest logo drużyny.",
            invalid_asset: "Nie można zapisać przesłanego obrazu.",
            too_large: "Rozmiar obrazu przekracza 2 MiB.",
            upload_limited:
                "Za dużo przesłanych plików. Spróbuj ponownie za {seconds} s.",
            forbidden: "Nie możesz przesyłać tutaj logo.",
            unavailable: "Przesyłanie jest chwilowo niedostępne.",
        },
        picker: {
            title: "Drużyny",
            description:
                "Wybierz drużyny rozgrywające ten mecz z katalogu drużyn Logi. Każdy drużyna zachowuje nazwę i logo, które miał w momencie wyboru, dopóki ich nie odświeżysz.",
            slots: { a: "Drużyna A", b: "Drużyna B", c: "Drużyna C" },
            team: "Drużyna",
            side: "Strona",
            noTeam: "Brak drużyny",
            noSide: "Bez strony",
            search: "Wyszukaj drużyny…",
            noResults: "Nie znaleziono aktywnych drużyn.",
            unknownTeam: "Dane drużyny niedostępne",
            savedSelections: "Zapisano na tym meczu",
            requestTeam: "Zgłoś nową drużynę",
            requestNamed: "Zgłoś „{name}”",
            requestHint:
                "Brakuje Ci drużyny? Poproś o to; można go wybrać po zatwierdzeniu przez administratora Logi.",
            requestSent:
                "Zapytanie wysłane. Możesz tutaj wybrać drużyna po zatwierdzeniu go przez administratora Logi; osoba żądająca otrzymuje decyzję jako Discord DM.",
            refreshSnapshot: "Odśwież migawkę",
            refreshing: "Odświeżanie…",
            snapshotRefreshed: "Migawka odświeżona z katalogu drużyny.",
            archivedSelection:
                "Drużyna zarchiwizowana. W tym meczu pozostaje zapisana wersja jej danych.",
            mergedBadge: "Połączone",
            mergedSelection:
                "Drużynę połączono z inną w katalogu. Odśwież zapisane dane, aby użyć nowej drużyny w tym meczu.",
            duplicateTeam:
                "Każdy drużyna może zostać umieszczony tylko w jednym miejscu.",
            duplicateSide:
                "Każda strona może być przypisana tylko do jednej drużyny.",
            errors: {
                invalid_match_teams: "Przypisanie drużyny jest nieprawidłowe.",
                team_not_found: "Drużyna nie istnieje już w katalogu.",
                team_archived: "Drużyna jest zarchiwizowana. Wybierz inną.",
                team_game_mismatch: "Drużyna należy do innej gry.",
                match_concluded: "Zakończone mecze przechowują migawki drużyn.",
                training_event: "Na treningach nie ma drużyn meczowych.",
                forbidden: "Niedozwolona jest zmiana drużyn meczowych.",
                unavailable: "Katalog drużyny jest chwilowo niedostępny.",
                rate_limited:
                    "Zbyt wiele żądań; poczekaj chwilę i spróbuj ponownie.",
            },
        },
    },
    teamRequests: {
        title: "Twoje wnioski dotyczące drużyn",
        description:
            "Żądania wysłane z tego obszaru roboczego. Administratorzy Logi zatwierdzają, łączą lub odrzucają każdy z nich, a osoba żądająca otrzymuje decyzję jako Discord DM. W obszarze roboczym może znajdować się maksymalnie 20 oczekujących żądań.",
        empty: "Ten obszar roboczy nie poprosił jeszcze o żadne drużyny.",
        loading: "Wczytywanie wniosków…",
        loadMore: "Załaduj więcej",
        retry: "Spróbuj ponownie",
        kinds: { create: "Nowa drużyna", update: "Zmiana" },
        statuses: {
            pending: "Oczekuje",
            approved: "Zatwierdzono",
            merged: "Połączone",
            rejected: "Odrzucono",
            cancelled: "Odwołano",
        },
        requestedOn: "Zgłoszono {date}",
        decidedOn: "Rozpatrzono {date}",
        note: "Twoja notatka",
        reason: "Powód",
        resultTeam: "Drużyna po zatwierdzeniu",
        resultTeamUnavailable: "Dane drużyny niedostępne",
        cancel: "Anuluj wniosek",
        cancelRequest: "Anuluj wniosek dla {name}",
        cancelling: "Anuluję…",
        cancelled: "Wniosek anulowany.",
        submitted:
            "Zapytanie wysłane. Administratorzy Logi przejrzą to; decyzja przychodzi jako Discord DM.",
        dialog: {
            createTitle: "Zgłoś nową drużynę",
            updateTitle: "Zaproponuj zmianę",
            createDescription:
                "{game} · Administratorzy Logi przeglądają każde żądanie. Po zatwierdzeniu drużynę można wybierać w meczach.",
            updateDescription:
                "{game} · Zaproponuj nowe szczegóły dla {name}. Administratorzy Logi sprawdzają zmianę przed jej zastosowaniem.",
            description: "Opis",
            descriptionHelp: "Opcjonalnie, do 500 znaków.",
            links: "Linki",
            linksHelp:
                "Maksymalnie 3 linki https, na przykład strona drużyny lub zaproszenie Discord.",
            link: "Link {index}",
            addLink: "Dodaj link",
            removeLink: "Usuń łącze {index}",
            note: "Uwagi dla administratorów",
            noteHelp:
                "Opcjonalnie, do 500 znaków. Wspomnij o wszystkim, co pomoże w recenzji.",
            submit: "Wyślij wniosek",
            submitting: "Wysyłanie…",
            cancel: "Anuluj",
            unchanged:
                "Przed wysłaniem zmień przynajmniej jeden szczegół drużyny.",
            duplicate:
                "{name} jest już w katalogu tej gry. Wybierz go zamiast tego lub zaproponuj zmianę.",
        },
        validation: {
            nameRequired: "Wpisz nazwę drużyny.",
            nameInvalid: "Użyj maksymalnie 120 znaków bez podziału wiersza.",
            shortCodeInvalid:
                "Użyj maksymalnie 16 znaków bez podziału wiersza.",
            descriptionInvalid:
                "Użyj maksymalnie 500 znaków bez znaków kontrolnych.",
            linksInvalid:
                "Każdy link musi być adresem https bez nazwy użytkownika i hasła.",
            linksDuplicate: "Każdy link może być wymieniony tylko raz.",
            linksTooMany: "Dodaj maksymalnie 3 linki.",
            noteInvalid: "Użyj maksymalnie 500 znaków bez znaków kontrolnych.",
            invalid: "Sprawdź szczegóły żądania i spróbuj ponownie.",
        },
        errors: {
            invalid_request: "Sprawdź szczegóły żądania i spróbuj ponownie.",
            not_found: "Żądanie lub jego drużyna już nie istnieje.",
            not_pending: "Ta prośba została już rozpatrzona lub anulowana.",
            limit_reached:
                "W tym obszarze roboczym znajduje się już 20 oczekujących żądań. Poczekaj na decyzję lub najpierw ją anuluj.",
            idempotency_conflict:
                "To żądanie zostało już wysłane z innymi szczegółami. Zamknij okno dialogowe i rozpocznij nowe żądanie.",
            team_archived:
                "Drużyna jest zarchiwizowana. Nie można już zgłaszać zmian.",
            team_game_mismatch: "Drużyna należy do innej gry.",
            invalid_decision:
                "Decyzja ta nie jest możliwa w przypadku wniosku.",
            forbidden: "Nie możesz tutaj zarządzać prośbami drużyny.",
            rate_limited:
                "Zbyt wiele żądań; poczekaj chwilę i spróbuj ponownie.",
            unavailable: "Żądania drużyny są chwilowo niedostępne.",
        },
    },
    signupActivity: {
        title: "Historia zapisów",
        description:
            "Zobacz, kto się zapisał, zmienił role lub wycofał się z meczów i treningów.",
        empty: "Brak historii zapisów.",
        role: "Rola",
        noRole: "Żadnej roli",
        actions: {
            signed_up: "zarejestrowany",
            changed_role: "zmieniona rola",
            unsigned: "wycofał się",
            declined: "odrzucony",
        },
        emptyTitle: "Brak historii zapisów",
        emptyDescription:
            "Zapisy, zmiany ról i wycofania się z meczów i treningów pojawiają się tutaj na bieżąco.",
        limitNotice:
            "Wyświetlanie najnowszych zmian w {count}. Starsze zmiany nie są tutaj wymienione.",
        filteredBy: "Tylko {event}",
        showAll: "Pokaż całą aktywność",
    },
} as const
