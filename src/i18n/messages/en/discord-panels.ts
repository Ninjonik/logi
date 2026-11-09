import { discordPanelsPage_editor } from "./discord-panels-editor"
import { discordPanelsPage_list } from "./discord-panels-list"
export const discordPanelsMessages = {
    discordPanelsPage: {
        newPanel: "New panel",
        time: {
            today: "today at {time}",
            yesterday: "yesterday at {time}",
            date: "{date} at {time}",
            now: "now",
        },
        bot: {
            online: "Bot online",
            version: "version {version} · last contact {ago}",
            refreshEvery: "Panels refresh every 60 s",
            offlineTitle: "The bot is not responding · last contact {ago}.",
            offlineBody:
                "Panels are not refreshing and new ones will not be sent. Check that the bot is running; restart it after an update.",
            outdatedTitle: "The bot runs an older version {version}.",
            outdatedBody:
                "Discord panels need version {required} or newer. Restart the bot after updating it; while the old version runs, panels do not refresh.",
            unknownTitle: "The bot has not checked in yet.",
            unknownBody:
                "Panels do not refresh and new ones are not sent until the bot runs. Start the bot; its state appears here within 30 s.",
            notInServer:
                "The bot has not checked in on this Discord server for over 3 minutes. Check that the Logi bot is invited to the server; until it is, panels are not sent.",
        },
        sources: {
            title: "Data sources",
            link: "Game servers",
            collecting: "Collecting · last data {ago}",
            collectingNoData: "Collecting · no data yet",
            notCollecting:
                "Not collecting · turn collection on in Game servers",
            stale: "Older data · last data {ago}",
            unavailable: "Not responding · last data {ago}",
            liveOk: "Live data ✓",
            liveLimited: "live data limited right now",
            empty: "There is no game server yet. Add one in Game servers.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: discordPanelsPage_list,
        actions: {
            accepted: {
                publish:
                    "Sent for publishing. The bot picks it up within 15 s.",
                refresh:
                    "Refresh requested. The bot redraws the panel within 15 s.",
                pause: "The panel is paused. The message stays and is not refreshed.",
                resume: "The panel runs again. The bot redraws it within 15 s.",
                retry: "We try again within 15 s.",
                delete: "The message is removed from Discord within 15 s. The panel stays saved as not sent.",
                remove: "The panel is removed together with its Discord messages.",
                control:
                    "The bot redraws the Server control message within 15 s.",
            },
            failed: "The action did not work. Try again.",
            notSent: "The panel is not in Discord yet.",
            removing: "The panel is being removed.",
            notFound: "The panel no longer exists.",
        },
        editor: discordPanelsPage_editor,
    },
    discordPanelStatus: {
        states: {
            published: "Published",
            error: "Error",
            waiting: "Waiting for the bot",
            unsent: "Not sent",
            paused: "Paused",
        },
        botOnline: "Bot online",
        botVersion: "version {version} · last contact {ago}",
        refreshEvery: "Panels refresh every 60 s",
        botOffline:
            "The bot is not responding · last contact {ago}. Panels are not refreshing and new ones will not be sent. Check that the bot is running; restart it after an update.",
        botNeverSeen:
            "The bot has not checked in yet. Panels do not refresh and new ones are not sent until the bot runs.",
        botOutdated:
            "The bot runs an older version {version}. Discord panels need version {required} or newer. Restart the bot after updating; while the old version runs, panels do not refresh.",
        permissions: {
            view_channel: "View Channel",
            send_messages: "Send Messages",
            embed_links: "Embed Links",
            attach_files: "Attach Files",
            read_message_history: "Read Message History",
        },
        errors: {
            bot_not_in_server: {
                title: "The bot is not in the Discord server.",
                past: "The bot was not in the Discord server.",
                fix: "Invite the Logi bot to the server again, then click Try again.",
            },
            channel_missing: {
                title: "Channel {channel} no longer exists or the bot cannot see it.",
                past: "Channel {channel} did not exist or the bot could not see it.",
                fix: "Choose another channel in the editor and save.",
            },
            channel_type: {
                title: "Messages cannot be posted in {channel}.",
                past: "Messages could not be posted in {channel}.",
                fix: "Choose a text or announcement channel in the editor.",
            },
            missing_permissions: {
                title: "The bot lacks the {permissions} permission in {channel}.",
                past: "The bot lacked the {permissions} permission in {channel}.",
                fix: "In Discord open Edit Channel → Permissions → Logi and turn on {permissions}. Then click Try again.",
            },
            delivery_uncertain: {
                title: "Discord did not confirm whether it received the message.",
                past: "Discord did not confirm whether it received the message.",
                fix: "The bot finds the message on the next refresh or sends it again. Nothing to do.",
            },
            discord_unavailable: {
                title: "Discord is not responding right now.",
                past: "Discord did not respond in time.",
                fix: "The bot retries on its own. If it takes long, click Try again.",
            },
            source_missing: {
                title: "The panel's game server is no longer in Logi.",
                past: "The panel's game server was not in Logi.",
                fix: "Choose another server in the editor, or delete the panel.",
            },
            source_not_collecting: {
                title: "Logi is not collecting data from the game server.",
                past: "Logi was not collecting data from the game server.",
                fix: "Turn on collection in Game servers, then click Try again.",
            },
            provider_unreachable: {
                title: "The game server is not responding.",
                past: "The game server did not respond.",
                fix: "The panel shows the last data. Check the address and key in Game servers.",
            },
            provider_rate_limited: {
                title: "The data provider is refusing more requests right now.",
                past: "The data provider refused further requests.",
                fix: "The panel shows the last data and retries. If it lasts over an hour, raise the key's limit or replace it in Game servers.",
            },
            render_failed: {
                title: "The panel could not be built.",
                past: "The panel could not be built.",
                fix: "Shorten the panel's title or description. If the error persists, report it to Logi support.",
            },
            unsupported_kind: {
                title: "The bot does not support this panel kind yet.",
                past: "The bot did not support this panel kind.",
                fix: "Update the bot and restart it.",
            },
            competition_missing: {
                title: "The panel's competition no longer exists.",
                past: "The panel's competition did not exist.",
                fix: "Choose another competition in the editor, or delete the panel.",
            },
            league_disabled: {
                title: "Wardogs League is turned off in Settings, so the bot deleted the panel's messages.",
                past: "Wardogs League was turned off in Settings.",
                fix: "Turn Wardogs League on in Settings → Wardogs League; the bot then posts both messages again.",
            },
            unknown: {
                title: "The message could not be sent.",
                past: "The message could not be sent.",
                fix: "Click Try again. If the error persists, report it to Logi support.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "The channel is now public, so the password was removed from the panel. Move the panel to a private channel to show the password again.",
            live_data_unavailable:
                "Live data is unavailable right now; the panel shows the last collected data.",
            attach_files_missing:
                "The bot lacks the Attach Files permission, so the panel has no image.",
        },
    },
    discordPreview: {
        regionLabel: "Discord message preview",
        appTag: "APP",
        edited: "(edited)",
        usedCommand: "{user} used {command}",
        onlyYouCanSee: "Only you can see this",
        dismissMessage: "Dismiss message",
        buttons: "Message buttons",
        externalLink: "external link",
        unavailable: "unavailable",
        unknownUser: "user",
        unknownRole: "role",
        unknownChannel: "channel",
    },
    joinPage: {
        metaTitle: "Join {name}",
        metaDescription: "Join the game server {name}.",
        opening: "Opening {game}…",
        players: "{players} / {capacity} players",
        queue: "queue {queue}",
        steamPrompt: "Steam asks whether to open the link. Confirm Open.",
        manualTitle: "Join manually",
        addressLabel: "Server address",
        copy: "Copy",
        copied: "Copied",
        copyFailed: "Copying failed. Select the address and copy it yourself.",
        steamInstructions:
            "In Steam: View → Game Servers → Favorites → Add a server and paste the address.",
        backToDiscord: "Back to Discord",
        joinCodeTitle: "Join code",
        joinCodeLabel: "Code for joining the game",
        joinCodeHelp: "In the game, open joining a game and enter this code.",
        noAddress: "The server address is not set yet. Ask a clan admin.",
        noJoinCode: "The join code is not set yet. Ask a clan admin.",
        notFoundTitle: "Server not found",
    },
} as const
