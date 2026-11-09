export const seedingMessages = {
    seedPage: {
        breadcrumbParent: "Discord panels",
        back: "Discord panels",
        title: "Server seeding",
        description:
            "When a server is empty, Logi calls players: it posts a call, pings the Seed role and shows in the panel how many players are missing. Only Logi admins may start it.",
        serversLabel: "The clan's game servers",
        noServers:
            "The clan has no game server yet. Add one under Game servers, then set up seeding here.",
        gameServersLink: "Game servers",
        unavailable: "Seeding could not be loaded right now. Reload the page.",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        status: {
            now: "Now {players} / {capacity} players",
            nowNoCapacity: "Now {players} players",
            noData: "No current server data",
            chips: {
                live: "Live",
                below_start: "Below the start threshold",
                filling: "Filling up",
                offline: "Unavailable",
                unknown: "No data",
            },
            running: "Seed running",
            idle: "No seed running",
            lastData: "last data {time}",
            nextSeed: "next scheduled seed {time}",
            lastSeed: "last seed {time}",
            progress: "{players} / {liveFrom} to a live game",
            startNow: "Seed now",
            stopNow: "End seed",
            busy: "Working…",
            started: "The seed is running. The call is in {channel}.",
            stopped: "The seed has ended.",
        },
        actionErrors: {
            cooldown: "A seed cannot start now. The next one can start {time}.",
            running: "A seed is already running.",
            duplicate: "This seed is already running.",
            not_configured: "Choose the call channel and save the plan first.",
            offline:
                "The server is not answering. Start the seed once it is online.",
            already_live: "The server is already live; no seed is needed.",
            not_running: "No seed is running right now.",
            not_found: "The server could not be found.",
            forbidden: "You are not allowed to do that.",
            unsaved: "Save your plan changes first.",
            unavailable: "That did not work. Please try again.",
        },
        time: {
            today: "today at {time}",
            yesterday: "yesterday at {time}",
            tomorrow: "tomorrow at {time}",
            other: "{date} at {time}",
        },
        plan: {
            title: "Seed plan · {server}",
            enabled: "On",
            enabledLabel: "Seed plan on",
            liveFrom: "The server is live from",
            liveFromUnit: "players",
            liveFromHint: "Then the seed ends.",
            startBelow: "A seed starts below",
            startBelowUnit: "players",
            startBelowHint: "Above that, the plan sends nothing.",
            when: "When",
            manual: "Manually",
            manualText:
                "with Seed now here or in the Server control message. Always available.",
            schedule: "Schedule",
            scheduleHint:
                "Only when the server is below the start threshold at that moment.",
            scheduleDays: "Schedule days",
            at: "at",
            time: "Time",
            addSlot: "Add another time",
            removeSlot: "Remove time",
            weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            auto: "Automatically",
            autoHint: "When the server empties during the day.",
            autoBelow: "when it drops below",
            autoBetween: "players between",
            autoAnd: "and",
            seedChannel: "Call channel",
            seedChannelPlaceholder: "Choose a channel",
            seedChannelOk: "The bot can post and ping {role}.",
            seedChannelOkNoRole: "The bot can post in the channel.",
            role: "Role the call pings",
            rolePlaceholder: "No role ping",
            createRole: "Create Seed role",
            createRoleBusy: "Creating the role…",
            createRoleHint:
                "Logi creates a mentionable Seed role in Discord and selects it. You can also pick a role you already have.",
            roleCreated: "The @Seed role was created and selected.",
            roleReused:
                "The server already has a @Seed role; it is now selected.",
            rolePermission:
                "The role could not be created. Give the Logi role the Manage Roles permission in Discord.",
            roleUnavailable:
                "Discord is not answering right now. Try creating the role again in a moment.",
            roleMembers: {
                one: "{count} member",
                few: "{count} members",
                many: "{count} members",
                other: "{count} members",
            },
            selfService: "Players turn the role on themselves with a button",
            selfServiceHint:
                "The call gets a Notify me about seeds button; another click removes the role again.",
            protection: "Protection",
            pingWindow: "At most 1 role ping per",
            hoursUnit: "h",
            pingWindowHint:
                "If a seed starts sooner, the call goes out without a role ping.",
            cooldown: "At least between seeds",
            cooldownHint:
                "Neither the button nor the plan starts another seed sooner.",
            template: "Call text",
            insert: "Insert:",
            templateHint:
                "Logi adds the title, the progress and the buttons itself.",
            templateDefault: "An empty field uses the default call text.",
            atThreshold: "At the threshold",
            endEdit:
                "Edit the message to “The server is live” and end the seed",
            endEditHint:
                "Nobody else is pinged. The progress also leaves the server panel.",
            endDelete: "Delete the message and end the seed",
            maxDuration: "At most",
            maxDurationHint:
                "Then the seed ends even if the server does not reach the threshold.",
        },
        previews: {
            title: "Call previews",
            call: "Preview of the call in {channel} · live from the text on the left",
            live: "At {count} players · the same message, edited",
            note: "The message refreshes every 60 s. The server panel shows the same progress meanwhile.",
            control: "Preview in {channel} · the message for this server",
            noChannel: "#channel",
            author: "today at {time}",
            deleted:
                "At {count} players Logi deletes the call and ends the seed. Nobody else is pinged.",
        },
        control: {
            title: "Control in Discord",
            channel: "Control channel",
            channelPlaceholder: "Choose a private channel",
            private: "The channel is private ✓",
            privateHint: "only admins can see it.",
            public: "Everyone can see the channel",
            publicHint:
                "the bot will not post the controls there. Choose a private channel.",
            checking: "Checking the channels in Discord…",
            note: "Only Logi admins may use the Seed, Refresh and Pause buttons. Anyone else gets a private reply that they are not allowed to. Public panels have no Seed button.",
        },
        problems: {
            seed_channel_unpublishable:
                "The bot cannot post in the call channel. Give it View Channel, Send Messages, Embed Links, Attach Files and Read Message History there.",
            seed_role_missing: "The chosen role no longer exists in Discord.",
            seed_role_not_mentionable:
                "The bot cannot ping the role. Turn on “Allow anyone to @mention this role”, or give the bot Mention @everyone.",
            seed_role_unmanageable:
                "The bot cannot assign the role. Give it Manage Roles and move its role above the chosen role.",
            control_channel_unpublishable:
                "The bot cannot post in the control channel. Give it View Channel, Send Messages and Read Message History there.",
            control_channel_public:
                "Everyone can see the control channel. Choose a channel @everyone cannot view.",
            verification_unavailable:
                "Discord is not answering, so the channels cannot be checked. Try again shortly.",
        },
        issues: {
            invalid: "Check this value.",
            start_below_not_under_live:
                "The start threshold must be lower than the live threshold.",
            auto_below_above_start:
                "The automatic start can be at most the start threshold.",
            auto_window_empty:
                "The window must start and end at different times.",
            schedule_without_slots: "Add at least one time to the schedule.",
            duplicate_day: "A day is in the schedule twice.",
            duplicate_slot: "This day and time are already in the schedule.",
            seed_channel_required: "A plan that is on needs a call channel.",
            control_channel_same_as_seed:
                "The control channel must differ from the call channel.",
            unknown_placeholder:
                "The text contains an unknown field in curly braces.",
            live_above_capacity:
                "The server has fewer slots than the live threshold.",
        },
        save: {
            note: "Saves the {server} plan and the control channel.",
            unsaved: {
                one: "{count} unsaved change",
                few: "{count} unsaved changes",
                many: "{count} unsaved changes",
                other: "{count} unsaved changes",
            },
            discard: "Discard",
            save: "Save",
            saving: "Saving…",
            saved: "The plan is saved.",
            reload: "Reload",
            conflict:
                "Someone else changed the plan meanwhile. Reload the page and make your changes again.",
            failed: "The plan could not be saved.",
        },
        history: {
            title: "Seed history · {server}",
            summary:
                "Last {days} days · {count} · on average {average} to a live game",
            summaryNoLive: "Last {days} days · {count}",
            seeds: {
                one: "{count} seed",
                few: "{count} seeds",
                many: "{count} seeds",
                other: "{count} seeds",
            },
            empty: "No seeds in the last 30 days.",
            columns: {
                start: "Start",
                trigger: "Started by",
                players: "Players at start → at end",
                result: "Result",
                duration: "Duration",
                pinged: "Pinged",
            },
            trigger: {
                schedule: "Plan {slot}",
                auto: "Automatically · below {count}",
                web: "{name} · manually on the web",
                discord: "{name} · button in {channel}",
                discordNoChannel: "{name} · button in Discord",
            },
            outcome: {
                live: "Live",
                timeout: "Missed the threshold",
                admin: "Ended by an admin",
                failed: "Failed",
                running: "Running",
            },
            endedSuffix: "ended",
            pinged: "{count} · {role}",
            silentWindow: "0 · protection {hours} h",
            silentNoRole: "0 · no role",
            unknownRole: "@role",
            units: { hours: "h", minutes: "min" },
        },
    },
} as const
