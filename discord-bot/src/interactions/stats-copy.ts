const en = {
    description: "Player statistics for Hell Let Loose and Wardogs",
    game: "Game",
    member: "Linked Discord player (default: you)",
    player: "Wardogs only: find a player by name or Steam ID",
    period: "Statistics period",
    server: "Wardogs only: recorded server",
    channel: "Optional channel for sharing after preview",
    all: "All recorded history",
    missing: "Add your Steam account to load your statistics.",
    otherMissing:
        "This player has no Steam account linked in Logi. They can add it using /stats themselves.",
    ambiguous:
        "More than one Steam account is linked. Choose the account to use with Add / change Steam.",
    otherAmbiguous:
        "This player needs to select their Steam account using /stats themselves.",
    empty: "No recorded statistics for this account and period yet.",
    unavailable:
        "The statistics source is temporarily unavailable. Your Steam link is unchanged.",
    blocked:
        "HLL Records currently blocks automated access. Open the profile below; your Steam link is unchanged.",
    stale: "Showing the last successful read; the source could not be refreshed.",
    forbidden:
        "This action is unavailable. Use /stats again in a server you can access.",
    expired:
        "This private view expired or the bot restarted. Run /stats again.",
    invalid:
        "Choose one target: a Discord member, or a Wardogs player from the suggestions.",
    hllOnly:
        "HLL statistics require a linked Discord player. Player search and server filters apply to Wardogs.",
    incomplete:
        "The history could not be read completely. Try again or choose a shorter period.",
    notConfigured:
        "An administrator must first connect this Discord server in Logi settings.",
    linkChanged:
        "The account link changed during this request. Run /stats again.",
    alreadyLinked:
        "That Steam account is already linked to another Logi player. Ask an administrator to review the link.",
    invalidSteam:
        "Enter a valid 17-digit Steam ID or a steamcommunity.com/profiles/ URL.",
    linkError:
        "Saving could not be confirmed. Run /stats to check your current link; an administrator can help.",
    add: "Add / change Steam",
    modal: "Link your Steam account",
    input: "Steam ID or numeric Steam profile URL",
    declared: "Self-declared Steam link · public statistics only",
    refresh: "Refresh",
    overview: "Overview",
    recent: "Recent games",
    factions: "Factions",
    weapons: "Weapons",
    maps: "Maps",
    share: "Share",
    selectChannel: "Choose the channel for this card",
    shared: "Card shared in the selected channel.",
    shareFailed:
        "Delivery could not be confirmed. Check the selected channel before posting again.",
    shareDenied:
        "You and the bot need access to that channel, Send Messages, Embed Links and Attach Files.",
    combat: "Combat",
    record: "Record",
    form: "Recent form",
    economy: "Cash / playtime",
    kills: "Kills",
    deaths: "Deaths",
    matches: "Games",
    wins: "Wins",
    winRate: "Win rate",
    time: "Playtime",
    cash: "Cash delta",
    coverage: "Metric coverage",
    unknownResults: "Unknown results",
    noItems: "No details available.",
    source: "Source",
    updated: "Last data",
    recorded: "Recorded games in this Discord community",
    hllCoverage: "Tracked community servers only · + means a lower bound",
    formScope: "Last 100 games with at least 20 minutes played",
    saved: "Steam account saved. Loading statistics…",
    chooseSteam: "Steam account selection required",
    session: "Private player statistics",
    viewProfile: "HLL Records",
    ownOnly: "Only the author of this private request can use these controls.",
    memberGone:
        "The selected player is no longer a member of this Discord server.",
}
const cs: typeof en = {
    description: "Statistiky hráčů Hell Let Loose a Wardogs",
    game: "Hra",
    member: "Propojený Discord hráč (výchozí: ty)",
    player: "Pouze Wardogs: vyhledej hráče podle nicku nebo Steam ID",
    period: "Období statistik",
    server: "Pouze Wardogs: sledovaný server",
    channel: "Volitelný kanál pro sdílení po náhledu",
    all: "Celá uložená historie",
    missing: "Pro načtení statistik přidej svůj Steam účet.",
    otherMissing:
        "Hráč nemá v Logim propojený Steam. Může si jej doplnit vlastním příkazem /stats.",
    ambiguous:
        "Máš propojeno více Steam účtů. Přes Přidat / změnit Steam zvol účet pro statistiky.",
    otherAmbiguous:
        "Hráč si musí vybrat svůj Steam účet vlastním příkazem /stats.",
    empty: "Pro tento účet a období zatím nejsou zaznamenané statistiky.",
    unavailable:
        "Zdroj statistik je dočasně nedostupný. Propojení Steamu zůstává uložené.",
    blocked:
        "HLL Records nyní blokuje automatické načítání. Profil otevřeš níže; propojení Steamu zůstává uložené.",
    stale: "Zobrazuji poslední úspěšně načtená data; zdroj se nepodařilo obnovit.",
    forbidden:
        "Akce není dostupná. Spusť /stats znovu na serveru, kam máš přístup.",
    expired:
        "Soukromý náhled vypršel nebo se bot restartoval. Spusť /stats znovu.",
    invalid:
        "Vyber jediný cíl: Discord člena, nebo Wardogs hráče z našeptávače.",
    hllOnly:
        "HLL statistiky vyžadují propojeného Discord hráče. Vyhledávání hráčů a filtr serveru jsou pro Wardogs.",
    incomplete:
        "Historii se nepodařilo přečíst celou. Zkus to znovu nebo vyber kratší období.",
    notConfigured:
        "Správce musí nejprve propojit tento Discord server v nastavení Logiho.",
    linkChanged:
        "Propojení účtu se během načítání změnilo. Spusť /stats znovu.",
    alreadyLinked:
        "Steam účet už je propojený s jiným hráčem Logiho. Požádej administrátora o kontrolu.",
    invalidSteam:
        "Zadej platné 17místné Steam ID nebo odkaz steamcommunity.com/profiles/ s číselným ID.",
    linkError:
        "Uložení se nepodařilo potvrdit. Aktuální propojení ověříš přes /stats; případně pomůže administrátor.",
    add: "Přidat / změnit Steam",
    modal: "Propojení tvého Steamu",
    input: "Steam ID nebo číselný odkaz na profil",
    declared: "Zadané propojení Steamu · pouze veřejné statistiky",
    refresh: "Obnovit",
    overview: "Přehled",
    recent: "Poslední hry",
    factions: "Frakce",
    weapons: "Zbraně",
    maps: "Mapy",
    share: "Sdílet",
    selectChannel: "Vyber kanál pro tuto kartu",
    shared: "Karta byla sdílena do vybraného kanálu.",
    shareFailed:
        "Doručení se nepodařilo potvrdit. Před dalším odesláním zkontroluj vybraný kanál.",
    shareDenied:
        "Ty i bot potřebujete přístup do kanálu, odesílání zpráv, vkládání embedů a přikládání souborů.",
    combat: "Boj",
    record: "Bilance",
    form: "Poslední forma",
    economy: "Cash / odehraný čas",
    kills: "Zabití",
    deaths: "Úmrtí",
    matches: "Hry",
    wins: "Výhry",
    winRate: "Úspěšnost",
    time: "Odehráno",
    cash: "Změna cash",
    coverage: "Pokrytí metrik",
    unknownResults: "Neznámé výsledky",
    noItems: "Podrobnosti nejsou dostupné.",
    source: "Zdroj",
    updated: "Poslední data",
    recorded: "Zaznamenané hry této Discord komunity",
    hllCoverage: "Pouze sledované komunitní servery · + značí dolní hranici",
    formScope: "Posledních 100 her s alespoň 20 minutami hraní",
    saved: "Steam účet uložen. Načítám statistiky…",
    chooseSteam: "Je potřeba vybrat Steam účet",
    session: "Soukromé hráčské statistiky",
    viewProfile: "HLL Records",
    ownOnly: "Tato tlačítka může použít pouze autor soukromého požadavku.",
    memberGone: "Vybraný hráč už není členem tohoto Discord serveru.",
}
const de: typeof en = {
    description: "Spielerstatistiken für Hell Let Loose und Wardogs",
    game: "Spiel",
    member: "Verknüpfter Discord-Spieler (Standard: du)",
    player: "Nur Wardogs: Spielername oder Steam-ID suchen",
    period: "Zeitraum",
    server: "Nur Wardogs: aufgezeichneter Server",
    channel: "Optionaler Kanal zum Teilen nach der Vorschau",
    all: "Gesamte gespeicherte Historie",
    missing: "Verknüpfe dein Steam-Konto, um Statistiken zu laden.",
    otherMissing:
        "Dieser Spieler hat kein Steam-Konto in Logi verknüpft. Er kann es selbst mit /stats hinzufügen.",
    ambiguous:
        "Mehrere Steam-Konten sind verknüpft. Wähle das Konto über Steam hinzufügen / ändern.",
    otherAmbiguous:
        "Dieser Spieler muss sein Steam-Konto selbst mit /stats auswählen.",
    empty: "Für dieses Konto und diesen Zeitraum gibt es noch keine aufgezeichneten Statistiken.",
    unavailable:
        "Die Statistikquelle ist vorübergehend nicht verfügbar. Deine Steam-Verknüpfung bleibt erhalten.",
    blocked:
        "HLL Records blockiert derzeit automatisierte Zugriffe. Öffne das Profil unten; deine Steam-Verknüpfung bleibt erhalten.",
    stale: "Die letzte erfolgreiche Abfrage wird angezeigt; die Quelle konnte nicht aktualisiert werden.",
    forbidden:
        "Diese Aktion ist nicht verfügbar. Nutze /stats erneut auf einem zugänglichen Server.",
    expired:
        "Diese private Ansicht ist abgelaufen oder der Bot wurde neu gestartet. Nutze /stats erneut.",
    invalid:
        "Wähle ein Ziel: ein Discord-Mitglied oder einen Wardogs-Spieler aus den Vorschlägen.",
    hllOnly:
        "HLL benötigt einen verknüpften Discord-Spieler. Spielersuche und Serverfilter gelten für Wardogs.",
    incomplete:
        "Die Historie konnte nicht vollständig gelesen werden. Versuche es erneut oder wähle einen kürzeren Zeitraum.",
    notConfigured:
        "Ein Administrator muss diesen Discord-Server zuerst in Logi verbinden.",
    linkChanged: "Die Kontoverknüpfung wurde geändert. Nutze /stats erneut.",
    alreadyLinked:
        "Dieses Steam-Konto gehört bereits zu einem anderen Logi-Profil. Bitte einen Administrator um Prüfung.",
    invalidSteam:
        "Gib eine gültige 17-stellige Steam-ID oder eine numerische steamcommunity.com/profiles/-URL ein.",
    linkError:
        "Speichern unbestätigt. Prüfe die aktuelle Verknüpfung mit /stats; ein Administrator kann helfen.",
    add: "Steam hinzufügen / ändern",
    modal: "Dein Steam-Konto verknüpfen",
    input: "Steam-ID oder numerische Profil-URL",
    declared: "Selbst angegebene Steam-Verknüpfung · öffentliche Statistiken",
    refresh: "Aktualisieren",
    overview: "Übersicht",
    recent: "Letzte Spiele",
    factions: "Fraktionen",
    weapons: "Waffen",
    maps: "Karten",
    share: "Teilen",
    selectChannel: "Kanal für diese Karte auswählen",
    shared: "Karte im gewählten Kanal geteilt.",
    shareFailed:
        "Zustellung unbestätigt. Prüfe den gewählten Kanal vor einem weiteren Versuch.",
    shareDenied:
        "Du und der Bot benötigen Kanalzugriff, Nachrichten senden, Links einbetten und Dateien anhängen.",
    combat: "Kampf",
    record: "Bilanz",
    form: "Aktuelle Form",
    economy: "Cash / Spielzeit",
    kills: "Kills",
    deaths: "Tode",
    matches: "Spiele",
    wins: "Siege",
    winRate: "Siegquote",
    time: "Spielzeit",
    cash: "Cash-Differenz",
    coverage: "Metrikabdeckung",
    unknownResults: "Unbekannte Ergebnisse",
    noItems: "Keine Details verfügbar.",
    source: "Quelle",
    updated: "Letzte Daten",
    recorded: "Aufgezeichnete Spiele dieser Discord-Community",
    hllCoverage: "Nur erfasste Community-Server · + bedeutet Untergrenze",
    formScope: "Letzte 100 Spiele mit mindestens 20 Minuten Spielzeit",
    saved: "Steam-Konto gespeichert. Statistiken werden geladen…",
    chooseSteam: "Steam-Konto auswählen",
    session: "Private Spielerstatistiken",
    viewProfile: "HLL Records",
    ownOnly:
        "Nur der Autor dieser privaten Anfrage kann die Steuerelemente verwenden.",
    memberGone:
        "Der ausgewählte Spieler ist kein Mitglied dieses Discord-Servers mehr.",
}
export function statsCopy(locale: string) {
    return locale.startsWith("cs") ? cs : locale.startsWith("de") ? de : en
}
