export const integrationsMessages = {
    membershipIntegration: {
        title: "Intégrations d’adhésion Discord",
        description:
            "Choisissez les rôles Discord que chaque intégration peut consulter. L’accès nécessite également une clé en lecture seule avec l’autorisation d’adhésion Discord. Le site décide comment utiliser ces observations.",
        enabled: "Autoriser la consultation des adhésions avec cette clé",
        roles: "Rôles autorisés",
        rolesHelp:
            "Sans rôle sélectionné, seules la présence et l’affectation Logi sont partagées. Enregistrez pour appliquer les modifications.",
        empty: "Créez une clé API en lecture seule avec l’autorisation d’adhésion Discord, puis actualisez cette liste.",
        loading: "Chargement…",
        refresh: "Actualiser",
        saving: "Enregistrement…",
        save: "Enregistrer la politique",
        saved: "Politique d’adhésion enregistrée.",
        error: "Impossible de charger ou d’enregistrer les politiques d’adhésion. Actualisez et réessayez.",
        invalid:
            "Utilisez des identifiants de rôles Discord valides, avec au maximum 100 rôles par jeu.",
    },
    websiteEventPolicies: {
        title: "Commandes d’événement du site",
        description:
            "Autorisez un site connecté à créer, modifier ou annuler des événements avec sa clé de service. Une politique associe une application SSO enregistrée à une clé API restreinte et définit, pour chaque jeu, les rôles Discord dont les membres peuvent utiliser ces commandes.",
        application: "Application d’authentification unique",
        applicationPlaceholder: "Choisir une application",
        noApplications:
            "Enregistrez d’abord une application SSO. La politique associera les commandes du site à cette application.",
        noKeys: "Créez une clé API restreinte pour le backend du site, puis actualisez. Les anciennes clés sans restrictions ne peuvent pas recevoir de politique de commandes.",
        enabled: "Autoriser les commandes d’événement avec cette clé",
        roles: "Rôles autorisés",
        rolesHelp:
            "Un jeu sans rôle reste en lecture seule. Enregistrer une politique active accorde l’accès en écriture aux commandes d’événement des jeux ayant des rôles ; la désactiver retire cet accès.",
        granted: "Accès en écriture accordé pour : {games}",
        notGranted: "Aucun accès en écriture aux commandes d’événement.",
        loading: "Chargement…",
        refresh: "Actualiser",
        saving: "Enregistrement…",
        save: "Enregistrer la politique",
        saved: "Politique des commandes d’événement enregistrée.",
        error: "Impossible de charger ou d’enregistrer la politique des commandes d’événement. Actualisez et réessayez.",
        denied: "La politique a été refusée. Utilisez une clé restreinte active de cet espace de travail et une application qui y est enregistrée.",
        invalid:
            "Utilisez des identifiants de rôles Discord valides, au maximum 64 par jeu, pour les jeux activés dans cet espace de travail.",
    },
    apiKeys: {
        revokeTitle: "Révoquer la clé {name} ?",
        groupsLegend: "Domaines",
        groups: {
            matches: {
                label: "Matchs",
                short: "matchs",
                help: "Événements, matchs, résumés et cartes tactiques.",
            },
            rosters: {
                label: "Compositions",
                short: "compositions",
                help: "Compositions, escouades et affectations des joueurs.",
            },
            results: {
                label: "Résultats",
                short: "résultats",
                help: "Résultats confirmés, statistiques des joueurs et historique des parties.",
            },
            members: {
                label: "Membres",
                short: "membres",
                help: "Membres du clan et leur statut. La consultation des adhésions possède également ses propres règles.",
            },
            servers: {
                label: "Serveurs de jeu",
                short: "serveurs",
                help: "État des serveurs en direct, Warcon, HLL et état des connexions.",
            },
            league: {
                label: "Ligue et équipes",
                short: "ligue",
                help: "Matchs Wardogs League et catalogue des équipes.",
            },
        },
        partialGroup: "{group} (partiel)",
        readOnlyShort: "lecture seule",
        everyGame: "tous les jeux",
        createdOn: "créée le {date}",
        revokeDescription:
            "Tout ce qui utilise cette clé, comme votre site, cesse immédiatement de recevoir les données de Logi. Cette action est irréversible ; créez une nouvelle clé pour rétablir l’accès.",
        revokeConfirm: "Révoquer la clé",
        emptyTitle: "Aucune clé API pour le moment",
        emptyDescription:
            "Créez une clé pour le serveur de votre site. Sélectionnez uniquement les données et les jeux nécessaires.",
        description:
            "Créez une clé d’intégration et conservez-la sur votre serveur. Sélectionnez uniquement les données et les jeux nécessaires à l’intégration.",
        name: "Nom de la clé",
        namePlaceholder: "Nom du site, ex. : site principal",
        access: "Accès",
        readOnly: "Lecture seule",
        fullAccess: "Accès complet (ancien)",
        readOnlyHelp:
            "Peut uniquement lire les ressources et les jeux sélectionnés. Ne peut ni créer, ni modifier, ni supprimer de données.",
        fullAccessHelp:
            "Peut lire et modifier toutes les données du clan, pour tous les jeux. À réserver aux intégrations nécessitant un accès en écriture.",
        resources: "Ressources",
        games: "Jeux",
        selectScope: "Sélectionnez au moins une ressource et un jeu.",
        privateData:
            "Les fiches complètes peuvent contenir des informations opérationnelles privées. Vérifiez les données avant de les publier.",
        createReadOnly: "Créer une clé en lecture seule",
        createFullAccess: "Créer une clé à accès complet",
        copyNow:
            "Copiez cette clé maintenant. Elle ne pourra plus être affichée. Conservez-la sur votre serveur.",
        copy: "Copier la clé API",
        copied: "Clé API copiée.",
        copyFailed:
            "Impossible de copier la clé. Copiez-la manuellement avant de la masquer.",
        hide: "Masquer la clé",
        createFailed:
            "Impossible de créer la clé. Vérifiez votre sélection et réessayez.",
        invalidKey: "Le serveur a renvoyé une clé API invalide.",
        revoke: "Révoquer",
        revokeFailed: "Impossible de révoquer la clé. Réessayez.",
        revoked: "révoquée",
        created: "créée",
        existingKeys: "Clés existantes",
        rotateHelp:
            "Pour modifier les permissions, créez une nouvelle clé, basculez l’intégration dessus, puis révoquez l’ancienne.",
        allGames: "tous les jeux ; lecture et écriture",
        loading: "Chargement des clés…",
        loadFailed:
            "Impossible d’actualiser les clés. Les permissions affichées peuvent être obsolètes.",
        retry: "Réessayer",
        empty: "Aucune clé API n’a été créée.",
        invalidPolicy:
            "Restrictions non reconnues ; l’accès au backend est refusé.",
        resourceLabels: {
            "server-game-history":
                "Parties de serveur conservées (pseudos et Steam ID)",
            "league-matches": "Wardogs League",
            "league-fixtures": "Matchs Wardogs League suivis",
            "hll-live":
                "Tableau des scores HLL en direct (pseudos et identifiants de plateforme inclus)",
            "warcon-data": "Données de jeu Warcon (pseudos et Steam ID inclus)",
            "member-summaries": "Annuaire des membres (lecture seule)",
            "roster-summaries":
                "Compositions publiées et présences (lecture seule)",
            "player-stat-summaries":
                "Données vérifiées des joueurs issues des sessions collectées",
            "membership-summaries":
                "Adhésion Discord (politique distincte requise)",
            "server-snapshots": "Instantanés des serveurs de jeu",
            "integration-health": "État de la collecte",
            "event-summaries": "Résumés des événements",
            "match-summaries": "Résumés des matchs",
            "result-summaries": "Résumés des résultats vérifiés",
            events: "Événements (fiches complètes)",
            matches: "Matchs (statistiques brutes)",
            groups: "Groupes",
            rosters: "Compositions",
            assignments: "Affectations des membres",
            stratmaps: "Cartes tactiques",
            teams: "Annuaire des équipes (équipes actives, noms et logos)",
        },
    },
    verifiedPlatformLinks: {
        title: "Compte Steam vérifié",
        description:
            "Confirmez que vous contrôlez votre compte Steam en vous connectant sur Steam. Les identifiants saisis dans votre profil sont de simples déclarations non vérifiées.",
        loading: "Chargement…",
        refresh: "Actualiser",
        error: "L’association Steam est indisponible. Actualisez ou réessayez dans un instant.",
        callbackFailed:
            "La vérification Steam n’a pas abouti. Lancez une nouvelle tentative d’association.",
        verified: "Vérifié via Steam",
        empty: "Aucun compte Steam vérifié",
        verifiedAt: "Vérifié",
        revokedAt: "Dissocié",
        link: "Vérifier avec Steam",
        unlink: "Dissocier Steam",
        history: "Historique récent des associations",
        effect: "La dissociation arrête les futures attributions de statistiques au joueur. Cette preuve n’accorde aucun rôle Discord, ne confirme pas la possession d’un jeu et ne publie pas votre profil sur le site.",
    },
    integrationSettings: {
        cancel: "Annuler",
        web: {
            stepKey: "Clé API pour le site",
            stepLogin: "Se connecter avec Logi",
            stepMembers: "Ce que le site peut faire pour les membres",
            newKey: "Nouvelle clé",
            closeForm: "Fermer",
            keyShownOnce:
                "Une clé n’est affichée qu’une fois, juste après sa création. Conservez-la sur le serveur de votre site.",
            loginPage: "Page de connexion du clan",
            ssoApps: "Applications d’authentification unique",
            addApplication: "Ajouter une application",
            membersRowHelp:
                "Via la clé {key}. Le membre doit posséder l’un des rôles.",
            saveRoles: "Enregistrer les rôles",
            membersTitle: "Vérifier qui est membre",
            membersHelp:
                "Via une clé en lecture seule avec l’autorisation d’adhésion Discord. Le site ne voit que les membres possédant l’un des rôles choisis.",
            eventsTitle: "Créer et modifier des événements",
            eventsHelp:
                "Via une application SSO et sa clé. Réservé aux personnes possédant l’un des rôles choisis.",
            footer: "Les clés et les applications sont enregistrées immédiatement. Les rôles s’enregistrent avec le bouton de chaque clé.",
            rolesPlaceholder: "Choisir les rôles",
            rolesUnavailable:
                "Impossible de charger les rôles Discord. Actualisez la page pour réessayer.",
        },
        sso: {
            emptyTitle: "Aucune application de connexion pour le moment",
            emptyDescription:
                "Ajoutez votre site comme application pour que les membres s’y connectent avec leur compte Discord via Logi.",
            redirects: "Adresses de retour après connexion : {count}",
            clientId: "Identifiant client",
            edit: "Modifier",
            save: "Enregistrer les modifications",
            saved: "Application enregistrée.",
            removeTitle: "Retirer {name} ?",
            removeDescription:
                "Les membres ne pourront plus se connecter à {website} avec Logi. L’identifiant client et le secret de l’application cesseront de fonctionner, ainsi que les commandes d’événement du site qui lui sont liées. Cette action est irréversible.",
            removeConfirm: "Retirer l’application",
        },
        webhooks: {
            emptyTitle: "Aucun webhook pour le moment",
            emptyDescription:
                "Ajoutez une adresse HTTPS : Logi y enverra les changements d’événements, de compositions, d’articles et de paramètres, signés avec un secret.",
            deleteTitle: "Supprimer ce webhook ?",
            deleteDescription:
                "Logi cessera immédiatement d’envoyer les changements à {url} et son secret de signature sera invalidé. Cette action est irréversible.",
            deleteConfirm: "Supprimer le webhook",
            loadFailed:
                "Impossible de charger les webhooks. Actualisez et réessayez.",
            createFailed:
                "Impossible de créer le webhook. Vérifiez l’adresse et réessayez.",
            actionFailed: "La modification n’a pas été enregistrée. Réessayez.",
            rotateFailed: "Impossible de renouveler le secret de signature.",
            historyFailed: "Impossible de charger l’historique des envois.",
        },
        calendar: {
            emptyTitle: "Aucun lien de calendrier pour le moment",
            emptyDescription:
                "Créez un lien privé et ajoutez-le à Google Agenda ou à une autre application de calendrier. Toute personne disposant du lien peut voir les événements du clan.",
            rotateTitle: "Créer un nouveau lien de calendrier ?",
            rotateDescription:
                "Le lien actuel cessera de fonctionner. Toutes les personnes abonnées devront ajouter le nouveau lien.",
            rotateConfirm: "Créer un nouveau lien",
        },
        league: {
            title: "Suivi Wardogs League",
            cadence:
                "Les nouveaux matchs sont recherchés toutes les {scan} minutes et les détails des matchs suivis sont actualisés toutes les {refresh} minutes. Le site et Discord utilisent les mêmes données.",
            enable: "Suivre Wardogs League et les liens de matchs",
            teamCodes: "Tags des équipes suivies (séparés par des virgules)",
            scanEvery: "Rechercher de nouveaux matchs toutes les",
            refreshEvery: "Actualiser les détails suivis toutes les",
            minutes: "{minutes} minutes",
            scanNote:
                "L’index partagé est parcouru à la fréquence la plus rapide demandée par un clan actif ; ce clan ne récupère un nouvel index qu’après son propre intervalle. Les limites de la source peuvent allonger ces délais.",
            intakeChannel: "Salon où les membres publient les liens",
            intakePlaceholder: "Choisir le salon de collecte",
            panelsNote:
                "Le classement et les prochains matchs de toute la ligue sont publiés dans Discord via le panneau WD League, dans Paramètres → Panneaux Discord. Les fiches de matchs individuels ne sont plus publiées. Désactiver le suivi supprime les messages du panneau.",
            intakeNote:
                "Les messages des bots sont ignorés. Pour lire automatiquement les messages des membres, l’exploitant doit activer Message Content pour le bot. La recherche périodique et les ajouts manuels fonctionnent sans cette option.",
            save: "Enregistrer les paramètres",
            saved: "Enregistré.",
            saveFailed:
                "Échec de l’enregistrement. Vérifiez les permissions, le lien et les paramètres des salons.",
            loadFailed: "Impossible de charger les paramètres de suivi.",
            lastScan: "Dernière recherche réussie",
            nextScan: "Prochaine recherche",
            incomplete:
                "La liste est incomplète ; ajoutez manuellement les matchs manquants.",
            queueFull:
                "La découverte automatique a atteint sa limite. Les matchs existants restent actualisés ; les places restantes sont réservées aux ajouts manuels.",
            sourceError:
                "La source est indisponible. Les dernières données valides sont conservées.",
            addByUrl: "Ajouter un match via son URL de ligue",
            preview: "Charger l’aperçu",
            previewFailed: "Aperçu indisponible. Vérifiez l’URL du match.",
            track: "Suivre ce match",
            createNative: "Créer votre propre match dans Logi",
            states: {
                pending: "En attente de chargement",
                tracked: "Suivi actif",
                paused: "En pause",
                ignored: "Ignoré",
                archived: "Archivée",
                unmatched: "Hors filtre",
            },
            refreshOnce: "Recharger",
            resume: "Reprendre",
            pause: "Mettre en pause",
            ignore: "Ignorer",
            staleData: "Données anciennes, dernier chargement {time}",
            linkedEvent: "Match Logi pour cette rencontre",
            notLinked: "Non associé",
            unknownEvent: "Match associé qui n’est plus répertorié",
            noEvents:
                "Il n’y a pas encore de match Wardogs dans Logi. Créez-en un, puis associez-le ici.",
            saveLink: "Enregistrer l’association",
            emptyTitle: "Aucun match suivi pour le moment",
            emptyDescription:
                "Les matchs des équipes suivies apparaîtront ici après la prochaine recherche. Vous pouvez aussi en ajouter un via son URL ci-dessus.",
        },
    },
} as const
