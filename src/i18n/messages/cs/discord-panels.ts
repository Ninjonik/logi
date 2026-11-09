import { discordPanelsPage_editor } from "./discord-panels-editor"
import { discordPanelsPage_list } from "./discord-panels-list"
export const discordPanelsMessages = {
    discordPanelsPage: {
        newPanel: "Nový panel",
        time: {
            today: "dnes v {time}",
            yesterday: "včera v {time}",
            date: "{date} v {time}",
            now: "teď",
        },
        bot: {
            online: "Bot online",
            version: "verze {version} · poslední kontakt {ago}",
            refreshEvery: "Panely se obnovují každých 60 s",
            offlineTitle: "Bot neodpovídá · poslední kontakt {ago}.",
            offlineBody:
                "Panely se teď neobnovují a nové se neodešlou. Zkontrolujte, že bot běží; po aktualizaci ho restartujte.",
            outdatedTitle: "Bot běží starší verzi {version}.",
            outdatedBody:
                "Panely v Discordu potřebují verzi {required} nebo novější. Po aktualizaci bota restartujte; dokud běží stará verze, panely se neobnovují.",
            unknownTitle: "Bot se zatím neozval.",
            unknownBody:
                "Panely se neobnovují a nové se neodešlou, dokud bot neběží. Spusťte bota; stav se tu ukáže do 30 s.",
            notInServer:
                "Bot se na tomto Discord serveru neozval přes 3 minuty. Zkontrolujte, že je bot Logi na serveru pozvaný; dokud tu není, panely se neodešlou.",
        },
        sources: {
            title: "Zdroje dat",
            link: "Herní servery",
            collecting: "Sbírá · poslední data {ago}",
            collectingNoData: "Sbírá · zatím bez dat",
            notCollecting: "Nesbírá · zapněte sběr v Herní servery",
            stale: "Starší data · poslední data {ago}",
            unavailable: "Neodpovídá · poslední data {ago}",
            liveOk: "Živá data ✓",
            liveLimited: "živá data teď omezená",
            empty: "Zatím tu není žádný herní server. Přidejte ho v Herní servery.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: discordPanelsPage_list,
        actions: {
            accepted: {
                publish: "Odesláno ke zveřejnění. Bot ho převezme do 15 s.",
                refresh: "Obnova vyžádána. Bot panel překreslí do 15 s.",
                pause: "Panel je pozastavený. Zpráva zůstává a neobnovuje se.",
                resume: "Panel znovu běží. Bot ho překreslí do 15 s.",
                retry: "Zkusíme to znovu do 15 s.",
                delete: "Zpráva se z Discordu odstraní do 15 s. Panel zůstane uložený jako neodeslaný.",
                remove: "Panel se odstraní spolu se zprávami v Discordu.",
                control: "Bot zprávu Ovládání serveru překreslí do 15 s.",
            },
            failed: "Akce se nepovedla. Zkuste to znovu.",
            notSent: "Panel ještě není v Discordu.",
            removing: "Panel se právě odstraňuje.",
            notFound: "Panel už neexistuje.",
        },
        editor: discordPanelsPage_editor,
    },
    discordPanelStatus: {
        states: {
            published: "Zveřejněno",
            error: "Chyba",
            waiting: "Čeká na bota",
            unsent: "Neodesláno",
            paused: "Pozastaveno",
        },
        botOnline: "Bot online",
        botVersion: "verze {version} · poslední kontakt {ago}",
        refreshEvery: "Panely se obnovují každých 60 s",
        botOffline:
            "Bot neodpovídá · poslední kontakt {ago}. Panely se teď neobnovují a nové se neodešlou. Zkontrolujte, že bot běží; po aktualizaci ho restartujte.",
        botNeverSeen:
            "Bot se zatím neozval. Panely se neobnovují a nové se neodešlou, dokud bot neběží.",
        botOutdated:
            "Bot běží starší verzi {version}. Panely v Discordu potřebují verzi {required} nebo novější. Po aktualizaci bota restartujte; dokud běží stará verze, panely se neobnovují.",
        permissions: {
            view_channel: "Zobrazit kanál",
            send_messages: "Posílat zprávy",
            embed_links: "Vkládat odkazy",
            attach_files: "Přikládat soubory",
            read_message_history: "Číst historii zpráv",
        },
        errors: {
            bot_not_in_server: {
                title: "Bot není na Discord serveru.",
                past: "Bot nebyl na Discord serveru.",
                fix: "Pozvěte bota Logi znovu na server a pak klikněte Zkusit znovu.",
            },
            channel_missing: {
                title: "Kanál {channel} už neexistuje nebo ho bot nevidí.",
                past: "Kanál {channel} neexistoval nebo ho bot neviděl.",
                fix: "V editoru vyberte jiný kanál a uložte.",
            },
            channel_type: {
                title: "Do kanálu {channel} nejde poslat zprávu.",
                past: "Do kanálu {channel} nešlo poslat zprávu.",
                fix: "V editoru vyberte textový kanál nebo kanál s oznámeními.",
            },
            missing_permissions: {
                title: "Bot nemá oprávnění {permissions} v {channel}.",
                past: "Bot neměl oprávnění {permissions} v {channel}.",
                fix: "Na Discordu otevřete Upravit kanál → Oprávnění → Logi a zapněte {permissions}. Pak klikněte Zkusit znovu.",
            },
            delivery_uncertain: {
                title: "Discord nepotvrdil, jestli zprávu přijal.",
                past: "Discord nepotvrdil, jestli zprávu přijal.",
                fix: "Bot zprávu při další obnově najde, nebo ji pošle znovu. Nic nemusíte dělat.",
            },
            discord_unavailable: {
                title: "Discord teď neodpovídá.",
                past: "Discord neodpověděl včas.",
                fix: "Bot to zkusí znovu sám. Když to trvá dlouho, klikněte Zkusit znovu.",
            },
            source_missing: {
                title: "Herní server panelu už v Logi není.",
                past: "Herní server panelu v Logi chyběl.",
                fix: "V editoru vyberte jiný server, nebo panel odstraňte.",
            },
            source_not_collecting: {
                title: "Logi z herního serveru nesbírá data.",
                past: "Logi z herního serveru nesbíralo data.",
                fix: "Zapněte sběr dat v Herní servery a pak klikněte Zkusit znovu.",
            },
            provider_unreachable: {
                title: "Herní server neodpovídá.",
                past: "Herní server neodpovídal.",
                fix: "Panel ukazuje poslední data. Zkontrolujte adresu a klíč v Herní servery.",
            },
            provider_rate_limited: {
                title: "Poskytovatel dat teď odmítá další dotazy.",
                past: "Poskytovatel dat odmítal další dotazy.",
                fix: "Panel ukazuje poslední data a zkusí to znovu. Když to trvá přes hodinu, zvyšte limit klíče, nebo ho vyměňte v Herní servery.",
            },
            render_failed: {
                title: "Panel se nepodařilo sestavit.",
                past: "Panel se nepodařilo sestavit.",
                fix: "Zkraťte název nebo popis panelu. Když chyba trvá, nahlaste ji podpoře Logi.",
            },
            unsupported_kind: {
                title: "Bot tento druh panelu ještě neumí.",
                past: "Bot tento druh panelu neuměl.",
                fix: "Aktualizujte bota a restartujte ho.",
            },
            competition_missing: {
                title: "Soutěž panelu už neexistuje.",
                past: "Soutěž panelu neexistovala.",
                fix: "V editoru vyberte jinou soutěž, nebo panel odstraňte.",
            },
            league_disabled: {
                title: "Wardogs League je v Nastavení vypnutá, bot zprávy panelu smazal.",
                past: "Wardogs League byla v Nastavení vypnutá.",
                fix: "Zapněte Wardogs League v Nastavení → Wardogs League, bot pak obě zprávy pošle znovu.",
            },
            unknown: {
                title: "Zprávu se nepodařilo odeslat.",
                past: "Zprávu se nepodařilo odeslat.",
                fix: "Klikněte Zkusit znovu. Když chyba trvá, nahlaste ji podpoře Logi.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "Kanál je teď veřejný, proto jsme heslo z panelu odebrali. Přesuňte panel do soukromého kanálu a heslo se znovu ukáže.",
            live_data_unavailable:
                "Živá data teď nejsou dostupná; panel ukazuje poslední sebraná data.",
            attach_files_missing:
                "Bot nemá oprávnění Přikládat soubory, panel je bez obrázku.",
        },
    },
    discordPreview: {
        regionLabel: "Náhled zprávy v Discordu",
        appTag: "APP",
        edited: "(upraveno)",
        usedCommand: "{user} použil(a) {command}",
        onlyYouCanSee: "Tuto zprávu vidíte jen vy",
        dismissMessage: "Zavřít zprávu",
        buttons: "Tlačítka zprávy",
        externalLink: "odkaz ven",
        unavailable: "nedostupné",
        unknownUser: "uživatel",
        unknownRole: "role",
        unknownChannel: "kanál",
    },
    joinPage: {
        metaTitle: "Připojit se na {name}",
        metaDescription: "Připoj se na herní server {name}.",
        opening: "Otevírám {game}…",
        players: "{players} / {capacity} hráčů",
        queue: "fronta {queue}",
        steamPrompt: "Steam se zeptá, jestli odkaz otevřít. Potvrď Otevřít.",
        manualTitle: "Připojit ručně",
        addressLabel: "Adresa serveru",
        copy: "Kopírovat",
        copied: "Zkopírováno",
        copyFailed:
            "Kopírování se nepovedlo. Označ adresu a zkopíruj ji ručně.",
        steamInstructions:
            "Ve Steamu: Zobrazit → Herní servery → Oblíbené → Přidat server a vložit adresu.",
        backToDiscord: "Zpět do Discordu",
        joinCodeTitle: "Kód pro připojení",
        joinCodeLabel: "Kód pro připojení do hry",
        joinCodeHelp: "Ve hře otevři připojení ke hře a zadej tento kód.",
        noAddress:
            "Adresa serveru zatím není nastavená. Zeptej se správce klanu.",
        noJoinCode:
            "Kód pro připojení zatím není nastavený. Zeptej se správce klanu.",
        notFoundTitle: "Server nenalezen",
    },
} as const
