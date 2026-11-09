export const teamsMessages = {
    teams: {
        title: "Týmy",
        description:
            "Vyberte týmy pro zápasy, požádejte o chybějící tým nebo navrhněte změnu.",
        cancel: "Zrušit",
        name: "Název",
        shortCode: "Zkratka",
        shortCodeHelp:
            "Nepovinné, nejvýše 16 znaků; zobrazuje se tam, kde je málo místa.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG nebo WebP do 2 MiB. Obrázek se upraví na čtverec 512×512.",
        upload: "Nahrát logo",
        uploading: "Nahrávání…",
        removeLogo: "Odebrat logo",
        search: "Hledat týmy…",
        loadMore: "Načíst další",
        archivedBadge: "Archivováno",
        empty: "Katalog pro tuto hru zatím neobsahuje žádné týmy.",
        emptySearch: "Tomuto hledání neodpovídá žádný tým.",
        loading: "Načítání týmů…",
        notAvailableForGame: "Katalog týmů není pro tuto hru dostupný.",
        gameDisabled:
            "Tato hra není v pracovním prostoru zapnutá. Týmy můžete procházet i o ně žádat, ale v zápasech je lze použít až po zapnutí hry v nastavení klanu.",
        retry: "Zkusit znovu",
        requestNew: "Požádat o nový tým",
        suggestChange: "Navrhnout změnu",
        suggestChangeTeam: "Navrhnout změnu týmu {name}",
        teamLinks: "Odkazy týmu {name}",
        errors: {
            invalid_team: "Zkontrolujte údaje týmu a zkuste to znovu.",
            game_disabled: "Tato hra není v pracovním prostoru zapnutá.",
            duplicate_name:
                "Tým s tímto názvem už v katalogu pro tuto hru existuje.",
            revision_conflict:
                "Tým byl mezitím změněn. Načtěte ho znovu a zkuste to znovu.",
            idempotency_conflict:
                "Tento požadavek už byl použit s jinými údaji. Zavřete dialog a začněte znovu.",
            not_found: "Tým již neexistuje.",
            archived: "Tým je archivován.",
            not_archived: "Tým není archivován.",
            asset_unavailable:
                "Nahrané logo již není dostupné. Nahrajte ho znovu.",
            limit_reached: "Katalog této hry dosáhl limitu 2000 týmů.",
            guild_already_linked:
                "Tento Discord server už je propojený s týmem.",
            invalid_merge: "Tyto týmy nelze sloučit.",
            forbidden: "Nemáte zde přístup ke katalogu týmů.",
            unavailable: "Katalog týmů je dočasně nedostupný.",
            rate_limited:
                "Příliš mnoho požadavků; chvíli počkejte a zkuste to znovu.",
        },
        uploadErrors: {
            unsupported_type: "Přijímají se pouze obrázky PNG, JPEG a WebP.",
            type_mismatch: "Obsah souboru neodpovídá jeho typu obrázku.",
            bad_dimensions:
                "Obrázek musí mít alespoň 1×1 a nejvýše 4096×4096 pixelů.",
            animated: "Animované obrázky nejsou podporovány.",
            undecodable: "Obrázek se nepodařilo načíst.",
            invalid_kind: "Toto nahrání není logo týmu.",
            invalid_asset: "Nahraný obrázek se nepodařilo uložit.",
            too_large: "Obrázek přesahuje 2 MiB.",
            upload_limited:
                "Příliš mnoho nahrávání. Zkuste to znovu za {seconds} s.",
            forbidden: "Nemáte oprávnění zde nahrávat loga.",
            unavailable: "Nahrávání je dočasně nedostupné.",
        },
        picker: {
            title: "Týmy",
            description:
                "Vyberte z katalogu týmů Logi týmy, které tento zápas hrají. Každý tým si ponechá název a logo z doby výběru, dokud ho neobnovíte.",
            slots: { a: "Tým A", b: "Tým B", c: "Tým C" },
            team: "Tým",
            side: "Strana",
            noTeam: "Bez týmu",
            noSide: "Bez strany",
            search: "Hledat týmy…",
            noResults: "Nebyly nalezeny žádné aktivní týmy.",
            unknownTeam: "Údaje o týmu nejsou dostupné",
            savedSelections: "Uloženo u tohoto zápasu",
            requestTeam: "Požádat o nový tým",
            requestNamed: "Požádat o tým „{name}“",
            requestHint:
                "Chybí tým? Požádejte o něj; vybrat ho půjde, jakmile ho administrátor Logi schválí.",
            requestSent:
                "Žádost byla odeslána. Tým zde půjde vybrat, jakmile ho administrátor Logi schválí; žadatel dostane rozhodnutí soukromou zprávou na Discordu.",
            refreshSnapshot: "Obnovit snímek",
            refreshing: "Obnovování…",
            snapshotRefreshed: "Snímek byl obnoven z katalogu týmů.",
            archivedSelection:
                "Archivovaný tým; uložený snímek u tohoto zápasu zůstává.",
            mergedBadge: "Sloučeno",
            mergedSelection:
                "Tým byl sloučen s jiným týmem v katalogu. Obnovením snímku na něj tento zápas převedete.",
            duplicateTeam: "Každý tým může být zařazen jen do jednoho slotu.",
            duplicateSide: "Každou stranu lze přiřadit jen jednomu týmu.",
            errors: {
                invalid_match_teams: "Přiřazení týmů je neplatné.",
                team_not_found: "Tým v katalogu již neexistuje.",
                team_archived: "Tým je archivován; vyberte jiný tým.",
                team_game_mismatch: "Tým patří k jiné hře.",
                match_concluded:
                    "Ukončené zápasy si své snímky týmů ponechávají.",
                training_event: "Tréninky nemají zápasové týmy.",
                forbidden: "Nemáte oprávnění měnit týmy zápasu.",
                unavailable: "Katalog týmů je dočasně nedostupný.",
                rate_limited:
                    "Příliš mnoho požadavků; chvíli počkejte a zkuste to znovu.",
            },
        },
    },
    teamRequests: {
        title: "Vaše žádosti o týmy",
        description:
            "Žádosti odeslané z tohoto pracovního prostoru. Administrátoři Logi každou schválí, sloučí nebo zamítnou a žadatel dostane rozhodnutí soukromou zprávou na Discordu. Pracovní prostor může mít nejvýše 20 čekajících žádostí.",
        empty: "Tento pracovní prostor zatím o žádné týmy nežádal.",
        loading: "Načítání žádostí…",
        loadMore: "Načíst další",
        retry: "Zkusit znovu",
        kinds: { create: "Nový tým", update: "Změna" },
        statuses: {
            pending: "Čeká",
            approved: "Schváleno",
            merged: "Sloučeno",
            rejected: "Zamítnuto",
            cancelled: "Zrušeno",
        },
        requestedOn: "Odesláno {date}",
        decidedOn: "Rozhodnuto {date}",
        note: "Vaše poznámka",
        reason: "Důvod",
        resultTeam: "Výsledný tým",
        resultTeamUnavailable: "Údaje o týmu nejsou dostupné",
        cancel: "Zrušit žádost",
        cancelRequest: "Zrušit žádost o tým {name}",
        cancelling: "Rušení…",
        cancelled: "Žádost byla zrušena.",
        submitted:
            "Žádost byla odeslána. Administrátoři Logi ji posoudí a rozhodnutí přijde soukromou zprávou na Discordu.",
        dialog: {
            createTitle: "Žádost o nový tým",
            updateTitle: "Návrh změny",
            createDescription:
                "{game} · Administrátoři Logi posuzují každou žádost. Po schválení půjde tým vybrat v zápasech.",
            updateDescription:
                "{game} · Navrhněte nové údaje týmu {name}. Administrátoři Logi změnu posoudí dříve, než se použije.",
            description: "Popis",
            descriptionHelp: "Nepovinné, nejvýše 500 znaků.",
            links: "Odkazy",
            linksHelp:
                "Nejvýše 3 odkazy https, například web týmu nebo pozvánka na Discord.",
            link: "Odkaz {index}",
            addLink: "Přidat odkaz",
            removeLink: "Odebrat odkaz {index}",
            note: "Poznámka pro administrátory",
            noteHelp:
                "Nepovinné, nejvýše 500 znaků. Uveďte cokoli, co pomůže při posouzení.",
            submit: "Odeslat žádost",
            submitting: "Odesílání…",
            cancel: "Zrušit",
            unchanged: "Před odesláním změňte alespoň jeden údaj týmu.",
            duplicate:
                "Tým {name} už v katalogu pro tuto hru je. Vyberte ho, nebo k němu navrhněte změnu.",
        },
        validation: {
            nameRequired: "Zadejte název týmu.",
            nameInvalid: "Použijte nejvýše 120 znaků bez zalomení řádku.",
            shortCodeInvalid: "Použijte nejvýše 16 znaků bez zalomení řádku.",
            descriptionInvalid:
                "Použijte nejvýše 500 znaků bez řídicích znaků.",
            linksInvalid:
                "Každý odkaz musí být adresa https bez uživatelského jména a hesla.",
            linksDuplicate: "Každý odkaz lze uvést jen jednou.",
            linksTooMany: "Uveďte nejvýše 3 odkazy.",
            noteInvalid: "Použijte nejvýše 500 znaků bez řídicích znaků.",
            invalid: "Zkontrolujte údaje žádosti a zkuste to znovu.",
        },
        errors: {
            invalid_request: "Zkontrolujte údaje žádosti a zkuste to znovu.",
            not_found: "Žádost nebo její tým již neexistuje.",
            not_pending:
                "O této žádosti už bylo rozhodnuto, nebo byla zrušena.",
            limit_reached:
                "Tento pracovní prostor už má 20 čekajících žádostí. Počkejte na rozhodnutí, nebo některou zrušte.",
            idempotency_conflict:
                "Tato žádost už byla odeslána s jinými údaji. Zavřete dialog a vytvořte novou žádost.",
            team_archived:
                "Tým je archivován, změny k němu už nelze navrhovat.",
            team_game_mismatch: "Tým patří k jiné hře.",
            invalid_decision: "Toto rozhodnutí není pro žádost možné.",
            forbidden: "Nemáte oprávnění zde spravovat žádosti o týmy.",
            rate_limited:
                "Příliš mnoho požadavků; chvíli počkejte a zkuste to znovu.",
            unavailable: "Žádosti o týmy jsou dočasně nedostupné.",
        },
    },
    signupActivity: {
        title: "Historie přihlášek",
        description:
            "Zjistěte, kdo se přihlásil, změnil roli nebo odhlásil ze zápasů a tréninků.",
        empty: "Zatím žádná aktivita přihlášek.",
        role: "Role",
        noRole: "Bez role",
        actions: {
            signed_up: "se přihlásil(a)",
            changed_role: "změnil(a) roli",
            unsigned: "se odhlásil(a)",
            declined: "odmítl(a)",
        },
        emptyTitle: "Zatím žádné přihlášky",
        emptyDescription:
            "Přihlášky, změny rolí a odhlášky ze zápasů a tréninků se tu objeví, jakmile proběhnou.",
        limitNotice:
            "Zobrazuje se posledních {count} změn. Starší změny tu nejsou.",
        filteredBy: "Jen {event}",
        showAll: "Zobrazit vše",
    },
} as const
