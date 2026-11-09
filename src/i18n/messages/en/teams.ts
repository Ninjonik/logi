export const teamsMessages = {
    teams: {
        title: "Teams",
        description:
            "Select teams for matches, request a missing team or suggest a change.",
        cancel: "Cancel",
        name: "Name",
        shortCode: "Short code",
        shortCodeHelp:
            "Optional, up to 16 characters; shown where space is tight.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG or WebP up to 2 MiB. The image is normalized to a 512×512 square.",
        upload: "Upload logo",
        uploading: "Uploading…",
        removeLogo: "Remove logo",
        search: "Search teams…",
        loadMore: "Load more",
        archivedBadge: "Archived",
        empty: "The catalogue has no teams for this game yet.",
        emptySearch: "No teams match this search.",
        loading: "Loading teams…",
        notAvailableForGame:
            "The team catalogue is not available for this game.",
        gameDisabled:
            "This game is not enabled in this workspace. You can browse and request teams, but they can be used in matches only after the game is enabled in clan settings.",
        retry: "Try again",
        requestNew: "Request a new team",
        suggestChange: "Suggest a change",
        suggestChangeTeam: "Suggest a change to {name}",
        teamLinks: "Links of {name}",
        errors: {
            invalid_team: "Check the team details and try again.",
            game_disabled: "This game is not enabled for the workspace.",
            duplicate_name:
                "A team with this name is already in the catalogue for this game.",
            revision_conflict:
                "This team changed in the meantime. Reload it and try again.",
            idempotency_conflict:
                "This request was already used with different details. Close the dialog and start again.",
            not_found: "The team no longer exists.",
            archived: "The team is archived.",
            not_archived: "The team is not archived.",
            asset_unavailable:
                "The uploaded logo is no longer available. Upload it again.",
            limit_reached:
                "This game's catalogue has reached its limit of 2000 teams.",
            guild_already_linked:
                "This Discord server is already linked to a team.",
            invalid_merge: "These teams cannot be merged.",
            forbidden: "You do not have access to the team catalogue here.",
            unavailable: "The team catalogue is temporarily unavailable.",
            rate_limited: "Too many requests; wait a moment and try again.",
        },
        uploadErrors: {
            unsupported_type: "Only PNG, JPEG and WebP images are accepted.",
            type_mismatch: "The file content does not match its image type.",
            bad_dimensions:
                "The image must be at least 1×1 and at most 4096×4096 pixels.",
            animated: "Animated images are not supported.",
            undecodable: "The image could not be read.",
            invalid_kind: "This upload is not a team logo.",
            invalid_asset: "The uploaded image could not be stored.",
            too_large: "The image exceeds 2 MiB.",
            upload_limited: "Too many uploads. Retry in {seconds} s.",
            forbidden: "You are not allowed to upload logos here.",
            unavailable: "Uploads are temporarily unavailable.",
        },
        picker: {
            title: "Teams",
            description:
                "Pick the teams playing this match from the Logi team catalogue. Each team keeps the name and logo it had when selected until you refresh it.",
            slots: { a: "Team A", b: "Team B", c: "Team C" },
            team: "Team",
            side: "Side",
            noTeam: "No team",
            noSide: "No side",
            search: "Search teams…",
            noResults: "No active teams found.",
            unknownTeam: "Team details unavailable",
            savedSelections: "Saved on this match",
            requestTeam: "Request a new team",
            requestNamed: "Request “{name}”",
            requestHint:
                "Missing a team? Request it; it can be selected once a Logi administrator approves it.",
            requestSent:
                "Request sent. You can select the team here once a Logi administrator approves it; the requester gets the decision as a Discord DM.",
            refreshSnapshot: "Refresh snapshot",
            refreshing: "Refreshing…",
            snapshotRefreshed: "Snapshot refreshed from the team catalogue.",
            archivedSelection:
                "Archived team; the saved snapshot stays on this match.",
            mergedBadge: "Merged",
            mergedSelection:
                "Merged into another catalogue team. Refresh the snapshot to switch this match to it.",
            duplicateTeam: "Each team can be placed in only one slot.",
            duplicateSide: "Each side can be assigned to only one team.",
            errors: {
                invalid_match_teams: "The team assignment is invalid.",
                team_not_found: "The team no longer exists in the catalogue.",
                team_archived: "The team is archived; choose another team.",
                team_game_mismatch: "The team belongs to a different game.",
                match_concluded: "Concluded matches keep their team snapshots.",
                training_event: "Trainings do not have match teams.",
                forbidden: "You are not allowed to change the match teams.",
                unavailable: "The team catalogue is temporarily unavailable.",
                rate_limited: "Too many requests; wait a moment and try again.",
            },
        },
    },
    teamRequests: {
        title: "Your team requests",
        description:
            "Requests sent from this workspace. Logi administrators approve, merge or reject each one, and the requester receives the decision as a Discord DM. A workspace can have up to 20 pending requests.",
        empty: "This workspace has not requested any teams yet.",
        loading: "Loading requests…",
        loadMore: "Load more",
        retry: "Try again",
        kinds: { create: "New team", update: "Change" },
        statuses: {
            pending: "Pending",
            approved: "Approved",
            merged: "Merged",
            rejected: "Rejected",
            cancelled: "Cancelled",
        },
        requestedOn: "Requested {date}",
        decidedOn: "Decided {date}",
        note: "Your note",
        reason: "Reason",
        resultTeam: "Resulting team",
        resultTeamUnavailable: "Team details unavailable",
        cancel: "Cancel request",
        cancelRequest: "Cancel the request for {name}",
        cancelling: "Cancelling…",
        cancelled: "Request cancelled.",
        submitted:
            "Request sent. Logi administrators will review it; the decision arrives as a Discord DM.",
        dialog: {
            createTitle: "Request a new team",
            updateTitle: "Suggest a change",
            createDescription:
                "{game} · Logi administrators review every request. Once approved, the team can be selected in matches.",
            updateDescription:
                "{game} · Propose new details for {name}. Logi administrators review the change before it is applied.",
            description: "Description",
            descriptionHelp: "Optional, up to 500 characters.",
            links: "Links",
            linksHelp:
                "Up to 3 https links, for example the team website or a Discord invite.",
            link: "Link {index}",
            addLink: "Add link",
            removeLink: "Remove link {index}",
            note: "Note for the administrators",
            noteHelp:
                "Optional, up to 500 characters. Mention anything that helps the review.",
            submit: "Send request",
            submitting: "Sending…",
            cancel: "Cancel",
            unchanged: "Change at least one detail of the team before sending.",
            duplicate:
                "{name} is already in the catalogue for this game. Select it instead, or suggest a change to it.",
        },
        validation: {
            nameRequired: "Enter the team name.",
            nameInvalid: "Use up to 120 characters without line breaks.",
            shortCodeInvalid: "Use up to 16 characters without line breaks.",
            descriptionInvalid:
                "Use up to 500 characters without control characters.",
            linksInvalid:
                "Each link must be an https address without a user name or password.",
            linksDuplicate: "Each link can be listed only once.",
            linksTooMany: "Add at most 3 links.",
            noteInvalid: "Use up to 500 characters without control characters.",
            invalid: "Check the request details and try again.",
        },
        errors: {
            invalid_request: "Check the request details and try again.",
            not_found: "The request or its team no longer exists.",
            not_pending: "This request has already been decided or cancelled.",
            limit_reached:
                "This workspace already has 20 pending requests. Wait for a decision or cancel one first.",
            idempotency_conflict:
                "This request was already sent with different details. Close the dialog and start a new request.",
            team_archived:
                "The team is archived, so changes can no longer be requested.",
            team_game_mismatch: "The team belongs to a different game.",
            invalid_decision: "This decision is not possible for the request.",
            forbidden: "You are not allowed to manage team requests here.",
            rate_limited: "Too many requests; wait a moment and try again.",
            unavailable: "Team requests are temporarily unavailable.",
        },
    },
    signupActivity: {
        title: "Signup activity",
        description:
            "See who signed up, changed roles, or withdrew from matches and trainings.",
        empty: "No signup activity yet.",
        role: "Role",
        noRole: "No role",
        actions: {
            signed_up: "signed up",
            changed_role: "changed role",
            unsigned: "withdrew",
            declined: "declined",
        },
        emptyTitle: "No signup activity yet",
        emptyDescription:
            "Signups, role changes and withdrawals for matches and trainings appear here as they happen.",
        limitNotice:
            "Showing the latest {count} changes. Older changes are not listed here.",
        filteredBy: "Only {event}",
        showAll: "Show all activity",
    },
} as const
