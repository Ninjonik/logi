import type { ResolvedCommandSettings } from "./command-settings"
import { isManagerOnlyCommand } from "./permissions"
import type { LogiCommand } from "./catalog"

/** The registration copy a description needs (`clan-language/commands.ts`). */
export type CommandDescriptionCopy = {
    descriptions: Record<LogiCommand, string>
    managerSuffix: string
}

/** Discord's limit for a command description. */
export const COMMAND_DESCRIPTION_MAX = 100

/**
 * The description Discord shows after "/" (M1 1.3): the clan language's
 * text, with "(pro správce)" only for commands Logi's managers alone may use
 * (N3-B07). The "Příkazy" page shows the same text in its table (N3-23).
 */
export function describeCommand(
    copy: CommandDescriptionCopy,
    command: LogiCommand,
    settings: ResolvedCommandSettings
) {
    const suffix = isManagerOnlyCommand(command, settings)
        ? copy.managerSuffix
        : ""
    return `${copy.descriptions[command]}${suffix}`.slice(
        0,
        COMMAND_DESCRIPTION_MAX
    )
}
