export const panelGraphicsMessages = {
    panelGraphicsPage: {
        breadcrumbParent: "Discord panels",
        unnamedServer: "Unnamed server",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Panel style",
            description:
                "How server panels look in Discord. Applies to every panel without its own style.",
            defaultLabel: "Default style",
            logiDefault: "Default",
            options: {
                a: {
                    title: "Style A · Image",
                    description:
                        "The bot draws a score image and uploads it again at most once every 60 s.",
                },
                b: {
                    title: "Style B · Banner and thumbnail",
                    description:
                        "Server banner on top, map thumbnail on the right, signs and player bar.",
                },
                c: {
                    title: "Style C · Compact",
                    description:
                        "Text only with signs and the player bar. The shortest message.",
                },
            },
            perPanel: "Set a different style for one panel in the",
            perPanelLink: "panel editor",
        },
        banners: {
            title: "Server banners",
            description:
                "The image on top of a style B panel and the background of the style A score image. One per server.",
            empty: "There is no game server yet. Add one in the Game servers settings.",
            emptyLink: "Game servers",
            customChip: "Own banner",
            mapChip: "Map image",
            noneChip: "No banner",
            mapOverlay: "map image",
            liveServer: "Live server",
            banner: "Banner",
            upload: "Upload banner",
            uploading: "Uploading…",
            remove: "Remove",
            help: "PNG, JPG or WebP · ratio 3 : 1, for example 1200 × 400 · at most 2 MB.",
            uploadedFile: "Uploaded {name} · {width} × {height} · {size}.",
            uploadedBanner: "Uploaded · {width} × {height} · {size}.",
            withoutBanner:
                "Without a banner the current map image is shown, now {map}.",
            withoutBannerUnknownMap:
                "Without a banner the current map image is shown.",
            withoutBannerOff: "Without a banner the panel has no image on top.",
            crop: "Crop",
            crops: { top: "Top", center: "Centre", bottom: "Bottom" },
            useMapImage: "Use the map image when the banner is missing",
            barColor: "Bar colour",
            barColorInput: "Bar colour in hexadecimal",
            clanColor: "Clan colour",
            clanColorNote: "clan colour",
            barColorInvalid: "Enter the colour as #RRGGBB.",
        },
        maps: {
            title: "Map images",
            description:
                "The panel thumbnail and the score image background when the server has no banner of its own. Logi has built-in images; the clan can replace them.",
            customCount: {
                one: "{count} custom",
                few: "{count} custom",
                many: "{count} custom",
                other: "{count} custom",
            },
            search: "Search maps",
            searchPlaceholder: "Map name",
            game: "Game",
            all: "All",
            builtinChip: "Logi default",
            customChip: "Custom",
            noneChip: "No image",
            replace: "Replace with own",
            restore: "Restore default",
            upload: "Upload image",
            uploading: "Uploading…",
            imageAlt: "Map {name}",
            footer: "Showing {shown} of {total} maps · own image: PNG, JPG or WebP, square of at least 160 × 160, at most 2 MB.",
            noResults: "No map matches the search.",
        },
        factions: {
            title: "Faction icons",
            description:
                "Fixed, they cannot be changed. The bot uploads them to Discord as application emoji itself and uses them in every panel, result and the league.",
            uploaded: "Uploaded to Discord ✓ · {count} emoji",
            pending: "Uploaded to Discord {ready} of {total} emoji",
            hllTitle: "Hell Let Loose · nations",
            hllChip: "Logi's own icons",
            nations: {
                us: { name: "USA", side: "Allies" },
                gb: { name: "Great Britain", side: "Allies" },
                sov: { name: "Soviet Union", side: "Allies" },
                cw: { name: "Commonwealth", side: "Allies" },
                ger: { name: "Germany", side: "Axis" },
                dak: { name: "Afrikakorps", side: "Axis" },
                allies: {
                    name: "Allies",
                    side: "when the server names no nation",
                },
                axis: { name: "Axis", side: "when the server names no nation" },
            },
            wardogsTitle: "Wardogs · factions",
            wardogsChip: "Wardogs icons, MIT licence",
            wardogsHint:
                "on a dark background, as you will see them in Discord",
            wardogs: {
                valkyra: { name: "Valkyra", role: "faction" },
                manticore: { name: "Manticore", role: "faction" },
                lonestar: { name: "Lonestar", role: "faction" },
                wardogs: { name: "Wardogs", role: "game sign" },
            },
            note: "The HLL nation signs are our own simple icons, not game artwork.",
        },
        status: {
            title: "Status icons and player bar",
            description:
                "Also fixed; the bot uploads them together with the faction icons. A word always stands next to the icon.",
            states: {
                live: { name: "Live", hint: "the server is playing" },
                seeding: {
                    name: "Seeding",
                    hint: "under 40 players, a seed is running",
                },
                empty: { name: "Empty", hint: "nobody is playing" },
                offline: {
                    name: "Offline",
                    hint: "the server does not respond",
                },
            },
            gauge: {
                players: {
                    name: "Players",
                    hint: "one piece = a tenth of the capacity",
                },
                queue: { name: "Queue", hint: "after a gap" },
                free: { name: "Free slot", hint: "" },
            },
            sample: "Example in a panel",
            sampleQueue: "{count} / {capacity} players, queue {queue}",
            sampleSeed: "{count} / {capacity} players, seed to {target}",
        },
        saveNote:
            "banners and the style apply at the next panel refresh, within 60 s",
        saved: "Panel graphics saved.",
        reload: "Reload",
        errors: {
            conflict:
                "Someone else changed the graphics in the meantime. Reload the page and repeat your changes.",
            asset_unavailable:
                "The image is no longer available. Please upload it again.",
            unknown_server:
                "The game server no longer exists. Reload the page.",
            invalid_request: "A value is not valid.",
            forbidden: "You are not allowed to change the panel graphics.",
            unavailable: "Saving failed. Try again.",
        },
        uploadErrors: {
            unsupported_type: "Only PNG, JPG and WebP images are accepted.",
            type_mismatch: "The file content does not match its image type.",
            bad_dimensions:
                "The image is too small or too large. A map image needs at least 160 × 160 pixels, no image more than 4096 × 4096.",
            animated: "Animated images are not supported.",
            undecodable: "The image could not be read.",
            invalid_kind: "This image cannot be uploaded here.",
            invalid_asset: "The uploaded image could not be saved.",
            too_large: "The image is larger than 2 MB.",
            upload_limited: "Too many uploads. Try again in {seconds} s.",
            forbidden: "You are not allowed to upload images.",
            unavailable: "Uploading is temporarily unavailable.",
        },
    },
    publicPanelAppearance: {
        title: "Appearance",
        description:
            "Layout, accent color, banner and faction emoji for this panel. Panels saved before these settings existed keep their previous look until you change them here.",
        mapArtwork: "Map artwork",
        layout: "Layout",
        showMap: "Show map name and artwork",
        showScoreboard: "Show scoreboard",
        showPlayerCount: "Show player count",
        compact: "Compact header",
        layoutHelp:
            "Compact uses a two-line header, inline scores and no separators. Map artwork also needs the Map artwork setting.",
        resultsLayoutHelp:
            "Result announcements use the map and compact settings; the scoreboard and player count apply to live panels.",
        accentColor: "Accent color",
        accentColorPicker: "Pick the accent color",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Replaces the green live color; stale or paused panels keep the amber warning. Leave empty for the default.",
        accentColorReset: "Default color",
        accentColorInvalid: "Use a color in #RRGGBB format.",
        banner: "Banner",
        bannerHelp:
            "PNG, JPEG or WebP up to 2 MiB and 4096 × 4096 px. Logi converts it to WebP of at most 1920 × 1080 px. A banner replaces the map thumbnail.",
        bannerUpload: "Upload banner",
        bannerUploading: "Uploading…",
        bannerRemove: "Remove banner",
        bannerPreview: "Banner preview",
        bannerNone:
            "No banner. The panel shows map artwork when it is enabled.",
        bannerUploaded: "Banner uploaded. Save the panel to publish it.",
        bannerSelected: "Banner selected. Save the panel to publish it.",
        bannerLibrary: "Uploaded banners",
        bannerLibraryShow: "Choose an uploaded banner",
        bannerLibraryHide: "Hide uploaded banners",
        bannerLibraryLoading: "Loading uploaded banners…",
        bannerLibraryEmpty:
            "No banners have been uploaded in this workspace yet.",
        bannerLibraryError:
            "Uploaded banners could not be loaded. Retry later.",
        bannerLibraryItem: "Use banner {width} × {height} px uploaded {date}",
        factionEmoji: "Faction emoji",
        factionEmojiHelp:
            "One Unicode emoji, or a custom Discord emoji written as <:name:id> (animated: <a:name:id>). Custom emoji must belong to a server the bot is in or to the bot application. Leave empty to keep the default shown as the placeholder.",
        factionEmojiInvalid: "Use one emoji or <:name:id>.",
        noDefaultEmoji: "None",
        factions: {
            allies: "Allies",
            axis: "Axis",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid: "Fix the highlighted appearance settings before saving.",
        errors: {
            invalid_kind: "This image type cannot be used as a banner.",
            unsupported_type: "Use a PNG, JPEG or WebP image.",
            type_mismatch:
                "The file content does not match its type. Export it again as PNG, JPEG or WebP.",
            bad_dimensions: "The image must be at most 4096 × 4096 pixels.",
            animated: "Animated images are not supported.",
            undecodable:
                "The image could not be read. Export it again and retry.",
            invalid_asset: "The image could not be stored. Retry the upload.",
            forbidden: "Only workspace administrators can upload banners.",
            too_large: "The image is larger than 2 MiB.",
            upload_limited: "Too many uploads. Retry in {seconds} s.",
            unavailable: "Image uploads are unavailable. Retry later.",
            asset_unavailable:
                "The banner is no longer available to this workspace. Upload it again or remove it, then save.",
        },
    },
} as const
