const copy = {
    pl: {
        title: "Plan taktyczny",
        tbd: "do ustalenia / nie wybrano",
        layout: "Układ / oznaczenie strefy",
        layoutPlaceholder:
            "np. uzgodniony układ serwera lub odniesienie do siatki",
        generate: "Utwórz plan taktyczny",
        clear: "Usuń plan",
        controlZone: "Control Zone",
        hotZone: "Hot Zone",
        team: "Drużyna",
        marker: "Umieść na mapie",
        hint: "Wybierz znacznik i kliknij mapę lub wprowadź X/Y poniżej. Współrzędne i promień to procent obrazu.",
        planned:
            "Ręczny plan meczów. O lokalizacji i wielkości stref decyduje organizator; nie są to układy działającego serwera. Bazy frakcji korzystają z istniejącego katalogu map.",
        radius: "Promień (%)",
        halfWidth: "Połowa szerokości (%)",
        downloading: "Przygotowywanie obrazu…",
        downloadError: "Nie można wyeksportować mapy. Spróbuj ponownie.",
        removeMarker: "Usuń znacznik",
        empty: "Wybierz mapę, aby przygotować strefy i pozycje drużyn.",
        download: "Pobierz mapę (SVG)",
    },
    fr: {
        title: "Plan tactique", tbd: "À définir / non sélectionné",
        layout: "Configuration / repère de zone", layoutPlaceholder: "ex. : configuration convenue du serveur ou coordonnées de grille",
        generate: "Créer un plan tactique", clear: "Retirer le plan", controlZone: "Control Zone", hotZone: "Hot Zone", team: "Équipe", marker: "Placer sur la carte",
        hint: "Sélectionnez un marqueur et cliquez sur la carte, ou saisissez X/Y ci-dessous. Les coordonnées et le rayon sont exprimés en pourcentage de l’image.",
        planned: "Plan de match manuel. L’organisateur choisit la position et la taille des zones ; elles ne reflètent pas la configuration en direct du serveur. Les bases des factions proviennent du catalogue des cartes.",
        radius: "Rayon (%)", halfWidth: "Demi-largeur (%)", downloading: "Préparation de l’image…", downloadError: "Impossible d’exporter la carte. Réessayez.",
        removeMarker: "Retirer le marqueur", empty: "Choisissez une carte pour préparer les zones et les positions des équipes.", download: "Télécharger la carte (SVG)",
    },
    en: {
        title: "Tactical plan",
        tbd: "TBD / not selected",
        layout: "Layout / zone reference",
        layoutPlaceholder: "e.g. agreed server layout or grid reference",
        generate: "Create tactical plan",
        clear: "Remove plan",
        controlZone: "Control Zone",
        hotZone: "Hot Zone",
        team: "Team",
        marker: "Place on map",
        hint: "Select a marker and click the map, or enter X/Y below. Coordinates and radius are percentages of the image.",
        planned:
            "Manual match plan. Zone positions and sizes are chosen by the organiser; they are not the live server layout. Faction bases use the existing map catalogue.",
        radius: "Radius (%)",
        halfWidth: "Half-width (%)",
        downloading: "Preparing image…",
        downloadError: "The map could not be exported. Try again.",
        removeMarker: "Remove marker",
        empty: "Choose a map to prepare the zones and team positions.",
        download: "Download map (SVG)",
    },
    cs: {
        title: "Taktický plán",
        tbd: "TBD / neurčeno",
        layout: "Layout / označení zóny",
        layoutPlaceholder: "Např. domluvený layout serveru nebo sektor",
        generate: "Vytvořit taktický plán",
        clear: "Odebrat plán",
        controlZone: "Control Zone",
        hotZone: "Hot Zone",
        team: "Tým",
        marker: "Umístit na mapu",
        hint: "Vyberte značku a klikněte do mapy nebo zadejte X/Y níže. Souřadnice a poloměr jsou v procentech obrázku.",
        planned:
            "Ruční plán zápasu. Pozice a velikosti zón zadává organizátor; nejde o živý layout serveru. Základny frakcí jsou ze stávajícího katalogu map.",
        radius: "Poloměr (%)",
        halfWidth: "Polovina šířky (%)",
        downloading: "Příprava obrázku…",
        downloadError: "Mapu se nepodařilo exportovat. Zkuste to znovu.",
        removeMarker: "Odebrat značku",
        empty: "Vyberte mapu pro přípravu zón a pozic týmů.",
        download: "Stáhnout mapu (SVG)",
    },
    de: {
        title: "Taktischer Plan",
        tbd: "TBD / offen",
        layout: "Layout / Zonenbezeichnung",
        layoutPlaceholder: "Z. B. vereinbartes Serverlayout oder Planquadrat",
        generate: "Taktischen Plan erstellen",
        clear: "Plan entfernen",
        controlZone: "Control Zone",
        hotZone: "Hot Zone",
        team: "Team",
        marker: "Auf Karte platzieren",
        hint: "Markierung wählen und auf die Karte klicken oder X/Y eingeben. Koordinaten und Radius sind Prozentwerte des Bildes.",
        planned:
            "Manueller Spielplan. Positionen und Größen der Zonen werden vom Organisator gewählt; dies ist kein Live-Serverlayout. Fraktionsbasen stammen aus dem bestehenden Kartenkatalog.",
        radius: "Radius (%)",
        halfWidth: "Halbe Breite (%)",
        downloading: "Bild wird vorbereitet…",
        downloadError:
            "Die Karte konnte nicht exportiert werden. Erneut versuchen.",
        removeMarker: "Markierung entfernen",
        empty: "Eine Karte wählen, um Zonen und Teampositionen vorzubereiten.",
        download: "Karte herunterladen (SVG)",
    },
}
export function tacticalPlanCopy(locale: string) {
    return copy[
        locale === "cs"
            ? "cs"
            : locale === "de"
              ? "de"
              : locale === "fr" ? "fr" : locale === "pl"
                ? "pl"
                : "en"
    ]
}
