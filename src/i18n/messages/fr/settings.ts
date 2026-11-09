import { settingsHub_messagesPage } from "./settings-messages-page"
import { settingsHub_commandsPage } from "./settings-commands-page"
import { settingsHub_guidedSetup } from "./settings-guided-setup"
import { settingsHub_sections } from "./settings-sections"
import { settingsHub_overview } from "./settings-overview"
export const settingsMessages = {
    settingsHub: {
        title: "Paramètres du clan",
        description:
            "Configurez votre clan, le bot Discord et les intégrations.",
        setupTitle: "Configuration initiale",
        setupProgress: "{done} paramètres obligatoires sur {total} configurés",
        setupNext: "Étape suivante : {item}",
        setupDone: "Tous les paramètres obligatoires sont configurés.",
        continueSetup: "Continuer",
        backToOverview: "Tous les paramètres",
        sectionNavLabel: "Rubriques des paramètres",
        menu: "Rubriques",
        breadcrumbLabel: "Fil d’Ariane",
        channelsPage: {
            missingAnnouncements: "Le salon d’annonces n’est pas défini.",
            missingAnnouncementsHelp:
                "Sans ce salon, le bot ne peut pas annoncer les nouveaux événements.",
            languageTitle: "Langue et horaires",
            textTitle: "Salons textuels",
            voiceTitle: "Salons vocaux",
            timezone: "Fuseau horaire",
            timezoneHelp:
                "Le bot l’utilise pour afficher les horaires des événements.",
            language: "Langue du bot",
            languageHelp: "Messages, embeds et réponses aux commandes.",
            announcements: "Annonces",
            required: "obligatoire",
            announcementsHelp:
                "Nouveaux événements et modifications des compositions.",
            eventResults: "Résultats des événements",
            eventResultsHelp:
                "Résultats de matchs confirmés avec scores, résultat du clan et statistiques disponibles. Un seul salon pour tous les jeux.",
            eventInfo: "Informations sur les événements",
            eventInfoHelp: "Détails des événements et inscriptions.",
            calendar: "Calendrier",
            calendarHelp: "Un aperçu des événements à venir.",
            errors: "Erreurs du bot",
            errorsHelp: "Réservé aux administrateurs. Facultatif.",
            forum: "Catégorie des forums d’événements",
            forumHelp: "L’emplacement où le bot ouvre les fils des événements.",
            squadVoice: "Catégorie des salons vocaux d’escouade",
            squadVoiceHelp:
                "Chaque match dispose de sa propre catégorie de salons d’escouade, placée juste en dessous de celle-ci et avec les mêmes permissions.",
            meeting: "Salon de rassemblement",
            meetingHelp:
                "Le salon où les joueurs se retrouvent avant un événement.",
            addChannelException: "Salon différent pour un jeu",
            addCategoryException: "Catégorie différente pour un jeu",
            selectChannel: "Choisir un salon",
            selectCategory: "Choisir une catégorie",
            none: "Aucun",
        },
        scopeLegend: {
            clanWide: "Tout le clan : une valeur commune à tous les jeux",
            exception: "exception pour un seul jeu",
            clanWideShort: "Tout le clan",
        },
        overview: settingsHub_overview,
        openSection: "Ouvert",
        gameExceptionsNote:
            "Ces paramètres s’appliquent à tout le clan. Si un jeu nécessite un salon différent, ajoutez une exception pour ce jeu sous le paramètre concerné.",
        gameExceptionAdd: "Différent pour un jeu",
        gameExceptionRemove: "Supprimer l’exception pour {game}",
        gameExceptionPlaceholder: "Choisir pour {game}",
        statsServersPerGame: "Serveurs propres à un jeu",
        statsServersPerGameHelp:
            "Chaque jeu utilise les serveurs ci-dessus, sauf s’il possède sa propre liste ici.",
        clanWideOnly: "Ces paramètres s’appliquent à tout le clan.",
        resyncHelp:
            "Un superadministrateur peut actualiser les accès au tableau de bord à partir des membres actuels du rôle de gestion.",
        saved: "Paramètres enregistrés.",
        groups: {
            clan: "Clan",
            matches: "Matchs",
            discord: "Discord",
            gameData: "Données de jeu",
            web: "Site et intégrations",
            maintenance: "Maintenance",
        },
        status: {
            ready: "Configurer",
            attention: "À vérifier",
            off: "Désactivé",
        },
        requirements: {
            enabledGames: "Choisissez les jeux de votre clan",
            announcements: "Choisissez le salon d’annonces",
            clanRole: "Choisissez le rôle du clan",
        },
        channelPicker: {
            empty: "Aucun salon trouvé.",
            search: "Rechercher un salon",
            searchPlaceholder: "Rechercher par nom ou identifiant",
            channelId: "Identifiant du salon",
            pasteId: "Collez l’identifiant du salon",
            showList: "Liste",
            enterId: "ID",
            checkAccess: "vérifier l’accès",
            noCategory: "Aucune catégorie",
            unsupportedType: "type non pris en charge",
            manualHelp:
                "Utilisez l’identifiant d’un salon de ce serveur Discord.",
        },
        saveBar: {
            none: "Aucune modification non enregistrée",
            changes: {
                one: "{count} modification non enregistrée",
                few: "{count} modifications non enregistrées",
                many: "{count} modifications non enregistrées",
                other: "{count} modifications non enregistrées",
            },
            discard: "Abandonner",
            save: "Enregistrer",
        },
        rolesPage: {
            membersTitle: "Membres du clan",
            clanRole: "Rôle du clan",
            clanRoleHelp:
                "Tous les membres le possèdent. Logi l’attribue et le retire selon les paramètres d’adhésion.",
            adminsTitle: "Responsables Logi",
            adminRole: "Rôle de responsable",
            notSet: "non défini",
            adminRoleHelp:
                "Les personnes ayant ce rôle peuvent modifier les paramètres, les matchs et les compositions.",
            chooseRole: "Choisir un rôle",
            noRole: "Aucun rôle",
            noResults: "Aucun rôle correspondant.",
            rolesUnavailable:
                "Impossible de charger les rôles Discord. Vos paramètres n’ont pas été modifiés ; actualisez la page pour réessayer.",
            resyncHelp:
                "À utiliser lorsque des rôles ont changé et que Logi n’est pas encore à jour.",
            resyncNeedsRole:
                "Choisissez et enregistrez d’abord un rôle de responsable.",
            resync: "Actualiser depuis Discord",
            resynced: "Accès des responsables actualisés depuis Discord.",
            resyncError: "Impossible d’actualiser les accès des responsables.",
            holders: {
                one: "{count} personne possède ce rôle",
                few: "{count} personnes possèdent ce rôle",
                many: "{count} personnes possèdent ce rôle",
                other: "{count} personnes possèdent ce rôle",
            },
            accessNow: "Qui dispose actuellement d’un accès",
            updated: "mis à jour {time}",
            accessUnavailable:
                "Impossible de charger l’aperçu des accès pour le moment. Vous pouvez tout de même modifier les rôles.",
            noManagers:
                "Personne pour le moment. Enregistrez un rôle de responsable ou accordez la permission Administrateur à quelqu’un sur Discord.",
            reasonAdministrator: "Permission Administrateur",
            reasonRole: "rôle {role}",
            reasonManagerRole: "rôle de responsable",
            reasonGranted: "ajouté dans Logi",
            unknownMember: "Membre sans compte Logi",
            moreManagers: "et {count} autres",
        },
        commandsPage: settingsHub_commandsPage,
        messagesPage: settingsHub_messagesPage,
        panelsForm: {
            regionLabel: "Panneaux Discord publics",
            title: "Panneaux publics",
            refresh: "Actualiser les salons et l’état",
            intro: "Un panneau compact par source. Utilisez un tableau de scores séparé uniquement dans un autre salon. Les résultats sont publiés après validation dans Logi ; les résultats antérieurs ne sont pas publiés.",
            kind: "Fonctionnalité",
            kinds: {
                server: "Serveur et score",
                scoreboard: "Tableau de scores séparé",
                results: "Résultats confirmés",
            },
            source: "Source des données",
            selectSource: "Choisir une source",
            destination: "Salon de destination",
            reportCategory: "Signaler un joueur · catégorie de tickets privés",
            reportOff: "Désactivé",
            reportHelp:
                "Choisissez le salon et les rôles de responsable dans Tickets. Le bot vérifie la confidentialité et les accès avant l’envoi d’un signalement.",
            enabled: "Activé",
            showPlayers: "Détails privés des joueurs (Warcon / CRCON)",
            showLeaders: "Meilleurs joueurs publics (noms et statistiques)",
            refreshRate: "Actualiser",
            save: "Enregistrer et actualiser le panneau",
            verify: "Vérifier le salon",
            loadError:
                "Impossible de charger les panneaux. Vérifiez les accès du bot et les sources de données.",
            invalid: "Choisissez une source et un salon valide.",
            verified: "Le bot dispose des permissions nécessaires.",
            saved: "Enregistré. Le bot prend en compte la modification sous 15 secondes ; un déplacement attend la suppression du message d’origine.",
            requestFailed: "La demande a échoué.",
            previewTitle: "Aperçu des données du panneau",
            panelOn: "activé",
            panelPaused: "en pause",
            message: "Message",
            awaitingBot: "En attente du bot",
            pendingReconciliation: "en attente de synchronisation",
        },
        presetLinks: {
            squadPresets: "Modèles d’escouades",
            topicPresets: "Modèles de sujets",
        },
        sections: settingsHub_sections,
        guidedSetup: settingsHub_guidedSetup,
    },
} as const
