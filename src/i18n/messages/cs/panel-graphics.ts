export const panelGraphicsMessages = {
    panelGraphicsPage: {
        breadcrumbParent: "Panely v Discordu",
        unnamedServer: "Server bez názvu",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Styl panelu",
            description:
                "Jak vypadají panely serverů v Discordu. Platí pro všechny panely, které nemají vlastní styl.",
            defaultLabel: "Výchozí styl",
            logiDefault: "Výchozí",
            options: {
                a: {
                    title: "Styl A · Obrázek",
                    description:
                        "Bot vykreslí obrázek skóre a nahraje ho znovu nejvýš jednou za 60 s.",
                },
                b: {
                    title: "Styl B · Banner a miniatura",
                    description:
                        "Banner serveru nahoře, miniatura mapy vpravo, znaky a ukazatel hráčů.",
                },
                c: {
                    title: "Styl C · Kompaktní",
                    description:
                        "Jen text se znaky a ukazatelem. Nejkratší zpráva.",
                },
            },
            perPanel: "Jiný styl pro jeden panel nastavíte v",
            perPanelLink: "editoru panelu",
        },
        banners: {
            title: "Bannery serverů",
            description:
                "Obrázek nahoře v panelu ve stylu B a pozadí obrázku skóre ve stylu A. Jeden na server.",
            empty: "Zatím tu není žádný herní server. Přidejte ho v nastavení Herní servery.",
            emptyLink: "Herní servery",
            customChip: "Vlastní banner",
            mapChip: "Obrázek mapy",
            noneChip: "Bez banneru",
            mapOverlay: "obrázek mapy",
            liveServer: "Živý server",
            banner: "Banner",
            upload: "Nahrát banner",
            uploading: "Nahrávám…",
            remove: "Odebrat",
            help: "PNG, JPG nebo WebP · poměr 3 : 1, třeba 1200 × 400 · nejvýš 2 MB.",
            uploadedFile: "Nahráno {name} · {width} × {height} · {size}.",
            uploadedBanner: "Nahráno · {width} × {height} · {size}.",
            withoutBanner:
                "Bez banneru: ukáže se obrázek aktuální mapy, teď {map}.",
            withoutBannerUnknownMap:
                "Bez banneru: ukáže se obrázek aktuální mapy.",
            withoutBannerOff: "Bez banneru je panel bez obrázku nahoře.",
            crop: "Výřez",
            crops: { top: "Nahoře", center: "Střed", bottom: "Dole" },
            useMapImage: "Použít obrázek mapy, když banner chybí",
            barColor: "Barva lišty",
            barColorInput: "Barva lišty v šestnáctkovém zápisu",
            clanColor: "Barva klanu",
            clanColorNote: "barva klanu",
            barColorInvalid: "Zadejte barvu ve tvaru #RRGGBB.",
        },
        maps: {
            title: "Obrázky map",
            description:
                "Miniatura v panelu a pozadí obrázku skóre, když server nemá vlastní banner. Logi má vestavěné obrázky; klan je může nahradit.",
            customCount: {
                one: "{count} vlastní",
                few: "{count} vlastní",
                many: "{count} vlastního",
                other: "{count} vlastních",
            },
            search: "Hledat mapu",
            searchPlaceholder: "Název mapy",
            game: "Hra",
            all: "Vše",
            builtinChip: "Výchozí Logi",
            customChip: "Vlastní",
            noneChip: "Bez obrázku",
            replace: "Nahradit vlastním",
            restore: "Obnovit výchozí",
            upload: "Nahrát obrázek",
            uploading: "Nahrávám…",
            imageAlt: "Mapa {name}",
            footer: "Zobrazeno {shown} z {total} map · vlastní obrázek: PNG, JPG nebo WebP, čtverec aspoň 160 × 160, nejvýš 2 MB.",
            noResults: "Hledání neodpovídá žádná mapa.",
        },
        factions: {
            title: "Ikony frakcí",
            description:
                "Pevné, nedají se měnit. Bot je sám nahraje do Discordu jako emoji aplikace a používá je ve všech panelech, výsledcích a v lize.",
            uploaded: "Nahráno do Discordu ✓ · {count} emoji",
            pending: "Nahráno do Discordu {ready} z {total} emoji",
            hllTitle: "Hell Let Loose · národy",
            hllChip: "vlastní ikony Logi",
            nations: {
                us: { name: "USA", side: "Spojenci" },
                gb: { name: "Velká Británie", side: "Spojenci" },
                sov: { name: "Sovětský svaz", side: "Spojenci" },
                cw: { name: "Commonwealth", side: "Spojenci" },
                ger: { name: "Německo", side: "Osa" },
                dak: { name: "Afrikakorps", side: "Osa" },
                allies: {
                    name: "Spojenci",
                    side: "když server národ neuvede",
                },
                axis: { name: "Osa", side: "když server národ neuvede" },
            },
            wardogsTitle: "Wardogs · frakce",
            wardogsChip: "ikony Wardogs, licence MIT",
            wardogsHint: "na tmavém pozadí, jak je uvidíte v Discordu",
            wardogs: {
                valkyra: { name: "Valkyra", role: "frakce" },
                manticore: { name: "Manticore", role: "frakce" },
                lonestar: { name: "Lonestar", role: "frakce" },
                wardogs: { name: "Wardogs", role: "znak hry" },
            },
            note: "Znaky národů HLL jsou naše jednoduché ikony, ne grafika ze hry.",
        },
        status: {
            title: "Stavové ikony a ukazatel hráčů",
            description:
                "Také pevné; bot je nahraje spolu s ikonami frakcí. Vedle ikony je vždy slovo.",
            states: {
                live: { name: "Živě", hint: "server hraje" },
                seeding: { name: "Seedujeme", hint: "pod 40 hráči, běží seed" },
                empty: { name: "Prázdný", hint: "nikdo nehraje" },
                offline: { name: "Nedostupný", hint: "server neodpovídá" },
            },
            gauge: {
                players: {
                    name: "Hráči",
                    hint: "jeden dílek = desetina kapacity",
                },
                queue: { name: "Fronta", hint: "za mezerou" },
                free: { name: "Volné místo", hint: "" },
            },
            sample: "Ukázka v panelu",
            sampleQueue: "{count} / {capacity} hráčů, fronta {queue}",
            sampleSeed: "{count} / {capacity} hráčů, seed do {target}",
        },
        saveNote:
            "bannery a styl se projeví při dalším obnovení panelů, nejpozději do 60 s",
        saved: "Grafika panelů je uložená.",
        reload: "Načíst znovu",
        errors: {
            conflict:
                "Grafiku mezitím změnil někdo jiný. Načtěte stránku znovu a změny zopakujte.",
            asset_unavailable:
                "Obrázek už není k dispozici. Nahrajte ho prosím znovu.",
            unknown_server:
                "Herní server už neexistuje. Načtěte stránku znovu.",
            invalid_request: "Některá hodnota není platná.",
            forbidden: "Nemáte oprávnění měnit grafiku panelů.",
            unavailable: "Uložení se nepovedlo. Zkuste to znovu.",
        },
        uploadErrors: {
            unsupported_type: "Přijímají se jen obrázky PNG, JPG a WebP.",
            type_mismatch: "Obsah souboru neodpovídá jeho typu obrázku.",
            bad_dimensions:
                "Obrázek je příliš malý nebo velký. Obrázek mapy musí mít aspoň 160 × 160 pixelů, žádný obrázek víc než 4096 × 4096.",
            animated: "Animované obrázky nejsou podporované.",
            undecodable: "Obrázek se nepodařilo načíst.",
            invalid_kind: "Tento obrázek sem nahrát nejde.",
            invalid_asset: "Nahraný obrázek se nepodařilo uložit.",
            too_large: "Obrázek je větší než 2 MB.",
            upload_limited:
                "Příliš mnoho nahrávání. Zkuste to znovu za {seconds} s.",
            forbidden: "Nemáte oprávnění nahrávat obrázky.",
            unavailable: "Nahrávání je dočasně nedostupné.",
        },
    },
    publicPanelAppearance: {
        title: "Vzhled",
        description:
            "Rozvržení, barva zvýraznění, banner a emoji frakcí tohoto panelu. Panely uložené před zavedením těchto nastavení si ponechají dosavadní vzhled, dokud je zde nezměníš.",
        mapArtwork: "Obrázek mapy",
        layout: "Rozvržení",
        showMap: "Zobrazit název a obrázek mapy",
        showScoreboard: "Zobrazit skóre",
        showPlayerCount: "Zobrazit počet hráčů",
        compact: "Kompaktní záhlaví",
        layoutHelp:
            "Kompaktní režim používá dvouřádkové záhlaví, skóre na jednom řádku a žádné oddělovače. Obrázek mapy navíc vyžaduje zapnutý Obrázek mapy.",
        resultsLayoutHelp:
            "Oznámení výsledků používají nastavení mapy a kompaktního režimu; skóre a počet hráčů platí pro živé panely.",
        accentColor: "Barva zvýraznění",
        accentColorPicker: "Vybrat barvu zvýraznění",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Nahrazuje zelenou barvu živého panelu; zastaralé nebo pozastavené panely si ponechají oranžové varování. Prázdné pole použije výchozí barvu.",
        accentColorReset: "Výchozí barva",
        accentColorInvalid: "Zadej barvu ve formátu #RRGGBB.",
        banner: "Banner",
        bannerHelp:
            "PNG, JPEG nebo WebP do 2 MiB a 4096 × 4096 px. Logi jej převede na WebP o velikosti nejvýše 1920 × 1080 px. Banner nahrazuje náhled mapy.",
        bannerUpload: "Nahrát banner",
        bannerUploading: "Nahrávám…",
        bannerRemove: "Odebrat banner",
        bannerPreview: "Náhled banneru",
        bannerNone:
            "Bez banneru. Panel zobrazí obrázek mapy, pokud je zapnutý.",
        bannerUploaded: "Banner je nahraný. Ulož panel, aby se zveřejnil.",
        bannerSelected: "Banner je vybraný. Ulož panel, aby se zveřejnil.",
        bannerLibrary: "Nahrané bannery",
        bannerLibraryShow: "Vybrat nahraný banner",
        bannerLibraryHide: "Skrýt nahrané bannery",
        bannerLibraryLoading: "Načítám nahrané bannery…",
        bannerLibraryEmpty:
            "V tomto workspace zatím nikdo nenahrál žádný banner.",
        bannerLibraryError: "Nahrané bannery nelze načíst. Zkus to později.",
        bannerLibraryItem: "Použít banner {width} × {height} px nahraný {date}",
        factionEmoji: "Emoji frakcí",
        factionEmojiHelp:
            "Jedno Unicode emoji, nebo vlastní Discord emoji ve tvaru <:nazev:id> (animované: <a:nazev:id>). Vlastní emoji musí patřit serveru, na kterém je bot, nebo aplikaci bota. Prázdné pole ponechá výchozí hodnotu zobrazenou jako nápověda.",
        factionEmojiInvalid: "Zadej jedno emoji nebo <:nazev:id>.",
        noDefaultEmoji: "Žádné",
        factions: {
            allies: "Spojenci",
            axis: "Osa",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid: "Před uložením oprav zvýrazněná nastavení vzhledu.",
        errors: {
            invalid_kind: "Tento typ obrázku nelze použít jako banner.",
            unsupported_type: "Použij obrázek PNG, JPEG nebo WebP.",
            type_mismatch:
                "Obsah souboru neodpovídá jeho typu. Exportuj jej znovu jako PNG, JPEG nebo WebP.",
            bad_dimensions: "Obrázek smí mít nejvýše 4096 × 4096 pixelů.",
            animated: "Animované obrázky nejsou podporované.",
            undecodable:
                "Obrázek nelze přečíst. Exportuj jej znovu a zkus to znovu.",
            invalid_asset:
                "Obrázek se nepodařilo uložit. Zkus nahrání zopakovat.",
            forbidden: "Bannery mohou nahrávat jen správci workspace.",
            too_large: "Obrázek je větší než 2 MiB.",
            upload_limited:
                "Příliš mnoho nahrání. Zkus to znovu za {seconds} s.",
            unavailable: "Nahrávání obrázků není dostupné. Zkus to později.",
            asset_unavailable:
                "Banner už pro tento workspace není dostupný. Nahraj jej znovu nebo jej odeber a pak ulož.",
        },
    },
} as const
