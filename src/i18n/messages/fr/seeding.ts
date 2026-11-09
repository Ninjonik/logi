export const seedingMessages = {
    seedPage: {
        breadcrumbParent: "Panneaux Discord",
        back: "Panneaux Discord",
        title: "Seeding des serveurs",
        description:
            "Lorsqu’un serveur est vide, Logi appelle les joueurs : il publie un appel, mentionne le rôle Seed et affiche le nombre de joueurs manquants dans le panneau. Seuls les administrateurs Logi peuvent le lancer.",
        serversLabel: "Serveurs de jeu du clan",
        noServers:
            "Le clan n’a pas encore de serveur de jeu. Ajoutez-en un dans Serveurs de jeu, puis configurez le seeding ici.",
        gameServersLink: "Serveurs de jeu",
        unavailable:
            "Impossible de charger le seeding pour le moment. Actualisez la page.",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        status: {
            now: "Actuellement : {players} / {capacity} joueurs",
            nowNoCapacity: "Actuellement : {players} joueurs",
            noData: "Aucune donnée récente du serveur",
            chips: {
                live: "En direct",
                below_start: "Sous le seuil de démarrage",
                filling: "En cours de remplissage",
                offline: "Indisponible",
                unknown: "Aucune donnée",
            },
            running: "Seeding en cours",
            idle: "Aucun seeding en cours",
            lastData: "dernières données {time}",
            nextSeed: "prochain seeding prévu {time}",
            lastSeed: "dernier seeding {time}",
            progress: "{players} / {liveFrom} pour lancer la partie",
            startNow: "Lancer le seeding",
            stopNow: "Arrêter le seeding",
            busy: "Traitement en cours…",
            started: "Le seeding est en cours. L’appel est dans {channel}.",
            stopped: "Le seeding est terminé.",
        },
        actionErrors: {
            cooldown:
                "Impossible de lancer un seeding maintenant. Le prochain pourra commencer {time}.",
            running: "Un seeding est déjà en cours.",
            duplicate: "Ce seeding est déjà en cours.",
            not_configured:
                "Choisissez le salon d’appel et enregistrez d’abord le programme.",
            offline:
                "Le serveur ne répond pas. Lancez le seeding lorsqu’il sera en ligne.",
            already_live:
                "Le serveur a déjà assez de joueurs ; aucun seeding n’est nécessaire.",
            not_running: "Aucun seeding n’est en cours.",
            not_found: "Serveur introuvable.",
            forbidden:
                "Vous n’avez pas l’autorisation d’effectuer cette action.",
            unsaved: "Enregistrez d’abord les modifications du programme.",
            unavailable: "L’opération a échoué. Réessayez.",
        },
        time: {
            today: "aujourd’hui à {time}",
            yesterday: "hier à {time}",
            tomorrow: "demain à {time}",
            other: "{date} à {time}",
        },
        plan: {
            title: "Programme de seeding · {server}",
            enabled: "Activé",
            enabledLabel: "Programme de seeding activé",
            liveFrom: "La partie est lancée à partir de",
            liveFromUnit: "joueurs",
            liveFromHint: "Le seeding se termine alors.",
            startBelow: "Le seeding démarre en dessous de",
            startBelowUnit: "joueurs",
            startBelowHint:
                "Au-dessus de ce seuil, le programme n’envoie rien.",
            when: "Quand",
            manual: "Manuellement",
            manualText:
                "avec Lancer le seeding ici ou dans le message de contrôle du serveur. Toujours disponible.",
            schedule: "Programmation",
            scheduleHint:
                "Uniquement si le serveur est sous le seuil de démarrage à ce moment-là.",
            scheduleDays: "Jours programmés",
            at: "à",
            time: "Heure",
            addSlot: "Ajouter un horaire",
            removeSlot: "Supprimer l’horaire",
            weekdays: ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."],
            auto: "Automatiquement",
            autoHint: "Lorsque le serveur se vide pendant la journée.",
            autoBelow: "lorsqu’il descend sous",
            autoBetween: "joueurs entre",
            autoAnd: "et",
            seedChannel: "Salon d’appel",
            seedChannelPlaceholder: "Choisir un salon",
            seedChannelOk: "Le bot peut publier et mentionner {role}.",
            seedChannelOkNoRole: "Le bot peut publier dans le salon.",
            role: "Rôle mentionné dans l’appel",
            rolePlaceholder: "Aucune mention de rôle",
            createRole: "Créer le rôle Seed",
            createRoleBusy: "Création du rôle…",
            createRoleHint:
                "Logi crée sur Discord un rôle Seed pouvant être mentionné et le sélectionne. Vous pouvez aussi choisir un rôle existant.",
            roleCreated: "Le rôle @Seed a été créé et sélectionné.",
            roleReused:
                "Le serveur possède déjà un rôle @Seed ; il est maintenant sélectionné.",
            rolePermission:
                "Impossible de créer le rôle. Accordez au rôle Logi la permission Gérer les rôles sur Discord.",
            roleUnavailable:
                "Discord ne répond pas pour le moment. Réessayez de créer le rôle dans un instant.",
            roleMembers: {
                one: "{count} membre",
                few: "{count} membres",
                many: "{count} membres",
                other: "{count} membres",
            },
            selfService:
                "Les joueurs activent eux-mêmes le rôle avec un bouton",
            selfServiceHint:
                "L’appel comporte un bouton Me prévenir des seedings ; un nouveau clic retire le rôle.",
            protection: "Protection",
            pingWindow: "Au maximum 1 mention du rôle toutes les",
            hoursUnit: "h",
            pingWindowHint:
                "Si un seeding démarre avant ce délai, l’appel est envoyé sans mention de rôle.",
            cooldown: "Délai minimum entre deux seedings",
            cooldownHint:
                "Ni le bouton ni le programme ne peuvent lancer un autre seeding avant ce délai.",
            template: "Texte de l’appel",
            insert: "Insérer :",
            templateHint:
                "Logi ajoute automatiquement le titre, la progression et les boutons.",
            templateDefault:
                "Un champ vide utilise le texte d’appel par défaut.",
            atThreshold: "Au seuil prévu",
            endEdit:
                "Modifier le message en « La partie est lancée » et terminer le seeding",
            endEditHint:
                "Aucune autre mention n’est envoyée. La progression disparaît également du panneau du serveur.",
            endDelete: "Supprimer le message et terminer le seeding",
            maxDuration: "Au maximum",
            maxDurationHint:
                "Le seeding se termine ensuite même si le serveur n’a pas atteint le seuil.",
        },
        previews: {
            title: "Aperçus de l’appel",
            call: "Aperçu de l’appel dans {channel} · actualisé selon le texte à gauche",
            live: "À {count} joueurs · le même message, modifié",
            note: "Le message s’actualise toutes les 60 s. Le panneau du serveur affiche la même progression en parallèle.",
            control: "Aperçu dans {channel} · message de ce serveur",
            noChannel: "#salon",
            author: "aujourd’hui à {time}",
            deleted:
                "À {count} joueurs, Logi supprime l’appel et termine le seeding. Aucune autre mention n’est envoyée.",
        },
        control: {
            title: "Contrôle dans Discord",
            channel: "Salon de contrôle",
            channelPlaceholder: "Choisissez un salon privé",
            private: "Le salon est privé ✓",
            privateHint: "seuls les administrateurs peuvent le voir.",
            public: "Tout le monde peut voir le salon",
            publicHint:
                "le bot n’y publiera pas les commandes de contrôle. Choisissez un salon privé.",
            checking: "Vérification des salons Discord…",
            note: "Seuls les administrateurs Logi peuvent utiliser les boutons Seed, Actualiser et Pause. Les autres reçoivent une réponse privée indiquant qu’ils n’y sont pas autorisés. Les panneaux publics n’ont pas de bouton Seed.",
        },
        problems: {
            seed_channel_unpublishable:
                "Le bot ne peut pas publier dans le salon d’appel. Accordez-lui les permissions Voir le salon, Envoyer des messages, Intégrer des liens, Joindre des fichiers et Voir les anciens messages.",
            seed_role_missing: "Le rôle choisi n’existe plus sur Discord.",
            seed_role_not_mentionable:
                "Le bot ne peut pas mentionner ce rôle. Autorisez tout le monde à le mentionner, ou accordez au bot la permission Mentionner @everyone.",
            seed_role_unmanageable:
                "Le bot ne peut pas attribuer ce rôle. Accordez-lui Gérer les rôles et placez son rôle au-dessus du rôle choisi.",
            control_channel_unpublishable:
                "Le bot ne peut pas publier dans le salon de contrôle. Accordez-lui Voir le salon, Envoyer des messages et Voir les anciens messages.",
            control_channel_public:
                "Tout le monde peut voir le salon de contrôle. Choisissez un salon invisible pour @everyone.",
            verification_unavailable:
                "Discord ne répond pas ; les salons ne peuvent pas être vérifiés. Réessayez dans un instant.",
        },
        issues: {
            invalid: "Vérifiez cette valeur.",
            start_below_not_under_live:
                "Le seuil de démarrage doit être inférieur au seuil de lancement de la partie.",
            auto_below_above_start:
                "Le seuil de démarrage automatique ne peut pas dépasser le seuil de démarrage.",
            auto_window_empty:
                "La plage horaire doit commencer et se terminer à des heures différentes.",
            schedule_without_slots: "Ajoutez au moins un horaire au programme.",
            duplicate_day: "Un jour apparaît deux fois dans le programme.",
            duplicate_slot:
                "Ce jour et cet horaire figurent déjà dans le programme.",
            seed_channel_required:
                "Un programme activé nécessite un salon d’appel.",
            control_channel_same_as_seed:
                "Le salon de contrôle doit être différent du salon d’appel.",
            unknown_placeholder:
                "Le texte contient un champ inconnu entre accolades.",
            live_above_capacity:
                "Le serveur a moins de places que le seuil de lancement de la partie.",
        },
        save: {
            note: "Enregistre le programme de {server} et le salon de contrôle.",
            unsaved: {
                one: "{count} modification non enregistrée",
                few: "{count} modifications non enregistrées",
                many: "{count} modifications non enregistrées",
                other: "{count} modifications non enregistrées",
            },
            discard: "Abandonner",
            save: "Enregistrer",
            saving: "Enregistrement…",
            saved: "Programme enregistré.",
            reload: "Recharger",
            conflict:
                "Quelqu’un a modifié le programme entre-temps. Actualisez la page et recommencez vos modifications.",
            failed: "Impossible d’enregistrer le programme.",
        },
        history: {
            title: "Historique du seeding · {server}",
            summary:
                "{days} derniers jours · {count} · {average} en moyenne pour lancer la partie",
            summaryNoLive: "{days} derniers jours · {count}",
            seeds: {
                one: "{count} seeding",
                few: "{count} seedings",
                many: "{count} seedings",
                other: "{count} seedings",
            },
            empty: "Aucun seeding au cours des 30 derniers jours.",
            columns: {
                start: "Début",
                trigger: "Lancé par",
                players: "Joueurs au début → à la fin",
                result: "Résultat",
                duration: "Durée",
                pinged: "Mentions",
            },
            trigger: {
                schedule: "Programme {slot}",
                auto: "Automatiquement · sous {count}",
                web: "{name} · manuellement sur le site",
                discord: "{name} · bouton dans {channel}",
                discordNoChannel: "{name} · bouton Discord",
            },
            outcome: {
                live: "En direct",
                timeout: "Seuil non atteint",
                admin: "Terminé par un administrateur",
                failed: "Échec",
                running: "Opérationnel",
            },
            endedSuffix: "terminé",
            pinged: "{count} · {role}",
            silentWindow: "0 · protection {hours} h",
            silentNoRole: "0 · aucun rôle",
            unknownRole: "@rôle",
            units: { hours: "h", minutes: "min" },
        },
    },
} as const
