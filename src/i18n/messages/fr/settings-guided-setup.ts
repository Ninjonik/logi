export const settingsHub_guidedSetup = {
    metaTitle: "Guide de configuration",
    workspace: "Configuration de l’espace de travail",
    exit: "Quitter le guide",
    progressLabel: "Progression du guide",
    stepsLabel: "Étapes du guide",
    reopenHint: "Vous pouvez rouvrir une étape terminée à tout moment.",
    required: "Obligatoire",
    optional: "Facultatif",
    optionalSuffix: "facultatif",
    stepOf: "Étape {number} sur {total}",
    doneMark: "Terminé",
    back: "Retour",
    skip: "Passer",
    continue: "Continuer",
    finish: "Terminer",
    saving: "Enregistrement…",
    saveError: "Échec de l’enregistrement. Réessayez.",
    discordUnavailable:
        "Logi ne peut pas lire les salons et les rôles Discord pour le moment. Vérifiez le bot à l’étape 1.",
    steps: {
        bot: {
            heading: "Inviter le bot Logi sur Discord",
            description:
                "Le bot annonce les événements, crée les salons d’escouade et gère les rôles. Il doit être présent sur le serveur de votre clan.",
            ready: "Le bot est présent sur le serveur et peut voir les salons et les rôles.",
            checking:
                "Le bot est présent sur le serveur. Vérification de ses accès…",
            blind: "Le bot est présent sur le serveur, mais ne voit pas les salons et les rôles. Accordez-lui les permissions Voir les salons et Gérer les rôles sur Discord.",
            missing: "Le bot n’est pas encore sur le serveur de votre clan.",
            invite: "Inviter le bot",
            checkAgain: "Vérifier à nouveau",
        },
        games: {
            heading: "À quels jeux votre clan joue-t-il ?",
            description: "Sélectionnez les jeux pratiqués par votre clan.",
            groupLabel: "Jeux du clan",
            required: "Choisissez au moins un jeu.",
        },
        profile: {
            heading: "Présentez le clan",
            description:
                "Le nom et le logo apparaissent sur le site Logi et dans les messages du bot.",
            name: "Nom du clan",
            namePlaceholder: "Nom du clan",
            logo: "Logo",
            logoAlt: "Logo du clan",
            upload: "Importer un logo",
            uploading: "Importation…",
            formats: "PNG ou JPG",
            about: "Description",
            aboutPlaceholder: "Quelques phrases pour présenter le clan",
            nameRequired: "Saisissez le nom du clan.",
            logoRequired: "Ajoutez le logo du clan.",
        },
        channels: {
            heading: "Où le bot doit-il publier ses messages ?",
            description:
                "Choisissez les salons de votre Discord. Vous pourrez définir des salons différents pour chaque jeu ultérieurement.",
            announcements: "Annonces",
            announcementsHelp:
                "Nouveaux événements et modifications des compositions.",
            eventResults: "Résultats des événements",
            eventResultsHelp:
                "Scores confirmés et liens vers les statistiques des matchs. Facultatif ; commun à tous les jeux.",
            eventInfo: "Informations sur les événements",
            eventInfoHelp: "Détails des événements et inscriptions.",
            errors: "Erreurs du bot",
            errorsHelp:
                "Réservé aux administrateurs, lorsqu’un problème survient.",
            choose: "Choisir un salon",
            none: "Aucun",
        },
        roles: {
            heading: "Qui fait partie du clan et qui le gère ?",
            description:
                "Logi identifie les membres et les administrateurs du clan grâce à leurs rôles Discord.",
            clanRole: "Rôle du clan",
            clanRoleHelp:
                "Toute personne ayant ce rôle est membre du clan. Créez-le dans Paramètres du serveur Discord → Rôles, puis actualisez Logi pour le sélectionner.",
            adminRole: "Rôle d’administrateur Logi",
            adminRoleHelp:
                "Les personnes ayant ce rôle peuvent consulter et modifier les paramètres.",
            choose: "Choisir un rôle",
            none: "Aucun rôle",
            noResults: "Aucun rôle trouvé.",
        },
        gameServers: {
            heading: "Connecter un serveur de jeu",
            description:
                "Logi peut collecter les résultats et les statistiques des joueurs depuis votre serveur CRCON ou Warcon. La clé API est stockée chiffrée et ne sera plus consultable.",
            empty: "Aucun serveur pour le moment. La connexion prend environ une minute : adresse, identifiant du serveur et clé API.",
            connect: "Connecter un serveur",
        },
    },
    finished: {
        title: "Guide de configuration terminé.",
        description:
            "Consultez la liste de configuration dans les paramètres. Les étapes obligatoires restantes sont indiquées ci-dessous.",
        openSettings: "Ouvrir les paramètres",
        again: "Reprendre le guide",
    },
} as const
