export const settingsHub_commandsPage = {
    title: "Commandes Discord",
    description:
        "Commandes proposées par le bot, personnes autorisées et salons où les utiliser. Le bot répond dans la langue du clan.",
    registration: {
        title: "Enregistrement des commandes",
        phoneTitle: "Commandes enregistrées",
        registered:
            "Enregistrées {when} · {count} sur {server}. Après l’enregistrement de vos modifications, le bot les réenregistre automatiquement ; Discord les affiche dans la minute.",
        registeredShort: "{when} · {count}",
        count: { one: "{count} commande", other: "{count} commandes" },
        today: "aujourd’hui à {time}",
        yesterday: "hier à {time}",
        neverTitle: "Les commandes ne sont pas encore enregistrées",
        never: "Le bot les enregistre dès qu’il est en ligne et qu’il voit ce serveur. Il les réenregistre automatiquement après chaque modification de vos paramètres.",
        pending: "Le bot réenregistrera les commandes dans la minute.",
        failedTitle: "Échec de l’enregistrement des commandes",
        failed: "{reason} Vérifiez que le bot est présent sur le serveur et qu’il peut gérer les commandes, puis réessayez.",
        failures: {
            forbidden: "Discord n’a pas autorisé le bot à les enregistrer.",
            rate_limited: "Discord a temporairement limité les requêtes.",
            unavailable: "Discord n’a pas répondu.",
        },
        reregister: "Réenregistrer",
        requested: "Le bot réenregistrera les commandes dans la minute.",
        requestFailed: "Impossible d’envoyer la demande.",
    },
    legacy: {
        title: "Anciennes connexions aux serveurs de statistiques · {count}",
        help: "Ni /link, ni les candidatures au clan, ni /stats ne les utilisent : la recherche de joueurs consulte les parties enregistrées depuis les serveurs du clan. Après leur transfert vers Serveurs de jeu, la clé sera stockée chiffrée et pourra être testée.",
        convert: "Transférer vers Serveurs de jeu",
        show: "Afficher les connexions",
        hide: "Masquer les connexions",
        converted:
            "Connexions transférées : {converted}. Testez-les dans Serveurs de jeu ; vous pourrez ensuite supprimer les anciennes connexions.",
        nothingToConvert:
            "Toutes les connexions figurent déjà dans Serveurs de jeu ou ne peuvent pas être transférées.",
        skipped:
            "Connexions non transférées : {count} (URL sans HTTPS, clé manquante ou autre jeu).",
        encryptionUnavailable:
            "Le chiffrement des clés est indisponible pour le moment ; aucune connexion n’a été transférée.",
        failed: "Échec du transfert des connexions.",
    },
    commands: {
        title: "Commandes",
        intro: "Logi vérifie les permissions directement auprès de Discord à chaque utilisation. Le menu affiché après « / » est identique pour tous ; les personnes non autorisées reçoivent une courte explication et /help ne leur propose pas la commande.",
        members: "Pour les membres",
        staff: "Pour les responsables",
        new: "Nouveau",
        on: "Activé",
        off: "Désactivé",
        who: "Qui peut l’utiliser",
        reply: "Réponse",
        where: "Où l’utiliser",
        audiences: {
            everyone: {
                label: "Tout le serveur",
                description: "Tous les membres du serveur Discord",
            },
            clanMembers: {
                label: "Membres du clan",
                description:
                    "Personnes ayant le rôle du clan défini dans Rôles et accès",
            },
            logiAdmins: {
                label: "Responsables Logi",
                description:
                    "Administrateurs ou personnes ayant le rôle de responsable",
            },
        },
        rolesHint: "Vous pouvez également autoriser des rôles spécifiques.",
        audienceWithRoles:
            "{group}, ainsi que les personnes ayant le rôle {roles}.",
        addRole: "Rôle",
        addRoleAria: "Ajouter un rôle à {command}",
        removeRole: "Retirer le rôle {role}",
        searchRoles: "Rechercher des rôles",
        noRoles: "Aucun autre rôle",
        replies: {
            private: "Uniquement l’auteur",
            privateShare: "Uniquement l’auteur, avec un bouton Partager",
        },
        fixedWho: {
            help: "Tout le serveur · chacun ne voit que ses commandes",
            link: "Tout le serveur · les candidats en ont aussi besoin",
            notice: "Joueurs inscrits à un événement qui n’a pas encore commencé",
        },
        allChannels: "Tous les salons",
        someChannels: "Salons sélectionnés uniquement",
        addChannel: "Salon",
        addChannelAria: "Ajouter un salon à {command}",
        removeChannel: "Retirer le salon {channel}",
        searchChannels: "Rechercher un salon",
        noChannels: "Aucun autre salon",
        channelsHint:
            "Ailleurs, le bot indique dans quels salons la commande est disponible.",
        playerShareHint:
            "Partager publie le profil dans le salon où la commande a été utilisée.",
        whoLabel: "Qui peut utiliser {command}",
        replyLabel: "Réponse de {command}",
        whereLabel: "Où utiliser {command}",
        closeTicket: {
            toggle: "selon les paramètres des tickets",
            who: "Support de la catégorie ou responsables Logi",
            whoLink: "Tickets",
            reply: "Confirmation à l’auteur de la commande, récapitulatif dans le fil, MP à l’auteur du ticket",
            where: "Uniquement dans les fils de tickets",
        },
        closeApplication: {
            toggle: "selon les paramètres d’adhésion",
            who: "Support de la catégorie ou responsables Logi",
            whoLink: "Adhésion",
            reply: "Confirmation à l’auteur de la commande, décision dans le fil, MP au candidat",
            where: "Uniquement dans les fils de candidature",
        },
    },
    stats: {
        gamesTitle: "Jeux et source des données",
        gameSwitch: "Statistiques {game}",
        hllSource:
            "À partir des profils publics HLL Records, via le compte Steam du joueur.",
        wardogsSource: "À partir des parties enregistrées depuis vos",
        gameServersLink: "serveurs de jeu",
        shareChannel: "Salon de partage",
        shareChannelHelp:
            "Partager publie la fiche directement ici. Sans salon défini, le bot demande au joueur où la publier.",
        noShareChannel: "Aucun salon",
        previewTitle: "Aperçu de la réponse · données d’exemple",
        previewPlayer: "Joueur 17",
    },
    descriptions: {
        title: "Descriptions des commandes dans Discord",
        intro: "Discord affiche les descriptions dans la langue du clan pour tous les membres, quelle que soit la langue de leur application. La langue du clan est {language} ; après une modification dans {channels}, le bot réenregistre les commandes. Il ajoute « (responsables) » uniquement aux commandes réservées aux responsables Logi.",
        channelsLink: "Salons et langue",
        languages: {
            cs: "Tchèque",
            en: "Anglais",
            de: "Allemand",
            pl: "Polonais",
            fr: "Français",
        },
        command: "Commandement",
        clanLanguage: "langue du clan",
        columns: {
            cs: "Čeština",
            en: "Anglais",
            de: "Deutsch",
            pl: "Polski",
            fr: "Français",
        },
    },
    saveNote: "Après l’enregistrement, le bot réenregistre les commandes.",
    saved: "Paramètres des commandes enregistrés. Le bot réenregistre les commandes.",
    saveError: "Impossible d’enregistrer les paramètres des commandes.",
} as const
