export const membershipMessages = {
    ticketSettings: {
        questionsTitle: "Questions du formulaire",
        questionsCount: "{count} sur {max}",
        edit: "Modifier",
        doneEditing: "Terminé",
        removeQuestion: "Retirer la question",
        requiredShort: "obligatoire",
        optionalShort: "facultatif",
        untitledQuestion: "Question sans titre",
        noQuestionsShort: "Aucune question : le fil s’ouvre dès le clic.",
        enabledLabel: "Activé",
        enabledAria: "Tickets activés",
        flowLabel: "Fonctionnement d’un ticket",
        flow: {
            pick: "Un membre choisit une catégorie dans le panneau",
            form: "Il remplit un court formulaire",
            thread: "Un fil privé avec le support s’ouvre",
            close: "Le support le ferme et l’auteur reçoit un message privé",
        },
        panelSection: "Panneau",
        panelChannel: "Salon du panneau",
        threadChannel: "Emplacement des fils",
        threadChannelHint: "Le bot doit pouvoir créer des fils privés ici.",
        threadChannelOk: "Le bot peut ouvrir des fils privés ici",
        categoriesShort: "Catégories",
        categoriesEditorNote:
            "Chaque catégorie correspond à un bouton du panneau.",
        headingLabel: "Titre",
        textLabel: "Texte",
        imageOptional: "facultatif",
        previewTitle: "Aperçu Discord",
        panelColor: "Couleur du panneau",
        panelColorHint:
            "Vide = couleur du clan. Format hexadécimal, ex. : #E8A33D.",
        panelColorInvalid:
            "La couleur doit être en hexadécimal, ex. : #E8A33D.",
        threadTitle: "Titre de la fiche du fil",
        threadTitlePlaceholder: "{author} signale un joueur",
        threadTitleHint:
            "{author} est le nom de l’auteur, {category} la catégorie. Si vide : « {author} · {category} ».",
        columns: {
            button: "Bouton",
            handledBy: "Équipe de réponse",
            questions: "Questions",
            actions: "Actions",
        },
        nobodyAdmins: "personne, uniquement les administrateurs Logi",
        removeCategory: "Retirer la catégorie",
        untitledCategory: "Catégorie sans titre",
        noCategoriesDescription:
            "Chaque catégorie devient un bouton du panneau, par exemple Signaler un joueur ou Problème avec le bot.",
        saveNote: "Enregistre les paramètres des tickets.",
        saveAndRefresh: "Enregistrer et actualiser le panneau",
        discard: "Abandonner",
        unsaved: "Modifications non enregistrées",
        title: "Paramètres des tickets",
        pageDescription:
            "Configurez le panneau de tickets, les catégories, les rôles du support et les questions des formulaires Discord.",
        enableTitle: "Activer les tickets",
        enableDescription:
            "Publiez un panneau de tickets personnalisable dans Discord et ouvrez des fils privés depuis les boutons des catégories.",
        submitChannel: "Salon de publication des tickets",
        parentChannel: "Salon parent des fils de tickets",
        panelTitle: "Titre de l’encart du panneau",
        panelDescription: "Description de l’encart du panneau",
        panelDescriptionPlaceholder:
            "Expliquez aux membres comment utiliser ce panneau de tickets.",
        image: "Image miniature",
        embedLimitNotice: "Le texte du panneau Discord utilise actuellement",
        embedLimitExceeded:
            "(trop long, raccourcissez certaines descriptions de catégories avant d’enregistrer).",
        categoriesTitle: "Catégories de tickets",
        categoriesDescription:
            "Chaque catégorie devient un bouton et peut ouvrir un formulaire Discord avant la création du fil de ticket.",
        addCategory: "Ajouter une catégorie",
        categoryLabel: "Catégorie",
        buttonText: "Texte du bouton",
        buttonTextPlaceholder: "Signaler un joueur",
        emoji: "Émoji",
        pickServerEmoji: "Choisir un émoji du serveur",
        typeAnyEmoji: "ou saisir un émoji",
        categoryDescription: "Description",
        categoryDescriptionPlaceholder:
            "Affiché après le nom de la catégorie dans le panneau, ex. : « comportement sur le serveur ».",
        supportRoles: "Rôles du support invités dans ce ticket",
        modalQuestions: "Questions du formulaire",
        modalQuestionsDescription:
            "Discord autorise jusqu’à 5 champs de texte par formulaire.",
        addQuestion: "Ajouter une question",
        questionLabel: "Question",
        questionText: "Libellé de la question",
        questionTextPlaceholder: "Que s’est-il passé ?",
        inputStyle: "Type de saisie",
        shortInput: "Court",
        paragraphInput: "Paragraphe",
        placeholder: "Texte indicatif",
        required: "Obligatoire",
        noQuestions:
            "Aucune question pour le moment. Si vous laissez cette section vide, le clic sur le bouton créera immédiatement le ticket.",
        noCategories: "Aucune catégorie de ticket pour le moment.",
        defaultPanelTitle: "Besoin d’aide ?",
        defaultPanelDescription:
            "Choisissez le sujet de votre demande. Un fil privé s’ouvrira, visible uniquement par vous et les administrateurs.",
        incompleteTitle:
            "La configuration du panneau de tickets est incomplète",
        incompleteDescription:
            "Les tickets sont activés, mais le panneau Discord ne sera pas publié et les fils ne pourront pas être ouverts tant que ces éléments ne seront pas configurés : {items}.",
        routingInfoTitle: "Attribution des tickets au support",
        routingInfoDescription:
            "Les membres des rôles de support de la catégorie sont automatiquement invités dans les nouveaux fils. Les administrateurs du tableau de bord peuvent gérer les tickets sans être ajoutés à chaque fil.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Identifiant Logi (Discord non associé)",
        title: "Opérations sur les rôles des membres",
        refresh: "Actualiser",
        loading: "Chargement…",
        description:
            "Les 100 dernières opérations des responsables ou des candidatures, tous jeux confondus. Enregistrer un membre met une modification en attente ; seul un résultat Discord vérifié est marqué comme appliqué. Les opérations refusées, remplacées et échouées sont supprimées 30 jours après leur fin.",
        error: "Les opérations sur les rôles sont indisponibles. Actualisez pour réessayer.",
        empty: "Aucune opération de rôle géré pour le moment.",
        target: "Identifiant Discord du membre",
        actor: "Identifiant Discord de l’auteur",
        origin: "Source",
        version: "Version",
        updated: "Mis à jour",
        audit: "Historique des tentatives",
        auditDescription:
            "Les 5 dernières tentatives sont affichées ; jusqu’à 20 sont conservées par opération. Une vérification quotidienne confirmant les rôles n’ajoute pas de tentative. Horaires en UTC. Les codes de motif aident au diagnostic.",
        reason: "Motif",
        status: {
            pending: "En attente",
            running: "En cours",
            retry_scheduled: "Nouvelle tentative programmée",
            applied: "Appliqué",
            denied: "Refusé",
            superseded: "Remplacé",
            failed: "Échec",
        },
        provenance: {
            dashboard: "Administrateur",
            recruitment: "Équipe de recrutement",
            application: "Candidature de membre",
            rollback: "Annulation de candidature",
        },
        hint: {
            pending:
                "Le bot vérifiera les permissions avant de modifier les rôles.",
            running: "Le bot vérifie Discord et applique la demande actuelle.",
            retry_scheduled:
                "Le bot réessaiera automatiquement après le délai d’attente.",
            applied:
                "Les rôles Discord correspondaient à cette demande lors de la dernière vérification. Le bot les revérifie chaque jour.",
            denied: "Vérifiez l’accès des responsables, l’adhésion, les permissions du bot et la hiérarchie des rôles, puis enregistrez une nouvelle demande pour ce membre.",
            superseded:
                "L’affectation ou la politique a changé. Seule une nouvelle demande autorisée peut appliquer le nouvel état.",
            failed: "Les tentatives automatiques sont arrêtées. Corrigez la cause et enregistrez une nouvelle demande pour ce membre.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "rôle du clan non défini",
        applicationsTitle: "Demandes d’adhésion",
        applicationsChannel: "Le bouton Postuler dans #{channel}",
        applicationsNoChannel:
            "Choisissez le salon du panneau dans Panneau et fils.",
        roleSyncToggleTitle: "Synchronisation des rôles",
        roleSyncToggleDescription:
            "Logi attribue et retire les rôles selon le statut du membre. Cette fonction s’active et se désactive avec les demandes d’adhésion.",
        roleSyncOn: "Activé",
        roleSyncOff: "Désactivé",
        roleSyncSwitchDescription:
            "Logi attribue et retire les rôles selon le statut du membre, même lorsque les candidatures sont désactivées.",
        skipPendingCategoryTitle:
            "Passer l’attente et ajouter directement comme recrue",
        skipPendingCategoryHelp: "Membres titulaires uniquement.",
        categoryDescriptionHelp:
            "Dans le panneau, ce texte suit le nom et le jeu ; dans le premier formulaire, il figure sous le nom de la catégorie.",
        addRole: "rôle",
        addRoleAria: "Ajouter un rôle : {status}",
        removeRole: "Retirer le rôle {role}",
        roleSearch: "Rechercher des rôles",
        roleEmpty: "Aucun autre rôle.",
        tabsLabel: "Rubriques du recrutement",
        tabs: {
            categories: "Catégories",
            panel: "Panneau et fils",
            scores: "Points de présence",
            roleChanges: "Changements de rôle",
        },
        categoryButtonTitle: "Dans le panneau et le premier formulaire",
        categoryText: "Nom",
        categoryDescriptionLabel: "Description",
        resultTitle: "Après approbation, le joueur devient",
        rolesByStatus: "Rôles par statut",
        statusPending: "En attente d’une décision",
        statusRecruit: "Recrue",
        noRoles: "aucun rôle",
        includeClanRoleTitle: "Attribuer le rôle du clan",
        includeClanRoleRecruitHelp:
            "Attribue le rôle du clan aux recrues de cette catégorie.",
        includeClanRoleFinalHelp:
            "Attribue le rôle du clan après approbation dans cette catégorie, y compris aux mercenaires.",
        handledBy: "Responsables des demandes",
        handledByAdmins: "et les administrateurs Logi",
        clanRoleNote:
            "{role} est le rôle du clan défini dans Rôles et accès. Configurez-le séparément pour chaque catégorie et statut ci-dessous.",
        clanRoleMissingNote:
            "Le rôle du clan n’est pas encore défini. Choisissez-le dans Rôles et accès ; il s’applique à toutes les catégories.",
        clanRoleLink: "Ouvrir Rôles et accès",
        missingFinalRole: "rôle final manquant",
        missingRecruitRole: "rôle de recrue manquant",
        removeCategory: "Retirer la catégorie",
        noCategoriesDescription:
            "Chaque catégorie correspond à un choix de candidature, par exemple membre titulaire, remplaçant ou mercenaire.",
        rolePlaceholder: "Ajouter un rôle",
        saveNote: "Enregistre les paramètres du recrutement.",
        discard: "Abandonner",
        saveShort: "Enregistrer",
        unsaved: "Modifications non enregistrées",
        title: "Paramètres du recrutement",
        pageDescription:
            "Configurez l’encart de candidature Discord, les catégories requises et l’affectation par défaut des nouveaux membres du clan.",
        enableTitle: "Activer les candidatures",
        enableDescription:
            "Publiez un encart de candidature au clan dans Discord et ouvrez des fils privés gérés par les responsables.",
        submitChannel: "Salon de publication de l’encart",
        parentChannel: "Salon parent des candidatures",
        skipPendingTitle: "Passer la phase d’attente",
        skipPendingDescription:
            "Les nouvelles candidatures de membre passent directement au statut de recrue après leur envoi.",
        inviteSupportMembersIndividuallyTitle:
            "Ajouter individuellement les membres des rôles de support",
        inviteSupportMembersIndividuallyDescription:
            "Activé : Logi ajoute individuellement les membres des rôles de support de la catégorie à chaque fil de candidature. Désactivé : Logi ne les ajoute pas ; ils accèdent au fil lorsque leur rôle y est mentionné, ce que Discord ne fait que pour les rôles de moins de 100 membres. Les administrateurs Logi peuvent traiter les candidatures dans Logi sans être dans le fil.",
        panelTitle: "Titre du panneau",
        panelDescription: "Description du panneau",
        welcomeMessage: "Message d’accueil du fil de candidature",
        welcomeMessageDescription:
            "Publié au-dessus du résumé de la candidature dans chaque fil privé. Utilisez {applicant}, {support_roles} et {category} pour les mentions Discord et la catégorie choisie.",
        welcomeMessagePlaceholder:
            "Salut {applicant}, merci pour ta candidature. {support_roles} te répondront bientôt.",
        image: "Image miniature",
        applicationThumbnail: "Miniature de la candidature",
        specializationTitle: "Demander la spécialité",
        specializationDescription:
            "Propose Infanterie et Blindés comme étape de la candidature Discord. Cette étape n’est jamais affichée pour Wardogs.",
        categoryGame: "Jeu",
        categoryDetails: "Détails de la catégorie",
        categoryRoles: "Rôles et accès",
        categoryRolesDescription:
            "Choisissez les rôles gérés par Logi après approbation et les responsables autorisés à accéder au fil de candidature.",
        categoriesTitle: "Catégories de candidatures",
        categoriesDescription:
            "Chaque catégorie devient un bouton. Les questions du formulaire sont facultatives et suivent le même principe que les tickets.",
        addCategory: "Ajouter une catégorie",
        buttonLabel: "Libellé du bouton",
        applicationResult: "Résultat de la candidature",
        recruitRole: "Rôle de recrue de cette catégorie",
        recruitRolePlaceholder: "Rôle de recrue",
        finalRole: "Rôle final de cette catégorie",
        finalRolePlaceholder: "Rôle final",
        modalQuestionsDescription: "Jusqu’à 5 champs de texte.",
        noQuestions:
            "Aucune question pour le moment. Laissez vide pour ouvrir le fil immédiatement après la vérification initiale.",
        noCategories: "Aucune catégorie de candidature pour le moment.",
        embedFieldUsage: "Utilisation du champ de l’encart : {length} / {max}",
        embedFieldTooLong:
            "(trop long, raccourcissez les descriptions des catégories avant d’enregistrer)",
        incompleteTitle:
            "La configuration du panneau de recrutement est incomplète",
        incompleteDescription:
            "Les candidatures sont activées, mais le panneau Discord ne sera pas publié et les fils ne pourront pas être ouverts tant que vous n’aurez pas défini {items}.",
        roleSyncTitle: "Synchronisation des rôles des membres",
        roleSyncDescription:
            "Les candidatures en attente n’attribuent aucun rôle d’adhésion. Le statut Recrue utilise le rôle du clan et celui de recrue de la catégorie ; le statut Actif utilise le rôle du clan et le rôle final de la catégorie, lorsqu’ils sont configurés. Les changements sont mis en attente ; vérifiez le résultat dans Paramètres du recrutement → Opérations sur les rôles des membres.",
        rosterScoreDescription:
            "Définissez les variations de score par serveur après la fin d’un événement. Laisser toutes les valeurs à 0 désactive les variations automatiques.",
        rosterScoreNoCategory: "Aucune catégorie / aucune réponse",
        rosterScorePresentRoster: "A répondu, présent dans la composition",
        rosterScorePresentReserve: "A répondu, présent parmi les remplaçants",
        rosterScoreAbsentRoster: "A répondu, absent de la composition",
        rosterScoreAbsentReserve: "A répondu, absent des remplaçants",
        rosterScoreExcusedAbsence: "A répondu, absent, mais a prévenu",
        rolesMissingTitle: "Certains rôles d’adhésion ne sont pas configurés",
        rolesMissingClanRole: "Le rôle de base du clan n’est pas défini. ",
        rolesMissingRecruitRole: "Rôle de recrue manquant : {categories}. ",
        rolesMissingFinalRole: "Rôle final manquant : {categories}. ",
        rolesMissingSummary:
            "Dans ces cas, Logi suit toujours le statut de la candidature, mais les changements de rôles Discord sont partiels ou ignorés.",
        save: "Enregistrer les paramètres du recrutement",
        saved: "Paramètres du recrutement enregistrés.",
        saveError: "Impossible d’enregistrer les paramètres d’adhésion.",
    },
    userManagement: {
        previousPage: "Précédent",
        nextPage: "Suivant",
        canAddMemberOrMercenary:
            "Peut être ajouté comme membre, réserviste ou mercenaire.",
        mercenaryOnly:
            "Appartient déjà à un autre clan ; peut uniquement être ajouté comme mercenaire.",
        missingPlayerLink:
            "Un joueur manque à l’appel ? Demandez-lui d’utiliser /link sur Discord pour créer son compte Logi. Les joueurs déjà affectés à ce clan sont exclus des résultats.",
        missingPlayerApplication:
            "Il peut également envoyer une demande d’adhésion au clan.",

        grantAdminAccess: "Nommer administrateur",
        removeAdminAccess: "Retirer les droits d’administration",
        adminAccessGranted: "Le joueur est désormais administrateur.",
        adminAccessRemoved:
            "Les droits d’administration du joueur ont été retirés.",
        recheckDisplayName: "Actualiser le nom affiché",
        recheckingDisplayName: "Vérification du nom affiché…",
        displayNameUpdated: "Nom affiché mis à jour.",
        displayNameUnchanged: "Le nom affiché est déjà à jour.",
        displayNameRecheckFailed:
            "Impossible d’actualiser le nom affiché. Vérifiez que le joueur est présent sur le serveur Discord et que le bot peut accéder à son profil.",
        adminAccessUpdateFailed:
            "Impossible de modifier les droits d’administration du joueur.",
        title: "Joueurs",
        description: "Gérez les membres et les mercenaires du clan.",
        addMember: "Ajouter comme membre",
        addReserveMember: "Ajouter comme réserviste",
        addMerc: "Ajouter comme mercenaire",
        removeMember: "Retirer le membre",
        removeMerc: "Retirer le mercenaire",
        memberLabel: "Membre titulaire",
        reserveMemberLabel: "Réserviste",
        mercLabel: "Mercenaire",
        eligibleMembers: "Peut devenir membre",
        eligibleMercs: "Peut devenir mercenaire",
        blocked: "Non admissible",
        searchPlaceholder:
            "Nom Discord, nom affiché sur le serveur ou identifiant Discord",
        noResults: "Aucun joueur correspondant dans Logi.",
        rulesTitle: "Règles d’affectation",
        rulesMember:
            "Un joueur peut devenir membre principal uniquement s’il n’appartient pas déjà à un autre clan principal.",
        rulesMerc:
            "Un joueur peut être mercenaire dans d’autres clans, mais ne peut pas être à la fois membre et mercenaire du même clan.",
        rulesSystem:
            "La recherche porte sur les joueurs disposant déjà d’un compte Logi.",
        tablePlayer: "Joueur",
        tableType: "Type",
        tableGroup: "Groupe",
        tableStatus: "Statut",
        tableScore: "Score",
        platformId: "Identifiant de plateforme",
        playerNote: "Note du joueur",
        platformNotConnected: "Identifiant de plateforme non renseigné",
        platformConnectedAs: "Identifiant de plateforme défini : {platformId}",
        platformIdNoSpaces:
            "L’identifiant de plateforme ne peut pas contenir d’espaces.",
        platformAlreadyLinked:
            "Cet identifiant de plateforme est déjà lié à un autre joueur.",
        paused: "En pause",
        active: "Active",
        membershipStatus: "Statut d’adhésion",
        pendingLabel: "En attente",
        recruitLabel: "Recrue",
        addPlayer: "Ajouter un joueur",
        autoLinkPlatformIds:
            "Associer automatiquement les identifiants de plateforme",
        autoLinkPlatformIdsDescription:
            "Analysez les tableaux de scores importés, retirez le tag du clan des noms des joueurs et renseignez automatiquement les identifiants de plateforme correspondants.",
        autoLinkPlatformIdsHint:
            "Saisissez le tag du clan exactement tel qu’il apparaît devant les noms des joueurs dans les événements importés. Exemple : VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "{linked} identifiants de plateforme associés à partir de {players} entrées de joueurs correspondantes.",
        autoLinkPlatformIdsPartial:
            "Certains résultats ont été ignorés : {ambiguous} correspondances ambiguës, {conflicts} conflits et {failed} événements en échec.",
        dedupePlayerStats: "Supprimer les doublons dans les statistiques",
        dedupePlayerStatsDescription:
            "Supprimez les lignes de match importées en double pour les événements de ce clan, en conservant si possible la version la plus complète, sans valeur « Inconnu ».",
        dedupePlayerStatsHint:
            "Cette opération concerne uniquement les statistiques importées des événements de ce clan. Les matchs des autres clans ne sont pas modifiés.",
        dedupePlayerStatsSuccess:
            "{matches} lignes de match en double supprimées pour {users} joueurs.",
        refreshPerformanceHistory:
            "Actualiser les statistiques du clan et des joueurs",
        refreshPerformanceHistorySuccess:
            "Statistiques du clan et des joueurs actualisées.",
        refreshPerformanceHistoryError:
            "Impossible d’actualiser les statistiques du clan et des joueurs.",
        mergeUsers: "Fusionner des comptes",
        mergeUsersDescription:
            "Fusionnez entièrement deux comptes. Les données du compte principal sont conservées lorsque les deux comptes possèdent des données qui se recoupent.",
        mergeUsersPrimary: "Compte principal",
        mergeUsersSecondary: "Compte secondaire",
        mergeUsersPickPrimary: "Choisissez le compte à conserver",
        mergeUsersPickSecondary:
            "Choisissez le compte à fusionner avec celui-ci",
        mergeUsersHint:
            "Les statistiques, matchs importés, affectations, compositions et références intégrées aux événements seront rattachés au compte principal.",
        mergeUsersConfirm: "Fusionner les comptes",
        mergeUsersSuccess: "Comptes fusionnés.",
        clanTag: "Tag du clan",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Importer des membres Discord",
        importDiscordMembersDescription:
            "Importez dans la gestion des joueurs toutes les personnes possédant le rôle Discord choisi.",
        importDiscordMembersHint:
            "Les joueurs importés n’ont pas de groupe principal. Les groupes dont les rôles Discord requis correspondent sont ajoutés comme groupes secondaires.",
        membershipMigration: "Migrer les adhésions selon un rôle",
        membershipMigrationDescription:
            "Choisissez un rôle Discord et le statut d’adhésion à appliquer aux joueurs déjà affectés au clan.",
        membershipMigrationTarget: "Statut d’adhésion cible",
        membershipMigrationHint:
            "Seuls les joueurs déjà affectés à ce clan sont mis à jour. Les membres Discord sans affectation sont ignorés.",
        membershipMigrationSuccess:
            "{updated} joueur(s) ont désormais le statut {status}.",
        membershipMigrationSkippedUnassigned:
            "{count} membre(s) Discord sans affectation au clan ignoré(s).",
        membershipMigrationSkippedUnchanged:
            "{count} joueur(s) ayant déjà ce statut ignoré(s).",
        linkMissingDiscordIds: "Associer les identifiants Discord manquants",
        linkMissingDiscordIdsDescription:
            "Associez les joueurs importés sans identifiant Discord aux membres possédant le rôle Discord sélectionné.",
        linkMissingDiscordIdsHint:
            "Les noms sont normalisés avant la comparaison et le premier membre Discord correspondant est associé.",
        linkMissingDiscordIdsSuccess:
            "{linked} joueur(s) importé(s) associé(s) sur {scanned} candidat(s) examinés.",
        linkMissingDiscordIdsMerged:
            "{count} fiche(s) de joueurs importés fusionnée(s) avec des comptes déjà liés à Discord.",
        discordSourceRole: "Rôle Discord source",
        discordImportSuccess:
            "{players} joueurs importés parmi {matched} membres Discord correspondants.",
        discordImportSkipped:
            "{count} membre(s) Discord correspondant(s) ont été ignorés, car ils ne pouvaient pas être importés avec le type d’affectation choisi.",
        editAssignment: "Modifier l’affectation",
        playerSearch: "Rechercher un joueur",
        assignmentType: "Type d’affectation",
        primaryGroup: "Groupe principal",
        secondaryGroups: "Groupes secondaires",
        noGroup: "Aucun groupe principal",
        noSecondaryGroups: "Aucun groupe secondaire",
        pauseMembership: "Mettre l’adhésion en pause",
        pauseHelp: "À utiliser en cas d’inactivité ou d’absence temporaire.",
        pauseNote: "Motif de la pause",
        pauseNoteRequired: "Ajoutez un motif lorsque l’adhésion est en pause.",
        pickPlayerFirst:
            "Choisissez d’abord un joueur dans les résultats de recherche de Logi.",
        currentAssignment: "Affectation actuelle",
        mainClan: "Clan principal",
        none: "Aucun",
        assignmentDescription:
            "Modifiez le type d’affectation, le groupe ou la pause de l’adhésion, ou retirez le joueur du clan.",
        assignmentMetaDescription:
            "Modifiez l’adhésion au clan, le statut de mercenaire, le groupe et la pause.",
        assignmentTitleSuffix: "affectation",
        averageDescription: "Moyenne sur les {count} derniers matchs.",
        storedAverageDescription: "Moyenne sur {count} matchs importés.",
        averageKills: "Kills moyens",
        averageKd: "K/D moyen",
        averageDeaths: "Morts moyennes",
        averageOffense: "Attaque moyenne",
        averageDefense: "Défense moyenne",
        averageSupport: "Soutien moyen",
        matchKills: "Kills",
        matchKd: "K/D",
        matchDeaths: "Morts",
        matchOffense: "Attaque",
        matchDefense: "Défense",
        matchSupport: "Soutien",
        matchHistorySearch: "Rechercher dans l’historique des matchs…",
        matchHistoryEvent: "Événement",
        matchHistoryPlayedAt: "Joué",
        removePlayerFromClan: "Retirer le joueur de ce clan.",
        removePlayerConfirm:
            "Retirer ce joueur du clan ? Son affectation sera supprimée.",
        saveError: "Impossible d’enregistrer l’affectation du joueur.",
        deleteError: "Impossible de supprimer l’affectation du joueur.",
        assignmentSaved: "Affectation du joueur enregistrée.",
        assignmentCreated: "Affectation du joueur créée.",
        assignmentDeleted: "Affectation du joueur supprimée.",
        primaryGroupRequired:
            "Choisissez un groupe principal avant d’enregistrer.",
        alreadyAssigned: "Ce joueur est déjà affecté à ce clan.",
        mercenaryRecruitStatusError:
            "Les mercenaires ne peuvent pas avoir le statut de recrue.",
        reserveMemberRecruitStatusError:
            "Les réservistes ne peuvent pas avoir le statut de recrue.",
        roleSyncTitle: "Synchronisation des rôles des membres",
        roleSyncDescription:
            "Les rôles Discord liés aux groupes sont synchronisés à partir des groupes principal et secondaires sélectionnés. Les rôles d’adhésion ne sont synchronisés que pour les membres dont l’adhésion n’est plus en attente. Le statut de recrue ou de membre actif dépend du rôle du clan et, s’ils existent, des rôles de la catégorie d’adhésion associée. Les changements sont mis en file d’attente ; vérifiez le résultat dans Paramètres d’adhésion → Opérations sur les rôles d’adhésion.",
        missingClanRoleTitle: "Le rôle du clan n’est pas configuré",
        missingClanRoleDescription:
            "Ce joueur peut tout de même être marqué comme recrue ou membre actif dans Logi, mais aucun rôle de base du clan ne lui sera attribué sur Discord tant que ce rôle n’aura pas été défini dans les paramètres du clan.",
        missingMembershipCategoryTitle:
            "Cette affectation n’est liée à aucune catégorie d’adhésion",
        missingMembershipCategoryDescription:
            "Les rôles de recrue et de membre confirmé ne peuvent pas être synchronisés pour les affectations manuelles sans catégorie de candidature associée. Seuls le rôle du clan et les rôles liés aux groupes peuvent être appliqués sur Discord.",
        missingCategoryRolesTitle:
            "Les rôles de la catégorie d’adhésion sont incomplets",
        missingRecruitRoleDescription:
            "Aucun rôle de recrue n’est configuré pour cette catégorie. ",
        missingFinalRoleDescription:
            "Aucun rôle de membre confirmé n’est configuré pour cette catégorie. ",
        missingCategoryRolesSummary:
            "Logi conservera le statut d’adhésion, mais le rôle Discord correspondant à cette étape ne sera pas attribué.",
        platformIdsHint:
            "Séparez les identifiants par des virgules. Un identifiant Steam comporte 17 chiffres et commence par 7656119 ; indiquez les identifiants Xbox et PlayStation sous la forme xbox:… ou psn:….",
        platformIdsInvalid:
            "Corrigez les identifiants de plateforme signalés avant d’enregistrer.",
        platformIssues: {
            steam_format:
                "Identifiant Steam invalide : il doit comporter 17 chiffres et commencer par 7656119.",
            epic_format: "Identifiant Epic Games invalide.",
            too_long: "Identifiant de plateforme trop long.",
            duplicate: "Présent deux fois ; il ne sera enregistré qu’une fois.",
            linked_elsewhere: "Déjà lié à {name}.",
        },
        grantAdminTitle: "Nommer {name} administrateur ?",
        grantAdminDescription:
            "{name} pourra modifier les paramètres, matchs, compositions et membres de ce clan dans le tableau de bord Logi. Vous pourrez retirer cet accès ultérieurement.",
        removeAdminTitle: "Retirer les droits d’administration de {name} ?",
        removeAdminDescription:
            "{name} restera dans le clan, mais ne pourra plus le gérer dans le tableau de bord, sauf si un rôle Discord lui accorde encore cet accès.",
        removePlayerTitle: "Retirer {name} du clan ?",
        removePlayerDescription:
            "Son affectation, ses groupes et son statut d’adhésion dans ce clan seront supprimés. Logi retirera les rôles Discord qu’il gère pour ce joueur. L’historique des matchs sera conservé.",
    },
} as const
