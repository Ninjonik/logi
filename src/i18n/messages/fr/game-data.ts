export const gameDataMessages = {
    wardogsMatchDetails: {
        ourTeam: "Votre équipe",
        players: "Joueurs",
        scoreTimeline: "Évolution du score pendant le match",
        noTimeline:
            "Aucun historique du score n’a été collecté pour cette partie. Les statistiques des joueurs restent disponibles ci-dessous.",
        factionCombat: "Kills et morts par faction",
        factionMoney: "Argent par faction",
        killActivity: "Activité des kills",
        killFeed: "Journal des kills",
        killCauses: "Kills par cause",
        noFeed: "Warcon n’a pas fourni de journal des combats pour ce match.",
        time: "Heure",
        killer: "Tueur",
        victim: "Victime",
        cause: "Cause",
        distance: "Distance",
        headshot: "Headshot",
        minutes: "Minutes",
        search: "Rechercher un joueur",
        allFactions: "Toutes les factions",
        noPlayers: "Aucun joueur ne correspond à ces filtres.",
        missingTitle: "Le résultat de ce match est manquant",
        missingBody:
            "Choisissez une partie collectée sur le serveur et vérifiez ses scores avant de confirmer.",
        suggestion: "Est-ce votre match ?",
        openReport: "Voir les détails du match",
        reviewResult: "Vérifier le résultat",
        otherSource:
            "Ce n’est pas la bonne partie ? Choisissez une autre source.",
    },
    gameHistory: {
        title: "Historique des parties Warcon",
        description:
            "Parties terminées sur les serveurs et conservées par Logi. Les factions représentent les camps du jeu, pas les équipes du clan.",
        load: "Charger / actualiser l’historique",
        retentionTitle: "Conservation de l’historique",
        retentionDescription:
            "Choisissez la durée de conservation des parties dans cet espace de travail. Les parties terminées avant cette période sont définitivement supprimées chaque nuit. La révision de l’historique est alors incrémentée pour que les sites connectés recalculent leurs totaux.",
        retentionWindow: "Conserver les parties pendant",
        retentionIndefinite: "Indéfiniment (par défaut)",
        retentionDays: "{days} jours",
        retentionSave: "Enregistrer la durée",
        retentionSaving: "Enregistrement…",
        retentionSaved:
            "Durée de conservation enregistrée. Les parties expirées sont supprimées en arrière-plan.",
        retentionError:
            "Impossible de charger ou d’enregistrer la durée de conservation. Actualisez et réessayez.",
        loading: "Chargement de toute la période…",
        error: "Impossible de charger l’intégralité de l’historique. Réessayez ou choisissez une période plus courte. Aucun classement partiel n’est affiché.",
        period: "Période",
        all: "Toutes les parties conservées",
        week: "7 jours",
        month: "30 jours",
        quarter: "90 jours",
        map: "Carte (nom exact, facultatif)",
        source: "Serveur",
        allSources: "Tous les serveurs conservés",
        minimum: "Minutes minimum pour le classement",
        games: "Jeux",
        decided: "Avec un vainqueur",
        draw: "Matchs nuls",
        no_result: "Sans résultat",
        unknown: "Inconnu",
        feed: "Parties avec journal des combats",
        faction: "Faction",
        factions: "Victoires par faction",
        share: "Part des parties avec un vainqueur",
        players: "Classement des joueurs",
        coverage: "Couverture",
        lastCollected: "Dernière partie importée dans cet espace de travail",
        empty: "Aucune partie terminée n’a été collectée sur cette période. Activez la collecte de l’historique pour une source Warcon ci-dessus.",
        player: "Joueur",
        matches: "Jeux",
        wins: "Victoires",
        losses: "Défaites",
        kills: "Kills",
        deaths: "Morts",
        cash: "Argent",
        cashHelp: "Argent gagné ou perdu pendant le match.",
        winRate: "Taux de victoire",
        kd: "K/D",
        sort: "Classer par",
        history: "Parties conservées",
        previous: "Précédent",
        next: "Suivant",
        details: "Détails du joueur",
        ended: "Terminé",
        unavailable: "Inconnu",
        ratioHelp:
            "Le K/D nécessite des données complètes sur les kills et les morts, ainsi qu’au moins une mort. Le taux de victoire exclut les résultats inconnus. Les totaux ne comptent que les valeurs connues ; x/y indique la couverture de la statistique.",
        retentionHelp:
            "La couverture comprend uniquement les parties terminées importées avec succès. L’historique manquant chez le fournisseur et les parties en cours sont exclus. La date de collecte ne garantit pas que toutes les parties du fournisseur ont été importées.",
    },
    gameData: {
        servers: {
            emptyTitle: "Aucun serveur de jeu connecté",
            emptyDescription:
                "Connectez un serveur CRCON ou Warcon pour que Logi collecte les résultats et les statistiques. La clé API est stockée chiffrée et ne peut plus être consultée ensuite.",
            closeForm: "Fermer",
            card: {
                status: {
                    collecting: "Collecte en cours",
                    stopped: "En pause suite à une erreur",
                    off: "Collecte arrêtée",
                    none: "Aucune collecte",
                },
                key: {
                    set: "enregistrée",
                    missing: "manquante",
                    not_required: "non nécessaire",
                    environment: "définie par l’exploitant de Logi",
                    needs_operator: "à saisir à nouveau",
                },
                unverified: "non vérifiée",
                changed: "modifiée le {date}",
                testOk: "validé",
                testFailed: "échec",
                lastGame: "Dernière partie",
                noGame: "aucune pour le moment",
                serverNumber: "serveur {id}",
                testKey: "Tester la clé",
                live: "Score en direct",
                liveHide: "Masquer le score en direct",
                fixUnauthorized: {
                    crcon: "Le serveur a refusé la clé. Créez dans CRCON une nouvelle clé autorisée à lire les informations du serveur, puis saisissez-la avec Changer la clé.",
                    other: "Le serveur a refusé la clé. Créez une nouvelle clé auprès du fournisseur, puis saisissez-la avec Changer la clé.",
                },
                retentionKeep: "Conserver les parties jouées",
                retentionHelp:
                    "Les parties plus anciennes sont supprimées durant la nuit et les sites recalculent leurs totaux.",
                browseHistory: "Parcourir les parties jouées",
            },
            form: {
                type: "Type de serveur",
                types: {
                    hll_crcon: "CRCON",
                    wardogs_warcon: "Warcon",
                    wardogs_rcon: "RCON",
                    wardogs_public_directory: "Public",
                },
                address: "Adresse",
                namePlaceholder: "Par exemple Serveur 2",
                serverNumber: {
                    hll_crcon: "Numéro du serveur dans CRCON",
                    wardogs_warcon: "Identifiant du serveur dans Warcon",
                    wardogs_rcon: "Identifiant du serveur dans RCON",
                    wardogs_public_directory:
                        "Identifiant du serveur dans la liste",
                },
                keyPlaceholder: "Coller la clé",
                help: "Le jeu est déterminé par le type de serveur. La clé est testée avant d’être enregistrée.",
                testFirst:
                    "L’enregistrement est possible après un test réussi.",
                testPassed:
                    "Le test a réussi. Vous pouvez enregistrer le serveur.",
                saveAndCollect: "Enregistrer et lancer la collecte",
            },
            keyLabel: "Clé API",
            lastTestLabel: "Dernier test",
            notTested: "Pas encore testée",
            collectionLabel: "Collecte",
            moreActions: "Autres actions pour {name}",
            historyTitle: "Historique des parties",
            title: "Serveurs de jeu",
            description:
                "Connectez les serveurs Hell Let Loose CRCON ou Wardogs Warcon utilisés par cet espace de travail : adresse HTTPS, identifiant chez le fournisseur et clé API. Logi teste la connexion et chiffre la clé lors du stockage. Une clé enregistrée ne peut être ni affichée ni exportée ; pour la modifier, saisissez-en une nouvelle.",
            encryptionUnavailable:
                "Le stockage chiffré des clés n’est pas encore activé sur ce déploiement de Logi. Vous pouvez tester une clé, mais son enregistrement est désactivé jusqu’à l’activation par l’exploitant de Logi.",
            none: "Aucun serveur de jeu n’est encore connecté à cet espace de travail.",
            limit: "Jusqu’à {limit} serveurs par espace de travail.",
            add: "Connecter un serveur",
            managed: {
                workspace: "Géré dans cet espace de travail",
                operator: "Configuré par l’exploitant de Logi",
            },
            games: {
                hell_let_loose: "Hell Let Loose",
                wardogs: "Wardogs",
            },
            providers: {
                hll_crcon: "CRCON",
                wardogs_warcon: "Panneau Warcon",
                wardogs_rcon: "Wardogs RCON",
                wardogs_public_directory: "Annuaire Wardog Servers (public)",
            },
            fields: {
                displayName: "Nom",
                game: "Jeu",
                provider: "Fournisseur",
                origin: "Adresse HTTPS",
                serverId: "Identifiant du serveur chez le fournisseur",
                key: "Clé API",
                newKey: "Nouvelle clé API",
            },
            hints: {
                origin: "L’adresse seule, par exemple https://panel.example.com, sans chemin.",
                serverId: {
                    hll_crcon: "Le numéro du serveur CRCON, généralement 1.",
                    wardogs_warcon:
                        "L’UUID du serveur affiché dans le panneau Warcon.",
                    wardogs_rcon:
                        "L’identifiant du serveur renvoyé par votre API RCON.",
                    wardogs_public_directory:
                        "L’identifiant du serveur dans l’annuaire Wardog Servers.",
                },
                key: "Transmise une seule fois, testée, puis stockée chiffrée. Logi ne l’affichera plus.",
                keyOptional:
                    "Facultative pour CRCON : sans clé, Logi ne lit que les données publiques. Avec une clé, l’utilisateur CRCON associé doit pouvoir consulter les informations de connexion.",
                keyNone: "L’annuaire public ne nécessite pas de clé.",
            },
            enableAfterTest: "Démarrer la collecte après un test réussi",
            allowUnverified:
                "Enregistrer même si le test échoue (collecte arrêtée jusqu’à un test réussi)",
            actions: {
                test: "Tester la connexion",
                testing: "Test en cours…",
                save: "Enregistrer le serveur",
                saving: "Enregistrement…",
                testStored: "Tester la clé enregistrée",
                changeKey: "Changer la clé",
                saveKey: "Enregistrer la clé",
                cancel: "Annuler",
                removeKey: "Retirer la clé",
                rename: "Renommer",
                saveName: "Enregistrer le nom",
                enable: "Démarrer la collecte",
                disable: "Arrêter la collecte",
                remove: "Retirer le serveur",
            },
            confirm: {
                removeKeyTitle: "Retirer la clé de {name} ?",
                removeTitle: "Retirer {name} ?",
                cancel: "Annuler",
                removeKey:
                    "La collecte nécessitant la clé sera arrêtée jusqu’à la saisie d’une nouvelle clé.",
                remove: "La collecte s’arrête et la clé stockée est supprimée. L’historique collecté est conservé.",
            },
            key: {
                set: "Clé stockée chiffrée",
                missing: "Aucune clé stockée",
                not_required: "Aucune clé nécessaire",
                environment: "Clé définie par l’exploitant de Logi",
                needs_operator:
                    "Ancienne référence de clé : saisissez la clé à nouveau ici ou demandez à l’exploitant de Logi de la migrer",
            },
            keyChanged: "Clé modifiée le {date}",
            verified: "La clé a réussi son dernier test",
            unverified:
                "Clé non vérifiée : testez-la avant de lancer la collecte",
            failure: {
                key_unavailable:
                    "La clé stockée est inutilisable car la clé de chiffrement de l’exploitant est indisponible. Contactez l’exploitant de Logi.",
                decrypt_failed:
                    "Impossible de lire la clé stockée pour ce serveur. Saisissez-la à nouveau.",
            },
            collection: {
                enabled: "Collecte en cours",
                disabled: "Collecte arrêtée",
                none: "Aucune collecte configurée",
                lastSuccess: "Dernière collecte réussie le {date}",
                never: "Aucune collecte réussie pour le moment",
            },
            lastTest: "Dernier test le {date} : {outcome}",
            saved: {
                created: "Serveur enregistré, collecte en cours.",
                draft: "Serveur enregistré comme brouillon désactivé. Testez-le et lancez la collecte après un test réussi.",
                key: "Clé enregistrée.",
                keyUnverified:
                    "Clé enregistrée, mais le test a échoué : la collecte est arrêtée.",
                removedKey: "Clé retirée.",
                renamed: "Nom enregistré.",
                removed: "Serveur retiré.",
                enabled: "Collecte démarrée.",
                disabled: "Collecte arrêtée.",
            },
            outcomes: {
                ok: "La connexion fonctionne et la clé est acceptée pour ce serveur.",
                unauthorized: "Le fournisseur a refusé la clé.",
                server_mismatch:
                    "Le fournisseur a répondu, mais pas pour cet identifiant de serveur.",
                rate_limited:
                    "Le fournisseur limite le nombre de requêtes. Réessayez plus tard.",
                timeout: "Le fournisseur n’a pas répondu à temps.",
                network: "Impossible de joindre le fournisseur.",
                invalid_response:
                    "Le fournisseur a envoyé une réponse inattendue. Vérifiez l’adresse et le fournisseur.",
                configuration:
                    "Cette adresse n’est pas autorisée (adresses HTTPS publiques uniquement) ou la configuration du serveur est incomplète.",
                unsupported:
                    "Le fournisseur ne prend pas en charge cette vérification.",
                key_unavailable:
                    "La clé stockée est inutilisable. Saisissez-la à nouveau ou contactez l’exploitant de Logi.",
            },
            errors: {
                invalid_source:
                    "Vérifiez les champs : une adresse HTTPS sans chemin et un identifiant de serveur au format du fournisseur.",
                invalid_key:
                    "La clé doit comporter de 8 à 4 096 caractères visibles, sans espace.",
                duplicate_name:
                    "Un autre serveur de cet espace de travail porte déjà ce nom.",
                duplicate_identity:
                    "Ce serveur est déjà connecté à cet espace de travail.",
                limit_reached:
                    "Cet espace de travail a atteint le nombre maximum de serveurs.",
                not_found: "Ce serveur n’existe plus. Actualisez la liste.",
                revision_conflict:
                    "Quelqu’un a modifié ce serveur. Actualisez et réessayez.",
                operator_managed:
                    "Ce serveur est configuré par l’exploitant de Logi : il ne peut être ni renommé ni retiré ici. Sa clé peut uniquement être remplacée.",
                key_required: "Ce fournisseur nécessite une clé API.",
                key_not_allowed: "L’annuaire public n’accepte pas de clé.",
                verification_required:
                    "Le test de connexion a échoué. Corrigez le problème ou enregistrez explicitement la clé comme non vérifiée.",
                encryption_unavailable:
                    "Le stockage chiffré des clés est indisponible. Contactez l’exploitant de Logi.",
                rate_limited:
                    "Trop de tests de connexion. Réessayez dans {seconds} s.",
                unavailable:
                    "Impossible de charger ou d’enregistrer les serveurs de jeu. Actualisez et réessayez.",
            },
        },
        liveScoreboard: "Tableau des scores Warcon en direct",
        scoreboardPolling:
            "Actualisé toutes les 15 secondes tant qu’il est ouvert. Les mises à jour du fournisseur peuvent être retardées.",
        scoreboardError:
            "Le tableau des scores en direct est indisponible. Réessayez lorsque le fournisseur sera rétabli.",
        scoreboardEmpty: "Aucun joueur dans le dernier relevé.",
        scoreboardUnavailable:
            "Aucun relevé récent des joueurs n’est disponible.",
        playerObservation: "Relevé des joueurs",
        joinCode: "Code de connexion à la partie",
        player: "Joueur",
        faction: "Faction",
        kills: "Kills",
        deaths: "Morts",
        cash: "Argent",
        ping: "Ping (ms)",
        collectedSessions: "Sessions collectées",
        historyObserved: "Dernier import de l’historique",
        historyError: "Collecte de l’historique",
        title: "Données des serveurs de jeu",
        description:
            "Collectez les données des serveurs dans Logi et partagez certains champs avec votre site. Connectez un serveur ci-dessus ; la collecte démarrera après un test de connexion réussi.",
        loading: "Chargement…",
        refresh: "Actualiser",
        saving: "Enregistrement…",
        enable: "Activer / reprendre",
        disable: "Désactiver",
        disabled: "Désactivé",
        error: "Impossible de charger ou d’enregistrer les connexions. Réessayez ou contactez l’exploitant.",
        empty: "Aucun serveur de jeu ne collecte encore de données pour cet espace de travail.",
        state: "État des données",
        players: "Joueurs",
        map: "Carte",
        observed: "Dernier relevé",
        unknown: "Inconnu",
        never: "Non collecté",
        unconfirmed: "scores en direct, non confirmés",
        historySupported:
            "Collecte de l’historique des matchs prise en charge. Les données importées doivent être vérifiées avant de confirmer le résultat.",
        historyUnsupported:
            "Cette source ne permet pas de collecter l’historique des matchs.",
        freshness: {
            fresh: "À jour",
            stale: "Périmé",
            unavailable: "Indisponible",
        },
        errors: {
            not_listed:
                "Le serveur n’est pas répertorié ; son état est inconnu.",
            timeout: "Le fournisseur n’a pas répondu à temps.",
            network: "Le fournisseur est injoignable.",
            rate_limited:
                "En attente de la levée de la limite de requêtes du fournisseur.",
            unauthorized: "Collecte en pause : accès au fournisseur refusé.",
            invalid_response:
                "Le fournisseur a renvoyé une réponse non prise en charge.",
            unsupported:
                "Collecte en pause : la fonctionnalité requise est indisponible.",
            configuration:
                "Collecte en pause : vérifiez l’adresse et la clé du serveur ou contactez l’exploitant de Logi.",
        },
    },
    gameCatalogue: {
        title: "Jeux",
        description:
            "Définitions globales des jeux, fonctionnalités disponibles et sélecteurs d’événements.",
        addGame: "Ajouter un jeu",
        newGameName: "Nouveau jeu",
        gameId: "Identifiant du jeu",
        managedIconAssetId:
            "Identifiant de la ressource d’icône gérée (facultatif)",
        displayName: "Nom affiché",
        eventSelectionLabel: "Libellé du sélecteur d’événement",
        optionsOnePerLine: "Options (une par ligne)",
        optionalTargetLabel: "Libellé facultatif de la cible",
        targetIsOptional: "La cible est facultative",
        defaultEventSelectionLabel: "Activité",
        saveGame: "Enregistrer le jeu",
        saving: "Enregistrement…",
        saved: "Enregistré.",
        saveFailed: "Impossible d’enregistrer ce jeu.",
        capabilities: {
            title: "Fonctionnalités",
            maps: "Cartes",
            stratmaps: "Cartes tactiques",
            serverData: "Données du serveur",
            playerStats: "Statistiques des joueurs",
            matchResults: "Résultats des matchs",
            competitions: "Compétitions",
        },
    },
} as const
