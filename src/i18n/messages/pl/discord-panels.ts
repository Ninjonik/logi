import { discordPanelsPage_editor } from "./discord-panels-editor"
import { discordPanelsPage_list } from "./discord-panels-list"
export const discordPanelsMessages = {
    discordPanelsPage: {
        newPanel: "Nowy panel",
        time: {
            today: "dzisiaj o {time}",
            yesterday: "wczoraj o {time}",
            date: "{date} o {time}",
            now: "teraz",
        },
        bot: {
            online: "Bot online",
            version: "Wersja {version} · ostatni kontakt {ago}",
            refreshEvery: "Panele odświeżają się co 60 sekund",
            offlineTitle: "Bot nie odpowiada · ostatni kontakt {ago}.",
            offlineBody:
                "Panele nie są odświeżane i nowe nie będą wysyłane. Sprawdź, czy bot działa; uruchom go ponownie po aktualizacji.",
            outdatedTitle: "Bot uruchamia starszą wersję {version}.",
            outdatedBody:
                "Panele Discord wymagają wersji {required} lub nowszej. Uruchom ponownie bota po jego aktualizacji; podczas działania starej wersji panele nie są odświeżane.",
            unknownTitle: "Bot jeszcze się nie zalogował.",
            unknownBody:
                "Panele nie są odświeżane, a nowe nie są wysyłane, dopóki bot nie uruchomi się. Uruchom bota; jego stan pojawia się tutaj w ciągu 30 s.",
            notInServer:
                "Bot nie logował się na tym serwerze Discord od ponad 3 minut. Sprawdź, czy bot Logi został zaproszony na serwer; do tego czasu panele nie są wysyłane.",
        },
        sources: {
            title: "Źródła danych",
            link: "Serwery gier",
            collecting: "Zbieranie · ostatnie dane {ago}",
            collectingNoData: "Zbieranie · brak jeszcze danych",
            notCollecting: "Brak zbierania · włącz zbieranie na serwerach gier",
            stale: "Starsze dane · ostatnie dane {ago}",
            unavailable: "Brak odpowiedzi · ostatnie dane {ago}",
            liveOk: "Dane na żywo ✓",
            liveLimited: "Dane na żywo są obecnie ograniczone",
            empty: "Nie ma jeszcze serwera gry. Dodaj jeden na serwerach gier.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: discordPanelsPage_list,
        actions: {
            accepted: {
                publish: "Wysłano do publikacji. Bot podnosi go w ciągu 15 s.",
                refresh:
                    "Zażądano odświeżenia. Bot przerysowuje panel w ciągu 15 sekund.",
                pause: "Panel jest wstrzymany. Wiadomość pozostaje i nie jest odświeżana.",
                resume: "Panel ponownie działa. Bot przerysowuje go w ciągu 15 sekund.",
                retry: "Próbujemy ponownie w ciągu 15 sekund.",
                delete: "Komunikat zostanie usunięty z Discord w ciągu 15 sekund. Panel pozostaje zapisany jako niewysłany.",
                remove: "Panel jest usuwany wraz z komunikatami Discord.",
                control:
                    "Bot ponownie rysuje komunikat kontrolny serwera w ciągu 15 sekund.",
            },
            failed: "Akcja nie zadziałała. Spróbuj ponownie.",
            notSent: "Panelu nie ma jeszcze w Discord.",
            removing: "Panel jest usuwany.",
            notFound: "Panel już nie istnieje.",
        },
        editor: discordPanelsPage_editor,
    },
    discordPanelStatus: {
        states: {
            published: "Opublikowany",
            error: "Błąd",
            waiting: "Oczekiwanie na bota",
            unsent: "Nie wysłano",
            paused: "Wstrzymano",
        },
        botOnline: "Bot online",
        botVersion: "Wersja {version} · ostatni kontakt {ago}",
        refreshEvery: "Panele odświeżają się co 60 sekund",
        botOffline:
            "Bot nie odpowiada · ostatni kontakt {ago}. Panele nie są odświeżane i nowe nie będą wysyłane. Sprawdź, czy bot działa; uruchom go ponownie po aktualizacji.",
        botNeverSeen:
            "Bot jeszcze się nie zalogował. Panele nie odświeżają się, a nowe nie są wysyłane do czasu uruchomienia bota.",
        botOutdated:
            "Bot uruchamia starszą wersję {version}. Panele Discord wymagają wersji {required} lub nowszej. Uruchom ponownie bota po aktualizacji; podczas działania starej wersji panele nie są odświeżane.",
        permissions: {
            view_channel: "Wyświetl kanał",
            send_messages: "Wyślij wiadomości",
            embed_links: "Osadzanie łączy",
            attach_files: "Dołącz pliki",
            read_message_history: "Przeczytaj historię wiadomości",
        },
        errors: {
            bot_not_in_server: {
                title: "Bota nie ma na serwerze Discord.",
                past: "Bota nie było na serwerze Discord.",
                fix: "Zaproś ponownie bota Logi na serwer, a następnie kliknij Spróbuj ponownie.",
            },
            channel_missing: {
                title: "Kanał {channel} już nie istnieje lub bot go nie widzi.",
                past: "Kanał {channel} nie istnieje lub bot go nie widzi.",
                fix: "Wybierz inny kanał w edytorze i zapisz.",
            },
            channel_type: {
                title: "Wiadomości nie mogą być publikowane w {channel}.",
                past: "Nie można opublikować wiadomości w {channel}.",
                fix: "Wybierz kanał tekstowy lub anonsowy w edytorze.",
            },
            missing_permissions: {
                title: "Bot nie ma uprawnienia {permissions} w {channel}.",
                past: "Botowi brakowało uprawnień {permissions} w {channel}.",
                fix: "W Discord otwórz Edytuj kanał → Uprawnienia → Logi i włącz {permissions}. Następnie kliknij Spróbuj ponownie.",
            },
            delivery_uncertain: {
                title: "Discord nie potwierdził, czy otrzymał wiadomość.",
                past: "Discord nie potwierdził, czy otrzymał wiadomość.",
                fix: "Bot znajduje wiadomość przy następnym odświeżeniu lub wysyła ją ponownie. Nic do zrobienia.",
            },
            discord_unavailable: {
                title: "Discord w tej chwili nie odpowiada.",
                past: "Discord nie odpowiedział na czas.",
                fix: "Bot samodzielnie ponawia próbę. Jeśli to trwa długo, kliknij Spróbuj ponownie.",
            },
            source_missing: {
                title: "Serwer gier panelu nie znajduje się już w Logi.",
                past: "Serwer gier panelu nie znajdował się w Logi.",
                fix: "Wybierz inny serwer w edytorze lub usuń panel.",
            },
            source_not_collecting: {
                title: "Logi nie zbiera danych z serwera gry.",
                past: "Logi nie zbierał danych z serwera gry.",
                fix: "Włącz zbieranie na serwerach gier, a następnie kliknij Spróbuj ponownie.",
            },
            provider_unreachable: {
                title: "Serwer gry nie odpowiada.",
                past: "Serwer gry nie odpowiedział.",
                fix: "Panel pokazuje ostatnie dane. Sprawdź adres i klucz na serwerach gry.",
            },
            provider_rate_limited: {
                title: "Dostawca danych odrzuca obecnie więcej żądań.",
                past: "Dostawca danych odrzucił dalsze żądania.",
                fix: "Panel pokazuje ostatnie dane i ponawia próby. Jeśli trwa to ponad godzinę, zwiększ limit klucza lub wymień go na serwerach Gry.",
            },
            render_failed: {
                title: "Nie można zbudować panelu.",
                past: "Nie można zbudować panelu.",
                fix: "Skróć tytuł lub opis panelu. Jeśli błąd będzie się powtarzał, zgłoś go do wsparcia technicznego Logi.",
            },
            unsupported_kind: {
                title: "Bot nie obsługuje jeszcze tego rodzaju panelu.",
                past: "Bot nie obsługiwał tego rodzaju panelu.",
                fix: "Zaktualizuj bota i uruchom go ponownie.",
            },
            competition_missing: {
                title: "Konkurencja panelu już nie istnieje.",
                past: "Konkurencja panelu nie istniała.",
                fix: "Wybierz w edytorze inną konkurencję lub usuń panel.",
            },
            league_disabled: {
                title: "Wardogs League jest wyłączone w Ustawieniach, więc bot usunął wiadomości panelu.",
                past: "Wardogs League zostało wyłączone w Ustawieniach.",
                fix: "Włącz Wardogs League w Ustawieniach → Wardogs League; następnie bot ponownie wysyła obie wiadomości.",
            },
            unknown: {
                title: "Nie można wysłać wiadomości.",
                past: "Nie można wysłać wiadomości.",
                fix: "Kliknij przycisk Spróbuj ponownie. Jeśli błąd będzie się powtarzał, zgłoś go do wsparcia technicznego Logi.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "Kanał jest teraz publiczny, więc hasło zostało usunięte z panelu. Przenieś panel na kanał prywatny, aby ponownie wyświetlić hasło.",
            live_data_unavailable:
                "są obecnie niedostępne; panel pokazuje ostatnio zebrane dane.",
            attach_files_missing:
                "Bot nie ma uprawnień do dołączania plików, więc na panelu nie ma obrazu.",
        },
    },
    discordPreview: {
        regionLabel: "Podgląd wiadomości Discord",
        appTag: "Aplikacja",
        edited: "(edytowane)",
        usedCommand: "{user} użył(a) {command}",
        onlyYouCanSee: "Tylko Ty możesz to zobaczyć",
        dismissMessage: "Odrzuć wiadomość",
        buttons: "Przyciski wiadomości",
        externalLink: "link zewnętrzny",
        unavailable: "niedostępne",
        unknownUser: "użytkownik",
        unknownRole: "rola",
        unknownChannel: "kanał",
    },
    joinPage: {
        metaTitle: "Dołącz do {name}",
        metaDescription: "Dołącz do serwera gry {name}.",
        opening: "Otwarcie {game}…",
        players: "Gracze {players} / {capacity}",
        queue: "Kolejka {queue}",
        steamPrompt: "Steam pyta, czy otworzyć łącze. Potwierdź Otwórz.",
        manualTitle: "Dołącz ręcznie",
        addressLabel: "Adres serwera",
        copy: "Kopiuj",
        copied: "Skopiowano",
        copyFailed:
            "Kopiowanie nie powiodło się. Wybierz adres i skopiuj go samodzielnie.",
        steamInstructions:
            "W Steam: Wyświetl → Serwery gier → Ulubione → Dodaj serwer i wklej adres.",
        backToDiscord: "Powrót do Discord",
        joinCodeTitle: "Kod dołączenia",
        joinCodeLabel: "Kod umożliwiający dołączenie do gry",
        joinCodeHelp:
            "W grze otwórz opcję dołączenia do gry i wprowadź ten kod.",
        noAddress:
            "Adres serwera nie jest jeszcze ustawiony. Zapytaj administratora klanu.",
        noJoinCode:
            "Kod przyłączania nie jest jeszcze ustawiony. Zapytaj administratora klanu.",
        notFoundTitle: "Nie znaleziono serwera",
    },
} as const
