export const applicationsMessages = {
    membershipApplication: {
        title: "Candidature au clan",
        description:
            "Un formulaire en plusieurs fenêtres, envoyé uniquement à la fin. Puis un fil privé, les rôles et la décision.",
        breadcrumbParent: "Adhésion",
        enabled: "Candidatures activées",
        tabsLabel: "Étapes de la candidature",
        tabs: {
            application: "Candidature",
            categories: "Catégories",
            scores: "Points de présence",
            roleChanges: "Changements de rôle",
        },
        categoryCount: {
            one: "{count} catégorie",
            few: "{count} catégories",
            many: "{count} catégories",
            other: "{count} catégories",
        },
        panel: {
            title: "Panneau et salons",
            channel: "Salon du panneau",
            threads: "Emplacement des fils de candidature",
            channelOk: "Le bot peut publier et intégrer des images ici.",
            channelBlocked:
                "Le bot ne peut pas publier ou intégrer des images ici. Accordez-lui Voir le salon, Envoyer des messages, Intégrer des liens, Joindre des fichiers et Voir les anciens messages dans ce salon.",
            threadsOk: "Le bot peut créer des fils privés ici.",
            threadsBlocked:
                "Le bot ne peut pas créer de fils privés ici. Accordez-lui Voir le salon, Créer des fils privés, Envoyer des messages dans les fils et Gérer les fils dans ce salon.",
            checking: "Vérification des permissions du bot…",
            checkUnavailable:
                "Impossible de vérifier les permissions du bot pour le moment. Réessayez dans un instant.",
            heading: "Titre",
            text: "Texte",
            textHelp:
                "Les catégories s’affichent automatiquement sous le texte.",
            image: "Image",
            upload: "Importer une image",
            uploading: "Importation…",
            pick: "Choisir parmi les bannières importées",
            pickTitle: "Images de panneau importées",
            pickDescription:
                "Images déjà importées par le clan pour ses panneaux Discord.",
            pickEmpty: "Aucune image importée pour le moment.",
            pickUnavailable:
                "Impossible de charger les images importées pour le moment.",
            pickImage: "Utiliser l’image {number}",
            removeImage: "Retirer l’image",
            imageHelp:
                "Facultatif, au-dessus du titre du panneau. PNG, JPEG ou WebP, 2 Mio maximum.",
            color: "Couleur du panneau",
            colorHint:
                "Vide = couleur du clan. Format hexadécimal, ex. : #E8A33D.",
            colorInvalid: "La couleur doit être en hexadécimal, ex. : #E8A33D.",
            imageAlt: "Image du panneau de candidature",
            attachFailed: "Impossible d’utiliser l’image. Réessayez.",
            uploadErrors: {
                unsupported_type:
                    "Seules les images PNG, JPEG et WebP sont acceptées.",
                type_mismatch:
                    "Le contenu du fichier ne correspond pas à son type d’image.",
                bad_dimensions:
                    "L’image doit mesurer entre 1 × 1 et 4 096 × 4 096 pixels.",
                animated: "Les images animées ne sont pas prises en charge.",
                undecodable: "Impossible de lire l’image.",
                invalid_kind:
                    "Ce fichier ne peut pas servir d’image de panneau.",
                invalid_asset: "Impossible d’enregistrer l’image importée.",
                too_large: "L’image dépasse 2 Mio.",
                upload_limited:
                    "Trop d’importations. Réessayez dans {seconds} s.",
                forbidden:
                    "Vous n’avez pas l’autorisation d’importer des images ici.",
                unavailable: "L’importation est temporairement indisponible.",
            },
            preview: "Aperçu dans #{channel}",
            previewNoChannel: "Aperçu du panneau",
            previewEmpty:
                "Le panneau apparaît dès que le clan possède au moins une catégorie.",
        },
        form: {
            title: "Formulaire : fenêtres et questions",
            intro: "Une candidature en plusieurs fenêtres. Types de questions : texte court, texte long, choix unique, choix multiple, oui/non et nombre.",
            note: "Le candidat parcourt les fenêtres dans l’ordre et envoie sa candidature après vérification. Entre les fenêtres, le bot affiche un bouton Continuer, car Discord ne permet pas d’ouvrir une fenêtre directement depuis une autre. Le nombre de champs correspond au parcours affichant le plus de questions.",
            window: "Fenêtre {number} · {name}",
            windowNames: {
                about: "À propos de toi",
                accounts: "Comptes de jeu",
                questions: "Questions du clan",
            },
            fieldCount: "{count} champs sur 5",
            inPreview: "dans l’aperçu",
            fixed: "champ fixe",
            fixedFields: {
                games: "Jeu",
                category: "Catégorie",
                name: "Pseudo en jeu",
                steam: "Steam",
                epic: "Epic",
                xbox: "Xbox",
                playstation: "PlayStation",
            },
            gamesNote: "uniquement si le clan joue à plusieurs jeux",
            categoryNote: "catégories du jeu choisi",
            accountsNote:
                "Les champs apparaissent uniquement pour le jeu qui en a besoin. Les comptes déjà liés au candidat dans Logi sont préremplis.",
            requireSteam: "Exiger un compte Steam vérifié",
            requireSteamHelp:
                "Pour HLL. Avant la fenêtre 2, le bot envoie un lien Vérifier avec Steam ; un identifiant Steam saisi manuellement n’est alors pas accepté.",
            addQuestion: "Ajouter une question",
            newQuestion: "Nouvelle question",
            option: "Option {number}",
            edit: "Modifier",
            editAria: "Modifier la question {name}",
            close: "Fermer",
            move: "Déplacer la question {name}",
            moveHint:
                "Glissez avec la souris ou utilisez les flèches haut et bas du clavier.",
            remove: "Supprimer la question {name}",
            windowFull: "La fenêtre est pleine.",
            windowFullText:
                "Discord autorise au maximum 5 champs par fenêtre. Placez la prochaine question dans une nouvelle fenêtre.",
            addWindow: "Ajouter une fenêtre",
            noMoreWindows:
                "Impossible d’ajouter une fenêtre : la candidature est limitée aux fenêtres 3, 3b et 3c.",
            windowEmpty: "Cette fenêtre n’a pas encore de questions.",
            removeWindow: "Supprimer la fenêtre {number}",
            types: {
                short_text: "Texte court",
                long_text: "Texte long",
                select: "Sélection",
                multi_select: "Choix multiple",
                yes_no: "Oui/non",
                number: "Nombre",
                member: "Membre du clan",
            },
            required: "Obligatoire",
            bothGames: "Les deux jeux",
            allGames: "Tous les jeux",
            specializationCategories: "catégories selon leur configuration",
            gameShort: {
                hell_let_loose: "HLL",
                hell_let_loose_vietnam: "HLL: Vietnam",
                wardogs: "Wardogs",
                world_of_warcraft_forever: "WoW:F",
            },
            editor: {
                title: "Modification de la question {name}",
                type: "Type",
                typeFixed: "Le type de cette question est fixe.",
                required: "Obligatoire",
                label: "Libellé",
                labelCount:
                    "{count} / 45 caractères · limite imposée par Discord.",
                help: "Aide",
                helpHint: "Sous le libellé, 100 caractères maximum.",
                placeholder: "Texte indicatif",
                options: "Options",
                optionInput: "Option {number}",
                removeOption: "Supprimer l’option {name}",
                moveOption: "Déplacer l’option {name}",
                addOption: "Ajouter une option",
                maxOptions: "25 options maximum.",
                selectFrom: "Choisir de",
                selectTo: "à",
                game: "Uniquement pour le jeu",
                gameBoth: "Les deux",
                gameAll: "Tous",
                category: "Uniquement pour la catégorie",
                categoryHint:
                    "Aucune case cochée signifie toutes les catégories.",
                categoryOtherGame:
                    "{game} · la question concerne uniquement {questionGame}",
                specializationNote:
                    "Le bot demande une spécialisation uniquement pour les catégories qui l’activent dans le tableau ci-dessous. HLL uniquement.",
                aboutNoFilters:
                    "Tous les candidats voient la fenêtre 1 : ils y choisissent le jeu et la catégorie.",
                done: "Terminé",
            },
            issues: {
                "window-full":
                    "La fenêtre contient plus de 5 champs. Déplacez une question vers une autre fenêtre.",
                "too-many-windows":
                    "La candidature est limitée aux fenêtres 3, 3b et 3c.",
                "label-empty": "La question doit avoir un libellé.",
                "label-too-long": "Le libellé dépasse 45 caractères.",
                "help-too-long": "Le texte d’aide dépasse 100 caractères.",
                "placeholder-too-long":
                    "Le texte indicatif dépasse 100 caractères.",
                "options-missing":
                    "Un champ de sélection nécessite au moins une option.",
                "options-too-many":
                    "Le champ de sélection contient plus de 25 options.",
                "option-empty": "Chaque option doit avoir un texte.",
                "option-too-long": "Une option dépasse 100 caractères.",
                "option-duplicate": "Deux options portent le même nom.",
                "values-range":
                    "Les limites de sélection ne correspondent pas au nombre d’options.",
                "duplicate-id":
                    "La question figure deux fois dans le formulaire.",
                "type-invalid": "Ce type ne convient pas à cette question.",
                "category-unknown":
                    "La question est limitée à une catégorie qui n’existe plus.",
                "specialization-duplicate":
                    "La question Spécialisation figure deux fois dans le formulaire.",
            },
            issuesTitle: "Le formulaire ne peut pas encore être enregistré",
            windowPreview:
                "Aperçu de la fenêtre {number} dans Discord · candidature pour {game}, {category}",
            windowPreviewNoCategory:
                "Aperçu de la fenêtre {number} dans Discord",
            previewWindowPick: "Fenêtre de l’aperçu",
            modalLabel: "Fenêtre de candidature dans Discord",
            modalClose: "Fermer la fenêtre",
            modalCancel: "Annuler",
            modalSubmit: "Envoyer",
            reviewPreview:
                "Vérification avant envoi · visible uniquement par le candidat",
            sample: {
                name: "Joueur 17",
                shortText: "Réponse du candidat",
                longText:
                    "Je cherche une équipe pour jouer régulièrement des matchs…",
            },
        },
        categories: {
            title: "Catégories",
            intro: "Choix proposés au candidat dans la fenêtre 1. Modifiez les détails dans l’onglet Catégories.",
            columns: {
                category: "Catégorie",
                game: "Jeu",
                roles: "Rôles après acceptation · recrue → membre confirmé",
                thread: "Fil visible par",
                specialization: "Demander la spécialité",
                actions: "Actions",
            },
            noRecruit: "sans recrue",
            noRole: "sans rôle",
            admins: "administrateurs Logi uniquement",
            edit: "Modifier",
            editAria: "Modifier la catégorie {name}",
            specializationAria: "Demander la spécialisation : {name}",
            add: "Ajouter une catégorie",
            note: "@{role} est attribué à tous les candidats acceptés ; définissez-le dans Rôles et accès. La spécialisation concerne uniquement HLL.",
            noteNoRole:
                "Définissez le rôle du clan attribué à tous les candidats acceptés dans Rôles et accès. La spécialisation concerne uniquement HLL.",
            empty: "Aucune catégorie pour le moment. Sans catégorie, personne ne peut postuler.",
            specializationMissing:
                "La question Spécialisation ne figure pas dans le formulaire ; le bot ne la pose donc pas.",
            restoreSpecialization: "Rétablir la question Spécialisation",
        },
        after: {
            title: "Après l’envoi",
            thread: "Créer un fil privé dans #{channel}",
            threadNoChannel: "Créer un fil privé",
            threadHelp:
                "Toujours. Il s’ouvre avec les réponses et le message d’accueil ci-dessous.",
            mention:
                "Mentionner les rôles de support de la catégorie dans le fil",
            mentionHelp:
                "Par exemple @Recrutement ; personne d’autre ne voit le fil.",
            recruit: "Attribuer le rôle Recrue dès l’envoi",
            recruitHelp: "Uniquement pour les catégories ayant un rôle Recrue.",
            dm: "Envoyer un MP de confirmation au candidat",
            dmHelp: "Avec un lien vers le fil.",
            keep: "Conserver une candidature inachevée pendant 24 h",
            keepHelp:
                "Le brouillon est ensuite supprimé et le candidat doit recommencer.",
            welcome: "Message d’accueil dans le fil",
            welcomePlaceholder:
                "{applicant}, merci pour ta candidature. {support_roles} te répondra bientôt.",
            welcomeHelp:
                "Vous pouvez utiliser {applicant}, {support_roles} et {category}.",
            decisionPreview:
                "Décision dans le fil · boutons à la place de /close_application",
            tableCaption: "Actions des boutons pour la catégorie {category}",
            table: {
                button: "Bouton",
                roles: "Changements de rôle",
                applicant: "Le candidat reçoit",
            },
            outcomes: {
                member: "Accepter comme membre",
                recruit: "Accepter comme recrue",
                mercenary: "Accepter comme mercenaire",
                denied: "Refuser…",
                pending: "Décision en attente",
            },
            gets: {
                result: "Le résultat et un MP",
                reason: "Une fenêtre pour le motif, le résultat et un MP",
                pending: "Une note sur la fiche, sans MP",
            },
            noRoleChange: "aucun changement",
            mercenaryMissing: "Aucune catégorie de mercenaires",
            mercenaryMissingNote:
                "Le bouton Accepter comme mercenaire reste désactivé dans Discord tant que le clan ne possède pas de catégorie de mercenaires. Ajoutez une catégorie ayant pour résultat Mercenaire.",
            mercenaryCategoryNote:
                "Accepter comme mercenaire attribue les rôles de la catégorie {category}, et non ceux de la catégorie choisie par le candidat.",
            roleSyncOff:
                "La synchronisation des rôles est désactivée ; Logi ne modifie donc aucun rôle.",
            decisionNote:
                "Le support de la catégorie et les administrateurs Logi peuvent prendre la décision. La commande /close_application reste disponible.",
        },
        web: {
            title: "Variante B · formulaire sur le site",
            switch: "Proposer aussi le formulaire sur le site",
            help: "Le panneau reçoit un second bouton, Remplir sur le site. Le même formulaire s’ouvre sur une page Logi, sans limite de 5 champs par fenêtre, après connexion avec Discord. La candidature arrive dans le même fil avec les mêmes rôles.",
            note: "Utile pour les longs formulaires ou les candidats sur téléphone, où les fenêtres Discord sont moins pratiques.",
            address: "Adresse du formulaire",
        },
        save: {
            changes: {
                one: "{count} modification non enregistrée",
                few: "{count} modifications non enregistrées",
                many: "{count} modifications non enregistrées",
                other: "{count} modifications non enregistrées",
            },
            note: "Le panneau dans #{channel} se met à jour après l’enregistrement.",
            noteNoChannel: "Le panneau se met à jour après l’enregistrement.",
            discard: "Abandonner",
            save: "Enregistrer",
            saved: "Candidature enregistrée.",
            error: "Impossible d’enregistrer la candidature.",
            formInvalid:
                "Le formulaire contient une erreur. Corrigez les questions signalées et enregistrez à nouveau.",
        },
    },
    applicationWeb: {
        brand: "Logi · Clan {clan}",
        signedInAs: "Connecté avec Discord en tant que {name}",
        title: "Candidature auprès de {clan}",
        stepsLabel: "Étapes de la candidature",
        review: "Vérification",
        autosave: "Votre progression est enregistrée automatiquement.",
        next: "Étape suivante",
        back: "Retour",
        saving: "Enregistrement…",
        submit: "Envoyer la candidature",
        submitting: "Envoi en cours…",
        edit: "Modifier",
        required: "obligatoire",
        chooseUpTo: "Choisissez entre {min} et {max} options.",
        reviewTitle: "Vérifiez votre candidature",
        reviewNote: "Nous conservons une candidature inachevée pendant 24 h.",
        queued: "Candidature envoyée. Le bot crée maintenant un fil privé…",
        done: "Candidature envoyée. Les recruteurs vous répondront dans le fil.",
        openThread: "Ouvrir le fil dans Discord",
        failed: "Impossible d’envoyer la candidature. Réessayez.",
        retry: "Réessayer",
        expired:
            "La candidature inachevée a expiré après 24 heures. Veuillez la remplir à nouveau.",
        busy: "La candidature est en cours d’envoi. Patientez un instant.",
        unavailable:
            "Le formulaire est indisponible pour le moment. Réessayez dans un instant.",
        disabled:
            "Le clan n’accepte pas de candidatures sur le site pour le moment.",
        alreadyOpen: "Vous avez déjà une candidature en cours.",
        member: "Vous faites déjà partie du clan. Vous n’avez pas besoin de postuler.",
        steamLocked:
            "Le compte Steam provient uniquement de la vérification Steam sur le site Logi.",
        memberHint:
            "Identifiant du compte Discord du membre qui vous a invité.",
        fixErrors: "Corrigez les champs signalés.",
    },
} as const
