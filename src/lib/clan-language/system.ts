import type { TeamRequestDmCopy } from "../../domain/discord-messages/team-request-dm"
import type { ServiceStatusCopy } from "../../domain/discord-messages/service-status"
import type { MessageKitCopy } from "../../domain/discord-messages/message-layout"
import type { BotErrorsCopy } from "../../domain/discord-messages/bot-errors"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * System copy that is not tied to one feature: the shared message kit (frame
 * footer, paging, error cards), managed-message delivery errors, the errors
 * channel, the Logi service status and the team request decisions (board
 * L5). Czech is the board's wording; bot copy says "ty" ("du").
 */
export type SystemMessages = {
    /** The team request decision DM (L5 1.3, L2-57..58). */
    teamRequests: TeamRequestDmCopy
    /** The frame words of every bot message (`message-layout.ts`). */
    kit: MessageKitCopy
    paging: { previous: string; next: string }
    errors: {
        /** Title of the unknown-error card. */
        unknownTitle: string
        unknownBody: string
        /** What a person sees when an admin must fix the cause. */
        adminNotified: string
    }
    /** Last delivery error of a managed message, shown on the dashboard. */
    publication: {
        deliveryFailed: string
        deliveryUncertain: string
    }
    /** The errors channel for admins (L5 1.1). */
    errorsChannel: BotErrorsCopy
    /** "Stav služeb Logi" and its thread "Změny stavu" (L5 1.2). */
    serviceStatus: ServiceStatusCopy
}

const systemMessages: Record<ClanLanguage, SystemMessages> = {
    en: {
        teamRequests: {
            label: "Logi team catalogue · {game}",
            approvedTitle: "The team is in the catalogue",
            mergedTitle: "The team was already in the catalogue",
            rejectedTitle: "The team request was not accepted",
            approvedChip: "Approved",
            mergedChip: "Merged",
            rejectedChip: "Rejected",
            newTeam: "new team",
            changedTeam: "team changed",
            requested: "you asked for “{name}”",
            approvedCreateBody: "You can now pick the team for matches.",
            approvedUpdateBody: "You will see the changes at your matches now.",
            mergedBody:
                "Your request joined the existing team. Pick this team for your matches.",
            kindCreate: "New team request",
            kindUpdate: "Change request",
            requestLine: "{kind} · team {name}",
            rejectedNext: "Send a corrected request in Logi → Teams.",
            openTeam: "Open the team in Logi",
            openTeams: "Open Teams in Logi",
        },
        kit: {
            updated: "Updated {time}",
            refreshEvery: "refreshes every {seconds} s",
            managed: "Managed in Logi",
            dmClan: "Clan {clan}",
            dmSettings: "Message settings",
            page: "Page {page} of {pages}",
            paused: "Paused",
            lastData: "last data {time}",
        },
        paging: { previous: "Previous", next: "Next" },
        errors: {
            unknownTitle: "That didn't work",
            unknownBody:
                "Try again in a moment. If it still fails, message the clan admins.",
            adminNotified: "The admins have been notified.",
        },
        publication: {
            deliveryFailed:
                "The message could not be delivered to Discord. Check that the bot may view the channel, send messages and read message history there. Logi retries on its own.",
            deliveryUncertain:
                "It is unclear whether the message reached Discord, so Logi does not send it again to avoid a duplicate. Check the channel and contact Logi support.",
        },
        errorsChannel: {
            label: "Bot error",
            labelWithArea: "Bot error · {area}",
            areas: {
                match: "Match",
                forum: "Event forum",
                eventRoles: "Event roles",
                scheduledEvent: "Discord event",
                memberRoles: "Member roles",
                panels: "Panels",
                reminders: "Attendance reminders",
                tickets: "Tickets",
                applications: "Applications",
                playerReports: "Player reports",
            },
            titles: {
                announcement: "The match announcement was not sent",
                roster: "The roster was not published",
                forumCreate: "The match forum could not be created",
                forumUpdate: "The match forum could not be updated",
                forumAccess: "Players could not be given access to the forum",
                eventRoles: "The roles for the match players could not be set",
                scheduledEventCreate: "The Discord event could not be created",
                scheduledEventUpdate: "The Discord event could not be updated",
                scheduledEventCancel:
                    "The Discord event could not be cancelled",
                adminAccess: "Admin access could not be read",
                ticketPanel: "The ticket panel was not updated",
                applicationPanel: "The application panel was not updated",
                calendarPanel: "The calendar was not updated",
                publicPanel: "The panel was not updated",
                attendanceReminders: "The attendance reminders were not sent",
                ticketOpen: "The ticket did not open",
                ticketSupport: "Support could not be added to the ticket",
                ticketIntro: "The ticket intro was not sent",
                ticketRename: "The ticket could not be renamed",
                applicationOpen: "The application did not open",
                applicationRecruiters:
                    "Recruiters could not be added to the application",
                applicationIntro: "The application intro was not sent",
                applicationRename: "The application could not be renamed",
                playerReport: "The player report did not open",
                general: "The bot could not finish an action",
            },
            memberRolesTitle: {
                one: "The roles of {count} member could not be changed",
                other: "The roles of {count} members could not be changed",
            },
            reasonHeading: "Why",
            fixHeading: "What to do",
            retry: {
                afterFix: "Retries after the fix",
                byItself: "Retries by itself",
                playerTold: "The player was told to try later",
            },
            reasons: {
                missingPermission:
                    "The bot is missing the {permissions} permission in the channel {channel}.",
                missingPermissionServer:
                    "The Logi role is missing the {permissions} permission on the server.",
                missingPermissionUnknown:
                    "The bot is missing a permission it needs.",
                privateThreads:
                    "The bot cannot create private threads in the channel {channel}.",
                missingAccess: "The bot cannot see the channel {channel}.",
                unknownChannel:
                    "The channel {channel} no longer exists on the server.",
                unknownRole: "The role {role} no longer exists.",
                roleAbove:
                    "The role {role} is above the Logi role in the role list, so the bot cannot add or remove it.",
                fullCategory:
                    "The category {category} already has 50 channels; Discord allows no more in one category.",
                fullServer:
                    "The server already has 500 channels; Discord allows no more.",
                timeout: "Discord did not answer in time.",
                other: "Discord refused the action.",
            },
            fixes: {
                missingPermissionSync:
                    "In Discord, open {channel} → Edit Channel → Permissions → Logi and allow {permissions}.",
                missingPermissionInteraction:
                    "Allow the Logi role {permissions} in {channel}.",
                missingPermissionServer:
                    "In Discord → Server Settings → Roles → Logi, allow {permissions}.",
                missingPermissionGeneric:
                    "Allow the Logi role {permissions} in the channel settings.",
                missingPermissionUnknown:
                    "Check the Logi role's permissions in the channel and in the server settings.",
                missingAccess:
                    "Add the Logi role to the channel, or pick another channel in Logi.",
                unknownChannel:
                    "Pick a new channel in Logi → Channels and language.",
                unknownRole: "Pick another role in Logi → Roles and access.",
                roleAbove:
                    "In Discord → Server Settings → Roles, drag the Logi role above {role}.",
                fullCategoryForum:
                    "Delete the channels of old events, or pick another category for forums in Logi → Channels and language.",
                fullCategory: "Delete old channels, or pick another category.",
                fullServer: "Delete old channels on the server.",
                timeoutSync:
                    "Nothing. The bot tries again at the next sync. If this keeps coming for more than an hour, contact Logi support.",
                timeoutInteraction:
                    "Nothing, the player can try again. If it keeps happening for more than an hour, contact Logi support.",
                other: "Try again. If it keeps happening, contact Logi support and send the time of the error.",
            },
            followUps: {
                announcement:
                    "The announcement goes out by itself at the next sync, within 5 minutes.",
                roster: "The roster is published by itself at the next sync, within 5 minutes.",
                forum: "The forum is completed by itself at the next sync, within 5 minutes.",
                eventRoles: "The roles are set at the next sync.",
                scheduledEvent:
                    "The event is updated by itself at the next sync.",
                memberRoles: "The roles are filled in at the next sync.",
                panel: "The panel refreshes by itself at the next sync.",
                reminders: "The next reminder goes out as planned.",
                ticket: "Then tell the player to open the ticket again.",
                application:
                    "Then tell the applicant to send the application again.",
                playerReport: "Then tell the player to report again.",
            },
            context: {
                channel: "Channel {channel}",
                category: "Category {category}",
                role: "Role {role}",
                meetingChannel: "meeting channel {channel}",
                tried: "tried by {user}",
                applicant: "applicant {user}",
                ticketNumber: "ticket #{number}",
                applicationNumber: "application #{number}",
                moreMembers: "and {count} more",
                players: { one: "{count} player", other: "{count} players" },
            },
            unnamed: {
                channel: "set in Logi",
                category: "set in Logi",
                role: "set in Logi",
            },
            and: "and",
            links: {
                match: "Open match",
                channels: "Channels in Logi",
                tickets: "Tickets in Logi",
                roles: "Roles and access in Logi",
                membership: "Membership in Logi",
            },
            permissions: {
                ViewChannel: "View Channel",
                SendMessages: "Send Messages",
                SendMessagesInThreads: "Send Messages in Threads",
                EmbedLinks: "Embed Links",
                AttachFiles: "Attach Files",
                ReadMessageHistory: "Read Message History",
                ManageChannels: "Manage Channels",
                ManageRoles: "Manage Roles",
                ManageThreads: "Manage Threads",
                ManageMessages: "Manage Messages",
                CreatePublicThreads: "Create Public Threads",
                CreatePrivateThreads: "Create Private Threads",
                ManageEvents: "Manage Events",
                Connect: "Connect",
            },
        },
        serviceStatus: {
            label: "Logi services",
            allRunning: "Everything is running",
            oneDown: "{service} is down",
            manyDown: "{services} are down",
            unknownTitle: "We don't know the status right now",
            unknownChip: "Monitoring is not answering",
            unknownBody:
                "The services may be running normally. The status shows up as soon as monitoring answers again.",
            checked: "Checked every {seconds} s · last today at {time}",
            up: "Running",
            down: "Unavailable",
            threadNote: "Status changes are in the thread",
            threadName: "Status changes",
            changeDownTitle: "{service} is down",
            changeDownBody: "The outage started at {time}.",
            changeUpTitle: "{service} is running again",
            changeUpBody: "The outage lasted {duration}.",
            changeUpBodyUnknown: "We don't know how long the outage lasted.",
            duration: {
                lessThanMinute: "less than a minute",
                minutes: { one: "{count} minute", other: "{count} minutes" },
                hours: { one: "{count} hour", other: "{count} hours" },
                days: { one: "{count} day", other: "{count} days" },
                pair: "{first} and {second}",
            },
            and: "and",
        },
    },
    cs: {
        teamRequests: {
            label: "Katalog týmů Logi · {game}",
            approvedTitle: "Tým je v katalogu",
            mergedTitle: "Tým už v katalogu byl",
            rejectedTitle: "Žádost o tým nebyla přijata",
            approvedChip: "Schváleno",
            mergedChip: "Sloučeno",
            rejectedChip: "Zamítnuto",
            newTeam: "nový tým",
            changedTeam: "změna týmu",
            requested: "žádal(a) jsi „{name}“",
            approvedCreateBody: "Tým teď můžeš vybrat u zápasů.",
            approvedUpdateBody: "Změny týmu teď uvidíš u zápasů.",
            mergedBody:
                "Tvoje žádost se připojila k existujícímu týmu. U zápasů vyber tento tým.",
            kindCreate: "Žádost o nový tým",
            kindUpdate: "Žádost o změnu",
            requestLine: "{kind} · tým {name}",
            rejectedNext: "Opravenou žádost pošleš v Logi → Týmy.",
            openTeam: "Otevřít tým v Logi",
            openTeams: "Otevřít Týmy v Logi",
        },
        kit: {
            updated: "Aktualizováno {time}",
            refreshEvery: "obnovuje se každých {seconds} s",
            managed: "Spravováno v Logi",
            dmClan: "Klan {clan}",
            dmSettings: "Nastavit zprávy",
            page: "Strana {page} z {pages}",
            paused: "Pozastaveno",
            lastData: "poslední data {time}",
        },
        paging: { previous: "Předchozí", next: "Další" },
        errors: {
            unknownTitle: "Tohle se nepovedlo",
            unknownBody:
                "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu.",
            adminNotified: "Správci dostali upozornění.",
        },
        publication: {
            deliveryFailed:
                "Zprávu se nepodařilo doručit do Discordu. Zkontrolujte, že bot smí v kanálu zobrazit kanál, posílat zprávy a číst historii. Logi to zkusí znovu samo.",
            deliveryUncertain:
                "Není jisté, jestli zpráva do Discordu dorazila, proto ji Logi znovu neposílá, aby v kanálu nebyla dvakrát. Zkontrolujte kanál a kontaktujte podporu Logi.",
        },
        errorsChannel: {
            label: "Chyba bota",
            labelWithArea: "Chyba bota · {area}",
            areas: {
                match: "Zápas",
                forum: "Fórum akce",
                eventRoles: "Role akce",
                scheduledEvent: "Událost na Discordu",
                memberRoles: "Role členů",
                panels: "Panely",
                reminders: "Připomínky docházky",
                tickets: "Tickety",
                applications: "Přihlášky",
                playerReports: "Nahlášení hráče",
            },
            titles: {
                announcement: "Ohlášení zápasu se neodeslalo",
                roster: "Soupiska se nezveřejnila",
                forumCreate: "Fórum zápasu se nepodařilo založit",
                forumUpdate: "Fórum zápasu se nepodařilo upravit",
                forumAccess: "Hráčům se nepodařilo dát přístup do fóra",
                eventRoles: "Role pro účastníky zápasu se nepodařilo nastavit",
                scheduledEventCreate:
                    "Událost na Discordu se nepodařilo vytvořit",
                scheduledEventUpdate:
                    "Událost na Discordu se nepodařilo upravit",
                scheduledEventCancel:
                    "Událost na Discordu se nepodařilo zrušit",
                adminAccess: "Přístup správců se nepodařilo načíst",
                ticketPanel: "Panel ticketů se neaktualizoval",
                applicationPanel: "Panel přihlášek se neaktualizoval",
                calendarPanel: "Kalendář se neaktualizoval",
                publicPanel: "Panel se neaktualizoval",
                attendanceReminders: "Připomínky docházky se neodeslaly",
                ticketOpen: "Ticket se neotevřel",
                ticketSupport: "Do ticketu se nepodařilo přidat podporu",
                ticketIntro: "Úvod ticketu se neodeslal",
                ticketRename: "Ticket se nepodařilo přejmenovat",
                applicationOpen: "Přihláška se neotevřela",
                applicationRecruiters:
                    "Do přihlášky se nepodařilo přidat nábor",
                applicationIntro: "Úvod přihlášky se neodeslal",
                applicationRename: "Přihlášku se nepodařilo přejmenovat",
                playerReport: "Nahlášení hráče se neotevřelo",
                general: "Bot nemohl dokončit akci",
            },
            memberRolesTitle: {
                one: "Role se {count} členovi nepodařilo upravit",
                few: "Role se {count} členům nepodařilo upravit",
                many: "Role se {count} členům nepodařilo upravit",
                other: "Role se {count} členům nepodařilo upravit",
            },
            reasonHeading: "Proč",
            fixHeading: "Co udělat",
            retry: {
                afterFix: "Zkusí se znovu po opravě",
                byItself: "Zkusí se znovu sám",
                playerTold: "Hráč dostal zprávu, ať to zkusí později",
            },
            reasons: {
                missingPermission:
                    "Bot nemá v kanálu {channel} oprávnění {permissions}.",
                missingPermissionServer:
                    "Role Logi nemá na serveru oprávnění {permissions}.",
                missingPermissionUnknown: "Bot nemá potřebné oprávnění.",
                privateThreads:
                    "Bot nemůže v kanálu {channel} zakládat soukromá vlákna.",
                missingAccess: "Bot do kanálu {channel} nevidí.",
                unknownChannel: "Kanál {channel} už na serveru není.",
                unknownRole: "Role {role} už neexistuje.",
                roleAbove:
                    "Role {role} je v seznamu rolí výš než role Logi, takže ji bot nemůže přidávat ani brát.",
                fullCategory:
                    "Kategorie {category} už má 50 kanálů, víc Discord do jedné kategorie nedovolí.",
                fullServer: "Na serveru je 500 kanálů, víc Discord nedovolí.",
                timeout: "Discord neodpověděl včas.",
                other: "Discord akci odmítl.",
            },
            fixes: {
                missingPermissionSync:
                    "V Discordu otevři {channel} → Upravit kanál → Oprávnění → Logi a povol {permissions}.",
                missingPermissionInteraction:
                    "Povol roli Logi v {channel} oprávnění {permissions}.",
                missingPermissionServer:
                    "V Discordu → Nastavení serveru → Role → Logi povol {permissions}.",
                missingPermissionGeneric:
                    "Povol roli Logi oprávnění {permissions} v nastavení kanálu.",
                missingPermissionUnknown:
                    "Zkontroluj oprávnění role Logi v kanálu i v nastavení serveru.",
                missingAccess:
                    "Přidej roli Logi do kanálu, nebo vyber jiný kanál v Logi.",
                unknownChannel: "Vyber nový kanál v Logi → Kanály a jazyk.",
                unknownRole: "Vyber jinou roli v Logi → Role a přístup.",
                roleAbove:
                    "V Discordu → Nastavení serveru → Role přetáhni roli Logi nad {role}.",
                fullCategoryForum:
                    "Smaž kanály starých akcí, nebo vyber jinou kategorii pro fóra v Logi → Kanály a jazyk.",
                fullCategory: "Smaž staré kanály, nebo vyber jinou kategorii.",
                fullServer: "Smaž staré kanály na serveru.",
                timeoutSync:
                    "Nic. Bot to zkusí znovu při další synchronizaci. Když se zpráva opakuje déle než hodinu, napiš podpoře Logi.",
                timeoutInteraction:
                    "Nic, hráč to může zkusit znovu. Když se to opakuje přes hodinu, napiš podpoře Logi.",
                other: "Zkus to znovu. Když se to opakuje, napiš podpoře Logi a pošli čas chyby.",
            },
            followUps: {
                announcement:
                    "Ohlášení se pošle samo při další synchronizaci, do 5 minut.",
                roster: "Soupiska se zveřejní sama při další synchronizaci, do 5 minut.",
                forum: "Fórum se doplní samo při další synchronizaci, do 5 minut.",
                eventRoles: "Role se nastaví při další synchronizaci.",
                scheduledEvent:
                    "Událost se upraví sama při další synchronizaci.",
                memberRoles: "Role se doplní při další synchronizaci.",
                panel: "Panel se obnoví sám při další synchronizaci.",
                reminders: "Další připomínka se pošle podle plánu.",
                ticket: "Pak hráči napiš, ať ticket otevře znovu.",
                application: "Pak uchazeči napiš, ať přihlášku podá znovu.",
                playerReport: "Pak hráči napiš, ať hráče nahlásí znovu.",
            },
            context: {
                channel: "Kanál {channel}",
                category: "Kategorie {category}",
                role: "Role {role}",
                meetingChannel: "kanál srazu {channel}",
                tried: "zkoušel {user}",
                applicant: "uchazeč {user}",
                ticketNumber: "ticket #{number}",
                applicationNumber: "přihláška #{number}",
                moreMembers: "a další {count}",
                players: {
                    one: "{count} hráč",
                    few: "{count} hráči",
                    many: "{count} hráče",
                    other: "{count} hráčů",
                },
            },
            unnamed: {
                channel: "z nastavení Logi",
                category: "z nastavení Logi",
                role: "z nastavení Logi",
            },
            and: "a",
            links: {
                match: "Otevřít zápas",
                channels: "Kanály v Logi",
                tickets: "Tickety v Logi",
                roles: "Role a přístup v Logi",
                membership: "Členství v Logi",
            },
            permissions: {
                ViewChannel: "Zobrazit kanál",
                SendMessages: "Posílat zprávy",
                SendMessagesInThreads: "Posílat zprávy ve vláknech",
                EmbedLinks: "Vkládat odkazy",
                AttachFiles: "Přikládat soubory",
                ReadMessageHistory: "Číst historii zpráv",
                ManageChannels: "Spravovat kanály",
                ManageRoles: "Spravovat role",
                ManageThreads: "Spravovat vlákna",
                ManageMessages: "Spravovat zprávy",
                CreatePublicThreads: "Vytvářet veřejná vlákna",
                CreatePrivateThreads: "Vytvářet soukromá vlákna",
                ManageEvents: "Spravovat události",
                Connect: "Připojit se",
            },
        },
        serviceStatus: {
            label: "Služby Logi",
            allRunning: "Všechno běží",
            oneDown: "{service} nefunguje",
            manyDown: "{services} nefungují",
            unknownTitle: "Stav teď neznáme",
            unknownChip: "Monitoring neodpovídá",
            unknownBody:
                "Služby můžou běžet normálně. Stav se ukáže, jakmile monitoring zase odpoví.",
            checked: "Kontrola každých {seconds} s · naposledy dnes v {time}",
            up: "V provozu",
            down: "Nedostupné",
            threadNote: "Změny stavu jsou ve vlákně",
            threadName: "Změny stavu",
            changeDownTitle: "{service} nefunguje",
            changeDownBody: "Výpadek začal v {time}.",
            changeUpTitle: "{service} zase běží",
            changeUpBody: "Výpadek trval {duration}.",
            changeUpBodyUnknown: "Jak dlouho výpadek trval, nevíme.",
            duration: {
                lessThanMinute: "méně než minutu",
                minutes: {
                    one: "{count} minutu",
                    few: "{count} minuty",
                    many: "{count} minuty",
                    other: "{count} minut",
                },
                hours: {
                    one: "{count} hodinu",
                    few: "{count} hodiny",
                    many: "{count} hodiny",
                    other: "{count} hodin",
                },
                days: {
                    one: "{count} den",
                    few: "{count} dny",
                    many: "{count} dne",
                    other: "{count} dní",
                },
                pair: "{first} a {second}",
            },
            and: "a",
        },
    },
    de: {
        teamRequests: {
            label: "Logi-Teamkatalog · {game}",
            approvedTitle: "Das Team ist im Katalog",
            mergedTitle: "Das Team war schon im Katalog",
            rejectedTitle: "Die Teamanfrage wurde nicht angenommen",
            approvedChip: "Genehmigt",
            mergedChip: "Zusammengeführt",
            rejectedChip: "Abgelehnt",
            newTeam: "neues Team",
            changedTeam: "Team geändert",
            requested: "du hast „{name}“ angefragt",
            approvedCreateBody: "Du kannst das Team jetzt bei Matches wählen.",
            approvedUpdateBody:
                "Die Änderungen siehst du jetzt bei deinen Matches.",
            mergedBody:
                "Deine Anfrage wurde dem bestehenden Team zugeordnet. Wähl dieses Team bei deinen Matches.",
            kindCreate: "Anfrage für ein neues Team",
            kindUpdate: "Änderungsanfrage",
            requestLine: "{kind} · Team {name}",
            rejectedNext:
                "Eine korrigierte Anfrage schickst du in Logi → Teams.",
            openTeam: "Team in Logi öffnen",
            openTeams: "Teams in Logi öffnen",
        },
        kit: {
            updated: "Aktualisiert {time}",
            refreshEvery: "wird alle {seconds} s aktualisiert",
            managed: "Verwaltet in Logi",
            dmClan: "Clan {clan}",
            dmSettings: "Nachrichten einstellen",
            page: "Seite {page} von {pages}",
            paused: "Pausiert",
            lastData: "letzte Daten {time}",
        },
        paging: { previous: "Zurück", next: "Weiter" },
        errors: {
            unknownTitle: "Das hat nicht geklappt",
            unknownBody:
                "Versuch es gleich noch einmal. Wenn es weiter nicht klappt, schreib den Clan-Admins.",
            adminNotified: "Die Admins wurden benachrichtigt.",
        },
        publication: {
            deliveryFailed:
                "Die Nachricht konnte nicht an Discord zugestellt werden. Prüfen Sie, ob der Bot den Kanal sehen, dort Nachrichten senden und den Verlauf lesen darf. Logi versucht es selbst erneut.",
            deliveryUncertain:
                "Es ist unklar, ob die Nachricht bei Discord angekommen ist. Logi sendet sie deshalb nicht erneut, damit sie nicht doppelt erscheint. Prüfen Sie den Kanal und wenden Sie sich an den Logi-Support.",
        },
        errorsChannel: {
            label: "Bot-Fehler",
            labelWithArea: "Bot-Fehler · {area}",
            areas: {
                match: "Match",
                forum: "Event-Forum",
                eventRoles: "Event-Rollen",
                scheduledEvent: "Discord-Event",
                memberRoles: "Mitgliederrollen",
                panels: "Panels",
                reminders: "Anwesenheitserinnerungen",
                tickets: "Tickets",
                applications: "Bewerbungen",
                playerReports: "Spielermeldungen",
            },
            titles: {
                announcement: "Die Match-Ankündigung wurde nicht gesendet",
                roster: "Der Kader wurde nicht veröffentlicht",
                forumCreate: "Das Match-Forum konnte nicht angelegt werden",
                forumUpdate: "Das Match-Forum konnte nicht bearbeitet werden",
                forumAccess:
                    "Die Spieler konnten keinen Zugang zum Forum bekommen",
                eventRoles:
                    "Die Rollen für die Match-Teilnehmer konnten nicht gesetzt werden",
                scheduledEventCreate:
                    "Das Discord-Event konnte nicht erstellt werden",
                scheduledEventUpdate:
                    "Das Discord-Event konnte nicht bearbeitet werden",
                scheduledEventCancel:
                    "Das Discord-Event konnte nicht abgesagt werden",
                adminAccess: "Der Admin-Zugang konnte nicht gelesen werden",
                ticketPanel: "Das Ticket-Panel wurde nicht aktualisiert",
                applicationPanel:
                    "Das Bewerbungs-Panel wurde nicht aktualisiert",
                calendarPanel: "Der Kalender wurde nicht aktualisiert",
                publicPanel: "Das Panel wurde nicht aktualisiert",
                attendanceReminders:
                    "Die Anwesenheitserinnerungen wurden nicht gesendet",
                ticketOpen: "Das Ticket hat sich nicht geöffnet",
                ticketSupport:
                    "Der Support konnte nicht zum Ticket hinzugefügt werden",
                ticketIntro: "Die Ticket-Einleitung wurde nicht gesendet",
                ticketRename: "Das Ticket konnte nicht umbenannt werden",
                applicationOpen: "Die Bewerbung hat sich nicht geöffnet",
                applicationRecruiters:
                    "Das Recruiting konnte nicht zur Bewerbung hinzugefügt werden",
                applicationIntro:
                    "Die Bewerbungs-Einleitung wurde nicht gesendet",
                applicationRename:
                    "Die Bewerbung konnte nicht umbenannt werden",
                playerReport: "Die Spielermeldung hat sich nicht geöffnet",
                general: "Der Bot konnte eine Aktion nicht abschließen",
            },
            memberRolesTitle: {
                one: "Die Rollen von {count} Mitglied konnten nicht geändert werden",
                other: "Die Rollen von {count} Mitgliedern konnten nicht geändert werden",
            },
            reasonHeading: "Warum",
            fixHeading: "Was tun",
            retry: {
                afterFix: "Neuer Versuch nach der Korrektur",
                byItself: "Versucht es selbst erneut",
                playerTold: "Der Spieler soll es später erneut versuchen",
            },
            reasons: {
                missingPermission:
                    "Dem Bot fehlt im Kanal {channel} die Berechtigung {permissions}.",
                missingPermissionServer:
                    "Der Logi-Rolle fehlt auf dem Server die Berechtigung {permissions}.",
                missingPermissionUnknown:
                    "Dem Bot fehlt eine nötige Berechtigung.",
                privateThreads:
                    "Der Bot kann im Kanal {channel} keine privaten Threads erstellen.",
                missingAccess: "Der Bot sieht den Kanal {channel} nicht.",
                unknownChannel:
                    "Den Kanal {channel} gibt es auf dem Server nicht mehr.",
                unknownRole: "Die Rolle {role} gibt es nicht mehr.",
                roleAbove:
                    "Die Rolle {role} steht in der Rollenliste über der Logi-Rolle, deshalb kann der Bot sie weder vergeben noch entfernen.",
                fullCategory:
                    "Die Kategorie {category} hat schon 50 Kanäle, mehr erlaubt Discord in einer Kategorie nicht.",
                fullServer:
                    "Der Server hat schon 500 Kanäle, mehr erlaubt Discord nicht.",
                timeout: "Discord hat nicht rechtzeitig geantwortet.",
                other: "Discord hat die Aktion abgelehnt.",
            },
            fixes: {
                missingPermissionSync:
                    "Öffne in Discord {channel} → Kanal bearbeiten → Berechtigungen → Logi und erlaube {permissions}.",
                missingPermissionInteraction:
                    "Erlaube der Logi-Rolle in {channel} die Berechtigung {permissions}.",
                missingPermissionServer:
                    "Erlaube in Discord → Servereinstellungen → Rollen → Logi die Berechtigung {permissions}.",
                missingPermissionGeneric:
                    "Erlaube der Logi-Rolle in den Kanaleinstellungen die Berechtigung {permissions}.",
                missingPermissionUnknown:
                    "Prüf die Berechtigungen der Logi-Rolle im Kanal und in den Servereinstellungen.",
                missingAccess:
                    "Füg die Logi-Rolle zum Kanal hinzu oder wähl in Logi einen anderen Kanal.",
                unknownChannel:
                    "Wähl in Logi → Kanäle und Sprache einen neuen Kanal.",
                unknownRole:
                    "Wähl in Logi → Rollen und Zugriff eine andere Rolle.",
                roleAbove:
                    "Zieh in Discord → Servereinstellungen → Rollen die Logi-Rolle über {role}.",
                fullCategoryForum:
                    "Lösch die Kanäle alter Events oder wähl in Logi → Kanäle und Sprache eine andere Kategorie für Foren.",
                fullCategory:
                    "Lösch alte Kanäle oder wähl eine andere Kategorie.",
                fullServer: "Lösch alte Kanäle auf dem Server.",
                timeoutSync:
                    "Nichts. Der Bot versucht es bei der nächsten Synchronisierung erneut. Wenn die Meldung länger als eine Stunde wiederkommt, schreib dem Logi-Support.",
                timeoutInteraction:
                    "Nichts, der Spieler kann es erneut versuchen. Wenn es länger als eine Stunde passiert, schreib dem Logi-Support.",
                other: "Versuch es erneut. Wenn es wieder passiert, schreib dem Logi-Support und schick die Uhrzeit des Fehlers.",
            },
            followUps: {
                announcement:
                    "Die Ankündigung geht bei der nächsten Synchronisierung von selbst raus, innerhalb von 5 Minuten.",
                roster: "Der Kader wird bei der nächsten Synchronisierung von selbst veröffentlicht, innerhalb von 5 Minuten.",
                forum: "Das Forum wird bei der nächsten Synchronisierung von selbst ergänzt, innerhalb von 5 Minuten.",
                eventRoles:
                    "Die Rollen werden bei der nächsten Synchronisierung gesetzt.",
                scheduledEvent:
                    "Das Event wird bei der nächsten Synchronisierung von selbst aktualisiert.",
                memberRoles:
                    "Die Rollen werden bei der nächsten Synchronisierung ergänzt.",
                panel: "Das Panel wird bei der nächsten Synchronisierung von selbst aktualisiert.",
                reminders: "Die nächste Erinnerung geht wie geplant raus.",
                ticket: "Sag dem Spieler dann, dass er das Ticket erneut öffnen soll.",
                application:
                    "Sag dem Bewerber dann, dass er die Bewerbung erneut abschicken soll.",
                playerReport:
                    "Sag dem Spieler dann, dass er die Meldung erneut abschicken soll.",
            },
            context: {
                channel: "Kanal {channel}",
                category: "Kategorie {category}",
                role: "Rolle {role}",
                meetingChannel: "Treffpunkt {channel}",
                tried: "versucht von {user}",
                applicant: "Bewerber {user}",
                ticketNumber: "Ticket #{number}",
                applicationNumber: "Bewerbung #{number}",
                moreMembers: "und {count} weitere",
                players: { one: "{count} Spieler", other: "{count} Spieler" },
            },
            unnamed: {
                channel: "aus den Logi-Einstellungen",
                category: "aus den Logi-Einstellungen",
                role: "aus den Logi-Einstellungen",
            },
            and: "und",
            links: {
                match: "Match öffnen",
                channels: "Kanäle in Logi",
                tickets: "Tickets in Logi",
                roles: "Rollen und Zugriff in Logi",
                membership: "Mitgliedschaft in Logi",
            },
            permissions: {
                ViewChannel: "Kanal ansehen",
                SendMessages: "Nachrichten senden",
                SendMessagesInThreads: "Nachrichten in Threads senden",
                EmbedLinks: "Links einbetten",
                AttachFiles: "Dateien anhängen",
                ReadMessageHistory: "Nachrichtenverlauf anzeigen",
                ManageChannels: "Kanäle verwalten",
                ManageRoles: "Rollen verwalten",
                ManageThreads: "Threads verwalten",
                ManageMessages: "Nachrichten verwalten",
                CreatePublicThreads: "Öffentliche Threads erstellen",
                CreatePrivateThreads: "Private Threads erstellen",
                ManageEvents: "Events verwalten",
                Connect: "Verbinden",
            },
        },
        serviceStatus: {
            label: "Logi-Dienste",
            allRunning: "Alles läuft",
            oneDown: "{service} funktioniert nicht",
            manyDown: "{services} funktionieren nicht",
            unknownTitle: "Den Status kennen wir gerade nicht",
            unknownChip: "Monitoring antwortet nicht",
            unknownBody:
                "Die Dienste können normal laufen. Der Status erscheint, sobald das Monitoring wieder antwortet.",
            checked: "Prüfung alle {seconds} s · zuletzt heute um {time}",
            up: "In Betrieb",
            down: "Nicht verfügbar",
            threadNote: "Statusänderungen stehen im Thread",
            threadName: "Statusänderungen",
            changeDownTitle: "{service} funktioniert nicht",
            changeDownBody: "Der Ausfall begann um {time}.",
            changeUpTitle: "{service} läuft wieder",
            changeUpBody: "Der Ausfall dauerte {duration}.",
            changeUpBodyUnknown:
                "Wie lange der Ausfall dauerte, wissen wir nicht.",
            duration: {
                lessThanMinute: "weniger als eine Minute",
                minutes: { one: "{count} Minute", other: "{count} Minuten" },
                hours: { one: "{count} Stunde", other: "{count} Stunden" },
                days: { one: "{count} Tag", other: "{count} Tage" },
                pair: "{first} und {second}",
            },
            and: "und",
        },
    },
}

/** The system copy in the clan language; unknown languages read English. */
export const getSystemMessages = clanCopy(systemMessages)
