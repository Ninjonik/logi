import { enLanding } from "../landing"
export const publicSiteMessages = {
    home: {
        openApp: "Open app",
        signIn: "Sign in with Discord",
        contribute: "Contribute on GitHub",
        loggedInAs: "Signed in as {name}",
        dashboard: "Dashboard",
        community: "Explore community",
        competitions: "Competitions",
        featuresNav: "Features",
        liveOperations: "Operations, connected",
        commandCenter: "Your operation command center",
        commandCenterDescription:
            "Plan events, collect sign-ups and publish rosters to Discord.",
        eventsMetric: "events",
        playersMetric: "players",
        matchesMetric: "matches",
        nextOperation: "Next operation",
        registrationOpen: "Registration open",
        sampleOperation: "Saturday competitive match",
        sampleOperationMeta: "19:30 · 31 registered",
        featuresEyebrow: "Built for organized teams",
        featureEventsDescription:
            "Plan every stage of an operation with clear times and Discord-ready announcements.",
        featureRostersDescription:
            "Assign squads, manage reserves and track attendance.",
        featureStats: "Public match history",
        featureStatsDescription:
            "Share player profiles, results, and detailed match analysis with your community.",
        badge: "Discord operations for organized groups",
        title: "Clan management with Logi",
        description:
            "Logi is an open-source platform for groups that run events, rosters, trainings, matches, and Discord coordination.",
        featuresTitle: "What it actually does",
        featuresDescription:
            "Plan events, manage signups, build rosters, prepare matches, and keep Discord synchronized.",
        featureEvents: "Events, trainings, and match workflows",
        featureRosters: "Roster and attendance management",
        featureDiscord: "Discord-linked server administration",
        featureTools: "Shared tooling for organized communities",
        commsBadge: "LogiComms",
        commsTitle: "Squad voice communication",
        commsDescription:
            "LogiComms is a desktop app for squad voice communication.",
        commsDownload: "Download for Windows",
        commsUnavailable: "Windows download is temporarily unavailable.",
        freeToUse: "Free to use",
        sourceAvailable: "Source available on GitHub",
        contributionsWelcome: "Contributions welcome",
        noMarketingFiller: "No marketing filler",
        landing: enLanding,
        pillars: {
            operationsTitle: "Runs the boring parts",
            operationsDescription:
                "Schedule matches, collect sign-ups and publish rosters.",
            communitiesTitle: "Built for real communities",
            communitiesDescription:
                "For clans that organise matches and trainings on Discord.",
            contributorsTitle: "Open to contributors",
            contributorsDescription:
                "Report issues or contribute code on GitHub.",
        },
    },
    auth: {
        loginTitle: "Sign in to Logi",
        loginDescription: "Sign in with your Discord account.",
        loginButton: "Continue with Discord",
        heroSubtitle: "Clan events and rosters",
        contributeButton: "Contribute",
        featureRosterManagement: "Roster management",
        featurePlayerPerformance: "Player performance aggregation",
        featureEventPlanning: "Event planning",
        featureOpenSource: "Open source",
        statsPlayers: "Players in database",
        statsMatches: "Matches tracked",
        statsTeams: "Teams using Logi",
        statsOperations: "Operations planned",
        loginHint:
            "Use Discord to open your clan workspace, rosters, and operations dashboard.",
        featureRostersTitle: "Rosters",
        featureRostersBody:
            "Publish slot-ready lineups with reserves and acknowledgements.",
        featureBriefingsTitle: "Briefings",
        featureBriefingsBody: "Add notes, maps and attachments to events.",
        featureDiscordTitle: "Discord-ready",
        featureDiscordBody: "Publish announcements and rosters to Discord.",
        englishEnabled: "English enabled",
        discordAccessOnly: "Discord access only",
        discordOauth: "Discord OAuth",
        discordOauthBody: "Single sign-on for clans, members, and mercs.",
        plannedBackendHooks: "Account and clan access",
        plannedBackendHooksBody: "Sign in with Discord to access your clans.",
    },
    publicProfiles: {
        independentPlayer: "Player without a clan",
        kdChartHint: "Each bar shows K/D",
        communityTitle: "Community",
        communityDescription:
            "Browse active clans and their public match histories.",
        backToLogi: "Back to Logi",
        matches: "Matches",
        kills: "Kills",
        deaths: "Deaths",
        kd: "K/D",
        matchHistory: "Match history",
        matchPlayers: "Players",
        activeMembers: "active members",
        recentMatches: "Recent matches",
        wins: "Wins",
        winRate: "Win rate",
        clans: "Clans",
        findPlayer: "Find a player",
        findCommunity: "Find a player or clan",
        findPlayerDescription:
            "Search public profiles with at least one recorded match.",
        playerSearchPlaceholder: "Search by player name...",
        communitySearchPlaceholder: "Search players and clans...",
        search: "Search",
        noPlayersFound: "No public players matched that search.",
        noClansFound: "No public clans matched that search.",
        platformMatchHistoryDescription:
            "Results from every public clan, shown only after match data has been posted.",
        victory: "Victory",
        defeat: "Defeat",
        recorded: "Recorded",
        noMatches: "No public match results have been posted yet.",
        loadMore: "Load more",
        inviteSettings: {
            title: "Discord invite",
            description:
                "The Join on Discord button on the clan's public page opens this invite.",
            label: "Invite link",
            help: "Only discord.gg or discord.com/invite links. Leave it empty to hide the button.",
            invalid:
                "That is not a Discord invite. Copy the link from Discord (Invite People).",
            save: "Save invite",
            saving: "Saving…",
            saved: "Invite saved.",
            removed: "Invite removed.",
            saveError: "The invite could not be saved.",
            viewPublicPage: "View public page",
        },
    },
    publicSite: {
        status: {
            eyebrow: "Logi status",
            title: "Service availability",
            description:
                "This page covers the Logi dashboard, Convex services, data stores, Discord reachability and LogiComms dependencies.",
            link: "Service status",
            operational: "All services operational",
            degraded: "Some services are degraded",
            unknown: "Service status unavailable",
            serviceOperational: "Operational",
            serviceDegraded: "Degraded",
            unavailableTitle: "The service status could not be loaded",
            unavailableDescription:
                "The status monitor did not answer, so Logi cannot say which services are up. Logi itself may still work. Reload this page in a minute, or ask on the Discord support server if something is broken.",
            reload: "Reload",
        },
        login: {
            errorTitle: "Sign-in did not finish",
            errors: {
                "oauth-state":
                    "The sign-in link expired or was opened in another browser. Start again with the button below.",
                "discord-login":
                    "Discord did not confirm the sign-in. Try again in a moment; if it keeps failing, ask on the Discord support server.",
            },
        },
        guildLogin: {
            notMemberTitle: "You are not a member of {clan} yet",
            notMemberDescription:
                "You are signed in as {name}, but Logi does not see you on this clan's Discord server, so it cannot open the clan for you.",
            notMemberNextStep:
                "Ask the clan for a Discord invite and join their server. Then sign in again here so Logi refreshes your servers.",
            signInAgain: "Sign in again",
            openDashboard: "Open your clans",
        },
        community: {
            pickGameTitle: "Choose a game",
            pickGameDescription:
                "Clans, players and match results are kept separately for each game. Pick one to browse its community.",
        },
        legal: {
            privacyTitle: "Privacy policy",
            termsTitle: "Terms of service",
            loadFailed:
                "This document could not be loaded right now. Try again later, or ask on the Discord support server.",
        },
        competition: {
            divisionsLabel: "Divisions",
            standings: "Standings",
            standingsNote:
                "Points follow the competition rules. Clans confirm results; corrections appear here within a few minutes.",
            upcoming: "Upcoming",
            noUpcoming: "No fixtures are scheduled.",
            noResults: "No results yet.",
            unknownTeam: "Unknown team",
            noDivisionsTitle: "No divisions yet",
            noDivisionsDescription:
                "The organisers have not set up divisions for this competition. Check back later.",
            emptyTitle: "No public competitions yet",
            emptyDescription:
                "Competitions appear here once Logi's administrators publish them.",
            matchesColumn: "Played",
            winsColumn: "Won",
            pointsColumn: "Points",
            standingsNoteFor:
                "Points follow the {name} rules. Clans confirm results; corrections appear here within a few minutes.",
            round: "Round {round}",
            resultsSuffix: "results",
            thisWeekend: "this weekend",
            thisWeek: "this week",
            nextWeek: "next week",
            undated: "Date to be confirmed",
            noFixturesTitle: "No matches yet",
            noFixturesDescription:
                "The schedule appears here once the organisers publish it.",
            divisionsIn: {
                one: "in {count} division",
                few: "in {count} divisions",
                many: "in {count} divisions",
                other: "in {count} divisions",
            },
            rules: "Rules",
            statistics: "Statistics",
            moreRounds: "More rounds ({count})",
        },
        clan: {
            noMatchesTitle: "No recorded matches yet",
            noMatchesDescription:
                "Matches appear here once the clan publishes results in Logi.",
            joinDiscord: "Join on Discord",
            activeMembers: {
                one: "{count} active member",
                few: "{count} active members",
                many: "{count} active members",
                other: "{count} active members",
            },
            statsLabel: "Clan statistics",
            competition: "Competition",
            place: "Place {place}",
            upcoming: "Upcoming",
            noUpcoming: "The clan has not announced another match yet.",
            recent: "Recent matches",
            versus: "vs {opponent}",
            outcomeShort: {
                victory: "W",
                defeat: "L",
                draw: "D",
            },
        },
    },
} as const
