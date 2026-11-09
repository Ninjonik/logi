export const teamsMessages = {
    teams: {
        title: "Équipes",
        description:
            "Sélectionnez les équipes des matchs, demandez une équipe manquante ou proposez une modification.",
        cancel: "Annuler",
        name: "Nom",
        shortCode: "Tag",
        shortCodeHelp:
            "Facultatif, 16 caractères maximum ; affiché lorsque l’espace est limité.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG ou WebP jusqu’à 2 Mio. L’image est normalisée en carré de 512 × 512.",
        upload: "Importer un logo",
        uploading: "Importation…",
        removeLogo: "Retirer le logo",
        search: "Rechercher des équipes…",
        loadMore: "Charger la suite",
        archivedBadge: "Archivée",
        empty: "Le catalogue ne contient pas encore d’équipes pour ce jeu.",
        emptySearch: "Aucune équipe ne correspond à cette recherche.",
        loading: "Chargement des équipes…",
        notAvailableForGame:
            "Le catalogue des équipes n’est pas disponible pour ce jeu.",
        gameDisabled:
            "Ce jeu n’est pas activé dans cet espace de travail. Vous pouvez parcourir et demander des équipes, mais leur utilisation dans les matchs nécessite d’activer le jeu dans les paramètres du clan.",
        retry: "Réessayer",
        requestNew: "Demander une nouvelle équipe",
        suggestChange: "Proposer une modification",
        suggestChangeTeam: "Proposer une modification de {name}",
        teamLinks: "Liens de {name}",
        errors: {
            invalid_team: "Vérifiez les informations de l’équipe et réessayez.",
            game_disabled: "Ce jeu n’est pas activé dans l’espace de travail.",
            duplicate_name:
                "Une équipe portant ce nom figure déjà dans le catalogue pour ce jeu.",
            revision_conflict:
                "Cette équipe a changé entre-temps. Rechargez-la et réessayez.",
            idempotency_conflict:
                "Cette demande a déjà été utilisée avec d’autres informations. Fermez la fenêtre et recommencez.",
            not_found: "L’équipe n’existe plus.",
            archived: "L’équipe est archivée.",
            not_archived: "L’équipe n’est pas archivée.",
            asset_unavailable:
                "Le logo importé n’est plus disponible. Importez-le à nouveau.",
            limit_reached:
                "Le catalogue de ce jeu a atteint sa limite de 2 000 équipes.",
            guild_already_linked:
                "Ce serveur Discord est déjà associé à une équipe.",
            invalid_merge: "Ces équipes ne peuvent pas être fusionnées.",
            forbidden: "Vous n’avez pas accès au catalogue des équipes ici.",
            unavailable:
                "Le catalogue des équipes est temporairement indisponible.",
            rate_limited:
                "Trop de demandes ; patientez un instant et réessayez.",
        },
        uploadErrors: {
            unsupported_type:
                "Seules les images PNG, JPEG et WebP sont acceptées.",
            type_mismatch:
                "Le contenu du fichier ne correspond pas à son type d’image.",
            bad_dimensions:
                "L’image doit mesurer entre 1 × 1 et 4 096 × 4 096 pixels.",
            animated: "Les images animées ne sont pas prises en charge.",
            undecodable: "Impossible de lire l’image.",
            invalid_kind: "Ce fichier importé n’est pas un logo d’équipe.",
            invalid_asset: "Impossible de stocker l’image importée.",
            too_large: "L’image dépasse 2 Mio.",
            upload_limited: "Trop d’importations. Réessayez dans {seconds} s.",
            forbidden:
                "Vous n’avez pas l’autorisation d’importer des logos ici.",
            unavailable: "Les importations sont temporairement indisponibles.",
        },
        picker: {
            title: "Équipes",
            description:
                "Choisissez les équipes de ce match dans le catalogue Logi. Chaque équipe conserve le nom et le logo qu’elle avait lors de sa sélection jusqu’à leur actualisation.",
            slots: { a: "Équipe A", b: "Équipe B", c: "Équipe C" },
            team: "Équipe",
            side: "Camp",
            noTeam: "Aucune équipe",
            noSide: "Sans camp",
            search: "Rechercher des équipes…",
            noResults: "Aucune équipe active trouvée.",
            unknownTeam: "Informations de l’équipe indisponibles",
            savedSelections: "Enregistrées pour ce match",
            requestTeam: "Demander une nouvelle équipe",
            requestNamed: "Demander « {name} »",
            requestHint:
                "Une équipe manque ? Demandez son ajout ; elle sera disponible une fois approuvée par un administrateur Logi.",
            requestSent:
                "Demande envoyée. Vous pourrez sélectionner l’équipe ici après approbation par un administrateur Logi ; l’auteur recevra la décision en message privé Discord.",
            refreshSnapshot: "Actualiser les informations",
            refreshing: "Actualisation…",
            snapshotRefreshed:
                "Informations actualisées depuis le catalogue des équipes.",
            archivedSelection:
                "Équipe archivée ; les informations enregistrées sont conservées pour ce match.",
            mergedBadge: "Fusionnée",
            mergedSelection:
                "Fusionnée avec une autre équipe du catalogue. Actualisez les informations pour utiliser cette équipe dans le match.",
            duplicateTeam:
                "Chaque équipe ne peut occuper qu’un seul emplacement.",
            duplicateSide:
                "Chaque camp ne peut être attribué qu’à une seule équipe.",
            errors: {
                invalid_match_teams: "L’affectation de l’équipe est invalide.",
                team_not_found: "L’équipe n’existe plus dans le catalogue.",
                team_archived:
                    "L’équipe est archivée ; choisissez-en une autre.",
                team_game_mismatch: "L’équipe appartient à un autre jeu.",
                match_concluded:
                    "Les matchs terminés conservent les informations d’équipe enregistrées.",
                training_event:
                    "Les entraînements n’ont pas d’équipes de match.",
                forbidden:
                    "Vous n’avez pas l’autorisation de modifier les équipes du match.",
                unavailable:
                    "Le catalogue des équipes est temporairement indisponible.",
                rate_limited:
                    "Trop de demandes ; patientez un instant et réessayez.",
            },
        },
    },
    teamRequests: {
        title: "Vos demandes d’équipes",
        description:
            "Demandes envoyées depuis cet espace de travail. Les administrateurs Logi les approuvent, les fusionnent ou les refusent, et l’auteur reçoit la décision en message privé Discord. Un espace de travail peut avoir jusqu’à 20 demandes en attente.",
        empty: "Cet espace de travail n’a pas encore demandé d’équipes.",
        loading: "Chargement des demandes…",
        loadMore: "Charger la suite",
        retry: "Réessayer",
        kinds: { create: "Nouvelle équipe", update: "Modification" },
        statuses: {
            pending: "En attente",
            approved: "Approuvée",
            merged: "Fusionnée",
            rejected: "Refusée",
            cancelled: "Annulé",
        },
        requestedOn: "Demandée le {date}",
        decidedOn: "Décision le {date}",
        note: "Votre note",
        reason: "Motif",
        resultTeam: "Équipe retenue",
        resultTeamUnavailable: "Informations de l’équipe indisponibles",
        cancel: "Annuler la demande",
        cancelRequest: "Annuler la demande pour {name}",
        cancelling: "Annulation…",
        cancelled: "Demande annulée.",
        submitted:
            "Demande envoyée. Les administrateurs Logi l’examineront ; la décision arrivera en message privé Discord.",
        dialog: {
            createTitle: "Demander une nouvelle équipe",
            updateTitle: "Proposer une modification",
            createDescription:
                "{game} · Les administrateurs Logi examinent chaque demande. Une fois approuvée, l’équipe pourra être sélectionnée pour les matchs.",
            updateDescription:
                "{game} · Proposez de nouvelles informations pour {name}. Les administrateurs Logi examinent les modifications avant leur application.",
            description: "Description",
            descriptionHelp: "Facultatif, 500 caractères maximum.",
            links: "Liens",
            linksHelp:
                "Jusqu’à 3 liens HTTPS, par exemple le site de l’équipe ou une invitation Discord.",
            link: "Lien {index}",
            addLink: "Ajouter un lien",
            removeLink: "Retirer le lien {index}",
            note: "Note pour les administrateurs",
            noteHelp:
                "Facultatif, 500 caractères maximum. Précisez tout élément utile à l’examen.",
            submit: "Envoyer la demande",
            submitting: "Envoi en cours…",
            cancel: "Annuler",
            unchanged:
                "Modifiez au moins une information de l’équipe avant l’envoi.",
            duplicate:
                "{name} figure déjà dans le catalogue pour ce jeu. Sélectionnez cette équipe ou proposez une modification.",
        },
        validation: {
            nameRequired: "Saisissez le nom de l’équipe.",
            nameInvalid: "120 caractères maximum, sans saut de ligne.",
            shortCodeInvalid: "16 caractères maximum, sans saut de ligne.",
            descriptionInvalid:
                "500 caractères maximum, sans caractères de contrôle.",
            linksInvalid:
                "Chaque lien doit être une adresse HTTPS sans nom d’utilisateur ni mot de passe.",
            linksDuplicate: "Chaque lien ne peut apparaître qu’une fois.",
            linksTooMany: "Ajoutez au maximum 3 liens.",
            noteInvalid: "500 caractères maximum, sans caractères de contrôle.",
            invalid: "Vérifiez les informations de la demande et réessayez.",
        },
        errors: {
            invalid_request:
                "Vérifiez les informations de la demande et réessayez.",
            not_found: "La demande ou son équipe n’existe plus.",
            not_pending: "Cette demande a déjà été traitée ou annulée.",
            limit_reached:
                "Cet espace de travail a déjà 20 demandes en attente. Attendez une décision ou annulez d’abord une demande.",
            idempotency_conflict:
                "Cette demande a déjà été envoyée avec d’autres informations. Fermez la fenêtre et créez une nouvelle demande.",
            team_archived:
                "L’équipe est archivée ; aucune modification ne peut plus être demandée.",
            team_game_mismatch: "L’équipe appartient à un autre jeu.",
            invalid_decision:
                "Cette décision n’est pas applicable à la demande.",
            forbidden:
                "Vous n’avez pas l’autorisation de gérer les demandes d’équipes ici.",
            rate_limited:
                "Trop de demandes ; patientez un instant et réessayez.",
            unavailable:
                "Les demandes d’équipes sont temporairement indisponibles.",
        },
    },
    signupActivity: {
        title: "Activité des inscriptions",
        description:
            "Suivez les inscriptions, changements de rôle et désinscriptions aux matchs et entraînements.",
        empty: "Aucune activité d’inscription pour le moment.",
        role: "Rôle",
        noRole: "Aucun rôle",
        actions: {
            signed_up: "s’est inscrit",
            changed_role: "a changé de rôle",
            unsigned: "s’est désinscrit",
            declined: "a décliné",
        },
        emptyTitle: "Aucune activité d’inscription",
        emptyDescription:
            "Les inscriptions, changements de rôle et désinscriptions aux matchs et entraînements apparaissent ici au fil de l’activité.",
        limitNotice:
            "Affichage des {count} dernières modifications. Les changements plus anciens ne sont pas affichés ici.",
        filteredBy: "Uniquement {event}",
        showAll: "Afficher toute l’activité",
    },
} as const
