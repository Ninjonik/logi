export const settingsHub_guidedSetup = {
    metaTitle: "Setup guide",
    workspace: "Workspace setup",
    exit: "Exit the guide",
    progressLabel: "Guide progress",
    stepsLabel: "Guide steps",
    reopenHint: "You can reopen a finished step at any time.",
    required: "Required",
    optional: "Optional",
    optionalSuffix: "optional",
    stepOf: "Step {number} of {total}",
    doneMark: "Done",
    back: "Back",
    skip: "Skip",
    continue: "Continue",
    finish: "Finish",
    saving: "Saving…",
    saveError: "Saving failed. Try again.",
    discordUnavailable:
        "Logi cannot read the channels and roles from Discord right now. Check the bot in step 1.",
    steps: {
        bot: {
            heading: "Invite the Logi bot to Discord",
            description:
                "The bot announces events, creates squad channels and guards roles. It has to be on your clan's server.",
            ready: "The bot is on the server and sees channels and roles.",
            checking: "The bot is on the server. Checking what it can see…",
            blind: "The bot is on the server but cannot see the channels and roles. Give it the View Channels and Manage Roles permissions on Discord.",
            missing: "The bot is not on your clan's server yet.",
            invite: "Invite the bot",
            checkAgain: "Check again",
        },
        games: {
            heading: "Which games does your clan play?",
            description: "Select the games your clan plays.",
            groupLabel: "Clan games",
            required: "Choose at least one game.",
        },
        profile: {
            heading: "Introduce the clan",
            description:
                "The name and logo appear on the Logi website and in the bot's messages.",
            name: "Clan name",
            namePlaceholder: "Clan name",
            logo: "Logo",
            logoAlt: "Clan logo",
            upload: "Upload logo",
            uploading: "Uploading…",
            formats: "PNG or JPG",
            about: "Description",
            aboutPlaceholder: "A few sentences about the clan",
            nameRequired: "Enter the clan name.",
            logoRequired: "Upload the clan logo.",
        },
        channels: {
            heading: "Where should the bot post?",
            description:
                "Choose channels on your Discord. You can set them differently for individual games later.",
            announcements: "Announcements",
            announcementsHelp: "New events and roster changes.",
            eventResults: "Event results",
            eventResultsHelp:
                "Confirmed match scores and statistics links. Optional; shared across games.",
            eventInfo: "Event information",
            eventInfoHelp: "Event details and sign-ups.",
            errors: "Bot errors",
            errorsHelp: "For admins only, when something goes wrong.",
            choose: "Choose a channel",
            none: "None",
        },
        roles: {
            heading: "Who belongs to the clan and who manages it?",
            description:
                "Logi recognises clan members and admins by their Discord roles.",
            clanRole: "Clan role",
            clanRoleHelp:
                "Whoever has this role is a clan member. Create the role in Discord Server Settings → Roles, then reload Logi to select it.",
            adminRole: "Logi admin role",
            adminRoleHelp:
                "People with this role see Settings and can change them.",
            choose: "Choose a role",
            none: "No role",
            noResults: "No role found.",
        },
        gameServers: {
            heading: "Connect a game server",
            description:
                "Logi can collect results and player statistics from your CRCON or Warcon server. The API key is stored encrypted and nobody will see it again.",
            empty: "No server yet. Connecting takes about a minute: the address, the server ID and the API key.",
            connect: "Connect a server",
        },
    },
    finished: {
        title: "Setup guide finished.",
        description:
            "Check the setup checklist in Settings. Any unfinished required steps are listed below.",
        openSettings: "Open Settings",
        again: "Go through again",
    },
} as const
