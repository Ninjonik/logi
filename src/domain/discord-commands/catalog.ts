/**
 * Logi's slash commands (design boards M1 and N3): the eight commands, which
 * of them a clan can configure, who may use each one by design and where it
 * replies. Names are English and identical in every language; descriptions
 * and options follow the clan language (`src/lib/clan-language/commands.ts`).
 */

/** Every command Logi registers, in the order the "/" menu lists them. */
export const LOGI_COMMANDS = [
    "close_application",
    "close_ticket",
    "help",
    "link",
    "notice",
    "player",
    "server-status",
    "stats",
] as const
export type LogiCommand = (typeof LOGI_COMMANDS)[number]

/** Commands a clan switches and restricts on the "Příkazy" page (N3). */
export const CONFIGURABLE_COMMANDS = [
    "help",
    "stats",
    "player",
    "link",
    "notice",
    "server-status",
] as const
export type ConfigurableCommand = (typeof CONFIGURABLE_COMMANDS)[number]

/**
 * The close commands follow the Tickety and Členství switches and are not
 * configured separately (N3-B06).
 */
export const CLOSE_COMMANDS = ["close_ticket", "close_application"] as const
export type CloseCommand = (typeof CLOSE_COMMANDS)[number]

/** The "Pro členy" rows of the N3 page and the member part of `/help`. */
export const MEMBER_COMMANDS = [
    "help",
    "stats",
    "player",
    "link",
    "notice",
] as const satisfies readonly ConfigurableCommand[]

/** The "Pro správce" rows of the N3 page and the staff part of `/help`. */
export const STAFF_COMMANDS = [
    "server-status",
    "close_ticket",
    "close_application",
] as const satisfies readonly LogiCommand[]

/** Commands that are new in this design and carry the "Nový" chip. */
export const NEW_COMMANDS: ReadonlySet<LogiCommand> = new Set(["help"])

/**
 * Who may use a command (M1 1.2): every member of the Discord server, the
 * clan's members (the clan role from Role a přístup) or Logi's managers
 * (Discord Administrator or the Logi admin role, the same group as on the
 * web). Extra roles can be added on top (N3-15).
 */
export const COMMAND_AUDIENCES = [
    "everyone",
    "clanMembers",
    "logiAdmins",
] as const
export type CommandAudience = (typeof COMMAND_AUDIENCES)[number]

/**
 * Where a reply lands: only the author, or only the author with a "Sdílet"
 * button that posts the card to a channel.
 */
export const COMMAND_REPLY_MODES = ["private", "privateShare"] as const
export type CommandReplyMode = (typeof COMMAND_REPLY_MODES)[number]

/** What the N3 page lets a clan change for each configurable command. */
export const COMMAND_CAPABILITIES: Record<
    ConfigurableCommand,
    {
        /** The "Kdo smí použít" select; otherwise a fixed text. */
        audience: readonly CommandAudience[] | null
        /** The "Odpověď" select; otherwise a fixed text. */
        reply: readonly CommandReplyMode[] | null
    }
> = {
    help: { audience: null, reply: null },
    stats: { audience: COMMAND_AUDIENCES, reply: COMMAND_REPLY_MODES },
    player: { audience: COMMAND_AUDIENCES, reply: COMMAND_REPLY_MODES },
    link: { audience: null, reply: null },
    notice: { audience: null, reply: null },
    "server-status": { audience: COMMAND_AUDIENCES, reply: ["private"] },
}

/** The storage key of a configurable command (Convex field names avoid "-"). */
export const COMMAND_SETTINGS_KEYS = {
    help: "help",
    stats: "stats",
    player: "player",
    link: "link",
    notice: "notice",
    "server-status": "serverStatus",
} as const satisfies Record<ConfigurableCommand, string>
export type CommandSettingsKey =
    (typeof COMMAND_SETTINGS_KEYS)[ConfigurableCommand]

export function isLogiCommand(value: string): value is LogiCommand {
    return (LOGI_COMMANDS as readonly string[]).includes(value)
}

export function isConfigurableCommand(
    value: string
): value is ConfigurableCommand {
    return (CONFIGURABLE_COMMANDS as readonly string[]).includes(value)
}

/** The option keys of every command; option names are localised per clan. */
export const COMMAND_OPTION_KEYS = {
    stats: ["game", "member", "player", "period", "server", "channel"],
    player: ["player"],
    notice: ["event"],
    close_ticket: ["reason"],
    close_application: ["outcome", "reason"],
    "server-status": ["game"],
    help: [],
    link: [],
} as const satisfies Record<LogiCommand, readonly string[]>

/** The longest reason text the close commands accept (M1-B11). */
export const COMMAND_REASON_MAX_LENGTH = 500

/** `/server-status` shows at most this many servers (M1-B09). */
export const SERVER_STATUS_LIMIT = 5
