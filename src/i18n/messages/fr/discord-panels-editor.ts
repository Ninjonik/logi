export const discordPanelsPage_editor = {
    back: "Panneaux Discord",
    newTitle: "Nouveau panneau",
    newStatus: "Nouveau panneau · pas encore sur Discord",
    statusChannel: "dans {channel}",
    statusUpdated: "mis à jour {ago}",
    statusNext: "prochaine actualisation {in}",
    openInDiscord: "Ouvrir le message dans Discord",
    notFound:
        "Panneau introuvable. Il a peut-être été supprimé. Revenez à la liste des panneaux.",
    loading: "Chargement du panneau…",
    steps: {
        type: "Type de panneau",
        server: "Serveur",
        servers: "Serveurs",
        game: "Jeu",
        calendar: "Événements",
        competition: "Compétition",
        channel: "Salon",
        content: "Contenu",
        contentLeague: "Contenu · WD League",
        look: "Apparence",
        refresh: "Actualiser",
    },
    edit: "Modifier",
    collapse: "Fermer",
    types: {
        server: {
            title: "Serveur en direct",
            text: "Un serveur : carte, joueurs, score.",
        },
        servers: {
            title: "Nos serveurs",
            text: "Plusieurs serveurs dans un message.",
        },
        results: {
            title: "Résultats",
            text: "Une fiche après chaque match confirmé.",
        },
        league: {
            title: "WD League",
            text: "Classement de la ligue et prochains matchs.",
        },
        calendar: {
            title: "Calendrier",
            text: "Prochains événements du clan.",
        },
        competition: {
            title: "Classement de la compétition",
            text: "Classements des poules d’une compétition Logi.",
        },
    },
    typeLocked:
        "Un panneau envoyé ne peut pas changer de type. Créez un nouveau panneau pour un autre type.",
    typeTaken: "Le clan possède déjà ce type de panneau ; modifiez-le.",
    server: {
        label: "Serveur de jeu",
        placeholder: "Choisir un serveur",
        empty: "Aucun serveur de jeu pour le moment. Ajoutez-en un dans",
        emptyLink: "Serveurs de jeu",
        healthCollecting: "Collecte active · dernières données {ago}",
        healthNoData: "Collecte active · aucune donnée pour le moment",
        healthNotCollecting: "Collecte arrêtée",
        liveOk: "Données en direct ✓",
        liveLimited:
            "données en direct actuellement limitées, voir Données du serveur",
    },
    servers: {
        order: "Affichés dans cet ordre dans le message. Glissez-les pour changer l’ordre.",
        moveUp: "Monter {server}",
        moveDown: "Descendre {server}",
        drag: "Déplacer {server}",
    },
    game: {
        label: "Jeu",
        help: "Résultats d’un jeu. Chaque jeu peut avoir un seul panneau de résultats ; à sa création, il envoie les 5 derniers résultats confirmés.",
    },
    calendar: {
        label: "Catégories d’événements",
        help: "Sans sélection, le panneau affiche tous les événements du clan.",
    },
    competition: {
        label: "Compétition",
        placeholder: "Choisir une compétition",
        empty: "Le clan ne participe encore à aucune compétition Logi.",
    },
    channel: {
        label: "Salon du panneau",
        placeholder: "Choisir un salon",
        verify: "Vérifier",
        verifying: "Vérification…",
        has: "Permissions accordées :",
        missing: "Permissions manquantes :",
        attachHint:
            "Sans cette permission, le panneau contient uniquement du texte, sans image de carte.",
        public: "Tout le monde (@everyone) peut voir ce salon. Le mot de passe du serveur ne peut pas y être affiché.",
        private: "Le salon est privé ✓",
        privateRoles: "· seuls {roles} et les administrateurs peuvent le voir.",
        privateAdmins: "· seuls les administrateurs peuvent le voir.",
        privatePassword:
            "· @everyone ne peut pas le voir, le mot de passe sera affiché.",
        role: "le rôle {name}",
        unsupported:
            "Impossible d’envoyer des messages dans ce salon. Choisissez un salon textuel ou d’annonces.",
        timedOut:
            "Le bot est exclu temporairement sur le serveur et ne peut pas écrire. Levez l’exclusion dans Discord.",
        failed: "Impossible de vérifier le salon. Réessayez.",
        unverified:
            "Cliquez sur Vérifier : Logi contrôle les permissions du bot et vérifie si le salon est visible par tout le monde.",
    },
    content: {
        show: "Éléments à afficher",
        compact: {
            label: "Affichage compact",
            help: "Fiche de résultat raccourcie : score sans la ligne des camps ; une correction indique uniquement sa date et l’ancien résultat.",
        },
        score: { label: "Score", help: "Alliés : Axe par secteurs." },
        leaders: {
            label: "Meilleurs joueurs",
            help: "Kills ; les noms sont visibles par tout le salon.",
        },
        nextMap: { label: "Prochaine carte", help: "" },
        queue: {
            label: "File d’attente",
            help: "Uniquement si le serveur l’indique.",
        },
        connection: "Connexion",
        address: {
            label: "Afficher IP:port",
            help: "Le panneau affiche {address}. Saisissez l’adresse ici ; elle s’applique à tous les panneaux de ce serveur.",
            helpCombined:
                "Pour les serveurs HLL. Saisissez les adresses ici ; chacune s’applique à tous les panneaux de son serveur.",
            missing: "Aucune adresse de serveur enregistrée. Saisissez-la ici.",
            field: "IP:port · {server}",
            placeholder: "203.0.113.24:7777",
            clear: "Retirer",
            clearFor: "Supprimer IP:port · {server}",
        },
        joinCode: {
            label: "Afficher le code d’accès",
            help: "Pour les serveurs Wardogs.",
            field: "Code d’accès · {server}",
            clear: "Retirer",
            clearFor: "Supprimer le code d’accès · {server}",
        },
        joinButton: {
            label: "Bouton Rejoindre (via Logi)",
            help: "Ouvre {url}, qui lance Steam.",
            helpWardogs: "Ouvre {url} avec le code d’accès.",
            helpCombined:
                "Pour les serveurs HLL ; Wardogs utilise un code d’accès.",
        },
        password: {
            label: "Afficher le mot de passe du serveur",
            field: "Mot de passe du serveur",
            fieldServer: "Mot de passe · {server}",
            help: "Stocké chiffré. Logi l’affiche uniquement dans un salon privé.",
            stored: "Un mot de passe est stocké chiffré. Un nouveau le remplacera.",
            clear: "Supprimer le mot de passe enregistré",
            publicTitle:
                "Le salon est visible par tout le monde ; le mot de passe ne peut pas être affiché.",
            publicFix: "Choisissez un salon invisible pour @everyone.",
            unverified:
                "Le mot de passe ne peut être affiché que dans un salon invisible pour @everyone. Cliquez sur Vérifier à côté du salon.",
            combined:
                "Le message Nos serveurs n’affiche jamais le mot de passe ; seul le panneau individuel du serveur peut l’afficher dans un salon privé.",
        },
        buttons: "Boutons",
        players: {
            label: "Voir les joueurs",
            help: "Seule la personne qui clique voit la liste des joueurs.",
        },
        report: {
            label: "Signaler un joueur",
            help: "Ouvre un fil privé pour les administrateurs.",
            category: "Catégorie de ticket",
            categoryPlaceholder: "Choisir une catégorie",
            note: "Définissez le salon et le support dans",
            noCategories:
                "Aucune catégorie de tickets ne possède encore de salon privé. Configurez-en une dans",
            provider:
                "Les signalements fonctionnent uniquement avec les serveurs CRCON et Warcon.",
        },
        ticketsLink: "Tickets",
        seed: "Seeding",
        seedProgress: {
            label: "Afficher la progression du seeding",
            help: "Pendant le seeding, le panneau indique le nombre de joueurs manquants pour lancer la partie.",
            helpCombined: "Pour le serveur dont le seeding est en cours.",
        },
        seedNote:
            "Le bouton Seed figure uniquement dans le message de contrôle du serveur réservé aux administrateurs.",
        seedPlan: "Programme de seeding",
        noContent:
            "Ce type de panneau ne propose aucune autre option de contenu.",
    },
    league: {
        table: {
            label: "Classement",
            help: "Classement de toutes les équipes de la ligue. Logi calcule les points à partir des résultats, selon les règles de la ligue.",
        },
        fixtures: {
            label: "Prochains matchs",
            help: "Équipes, factions, carte, hôte et état de préparation.",
        },
        recent: {
            label: "Derniers résultats",
            help: "Sous les prochains matchs.",
        },
        count: {
            label: "Nombre de matchs",
            help: "Nombre de prochains matchs affichés dans le message.",
        },
        note: "Tous les matchs de la ligue, pas seulement les nôtres. Le classement et les prochains matchs sont deux messages superposés dans {channel}, actualisés toutes les 60 s. Les fiches de ligue individuelles par match ont été supprimées.",
        channelFallback: "un seul salon",
    },
    look: {
        title: {
            label: "Nom",
            help: "Affiché comme titre du message.",
        },
        description: {
            label: "Description",
            help: "Facultatif. Une courte phrase sous le titre.",
        },
        banner: {
            label: "Bannière",
            upload: "Importer une bannière",
            choose: "Choisir parmi les bannières importées",
            hide: "Masquer les bannières importées",
            remove: "Retirer",
            help: "Aucune bannière. Elle remplace l’image de la carte. PNG, JPEG ou WebP, 2 Mio maximum.",
            set: "Bannière personnalisée. Elle remplace l’image de la carte. PNG, JPEG ou WebP, 2 Mio maximum.",
            uploading: "Envoi de la bannière…",
            uploaded: "Bannière importée.",
            selected: "Bannière sélectionnée.",
            libraryLoading: "Chargement des bannières importées…",
            libraryEmpty: "Aucune bannière importée pour le moment.",
            libraryError: "Impossible de charger les bannières importées.",
            library: "Bannières importées",
            libraryItem: "Bannière {width} × {height}, importée le {date}",
            preview: "Aperçu de la bannière",
        },
        accent: {
            label: "Couleur de la barre",
            clan: "Couleur du clan",
            custom: "Couleur personnalisée",
            customHelp: "Pour ce panneau uniquement",
            picker: "Choisir la couleur de la barre",
            field: "Couleur de la barre du panneau",
            invalid: "Saisissez une couleur au format #RRGGBB.",
        },
        style: {
            label: "Style des panneaux",
            clan: "Selon Graphismes des panneaux",
            clanHelp: "Actuellement : {style}",
            help: "Définissez le style par défaut de tous les panneaux dans",
            link: "Graphismes des panneaux",
        },
        summary: {
            title: "Nom : {title}",
            titleDefault: "Nom du serveur",
            description: "description renseignée",
            noDescription: "sans description",
            banner: "bannière personnalisée",
            noBanner: "sans bannière",
            accentClan: "couleur du clan",
            accentCustom: "couleur personnalisée {color}",
            style: "{style}",
        },
    },
    refresh: {
        locked: "Toutes les 60 s · identique pour tous les panneaux",
        footer: {
            label: "Afficher dans le pied de message",
            help: "« Mis à jour il y a 6 s · actualisation toutes les 60 s »",
        },
        summaryFooter: "Toutes les 60 s · indiqué en pied de message",
        summaryNoFooter: "Toutes les 60 s · sans pied de message",
    },
    preview: {
        title: "Aperçu dans {channel} · données réelles de {server}",
        titleCombined:
            "Aperçu dans {channel} · données réelles de {count} serveurs",
        titleLeague: "Aperçu dans {channel} · deux messages superposés",
        titlePlain: "Aperçu dans {channel}",
        noChannel: "le salon",
        author: "aujourd’hui à {time}",
        pending: "L’aperçu apparaît une fois les données du serveur chargées.",
        noServer: "Choisissez un serveur pour afficher l’aperçu.",
        loading: "Chargement des données du serveur…",
        leagueLoading: "Chargement des données de la ligue…",
        leagueFailed: "Impossible de charger les données de la ligue.",
        resultsEmpty:
            "La fiche apparaît après le premier résultat confirmé. L’aperçu affiche le dernier match ayant un résultat.",
        resultsNone: "Le clan n’a pas encore de match avec un résultat.",
        calendarNote:
            "Aperçu des événements de Logi ; le bot ajoute les liens vers les annonces.",
        competitionNote:
            "Le bot génère les classements de poule après l’enregistrement.",
        noAttach:
            "Le bot n’a pas la permission {permission} dans {channel} ; le panneau est donc publié en texte sans images, comme cet aperçu.",
    },
    joinPage: {
        title: "Après un clic sur Rejoindre · page Logi",
        players: "{game} · {map} · {players} / {capacity} joueurs",
        open: "Ouvrir dans Steam",
        fallback:
            "Steam ne s’est pas ouvert ? Dans le jeu, choisissez Rejoindre par IP et saisissez {address}.",
        joinCode:
            "Dans le jeu, ouvrez l’option de connexion et saisissez le code {code}.",
        noAddress:
            "Sans adresse, la page indique uniquement au joueur de contacter un administrateur.",
        noJoinCode:
            "Sans code d’accès, la page indique uniquement au joueur de contacter un administrateur.",
        caption:
            "Discord autorise uniquement les liens HTTP(S) dans les boutons. Cette page ouvre immédiatement steam://connect et affiche l’IP en cas d’échec.",
        captionJoinCode:
            "Discord autorise uniquement les liens HTTP(S) dans les boutons. Cette page affiche le code d’accès au jeu et permet de le copier.",
    },
    data: {
        title: "Données du serveur",
        load: "Charger les données du serveur",
        loading: "Chargement…",
        help: "La même lecture que celle effectuée par le bot.",
        loadedAgo: "Données chargées {ago}.",
        result: "Données chargées {ago} · {map} · {players}/{capacity}",
        perServer: "{server} · chargé {ago} · {map} · {players}/{capacity}",
        score: "Score {score}",
        timeLeft: "{minutes} min restantes",
        queue: "file d’attente {count}",
        inStats: "{count} joueurs dans les statistiques",
        nextMap: "prochaine carte {map}",
        seed: "Seeding en cours · {players} sur {liveFrom}",
        stale: "Le serveur a envoyé des données anciennes.",
        unavailable:
            "Le serveur ne répond pas. Le panneau affiche les dernières données collectées.",
        busy: "Une autre lecture du serveur est en cours. Réessayez dans {seconds} s.",
        denied: "La clé n’autorise pas la lecture des données en direct. Remplacez-la dans Serveurs de jeu.",
        failed: "La lecture a échoué. Le panneau affiche les dernières données collectées et réessaie.",
        rateLimited:
            "{server} · {provider} refuse de nouvelles requêtes pour le moment (limite 429).",
        rateLimitedBody:
            "Le panneau affiche les données de {ago} et réessaiera dans {seconds} s. Si cela dure plus d’une heure, augmentez la limite de la clé {providerIn} ou remplacez-la dans Serveurs de jeu → {server}.",
        providerIn: {
            hll_crcon: "dans CRCON",
            wardogs_warcon: "dans Warcon",
        },
        snapshot:
            "Ce serveur n’a pas de lecture en direct ; les données collectées sont affichées.",
        notCollecting: "Logi ne collecte pas les données de ce serveur.",
        requestFailed: "Impossible de charger les données. Réessayez.",
        notServerKind:
            "Les données du serveur sont lues uniquement pour les panneaux de serveur.",
    },
    source: {
        title: "Source · {server}",
        link: "Serveurs de jeu",
        collection: "Collecte",
        live: "Données en direct",
        liveOk: "✓ dernière lecture {ago}",
        liveNone: "aucune lecture pour le moment",
        liveLimited: "limitées, voir Données du serveur",
        key: "Clé",
        keySet: "stockée chiffrée",
        keyVerified: "vérifiée le {date}",
        keyNotVerified: "non vérifiée",
        keyMissing: "manquante",
        keyNotRequired: "non nécessaire",
        keyEnvironment: "définie par l’exploitant de Logi",
        address: "Adresse",
        addressValue: "{origin} · serveur {id}",
    },
    delivery: {
        title: "Envoi",
        saved: "Enregistré",
        claimed: "Pris en charge par le bot",
        sent: "Envoyé",
        lastRefresh: "Dernière actualisation",
        notYet: "pas encore",
        none: "—",
        savedBy: "{when} · {name}",
        sentIn: "message dans {channel}",
        refreshValue: "{ago} · suivant {in}",
        hint: "Après Envoyer dans le salon, les étapes se cochent, généralement sous 15 s. La page s’actualise automatiquement.",
        lastError: "Dernière erreur :",
        recovered: "La tentative suivante, {after} plus tard, a réussi.",
        recoveredAfter: {
            second: {
                one: "une seconde",
                few: "{count} secondes",
                many: "{count} secondes",
                other: "{count} secondes",
            },
            minute: {
                one: "une minute",
                few: "{count} minutes",
                many: "{count} minutes",
                other: "{count} minutes",
            },
            hour: {
                one: "une heure",
                few: "{count} heures",
                many: "{count} heures",
                other: "{count} heures",
            },
            day: {
                one: "un jour",
                few: "{count} jours",
                many: "{count} jours",
                other: "{count} jours",
            },
        },
        stuck: {
            title: "En cas de blocage de l’envoi",
            lead: "Envoi non confirmé.",
            body: "Discord n’a pas confirmé la réception du message et nous ne l’avons pas trouvé dans {channel}. Réessayer l’envoie à nouveau.",
        },
    },
    bar: {
        adoptCalendar:
            "Le calendrier est déjà dans {channel}. L’enregistrement le reprend : le message est modifié sans nouvel envoi.",
        editsMessage:
            "L’enregistrement modifie le message dans {channel} sans en envoyer un nouveau.",
        notInDiscord: "Le panneau n’est pas encore sur Discord.",
        pausedNote:
            "Le panneau est en pause ; l’enregistrement ne le réactive pas.",
        delete: "Supprimer le message",
        deleteConfirm:
            "Supprimer le message de Discord ? Le panneau restera enregistré comme non envoyé.",
        removePanel: "Supprimer le panneau",
        removeConfirm:
            "Supprimer le panneau ? Ses messages disparaîtront de Discord et ses paramètres seront supprimés.",
        pause: "Mettre en pause",
        resume: "Reprendre",
        refresh: "Actualiser maintenant",
        save: "Enregistrer",
        publish: "Envoyer dans le salon",
        saving: "Enregistrement…",
        discard: "Abandonner",
        actions: "Actions du panneau",
    },
    saved: "Enregistré.",
    savedSent:
        "Enregistré et mis en attente de publication. Le bot le prend en charge sous 15 s.",
    problems: {
        channel: "Choisissez un salon.",
        server: "Choisissez un serveur de jeu.",
        servers: "Choisissez au moins un serveur.",
        reportCategory: "Choisissez une catégorie de ticket.",
        accentColor: "Saisissez une couleur au format #RRGGBB.",
        competition: "Choisissez une compétition.",
        fixtureCount: "Le nombre de matchs doit être compris entre 1 et 10.",
    },
    errors: {
        not_found: "Le panneau n’existe plus.",
        conflict:
            "Quelqu’un a modifié le panneau entre-temps. Actualisez la page.",
        kind_locked: "Un panneau envoyé ne peut pas changer de type.",
        removing: "Le panneau est en cours de suppression.",
        source_not_found: "Le serveur de jeu n’existe plus dans Logi.",
        game_mismatch: "Le serveur ne correspond pas au jeu du panneau.",
        report_destination_missing:
            "La catégorie de ticket n’a pas de salon privé. Configurez-la dans Tickets.",
        report_provider:
            "Les signalements fonctionnent uniquement avec les serveurs CRCON et Warcon.",
        duplicate_channel: "Ce serveur possède déjà un panneau dans ce salon.",
        results_exists: "Ce jeu possède déjà un panneau de résultats.",
        league_exists: "Le clan possède déjà un panneau WD League.",
        calendar_exists: "Le clan possède déjà un panneau de calendrier.",
        competition_not_found: "La compétition n’existe plus.",
        panel_limit: "Un clan peut avoir jusqu’à 20 panneaux.",
        asset_unavailable:
            "La bannière n’est plus disponible. Importez-la à nouveau.",
        invalid_settings: "Un paramètre est invalide.",
        unavailable: "Échec de l’enregistrement. Réessayez.",
        address:
            "L’adresse doit être au format IP:port, par exemple 203.0.113.24:7777.",
        joinCode:
            "Un code d’accès ne peut contenir que des lettres, des chiffres et des tirets.",
        password:
            "Un mot de passe doit comporter de 1 à 64 caractères, sans caractères de contrôle.",
        encryption_unavailable:
            "Impossible d’enregistrer le mot de passe : le chiffrement n’est pas activé. Demandez à l’exploitant de Logi de configurer la clé.",
    },
} as const
