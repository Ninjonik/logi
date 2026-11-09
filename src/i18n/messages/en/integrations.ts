export const integrationsMessages = {
    membershipIntegration: {
        title: "Discord membership integrations",
        description:
            "Choose which Discord roles each integration may read. Access also requires a read-only key with the Discord membership grant. The website decides how to use these observations.",
        enabled: "Allow membership lookups with this key",
        roles: "Allowed roles",
        rolesHelp:
            "Without roles, only presence and the Logi assignment are shared. Save to apply changes.",
        empty: "Create a read-only API key with the Discord membership grant, then refresh this list.",
        loading: "Loading…",
        refresh: "Refresh",
        saving: "Saving…",
        save: "Save policy",
        saved: "Membership policy saved.",
        error: "Unable to load or save membership policies. Refresh and retry.",
        invalid: "Use valid Discord role IDs, with at most 100 roles per game.",
    },
    websiteEventPolicies: {
        title: "Website event commands",
        description:
            "Let a connected website create, update or cancel events through its service key. A policy binds one registered single sign-on application to one restricted API key and lists, per game, the Discord roles whose members may use the commands.",
        application: "Single sign-on application",
        applicationPlaceholder: "Choose an application",
        noApplications:
            "Register a single sign-on application first. The policy binds the website's commands to that application.",
        noKeys: "Create a restricted API key for the website backend, then refresh. Legacy unrestricted keys cannot carry a command policy.",
        enabled: "Allow event commands with this key",
        roles: "Allowed roles",
        rolesHelp:
            "A game without roles stays read-only. Saving an enabled policy grants event-command write access for the games with roles; disabling it removes the grant.",
        granted: "Write access granted for: {games}",
        notGranted: "No event-command write access granted.",
        loading: "Loading…",
        refresh: "Refresh",
        saving: "Saving…",
        save: "Save policy",
        saved: "Event command policy saved.",
        error: "Unable to load or save the event command policy. Refresh and retry.",
        denied: "The policy was rejected. Use a live restricted key of this workspace and an application registered in it.",
        invalid:
            "Use valid Discord role IDs, at most 64 per game, for games enabled in this workspace.",
    },
    apiKeys: {
        revokeTitle: "Revoke the key {name}?",
        groupsLegend: "Areas",
        groups: {
            matches: {
                label: "Matches",
                short: "matches",
                help: "Events, matches, their summaries and strat maps.",
            },
            rosters: {
                label: "Rosters",
                short: "rosters",
                help: "Rosters, squads and player assignments.",
            },
            results: {
                label: "Results",
                short: "results",
                help: "Confirmed results, player statistics and game history.",
            },
            members: {
                label: "Members",
                short: "members",
                help: "Clan members and their status. Reading membership also has its own rules.",
            },
            servers: {
                label: "Game servers",
                short: "servers",
                help: "Live server state, Warcon, HLL and connection health.",
            },
            league: {
                label: "League and teams",
                short: "league",
                help: "Wardogs League matches and the team catalogue.",
            },
        },
        partialGroup: "{group} (part)",
        readOnlyShort: "read only",
        everyGame: "every game",
        createdOn: "created {date}",
        revokeDescription:
            "Everything that uses this key, such as your website, stops getting data from Logi immediately. This cannot be undone; to restore access, create a new key.",
        revokeConfirm: "Revoke key",
        emptyTitle: "No API key yet",
        emptyDescription:
            "Create a key for your website's server. Choose only the data and games it needs.",
        description:
            "Create an integration key and keep it on your server. Choose only the data and games the integration needs.",
        name: "Key name",
        namePlaceholder: "Website name, e.g. main site",
        access: "Access",
        readOnly: "Read-only",
        fullAccess: "Full access (legacy)",
        readOnlyHelp:
            "Can read only the selected resources and games. Cannot create, update or delete data.",
        fullAccessHelp:
            "Can read and modify all clan data across all games. Use only for integrations that need write access.",
        resources: "Resources",
        games: "Games",
        selectScope: "Select at least one resource and one game.",
        privateData:
            "Complete records may contain private operational details. Review data before publishing it.",
        createReadOnly: "Create read-only key",
        createFullAccess: "Create full-access key",
        copyNow:
            "Copy this key now. It cannot be shown again. Keep it on your server.",
        copy: "Copy API key",
        copied: "API key copied.",
        copyFailed:
            "Unable to copy the key. Copy it manually before hiding it.",
        hide: "Hide key",
        createFailed:
            "Unable to create the key. Check your selection and try again.",
        invalidKey: "The server returned an invalid API key.",
        revoke: "Revoke",
        revokeFailed: "Unable to revoke the key. Try again.",
        revoked: "revoked",
        created: "created",
        existingKeys: "Existing keys",
        rotateHelp:
            "To change permissions, create a replacement key, switch the integration, then revoke the old key.",
        allGames: "all games; read and write",
        loading: "Loading keys…",
        loadFailed:
            "Unable to refresh keys. Displayed permissions may be out of date.",
        retry: "Retry",
        empty: "No API keys have been created.",
        invalidPolicy: "Unrecognized restrictions; backend access is denied.",
        resourceLabels: {
            "server-game-history":
                "Retained server games (player names and Steam IDs)",
            "league-matches": "Wardogs League",
            "league-fixtures": "Tracked Wardogs League fixtures",
            "hll-live":
                "HLL live scoreboard (including player names and platform IDs)",
            "warcon-data":
                "Warcon gameplay data (includes player names and Steam IDs)",
            "member-summaries": "Member directory (read-only)",
            "roster-summaries": "Published rosters and attendance (read-only)",
            "player-stat-summaries":
                "Verified player facts from collected sessions",
            "membership-summaries":
                "Discord membership (separate policy required)",
            "server-snapshots": "Game server snapshots",
            "integration-health": "Collection health",
            "event-summaries": "Event summaries",
            "match-summaries": "Match summaries",
            "result-summaries": "Reviewed result summaries",
            events: "Events (complete records)",
            matches: "Matches (raw statistics)",
            groups: "Groups",
            rosters: "Rosters",
            assignments: "Member assignments",
            stratmaps: "Tactical maps",
            teams: "Team directory (active teams, names and logos)",
        },
    },
    verifiedPlatformLinks: {
        title: "Verified Steam account",
        description:
            "Verify control of your Steam account by signing in on Steam. IDs entered in your profile are unverified claims.",
        loading: "Loading…",
        refresh: "Refresh",
        error: "Steam linking is unavailable. Refresh or try again shortly.",
        callbackFailed:
            "Steam verification did not complete. Start a new link attempt.",
        verified: "Verified through Steam",
        empty: "No verified Steam account",
        verifiedAt: "Verified",
        revokedAt: "Unlinked",
        link: "Verify with Steam",
        unlink: "Unlink Steam",
        history: "Recent link history",
        effect: "Unlinking stops future player attribution. This proof does not grant Discord roles, confirm game ownership, or publish your profile on the website.",
    },
    integrationSettings: {
        cancel: "Cancel",
        web: {
            stepKey: "API key for the website",
            stepLogin: "Sign in with Logi",
            stepMembers: "What the website may do for members",
            newKey: "New key",
            closeForm: "Close",
            keyShownOnce:
                "A key is shown only once, right after it is created. Keep it on your website's server.",
            loginPage: "Clan sign-in page",
            ssoApps: "Single sign-on applications",
            addApplication: "Add application",
            membersRowHelp:
                "Through the {key} key. A member needs one of the roles.",
            saveRoles: "Save roles",
            membersTitle: "Find out who is a member",
            membersHelp:
                "Through a read-only key with the Discord membership grant. The website sees only members with one of the chosen roles.",
            eventsTitle: "Create and edit events",
            eventsHelp:
                "Through a single sign-on application and its key. Only people with one of the chosen roles.",
            footer: "Keys and applications are saved immediately. Roles are saved with the button of each key.",
            rolesPlaceholder: "Choose roles",
            rolesUnavailable:
                "Discord roles could not be loaded. Refresh the page to try again.",
        },
        sso: {
            emptyTitle: "No sign-in application yet",
            emptyDescription:
                "Add your website as an application so members can sign in to it with their Discord account through Logi.",
            redirects: "Return addresses after sign-in: {count}",
            clientId: "Client ID",
            edit: "Edit",
            save: "Save changes",
            saved: "Application saved.",
            removeTitle: "Remove {name}?",
            removeDescription:
                "Members can no longer sign in to {website} with Logi. The application's client ID and secret stop working, and website event commands bound to it stop too. This cannot be undone.",
            removeConfirm: "Remove application",
        },
        webhooks: {
            emptyTitle: "No webhooks yet",
            emptyDescription:
                "Add an HTTPS address and Logi will send event, roster, article and settings changes to it, signed with a secret.",
            deleteTitle: "Delete this webhook?",
            deleteDescription:
                "Logi stops sending changes to {url} immediately and its signing secret stops working. This cannot be undone.",
            deleteConfirm: "Delete webhook",
            loadFailed: "Unable to load webhooks. Refresh and try again.",
            createFailed:
                "Unable to create the webhook. Check the address and try again.",
            actionFailed: "The change was not saved. Try again.",
            rotateFailed: "Unable to rotate the signing secret.",
            historyFailed: "Unable to load the delivery history.",
        },
        calendar: {
            emptyTitle: "No calendar link yet",
            emptyDescription:
                "Create a private link and add it to Google Calendar or another calendar app. Anyone with the link can see the clan's events.",
            rotateTitle: "Create a new calendar link?",
            rotateDescription:
                "The current link stops working. Everyone who subscribed with it has to add the new link again.",
            rotateConfirm: "Create new link",
        },
        league: {
            title: "Wardogs League tracking",
            cadence:
                "New matches are checked every {scan} minutes and tracked details every {refresh} minutes. The website and Discord use the same record.",
            enable: "Track Wardogs League and match links",
            teamCodes: "Codes of tracked teams (comma separated)",
            scanEvery: "Look for new matches every",
            refreshEvery: "Refresh tracked details every",
            minutes: "{minutes} minutes",
            scanNote:
                "The shared index scan runs at the fastest interval any enabled clan asks for; this clan takes a fresh index only after its own interval. Limits at the source can stretch the intervals.",
            intakeChannel: "Channel where people post links",
            intakePlaceholder: "Choose the intake channel",
            panelsNote:
                "The table and the next matches of the whole league go to Discord as the WD League panel in Settings → Discord panels. Cards for single matches are no longer posted. When you turn tracking off, the bot deletes the panel's messages.",
            intakeNote:
                "Bot messages are ignored. Reading people's messages automatically needs Message Content enabled for the bot by its operator. Scanning and manual additions work without it.",
            save: "Save settings",
            saved: "Saved.",
            saveFailed:
                "Saving failed. Check permissions, the link and the channel settings.",
            loadFailed: "Tracking settings could not be loaded.",
            lastScan: "Last successful scan",
            nextScan: "Next scan",
            incomplete: "The list is incomplete; add a missing match manually.",
            queueFull:
                "Automatic discovery is full. Existing matches still refresh; the remaining slots are kept for manual additions.",
            sourceError:
                "The source is unavailable. The last valid data is kept.",
            addByUrl: "Add a match by its League URL",
            preview: "Load preview",
            previewFailed: "Preview unavailable. Check the match URL.",
            track: "Track this match",
            createNative: "Create your own match in Logi",
            states: {
                pending: "Waiting to load",
                tracked: "Tracking",
                paused: "Paused",
                ignored: "Ignored",
                archived: "Archived",
                unmatched: "Outside the filter",
            },
            refreshOnce: "Load again",
            resume: "Resume",
            pause: "Pause",
            ignore: "Ignore",
            staleData: "Older data, last loaded {time}",
            linkedEvent: "Logi match for this fixture",
            notLinked: "Not linked",
            unknownEvent: "Linked match that is no longer listed",
            noEvents:
                "There is no Wardogs match in Logi yet. Create one, then link it here.",
            saveLink: "Save link",
            emptyTitle: "No tracked match yet",
            emptyDescription:
                "Matches of the tracked teams appear here after the next scan. You can also add one by its URL above.",
        },
    },
} as const
