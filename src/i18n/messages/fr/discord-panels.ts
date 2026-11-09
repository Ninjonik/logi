import { discordPanelsPage_editor } from "./discord-panels-editor"
import { discordPanelsPage_list } from "./discord-panels-list"
export const discordPanelsMessages = {
    discordPanelsPage: {
        newPanel: "Nouveau panneau",
        time: {
            today: "aujourd’hui à {time}",
            yesterday: "hier à {time}",
            date: "{date} à {time}",
            now: "maintenant",
        },
        bot: {
            online: "Bot en ligne",
            version: "version {version} · dernier contact {ago}",
            refreshEvery: "Les panneaux s’actualisent toutes les 60 s",
            offlineTitle: "Le bot ne répond pas · dernier contact {ago}.",
            offlineBody:
                "Les panneaux ne s’actualisent plus et les nouveaux ne seront pas envoyés. Vérifiez que le bot fonctionne ; redémarrez-le après une mise à jour.",
            outdatedTitle: "Le bot utilise l’ancienne version {version}.",
            outdatedBody:
                "Les panneaux Discord nécessitent la version {required} ou ultérieure. Redémarrez le bot après sa mise à jour ; les panneaux ne s’actualisent pas avec l’ancienne version.",
            unknownTitle: "Le bot ne s’est pas encore manifesté.",
            unknownBody:
                "Les panneaux ne s’actualisent pas et les nouveaux ne sont pas envoyés tant que le bot n’est pas lancé. Démarrez-le ; son état apparaîtra ici sous 30 s.",
            notInServer:
                "Le bot ne s’est pas manifesté sur ce serveur Discord depuis plus de 3 minutes. Vérifiez qu’il y est bien invité ; tant que ce n’est pas le cas, les panneaux ne sont pas envoyés.",
        },
        sources: {
            title: "Sources de données",
            link: "Serveurs de jeu",
            collecting: "Collecte active · dernières données {ago}",
            collectingNoData: "Collecte active · aucune donnée pour le moment",
            notCollecting:
                "Collecte inactive · activez-la dans Serveurs de jeu",
            stale: "Données anciennes · dernières données {ago}",
            unavailable: "Sans réponse · dernières données {ago}",
            liveOk: "Données en direct ✓",
            liveLimited: "données en direct actuellement limitées",
            empty: "Aucun serveur de jeu pour le moment. Ajoutez-en un dans Serveurs de jeu.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: discordPanelsPage_list,
        actions: {
            accepted: {
                publish:
                    "Publication demandée. Le bot la prend en charge sous 15 s.",
                refresh:
                    "Actualisation demandée. Le bot régénère le panneau sous 15 s.",
                pause: "Le panneau est en pause. Le message reste affiché sans être actualisé.",
                resume: "Le panneau est de nouveau actif. Le bot le régénère sous 15 s.",
                retry: "Nouvelle tentative sous 15 s.",
                delete: "Le message sera retiré de Discord sous 15 s. Le panneau restera enregistré comme non envoyé.",
                remove: "Le panneau et ses messages Discord sont supprimés.",
                control:
                    "Le bot régénère le message de contrôle du serveur sous 15 s.",
            },
            failed: "L’action a échoué. Réessayez.",
            notSent: "Le panneau n’est pas encore sur Discord.",
            removing: "Le panneau est en cours de suppression.",
            notFound: "Le panneau n’existe plus.",
        },
        editor: discordPanelsPage_editor,
    },
    discordPanelStatus: {
        states: {
            published: "Publié",
            error: "Erreur",
            waiting: "En attente du bot",
            unsent: "Non envoyé",
            paused: "En pause",
        },
        botOnline: "Bot en ligne",
        botVersion: "version {version} · dernier contact {ago}",
        refreshEvery: "Les panneaux s’actualisent toutes les 60 s",
        botOffline:
            "Le bot ne répond pas · dernier contact {ago}. Les panneaux ne s’actualisent plus et les nouveaux ne seront pas envoyés. Vérifiez que le bot fonctionne ; redémarrez-le après une mise à jour.",
        botNeverSeen:
            "Le bot ne s’est pas encore manifesté. Les panneaux ne s’actualisent pas et les nouveaux ne sont pas envoyés tant que le bot n’est pas lancé.",
        botOutdated:
            "Le bot utilise l’ancienne version {version}. Les panneaux Discord nécessitent la version {required} ou ultérieure. Redémarrez le bot après la mise à jour ; les panneaux ne s’actualisent pas avec l’ancienne version.",
        permissions: {
            view_channel: "Voir le salon",
            send_messages: "Envoyer des messages",
            embed_links: "Intégrer des liens",
            attach_files: "Joindre des fichiers",
            read_message_history: "Voir les anciens messages",
        },
        errors: {
            bot_not_in_server: {
                title: "Le bot n’est pas sur le serveur Discord.",
                past: "Le bot n’était pas sur le serveur Discord.",
                fix: "Invitez à nouveau le bot Logi sur le serveur, puis cliquez sur Réessayer.",
            },
            channel_missing: {
                title: "Le salon {channel} n’existe plus ou le bot ne peut pas le voir.",
                past: "Le salon {channel} n’existait pas ou le bot ne pouvait pas le voir.",
                fix: "Choisissez un autre salon dans l’éditeur et enregistrez.",
            },
            channel_type: {
                title: "Impossible de publier des messages dans {channel}.",
                past: "Il était impossible de publier des messages dans {channel}.",
                fix: "Choisissez un salon textuel ou d’annonces dans l’éditeur.",
            },
            missing_permissions: {
                title: "Le bot n’a pas la permission {permissions} dans {channel}.",
                past: "Le bot n’avait pas la permission {permissions} dans {channel}.",
                fix: "Dans Discord, ouvrez Modifier le salon → Permissions → Logi et activez {permissions}. Cliquez ensuite sur Réessayer.",
            },
            delivery_uncertain: {
                title: "Discord n’a pas confirmé la réception du message.",
                past: "Discord n’a pas confirmé la réception du message.",
                fix: "Le bot retrouvera le message à la prochaine actualisation ou le renverra. Aucune action nécessaire.",
            },
            discord_unavailable: {
                title: "Discord ne répond pas pour le moment.",
                past: "Discord n’a pas répondu à temps.",
                fix: "Le bot réessaie automatiquement. Si l’attente se prolonge, cliquez sur Réessayer.",
            },
            source_missing: {
                title: "Le serveur de jeu du panneau n’existe plus dans Logi.",
                past: "Le serveur de jeu du panneau n’existait pas dans Logi.",
                fix: "Choisissez un autre serveur dans l’éditeur ou supprimez le panneau.",
            },
            source_not_collecting: {
                title: "Logi ne collecte pas les données du serveur de jeu.",
                past: "Logi ne collectait pas les données du serveur de jeu.",
                fix: "Activez la collecte dans Serveurs de jeu, puis cliquez sur Réessayer.",
            },
            provider_unreachable: {
                title: "Le serveur de jeu ne répond pas.",
                past: "Le serveur de jeu n’a pas répondu.",
                fix: "Le panneau affiche les dernières données disponibles. Vérifiez l’adresse et la clé dans Serveurs de jeu.",
            },
            provider_rate_limited: {
                title: "Le fournisseur de données refuse de nouvelles requêtes pour le moment.",
                past: "Le fournisseur de données a refusé de nouvelles requêtes.",
                fix: "Le panneau affiche les dernières données et réessaie. Si cela dure plus d’une heure, augmentez la limite de la clé ou remplacez-la dans Serveurs de jeu.",
            },
            render_failed: {
                title: "Impossible de générer le panneau.",
                past: "Impossible de générer le panneau.",
                fix: "Raccourcissez le titre ou la description du panneau. Si l’erreur persiste, signalez-la au support Logi.",
            },
            unsupported_kind: {
                title: "Le bot ne prend pas encore en charge ce type de panneau.",
                past: "Le bot ne prenait pas en charge ce type de panneau.",
                fix: "Mettez le bot à jour et redémarrez-le.",
            },
            competition_missing: {
                title: "La compétition du panneau n’existe plus.",
                past: "La compétition du panneau n’existait pas.",
                fix: "Choisissez une autre compétition dans l’éditeur ou supprimez le panneau.",
            },
            league_disabled: {
                title: "Wardogs League est désactivé dans les paramètres ; le bot a donc supprimé les messages du panneau.",
                past: "Wardogs League était désactivé dans les paramètres.",
                fix: "Activez Wardogs League dans Paramètres → Wardogs League ; le bot republiera les deux messages.",
            },
            unknown: {
                title: "Impossible d’envoyer le message.",
                past: "Impossible d’envoyer le message.",
                fix: "Cliquez sur Réessayer. Si l’erreur persiste, signalez-la au support Logi.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "Le salon est désormais public ; le mot de passe a donc été retiré du panneau. Déplacez le panneau vers un salon privé pour l’afficher à nouveau.",
            live_data_unavailable:
                "Les données en direct sont indisponibles pour le moment ; le panneau affiche les dernières données collectées.",
            attach_files_missing:
                "Le bot n’a pas la permission Joindre des fichiers ; le panneau ne contient donc pas d’image.",
        },
    },
    discordPreview: {
        regionLabel: "Aperçu du message Discord",
        appTag: "APP",
        edited: "(modifié)",
        usedCommand: "{user} a utilisé {command}",
        onlyYouCanSee: "Vous seul pouvez voir ce message",
        dismissMessage: "Ignorer le message",
        buttons: "Boutons du message",
        externalLink: "lien externe",
        unavailable: "indisponible",
        unknownUser: "utilisateur",
        unknownRole: "rôle",
        unknownChannel: "salon",
    },
    joinPage: {
        metaTitle: "Rejoindre {name}",
        metaDescription: "Rejoindre le serveur de jeu {name}.",
        opening: "Ouverture de {game}…",
        players: "{players} / {capacity} joueurs",
        queue: "file d’attente {queue}",
        steamPrompt:
            "Steam demande s’il faut ouvrir le lien. Confirmez avec Ouvrir.",
        manualTitle: "Rejoindre manuellement",
        addressLabel: "Adresse du serveur",
        copy: "Copier",
        copied: "Copié",
        copyFailed:
            "Échec de la copie. Sélectionnez l’adresse et copiez-la manuellement.",
        steamInstructions:
            "Dans Steam : Afficher → Serveurs de jeu → Favoris → Ajouter un serveur, puis collez l’adresse.",
        backToDiscord: "Retour à Discord",
        joinCodeTitle: "Code de connexion",
        joinCodeLabel: "Code pour rejoindre la partie",
        joinCodeHelp:
            "Dans le jeu, ouvrez l’option pour rejoindre une partie et saisissez ce code.",
        noAddress:
            "L’adresse du serveur n’est pas encore définie. Contactez un administrateur du clan.",
        noJoinCode:
            "Le code d’accès n’est pas encore défini. Contactez un administrateur du clan.",
        notFoundTitle: "Serveur introuvable",
    },
} as const
