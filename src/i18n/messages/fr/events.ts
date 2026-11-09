export const eventsMessages = {
    event: {
        signupStatusSignedUpAs: "Vous êtes inscrit en tant que : {type}.",
        signupStatusGeneral: "participant sans groupe",
        signupStatusDeclined: "Vous avez indiqué votre indisponibilité.",
        signupStatusNotSignedUp:
            "Vous n’êtes pas encore inscrit à cet événement.",
        infoTitle: "Informations sur les événements",
        infoDescription: "Horaires, inscriptions et paramètres Discord.",
        listDescription: "Événements du clan à venir et passés.",
        createTitle: "Créer un événement",
        created: "Événement créé.",
        saved: "Événement enregistré.",
        createDescription:
            "Renseignez les détails, les horaires et les options Discord de l’événement avant de le publier pour votre clan.",
        createPageDescription:
            "Définissez les horaires, les règles d’inscription et les salons Discord.",
        relatedRoster: "Composition associée",
        showRoster: "Voir la composition",
        rosterPublishedHint: "La composition est publiée.",
        rosterDraftHint:
            "Une composition est associée, mais elle reste masquée pour les membres ordinaires.",
        rosterMissingHint: "Aucune composition associée.",
        detailMetaTitle: "Détails de l’événement",
        requiredLabel: "Obligatoire",
        optionalLabel: "Facultatif",
        noPreset: "Aucun modèle",
        topicPreset: "Modèle de sujets",
        topicPresetCompleteMatch: "Match complet",
        topicPresetPartialMatch: "Match partiel",
        resyncTopicThread: "Resynchroniser le fil de sujet",
        topicThreadResyncQueued:
            "Resynchronisation du fil de sujet en attente.",
        generalSignupDescription:
            "Activer un bouton d’inscription général qui affecte les joueurs à leur groupe principal s’il est disponible pour ce match, sinon à la réserve.",
        signupGroupsDescription:
            "Choisissez les boutons d’inscription propres à chaque groupe à afficher pour ce match.",
        allowedSignupStatusesDescription:
            "Laissez vide pour autoriser tous les statuts de membre du clan. Sinon, seuls les statuts sélectionnés peuvent s’inscrire à ce match.",
        allowedSignupStatusesAll: "Tous les statuts de membre du clan",
        signupReminderStatusesDescription:
            "Envoyer le message complet d’inscription au match par MP toutes les 24 heures, à partir de 24 heures après sa création et jusqu’à la clôture des inscriptions. Ne sélectionnez aucun statut pour désactiver cette fonction.",
        signupReminderDisabled:
            "Les rappels quotidiens d’inscription sont désactivés.",
        createForumChannelDescription:
            "Créer le salon forum Discord et les sujets de briefing de cet événement.",
        conclude: "Clôturer l’événement",
        submitMatchResults: "Envoyer les résultats du match",
        submitMatchResultsDescription:
            "Collez un lien de match se terminant par /games/[id]. L’application importera le tableau de scores et enregistrera les statistiques des joueurs.",
        importEvents: "Importer des événements",
        importEventsDescription:
            "Collez les liens des événements au même format que pour l’import des résultats. Vous pouvez les séparer par des virgules ou des retours à la ligne.",
        importEventsHint: "{count} lien(s) prêt(s) à importer.",
        importEventsSuccess:
            "{events} événement(s) et {players} fiches de joueurs importés.",
        importEventsPartial: "{failed} lien(s) n’ont pas pu être importés.",
        importEventPlayers: "Importer et identifier les joueurs",
        importEventPlayersDescription:
            "Identifiez les joueurs HLL importés dans la base, associez les identifiants de plateforme manquants et créez les joueurs si nécessaire.",
        importEventPlayersHint:
            "Les noms sont comparés après suppression du tag du clan et des caractères spéciaux, et conversion en minuscules.",
        matchLink: "Lien du match",
        matchLinks: "Liens des événements",
        matchResultsImported:
            "{players} fiches de joueurs importées. Résultat de l’événement : {result}.",
        resultSaved: "enregistrée",
        resultSkipped: "ignoré",
        resultVictory: "Victoire",
        resultDefeat: "Défaite",
        resultDraw: "Match nul",
        resultColumn: "Résultat",
        matchColumn: "Match",
        openMatch: "Ouvrir le match",
        matchDetailTitle: "Détails du match",
        matchDetailDescription:
            "Tableau de scores brut importé, performances des joueurs et détail par équipe de cet événement.",
        rawSource: "Source",
        importedAt: "Importé",
        playedAt: "Joué",
        duration: "Durée",
        players: "Joueurs",
        score: "Score",
        overviewTab: "Vue d’ensemble",
        playersTab: "Joueurs",
        weaponsTab: "Armes",
        killsByTypeTab: "Kills par type",
        noMatchLinked:
            "Aucun match importé n’est encore associé à cet événement.",
        alliedTeam: "Alliés",
        axisTeam: "Axe",
        teamUnknown: "Inconnu",
        topWeapons: "Armes les plus utilisées",
        deathsByWeapon: "Morts par arme",
        playerBreakdowns: "Détail par joueur",
        standoutAwards: "Distinctions",
        topRivalries: "Principales rivalités",
        encounters: "Affrontements",
        encountersDescription:
            "Calculé à partir des données agrégées par joueur, comme l’adversaire le plus éliminé ou celui ayant causé le plus de morts.",
        killsByWeaponForPlayer: "Kills par arme",
        deathsByWeaponForPlayer: "Morts par arme",
        badges: "Badges",
        killed: "A éliminé",
        diedTo: "Tué par",
        plusMinus: "+/−",
        noDerivedData: "Aucune donnée calculée",
        performanceScatter: "Kills et morts",
        rawStats: "Statistiques brutes",
        concludedSuccess: "Événement clôturé",
        trainingCompletionTitle: "Terminer l’entraînement",
        trainingCompletionDescription:
            "Indiquez une réussite ou un échec pour chaque participant présent avant de clôturer l’entraînement.",
        trainingCompletionEmpty:
            "Aucun participant présent n’est actuellement inscrit à cet entraînement.",
        trainingCompletionSuccess:
            "Entraînement terminé. Récompenses attribuées : {rewarded}. MP envoyés : {dmed}.",
        trainingPassed: "Validé",
        trainingFailed: "Échec",
        trainingCompleteAction: "Enregistrer et clôturer",
        saveHelp:
            "Le nom et les quatre champs d’horaires sont obligatoires. Tout le reste est facultatif.",
        saveError: "Impossible d’enregistrer l’événement.",
        writeForbidden:
            "Seuls les administrateurs de l’espace de travail peuvent modifier cet événement. Reconnectez-vous si votre session a expiré.",
        notices: {
            announcementsTitle: "Le salon d’annonces n’est pas défini",
            announcementsDescription:
                "Les annonces d’événements ne seront ni publiées ni mises à jour sur Discord tant qu’un salon d’annonces n’aura pas été configuré pour ce clan.",
            forumTitle: "La catégorie de forum n’est pas définie",
            forumDescription:
                "Cet événement prévoit la création d’un salon forum Discord, mais aucune catégorie n’est configurée. Le forum et les sujets de briefing ne seront pas créés tant que ce paramètre restera vide.",
            meetingAutomationTitle:
                "L’automatisation du vocal de rassemblement est désactivée",
            meetingAutomationDescription:
                "Les événements Discord programmés et la confirmation des présences depuis le vocal de rassemblement nécessitent tous deux un salon vocal de rassemblement défini pour le clan.",
            openClanSettings: "Ouvrir les paramètres du clan",
        },
        statuses: {
            registration: "Inscription",
            closed: "Fermé",
            starting: "Début imminent",
            concluded: "Terminé",
        },
        fields: {
            name: "Nom",
            kind: "Type",
            matchType: "Catégorie d’événement",
            description: "Description",
            thumbnail: "Miniature",
            image: "Image de l’embed",
            announcementChannelId: "Salon d’inscription à l’événement",
            eventInfoChannelId: "Salon d’informations de l’événement",
            meetingChannelId: "Vocal de rassemblement / lieu",
            server: "Serveur",
            serverPassword: "Mot de passe du serveur",
            map: "Carte",
            mapVariant: "Moment de la journée / météo",
            mapMode: "Mode de jeu",
            mapPresetCode: "Code de configuration de la carte",
            side: "Camp",
            capMode: "Point de capture central",
            registrationStart: "Début de l’annonce des inscriptions",
            registrationEnd: "Fin des inscriptions",
            meetingStart: "Début du rassemblement",
            gameStart: "Début de la partie",
            gameEnd: "Fin de la partie",
            notes: "Notes",
            stratmaps: "Cartes tactiques",
            requiredRoleIds: "Identifiants des rôles requis",
            rewardRoleIds: "Identifiants des rôles de récompense",
            signupGroupIds: "Groupes d’inscription visibles",
            allowedSignupStatuses: "Statuts autorisés à s’inscrire",
            signupReminderStatuses:
                "Destinataires des rappels quotidiens d’inscription",
            useGeneralSignup: "Activer l’inscription générale",
            allowRankedSignup: "Autoriser des groupes de secours",
            pingClan: "Mentionner le clan",
            pingMode: "Mention dans l’annonce",
            pingRoleIds: "Rôles à mentionner",
            createForumChannel: "Créer un salon forum",
            createSquadVoiceChannels:
                "Créer les salons vocaux d’escouade au début du rassemblement",
            squadVoiceCategory:
                "Catégorie des vocaux d’escouade (valeur du serveur si vide)",
            conclusionReserveHelp:
                "L’événement est automatiquement clôturé 15 minutes après la fin de cette durée.",
        },
        channelRoutingCreateHelp:
            "Prérempli à partir des paramètres du clan. Ce choix est verrouillé après la création pour préserver les messages Discord.",
        channelRoutingSharedHelp:
            "Choisissez le salon d’inscription. Si le salon d’informations reste vide, les deux messages utilisent le salon d’inscription.",
        channelRoutingLockedHelp:
            "Ces destinations sont verrouillées après la création pour préserver les identifiants des messages Discord.",
        pingNone: "Ne mentionner personne",
        pingClanOption: "Mentionner le rôle du clan",
        pingRolesOption: "Mentionner les rôles sélectionnés",
        quickScheduleTitle: "Planification rapide",
        quickScheduleDescription:
            "Définissez les quatre horaires clés de ce match. Vous pouvez modifier la chronologie générée à tout moment.",
        registrationHoursBefore:
            "Heures avant le rassemblement pour fermer les inscriptions",
        meetingMinutesBefore: "Minutes avant le début pour le rassemblement",
        durationHours: "Durée (heures)",
        durationMinutes: "Durée du match (minutes)",
        quickEventStart: "Date et heure de début du match",
        applyQuickSchedule: "Appliquer les horaires",
        quickScheduleApplied: "Horaires appliqués.",
        recurringMatch: "Rendre ce match récurrent",
        recurringMatches: "Matchs récurrents",
        recurringMatchesDescription:
            "Gérez les séries de matchs suivant un calendrier récurrent.",
        noRecurringMatches: "Aucun match récurrent n’a encore été créé.",
        recurrenceHelp:
            "Le match en cours de création est le premier de cette série. Ses détails et son horaire serviront aux prochaines occurrences.",
        recurrenceFrequency: "Répétition",
        recurrenceWeekly: "Chaque semaine",
        recurrenceMonthlyDate: "Chaque mois à une date donnée",
        recurrenceMonthlyNthWeekday: "Chaque mois un jour de la semaine",
        recurrenceInterval: "Tous les (intervalle)",
        recurrenceWeekdays: "Jours de la semaine",
        recurrenceMonthDay: "Jour du mois",
        recurrenceNth: "Semaine du mois",
        recurrenceWeekday: "Jour de la semaine",
        editSchedule: "Modifier les horaires",
        quickScheduleStepLabel: "Étape {step} sur 4",
        wizardBack: "Retour",
        wizardNext: "Suivant",
        discordPreview: "Aperçu Discord",
        previewUntitled: "Événement sans titre",
        previewNoDescription:
            "La description de votre événement apparaîtra ici.",
        createMatchAction: "Créer le match",
        createTrainingAction: "Créer l’entraînement",
        recurrenceEditHelp:
            "Désactivez la répétition pour arrêter la série. Les matchs existants sont conservés.",
    },
    presets: {
        topicTitle: "Modèles de sujets",
        topicDescription:
            "Sujets de briefing réutilisables. Modifier un modèle ne change pas les matchs existants.",
        squadTitle: "Modèles d’escouades",
        squadDescription:
            "Escouades, rôles et emplacements réutilisables pour les nouvelles compositions.",
        createTopicTitle: "Créer un modèle de sujets",
        createTopicDescription:
            "Ajoutez les sujets du briefing et leur contenu.",
        createSquadTitle: "Créer un modèle d’escouades",
        createSquadDescription:
            "Ajoutez des escouades, des rôles et des emplacements.",
        presetDetails: "Détails du modèle",
        presetCreateMode: "La création ouvre directement le mode édition.",
        squadPresetPageDescription:
            "Escouades et rôles prédéfinis pouvant être copiés dans les compositions d’événements.",
        squadPresetMetaDescription:
            "Structure d’escouades prédéfinie pour les nouvelles compositions.",
        topicPresetMetaDescription:
            "Modèles de briefing réutilisables, copiés dans les événements au besoin.",
        topics: "Sujets",
        squadStructure: "Structure des escouades",
        presetSetup: "Configuration du modèle",
        presetSetupDescription: "Escouades, rôles et emplacements.",
        addTopic: "Ajouter un sujet",
        role: "Rôle",
        roleNote: "Note du rôle",
        addRole: "Ajouter un rôle",
        squadBlock: "Bloc d’escouade",
        presetName: "Nom du modèle",
        topicEditorDescription: "Noms des sujets et messages de briefing.",
        attachmentPlaceholder: "Une URL de pièce jointe par ligne",
        attachmentCountSuffix: "pièce(s) jointe(s)",
        newTopic: "Nouveau sujet",
        newSquad: "Nouvelle escouade",
        newRole: "Nouveau rôle",
        importStarterTemplate: "Importer un modèle de départ",
        starterTemplateName: "Composition HLL standard",
        wowForeverStarterTemplateName: "Raid WoW:F à 20 joueurs",
        shortNote: "Note",
        untitledPreset: "Modèle sans titre",
        topicPresetMetaFallback: "Modèle de sujets",
        topicPresetPageDescription:
            "Sujets de briefing réutilisables dans les matchs.",
        squadPresetMetaFallback: "Modèle d’escouades",
        fields: {
            name: "Nom",
            map: "Carte",
            side: "Camp",
            cap: "Cap",
            notes: "Notes",
        },
        table: {
            preset: "Modèle",
            topics: "Sujets",
            groups: "Groupes",
            roleSlots: "Emplacements de rôle",
            squads: "Escouades",
        },
        emptySquadTitle: "Aucun modèle d’escouades pour le moment",
        emptySquadAdmin:
            "Un modèle d’escouades définit la structure initiale d’une composition : escouades, rôles et emplacements. Créez-en un pour le copier dans les nouvelles compositions.",
        emptyTopicTitle: "Aucun modèle de sujets pour le moment",
        emptyTopicAdmin:
            "Un modèle de sujets contient les briefings qu’un match copie dans son forum Discord.",
        emptyMember:
            "Les administrateurs de votre clan n’ont pas encore créé de modèles.",
        delete: {
            action: "Supprimer le modèle",
            title: "Supprimer le modèle {name} ?",
            squadConsequence:
                "Les compositions existantes conservent leurs escouades. Les nouvelles compositions ne pourront plus utiliser ce modèle.",
            topicConsequence:
                "Les matchs clôturés conservent les sujets déjà publiés. Un match non clôturé utilisant ce modèle empêche sa suppression.",
            confirm: "Supprimer",
            done: "Modèle supprimé.",
            inUse: "Matchs ouverts utilisant encore ce modèle : {count}. Choisissez-y d’abord un autre modèle.",
            forbidden:
                "Seuls les administrateurs du clan peuvent supprimer les modèles. Reconnectez-vous si votre session a expiré.",
            failed: "Impossible de supprimer le modèle.",
        },
    },
    groups: {
        title: "Groupes",
        manageAction: "Gérer les groupes",
        refreshAction: "Actualiser les groupes",
        newTab: "s’ouvre dans un nouvel onglet",
        refreshFailed:
            "Impossible de charger les groupes. Enregistrez vos modifications et actualisez la page.",
        description:
            "Les groupes sont des spécialités du clan réutilisables pour les joueurs et les modèles d’escouades. Les compositions en copient les noms pour préserver les anciens événements.",
        createTitle: "Créer un groupe",
        createDescription:
            "Créez une spécialité du clan réutilisable avec une couleur et une courte description.",
        name: "Nom du groupe",
        color: "Couleur",
        descriptionLabel: "Description",
        order: "Ordre",
        parent: "Groupe parent",
        none: "Aucun",
        reset: "Réinitialiser les données de référence",
        initialize: "Importer les modèles par défaut",
        resetConfirm:
            "Les groupes, modèles d’escouades et modèles de sujets de ce clan seront supprimés. Les événements, compositions et joueurs seront conservés. Continuer ?",
        initializeConfirm:
            "Les groupes, modèles d’escouades et modèles de sujets seront réinitialisés, puis les groupes par défaut et le modèle d’escouades initial seront recréés. Continuer ?",
        resetSuccess: "Données de référence réinitialisées.",
        initializeSuccess: "Modèles par défaut importés.",
        usedByPlayers: "Joueurs principaux",
        starterDescription:
            "Spécialités initiales du clan adaptées à la composition HLL par défaut.",
        created: "Groupe créé.",
        saved: "Groupe enregistré.",
        saveFailed: "Impossible d’enregistrer le groupe. Réessayez.",
        duplicateName: "Un groupe porte déjà ce nom.",
        deleteAction: "Supprimer le groupe",
        deleteTitle: "Supprimer le groupe « {name} » ?",
        deleteDescription:
            "Les joueurs perdront ce groupe. Les compositions et événements passés conserveront le nom du groupe qu’ils ont copié. Cette action est irréversible.",
        deleteImpact:
            "{primary} joueur(s) l’ont comme groupe principal et {secondary} comme groupe supplémentaire.",
        deleted: "Groupe supprimé.",
        deleteFailed: "Impossible de supprimer le groupe. Réessayez.",
        emptyTitle: "Aucun groupe pour le moment",
        emptyDescription:
            "Les groupes sont des spécialités du clan, comme les tankistes ou les commandants. Ils sont utilisés par les joueurs et les modèles d’escouades.",
    },
} as const
