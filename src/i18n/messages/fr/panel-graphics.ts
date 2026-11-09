export const panelGraphicsMessages = {
    panelGraphicsPage: {
        breadcrumbParent: "Panneaux Discord",
        unnamedServer: "Serveur sans nom",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Style des panneaux",
            description:
                "Apparence des panneaux de serveur sur Discord. S’applique aux panneaux sans style personnalisé.",
            defaultLabel: "Style par défaut",
            logiDefault: "Par défaut",
            options: {
                a: {
                    title: "Style A · Image",
                    description:
                        "Le bot génère une image du score et la téléverse au maximum une fois toutes les 60 s.",
                },
                b: {
                    title: "Style B · Bannière et miniature",
                    description:
                        "Bannière du serveur en haut, miniature de la carte à droite, emblèmes et barre des joueurs.",
                },
                c: {
                    title: "Style C · Compact",
                    description:
                        "Texte uniquement, avec emblèmes et barre des joueurs. Le message le plus court.",
                },
            },
            perPanel: "Pour modifier le style d’un panneau, ouvrez l’",
            perPanelLink: "éditeur de panneaux",
        },
        banners: {
            title: "Bannières des serveurs",
            description:
                "Image affichée en haut d’un panneau de style B et en fond de l’image de score du style A. Une par serveur.",
            empty: "Aucun serveur de jeu pour le moment. Ajoutez-en un dans les paramètres Serveurs de jeu.",
            emptyLink: "Serveurs de jeu",
            customChip: "Bannière personnalisée",
            mapChip: "Image de la carte",
            noneChip: "Sans bannière",
            mapOverlay: "image de la carte",
            liveServer: "Serveur en direct",
            banner: "Bannière",
            upload: "Importer une bannière",
            uploading: "Importation…",
            remove: "Retirer",
            help: "PNG, JPG ou WebP · ratio 3:1, par exemple 1 200 × 400 · 2 Mo maximum.",
            uploadedFile: "{name} importé · {width} × {height} · {size}.",
            uploadedBanner: "Importé · {width} × {height} · {size}.",
            withoutBanner:
                "Sans bannière, l’image de la carte en cours est affichée : actuellement {map}.",
            withoutBannerUnknownMap:
                "Sans bannière, l’image de la carte en cours est affichée.",
            withoutBannerOff:
                "Sans bannière, aucune image n’apparaît en haut du panneau.",
            crop: "Recadrage",
            crops: { top: "Haut", center: "Centre", bottom: "Bas" },
            useMapImage:
                "Utiliser l’image de la carte en l’absence de bannière",
            barColor: "Couleur de la barre",
            barColorInput: "Couleur de la barre en hexadécimal",
            clanColor: "Couleur du clan",
            clanColorNote: "couleur du clan",
            barColorInvalid: "Saisissez la couleur au format #RRGGBB.",
        },
        maps: {
            title: "Images des cartes",
            description:
                "Miniature du panneau et fond de l’image de score lorsque le serveur n’a pas de bannière. Logi fournit des images par défaut que le clan peut remplacer.",
            customCount: {
                one: "{count} personnalisées",
                few: "{count} personnalisées",
                many: "{count} personnalisées",
                other: "{count} personnalisées",
            },
            search: "Rechercher des cartes",
            searchPlaceholder: "Nom de la carte",
            game: "Jeu",
            all: "Tous",
            builtinChip: "Par défaut dans Logi",
            customChip: "Personnalisé",
            noneChip: "Sans image",
            replace: "Remplacer par une image",
            restore: "Rétablir l’image par défaut",
            upload: "Importer une image",
            uploading: "Importation…",
            imageAlt: "Carte {name}",
            footer: "{shown} cartes sur {total} · image personnalisée : PNG, JPG ou WebP, carrée, au moins 160 × 160, 2 Mo maximum.",
            noResults: "Aucune carte ne correspond à la recherche.",
        },
        factions: {
            title: "Icônes des factions",
            description:
                "Elles sont fixes et ne peuvent pas être modifiées. Le bot les importe automatiquement dans Discord comme émojis d’application et les utilise dans les panneaux, les résultats et la ligue.",
            uploaded: "Importés dans Discord ✓ · {count} émojis",
            pending: "{ready} émojis sur {total} importés dans Discord",
            hllTitle: "Hell Let Loose · nations",
            hllChip: "Icônes propres à Logi",
            nations: {
                us: { name: "États-Unis", side: "Alliés" },
                gb: { name: "Grande-Bretagne", side: "Alliés" },
                sov: { name: "Union soviétique", side: "Alliés" },
                cw: { name: "Commonwealth", side: "Alliés" },
                ger: { name: "Allemagne", side: "Axe" },
                dak: { name: "Afrikakorps", side: "Axe" },
                allies: {
                    name: "Alliés",
                    side: "lorsque le serveur ne précise pas la nation",
                },
                axis: {
                    name: "Axe",
                    side: "lorsque le serveur ne précise pas la nation",
                },
            },
            wardogsTitle: "Wardogs · factions",
            wardogsChip: "Icônes Wardogs, licence MIT",
            wardogsHint:
                "sur fond sombre, comme elles apparaîtront dans Discord",
            wardogs: {
                valkyra: { name: "Valkyra", role: "faction" },
                manticore: { name: "Manticore", role: "faction" },
                lonestar: { name: "Lonestar", role: "faction" },
                wardogs: { name: "Wardogs", role: "emblème du jeu" },
            },
            note: "Les emblèmes nationaux HLL sont des icônes simples créées par Logi, pas des illustrations du jeu.",
        },
        status: {
            title: "Icônes d’état et barre des joueurs",
            description:
                "Également fixes ; le bot les importe avec les icônes des factions. Un libellé accompagne toujours l’icône.",
            states: {
                live: {
                    name: "En direct",
                    hint: "une partie est en cours sur le serveur",
                },
                seeding: {
                    name: "Seeding",
                    hint: "moins de 40 joueurs, seeding en cours",
                },
                empty: { name: "Vide", hint: "aucun joueur en jeu" },
                offline: {
                    name: "Hors ligne",
                    hint: "le serveur ne répond pas",
                },
            },
            gauge: {
                players: {
                    name: "Joueurs",
                    hint: "un segment = un dixième de la capacité",
                },
                queue: { name: "File d’attente", hint: "après un espace" },
                free: { name: "Place libre", hint: "" },
            },
            sample: "Exemple dans un panneau",
            sampleQueue: "{count} / {capacity} joueurs, file d’attente {queue}",
            sampleSeed:
                "{count} / {capacity} joueurs, objectif de seeding {target}",
        },
        saveNote:
            "les bannières et le style seront appliqués à la prochaine actualisation du panneau, sous 60 s",
        saved: "Habillage des panneaux enregistré.",
        reload: "Recharger",
        errors: {
            conflict:
                "Quelqu’un a modifié l’habillage entre-temps. Rechargez la page et refaites vos modifications.",
            asset_unavailable:
                "L’image n’est plus disponible. Importez-la à nouveau.",
            unknown_server:
                "Le serveur de jeu n’existe plus. Rechargez la page.",
            invalid_request: "Une valeur n’est pas valide.",
            forbidden:
                "Vous n’avez pas l’autorisation de modifier l’habillage des panneaux.",
            unavailable: "Échec de l’enregistrement. Réessayez.",
        },
        uploadErrors: {
            unsupported_type:
                "Seules les images PNG, JPG et WebP sont acceptées.",
            type_mismatch:
                "Le contenu du fichier ne correspond pas à son type d’image.",
            bad_dimensions:
                "L’image est trop petite ou trop grande. Une image de carte doit faire au moins 160 × 160 pixels ; aucune image ne peut dépasser 4 096 × 4 096.",
            animated: "Les images animées ne sont pas prises en charge.",
            undecodable: "Impossible de lire l’image.",
            invalid_kind: "Cette image ne peut pas être importée ici.",
            invalid_asset: "Impossible d’enregistrer l’image importée.",
            too_large: "L’image dépasse 2 Mo.",
            upload_limited: "Trop d’importations. Réessayez dans {seconds} s.",
            forbidden: "Vous n’avez pas l’autorisation d’importer des images.",
            unavailable: "L’importation est temporairement indisponible.",
        },
    },
    publicPanelAppearance: {
        title: "Apparence",
        description:
            "Disposition, couleur d’accentuation, bannière et émojis de factions de ce panneau. Les panneaux enregistrés avant l’ajout de ces paramètres conservent leur apparence jusqu’à leur modification ici.",
        mapArtwork: "Illustration de la carte",
        layout: "Disposition",
        showMap: "Afficher le nom et l’illustration de la carte",
        showScoreboard: "Afficher le tableau des scores",
        showPlayerCount: "Afficher le nombre de joueurs",
        compact: "En-tête compact",
        layoutHelp:
            "Le mode compact utilise un en-tête sur deux lignes, des scores sur une ligne et aucun séparateur. L’illustration nécessite aussi l’activation du paramètre Illustration de la carte.",
        resultsLayoutHelp:
            "Les annonces de résultats utilisent les paramètres de carte et de mode compact ; le tableau des scores et le nombre de joueurs s’appliquent aux panneaux en direct.",
        accentColor: "Couleur d’accentuation",
        accentColorPicker: "Choisir la couleur d’accentuation",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Remplace le vert de l’état en direct ; les panneaux en pause ou aux données périmées conservent l’avertissement ambré. Laissez vide pour la couleur par défaut.",
        accentColorReset: "Couleur par défaut",
        accentColorInvalid: "Utilisez une couleur au format #RRGGBB.",
        banner: "Bannière",
        bannerHelp:
            "PNG, JPEG ou WebP jusqu’à 2 Mio et 4 096 × 4 096 px. Logi la convertit en WebP de 1 920 × 1 080 px maximum. Une bannière remplace la miniature de la carte.",
        bannerUpload: "Importer une bannière",
        bannerUploading: "Importation…",
        bannerRemove: "Retirer la bannière",
        bannerPreview: "Aperçu de la bannière",
        bannerNone:
            "Sans bannière. Le panneau affiche l’illustration de la carte si elle est activée.",
        bannerUploaded:
            "Bannière importée. Enregistrez le panneau pour la publier.",
        bannerSelected:
            "Bannière sélectionnée. Enregistrez le panneau pour la publier.",
        bannerLibrary: "Bannières importées",
        bannerLibraryShow: "Choisir une bannière importée",
        bannerLibraryHide: "Masquer les bannières importées",
        bannerLibraryLoading: "Chargement des bannières importées…",
        bannerLibraryEmpty:
            "Aucune bannière n’a encore été importée dans cet espace de travail.",
        bannerLibraryError:
            "Impossible de charger les bannières importées. Réessayez plus tard.",
        bannerLibraryItem:
            "Utiliser la bannière de {width} × {height} px importée le {date}",
        factionEmoji: "Émojis des factions",
        factionEmojiHelp:
            "Un émoji Unicode ou un émoji Discord personnalisé au format <:name:id> (animé : <a:name:id>). Les émojis personnalisés doivent appartenir à un serveur où se trouve le bot ou à son application. Laissez vide pour conserver la valeur par défaut affichée en exemple.",
        factionEmojiInvalid: "Utilisez un seul émoji ou <:name:id>.",
        noDefaultEmoji: "Aucun",
        factions: {
            allies: "Alliés",
            axis: "Axe",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid:
            "Corrigez les paramètres d’apparence signalés avant d’enregistrer.",
        errors: {
            invalid_kind:
                "Ce type d’image ne peut pas être utilisé comme bannière.",
            unsupported_type: "Utilisez une image PNG, JPEG ou WebP.",
            type_mismatch:
                "Le contenu du fichier ne correspond pas à son type. Exportez-le à nouveau en PNG, JPEG ou WebP.",
            bad_dimensions:
                "L’image ne doit pas dépasser 4 096 × 4 096 pixels.",
            animated: "Les images animées ne sont pas prises en charge.",
            undecodable:
                "Impossible de lire l’image. Exportez-la à nouveau et réessayez.",
            invalid_asset:
                "Impossible de stocker l’image. Réessayez l’importation.",
            forbidden:
                "Seuls les administrateurs de l’espace de travail peuvent importer des bannières.",
            too_large: "L’image dépasse 2 Mio.",
            upload_limited: "Trop d’importations. Réessayez dans {seconds} s.",
            unavailable:
                "L’importation d’images est indisponible. Réessayez plus tard.",
            asset_unavailable:
                "La bannière n’est plus disponible pour cet espace de travail. Importez-la à nouveau ou retirez-la, puis enregistrez.",
        },
    },
} as const
