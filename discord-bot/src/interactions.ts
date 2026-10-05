import type {
    AutocompleteInteraction,
    ButtonInteraction,
    ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
} from "discord.js"

import {
    ATTENDANCE_DECLINE_MODAL_PREFIX,
    ATTENDANCE_DECLINE_PREFIX,
    handleAttendanceDeclineButton,
    handleAttendanceDeclineModalSubmit,
} from "./interactions/attendance-decline"
import {
    handleEventButtonInteraction,
    handleCheckSignupInteraction,
    handleEventSignupPickerInteraction,
    handleRosterAssignmentInteraction,
} from "./interactions/event-buttons"
import {
    createInteractionRegistry,
    type InteractionFeatureContext,
    type InteractionRegistry,
} from "./interactions/registry"
import { handleMatchRecapPreference } from "./interactions/match-recap-preference"
import { interactionFeatures } from "./interactions/features"
import { handlePlayerReport } from "./player-reports"

/**
 * The bot's interaction entry point. Feature modules route their own
 * buttons, selects, windows and commands through the registry
 * (`interactions/features.ts`): commands, tickets, `/link`, the clan
 * application and its decisions, panels, announcements and rosters. What
 * is left here are the sign-up, attendance and recap buttons that have no
 * feature module yet.
 */

type InteractionHandlerOptions = InteractionFeatureContext & {
    /** Feature routes; defaults to every module in `interactions/features.ts`. */
    registry?: InteractionRegistry
}

export function createInteractionHandler(options: InteractionHandlerOptions) {
    // Feature modules register their routes; registered routes win and the
    // rest of this dispatch stays as it is (interactions/registry.ts).
    const registry =
        options.registry ??
        createInteractionRegistry(interactionFeatures, options)
    return {
        async handleButtonInteraction(interaction: ButtonInteraction) {
            if (await registry.routeButton(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("match-recap:")) {
                await handleMatchRecapPreference(interaction)
                return
            }
            if (interaction.customId.startsWith(ATTENDANCE_DECLINE_PREFIX)) {
                await handleAttendanceDeclineButton(interaction)
                return
            }
            if (interaction.customId.startsWith("signup-picker:")) {
                await handleEventSignupPickerInteraction(interaction)
                return
            }
            if (interaction.customId.startsWith("check-signup:")) {
                await handleCheckSignupInteraction(interaction)
                return
            }
            if (interaction.customId.startsWith("roster-assignment:")) {
                await handleRosterAssignmentInteraction(interaction)
                return
            }
            if (
                interaction.customId.startsWith("signup:") ||
                interaction.customId.startsWith("attendance:")
            ) {
                await handleEventButtonInteraction(interaction, options)
            }
        },

        async handleStringSelectMenuInteraction(
            interaction: StringSelectMenuInteraction
        ) {
            if (await registry.routeStringSelect(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("signup:"))
                await handleEventButtonInteraction(interaction, options)
        },

        async handleModalSubmit(interaction: ModalSubmitInteraction) {
            if (await registry.routeModal(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (
                interaction.customId.startsWith(ATTENDANCE_DECLINE_MODAL_PREFIX)
            )
                await handleAttendanceDeclineModalSubmit(interaction, options)
        },

        async handleAutocompleteInteraction(
            interaction: AutocompleteInteraction
        ) {
            await registry.routeAutocomplete(interaction)
        },

        async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
            // Every command is a feature module's (commands, /close_ticket,
            // /link, /close_application).
            await registry.routeCommand(interaction)
        },

        async handleChannelSelectMenuInteraction(
            interaction: ChannelSelectMenuInteraction
        ) {
            await registry.routeChannelSelect(interaction)
        },
    }
}
