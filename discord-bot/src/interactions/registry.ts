/**
 * The interaction handler registry. A feature module routes its own slash
 * commands, autocomplete, buttons, select menus and modals by registering
 * them here, instead of editing the dispatch block in `interactions.ts`:
 *
 *     export const seedInteractions: InteractionFeature = {
 *         name: "seed",
 *         register(registry, context) {
 *             registry.button("seed:", (interaction) => handleSeedButton(interaction, context))
 *         },
 *     }
 *
 * and appending it to `interactionFeatures` (`features.ts`). Registered routes
 * win; everything else falls through to the existing dispatch unchanged. A
 * handler that throws ends in the private "Tohle se nepovedlo" card through
 * {@link runInteraction}.
 */

import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    Interaction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from "discord.js"

import { interactionLanguage, replyUnknownError } from "../ui/replies"
import { logError, logWarn } from "../log"

type Handler<T> = (interaction: T) => Promise<unknown> | unknown

/** What feature handlers may need from the bot runtime. */
export type InteractionFeatureContext = {
    enqueueEventSync: (eventId: string) => void
    triggerPollSoon: () => void
}

/** One feature's routes, wired once in `features.ts`. */
export type InteractionFeature = {
    name: string
    register(
        registry: InteractionRegistry,
        context: InteractionFeatureContext
    ): void
}

const COMMAND_NAME = /^[-_\p{Ll}\p{Lo}\p{N}]{1,32}$/u

type PrefixKind = "button" | "stringSelect" | "channelSelect" | "modal"

export class InteractionRegistry {
    private readonly commands = new Map<
        string,
        Handler<ChatInputCommandInteraction>
    >()
    private readonly autocompletes = new Map<
        string,
        Handler<AutocompleteInteraction>
    >()
    private readonly prefixes = {
        button: new Map<string, Handler<ButtonInteraction>>(),
        stringSelect: new Map<string, Handler<StringSelectMenuInteraction>>(),
        channelSelect: new Map<string, Handler<ChannelSelectMenuInteraction>>(),
        modal: new Map<string, Handler<ModalSubmitInteraction>>(),
    }

    /** A slash command by its name, e.g. `help`. */
    command(name: string, handler: Handler<ChatInputCommandInteraction>) {
        this.addName(this.commands, "command", name, handler)
        return this
    }

    /** Autocomplete of a slash command's options, by the command's name. */
    autocomplete(name: string, handler: Handler<AutocompleteInteraction>) {
        this.addName(this.autocompletes, "autocomplete", name, handler)
        return this
    }

    /** Buttons whose custom ID starts with `prefix`, e.g. `seed:`. */
    button(prefix: string, handler: Handler<ButtonInteraction>) {
        return this.addPrefix(this.prefixes.button, "button", prefix, handler)
    }

    /** String select menus whose custom ID starts with `prefix`. */
    stringSelect(
        prefix: string,
        handler: Handler<StringSelectMenuInteraction>
    ) {
        return this.addPrefix(
            this.prefixes.stringSelect,
            "stringSelect",
            prefix,
            handler
        )
    }

    /** Channel select menus whose custom ID starts with `prefix`. */
    channelSelect(
        prefix: string,
        handler: Handler<ChannelSelectMenuInteraction>
    ) {
        return this.addPrefix(
            this.prefixes.channelSelect,
            "channelSelect",
            prefix,
            handler
        )
    }

    /** Modal submissions whose custom ID starts with `prefix`. */
    modal(prefix: string, handler: Handler<ModalSubmitInteraction>) {
        return this.addPrefix(this.prefixes.modal, "modal", prefix, handler)
    }

    /** Every registered route as `kind:key`, for diagnostics and tests. */
    routes() {
        return [
            ...[...this.commands.keys()].map((name) => `command:${name}`),
            ...[...this.autocompletes.keys()].map(
                (name) => `autocomplete:${name}`
            ),
            ...(Object.keys(this.prefixes) as PrefixKind[]).flatMap((kind) =>
                [...this.prefixes[kind].keys()].map(
                    (prefix) => `${kind}:${prefix}`
                )
            ),
        ].sort()
    }

    routeCommand(interaction: ChatInputCommandInteraction) {
        return this.run(this.commands.get(interaction.commandName), interaction)
    }

    routeAutocomplete(interaction: AutocompleteInteraction) {
        return this.run(
            this.autocompletes.get(interaction.commandName),
            interaction
        )
    }

    routeButton(interaction: ButtonInteraction) {
        return this.run(
            this.match(this.prefixes.button, interaction.customId),
            interaction
        )
    }

    routeStringSelect(interaction: StringSelectMenuInteraction) {
        return this.run(
            this.match(this.prefixes.stringSelect, interaction.customId),
            interaction
        )
    }

    routeChannelSelect(interaction: ChannelSelectMenuInteraction) {
        return this.run(
            this.match(this.prefixes.channelSelect, interaction.customId),
            interaction
        )
    }

    routeModal(interaction: ModalSubmitInteraction) {
        return this.run(
            this.match(this.prefixes.modal, interaction.customId),
            interaction
        )
    }

    private addName<T>(
        map: Map<string, Handler<T>>,
        kind: string,
        name: string,
        handler: Handler<T>
    ) {
        if (!COMMAND_NAME.test(name))
            throw new Error(
                `Interaction ${kind} "${name}" is not a command name.`
            )
        if (map.has(name))
            throw new Error(
                `Interaction route "${kind}:${name}" is registered twice.`
            )
        map.set(name, handler)
    }

    private addPrefix<T>(
        map: Map<string, Handler<T>>,
        kind: PrefixKind,
        prefix: string,
        handler: Handler<T>
    ) {
        if (!prefix || prefix.length > 100)
            throw new Error(
                `Interaction ${kind} prefix "${prefix}" is invalid.`
            )
        if (map.has(prefix))
            throw new Error(
                `Interaction route "${kind}:${prefix}" is registered twice.`
            )
        map.set(prefix, handler)
        return this
    }

    /** The longest registered prefix of the custom ID wins. */
    private match<T>(map: Map<string, Handler<T>>, customId: string) {
        let best: [string, Handler<T>] | undefined
        for (const entry of map)
            if (
                customId.startsWith(entry[0]) &&
                (!best || entry[0].length > best[0].length)
            )
                best = entry
        return best?.[1]
    }

    private async run<T>(handler: Handler<T> | undefined, interaction: T) {
        if (!handler) return false
        await handler(interaction)
        return true
    }
}

/** A registry with every feature's routes registered. */
export function createInteractionRegistry(
    features: readonly InteractionFeature[],
    context: InteractionFeatureContext
) {
    const registry = new InteractionRegistry()
    for (const feature of features) feature.register(registry, context)
    return registry
}

export type InteractionFailureDeps = {
    replyUnknownError: typeof replyUnknownError
    interactionLanguage: typeof interactionLanguage
    logError: typeof logError
    logWarn: typeof logWarn
}

const defaultFailureDeps: InteractionFailureDeps = {
    replyUnknownError,
    interactionLanguage,
    logError,
    logWarn,
}

/**
 * Runs one interaction. Any error a handler throws, registered or not, is
 * logged and answered with the private "Tohle se nepovedlo" card in the
 * clan language (M3-08); nothing internal reaches the person.
 */
export async function runInteraction(
    interaction: Interaction,
    handle: () => Promise<unknown>,
    deps: InteractionFailureDeps = defaultFailureDeps
) {
    try {
        await handle()
    } catch (error) {
        deps.logError("interaction", "Discord interaction failed", {
            type: interaction.type,
            customId:
                "customId" in interaction ? interaction.customId : undefined,
            commandName:
                "commandName" in interaction
                    ? interaction.commandName
                    : undefined,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            error,
        })
        if (!interaction.isRepliable()) return
        await deps
            .replyUnknownError(interaction, {
                language: await deps.interactionLanguage(interaction.guildId),
            })
            .catch((replyError) =>
                deps.logWarn("interaction", "Unknown error reply failed", {
                    guildId: interaction.guildId,
                    error: replyError,
                })
            )
    }
}
