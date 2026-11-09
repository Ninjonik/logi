export const settingsHub_guidedSetup = {
    metaTitle: "Poradnik konfiguracji",
    workspace: "Konfiguracja obszaru roboczego",
    exit: "Wyjdź z przewodnika",
    progressLabel: "Postęp poradnika",
    stepsLabel: "Kroki poradnika",
    reopenHint: "Możesz ponownie otworzyć ukończony krok w dowolnym momencie.",
    required: "Wymagane",
    optional: "Opcjonalnie",
    optionalSuffix: "opcjonalnie",
    stepOf: "Krok {number} z {total}",
    doneMark: "Gotowe",
    back: "Wstecz",
    skip: "Pomiń",
    continue: "Dalej",
    finish: "Zakończ",
    saving: "Zapisywanie…",
    saveError: "Zapisywanie nie powiodło się. Spróbuj ponownie.",
    discordUnavailable:
        "Logi nie może teraz odczytać kanałów i ról z Discord. Sprawdź bota w kroku 1.",
    steps: {
        bot: {
            heading: "Zaproś bota Logi do Discord",
            description:
                "Bot ogłasza zdarzenia, tworzy kanały oddziałów i pilnuje ról. Musi znajdować się na serwerze twojego klanu.",
            ready: "Bot jest na serwerze i widzi kanały i role.",
            checking: "Bot jest na serwerze. Sprawdzam, co widzi…",
            blind: "Bot jest na serwerze, ale nie widzi kanałów i ról. Nadaj mu uprawnienia Wyświetlanie kanałów i Zarządzanie rolami w Discord.",
            missing: "Bota nie ma jeszcze na serwerze Twojego klanu.",
            invite: "Zaproś bota",
            checkAgain: "Sprawdź ponownie",
        },
        games: {
            heading: "W jakie gry gra twój klan?",
            description: "Wybierz gry, w które gra Twój klan.",
            groupLabel: "Gry klanowe",
            required: "Wybierz co najmniej jedną grę.",
        },
        profile: {
            heading: "Przedstaw klan",
            description:
                "Nazwa i logo pojawiają się na stronie internetowej Logi oraz w wiadomościach bota.",
            name: "Nazwa klanu",
            namePlaceholder: "Nazwa klanu",
            logo: "Logo",
            logoAlt: "Logo klanu",
            upload: "Prześlij logo",
            uploading: "Przesyłanie…",
            formats: "PNG lub JPG",
            about: "Opis",
            aboutPlaceholder: "Kilka zdań o klanie",
            nameRequired: "Wprowadź nazwę klanu.",
            logoRequired: "Prześlij logo klanu.",
        },
        channels: {
            heading: "Gdzie bot powinien publikować posty?",
            description:
                "Wybierz kanały w swoim Discord. Możesz je później ustawić inaczej dla poszczególnych gier.",
            announcements: "Ogłoszenia",
            announcementsHelp: "Nowe wydarzenia i zmiany w składzie.",
            eventResults: "Wyniki wydarzenia",
            eventResultsHelp:
                "Potwierdzone wyniki meczów i linki do statystyk. Fakultatywny; wspólne dla wszystkich gier.",
            eventInfo: "Informacje o wydarzeniu",
            eventInfoHelp: "Szczegóły wydarzenia i zapisy.",
            errors: "Błędy bota",
            errorsHelp: "Tylko dla administratorów, gdy coś pójdzie nie tak.",
            choose: "Wybierz kanał",
            none: "Brak",
        },
        roles: {
            heading: "Kto należy do klanu i kto nim zarządza?",
            description:
                "Logi rozpoznaje członków klanu i administratorów na podstawie ich ról Discord.",
            clanRole: "Rola w klanie",
            clanRoleHelp:
                "Posiadacz tej roli jest członkiem klanu. Utwórz rolę w ustawieniach serwera Discord → Role i odśwież Logi.",
            adminRole: "Rola administratorów Logi",
            adminRoleHelp:
                "Osoby z tą rolą widzą Ustawienia i mogą je zmieniać.",
            choose: "Wybierz rolę",
            none: "Żadnej roli",
            noResults: "Nie znaleziono roli.",
        },
        gameServers: {
            heading: "Podłącz serwer gier",
            description:
                "Logi może zbierać wyniki i statystyki graczy z Twojego serwera CRCON lub Warcon. Klucz API jest przechowywany w postaci zaszyfrowanej i nikt go więcej nie zobaczy.",
            empty: "Nie ma jeszcze serwera. Połączenie trwa około minuty: adres, identyfikator serwera i klucz API.",
            connect: "Podłącz serwer",
        },
    },
    finished: {
        title: "Przewodnik konfiguracji zakończony.",
        description:
            "Sprawdź listę w ustawieniach. Niedokończone wymagane kroki są wymienione poniżej.",
        openSettings: "Otwórz ustawienia",
        again: "Przejdź ponownie",
    },
} as const
