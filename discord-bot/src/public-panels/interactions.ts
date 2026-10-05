import {
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
} from "discord.js"

import {
    hllLiveFacts,
    wardogsLiveFacts,
    type LiveServerFacts,
    type PanelEmojiMarkup,
} from "../../../src/domain/discord-publications/live-panel"
import {
    guildPanels,
    readHllLive,
    readWarconLive,
    type WorkerPanel,
} from "./worker"
import { playerListUnavailableView } from "../../../src/domain/discord-publications/player-list"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
import type { InteractionFeature } from "../interactions/registry"
import { applicationEmoji } from "../runtime/application-emoji"
import { completePrivatePlayerReply } from "./private-reply"
import { handlePlayerReport } from "../player-reports"
import { loadPlayerDetails } from "./player-details"
import { interactionLanguage } from "../ui/replies"
import { editPayload } from "../ui/message-kit"
import { panelPlayersView } from "./render"

/**
 * The panels' buttons, routed through the interaction registry (KIT §7):
 * "Zobrazit hráče" and its paging (`logi:players:`), and the private
 * "Nahlásit hráče" flow (`report:` buttons, select and form).
 */

export type PlayersButtonPorts = {
    readPanel(guildId: string, panelId: string): Promise<WorkerPanel | null>
    /** The current round's facts, "unavailable" when the read failed. */
    readFacts(panel: WorkerPanel): Promise<LiveServerFacts | "unavailable">
    canView(
        interaction: ButtonInteraction,
        panel: WorkerPanel
    ): Promise<boolean>
    language(guildId: string | null): Promise<string | undefined>
    emoji(interaction: ButtonInteraction): Promise<PanelEmojiMarkup>
}

export const defaultPlayersPorts: PlayersButtonPorts = {
    readPanel: async (guildId, panelId) =>
        (await guildPanels(guildId)).find((panel) => panel._id === panelId) ??
        null,
    readFacts: async (panel) => {
        const server = panel.servers[0]
        if (!server) return "unavailable"
        if (server.provider === "hll_crcon") {
            const served = await readHllLive(panel, server.connectionId)
            return served.kind === "ready"
                ? hllLiveFacts(served.envelope.data)
                : "unavailable"
        }
        if (server.provider === "wardogs_warcon") {
            const served = await readWarconLive(panel, server.connectionId)
            return served.kind === "ready" &&
                served.envelope.result.view === "live"
                ? wardogsLiveFacts(served.envelope.result.data)
                : "unavailable"
        }
        return "unavailable"
    },
    canView: async (interaction, panel) => {
        if (!interaction.guild || interaction.guild.id !== panel.guildId)
            return false
        // Fresh channel overwrites, member roles and ownership; cached
        // interaction state is not proof.
        const guild = await interaction.guild.fetch()
        const [channel, member] = await Promise.all([
            guild.channels.fetch(panel.channelId, { force: true }),
            guild.members.fetch({ user: interaction.user.id, force: true }),
            guild.roles.fetch(),
        ])
        return Boolean(
            channel &&
            channel
                .permissionsFor(member)
                ?.has([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                ])
        )
    },
    language: (guildId) => interactionLanguage(guildId),
    emoji: (interaction) =>
        applicationEmoji(interaction.client)
            .emoji()
            .catch(() => ({})),
}

/** "Zobrazit hráče" and its paging: a private, paged list (P4-B09). */
export async function handlePlayersButton(
    interaction: ButtonInteraction,
    ports: PlayersButtonPorts = defaultPlayersPorts
) {
    if (interaction.message.flags.has(MessageFlags.Ephemeral))
        await interaction.deferUpdate()
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const language = await ports.language(interaction.guildId)
    const copy = getPanelMessages(language)
    await completePrivatePlayerReply(
        (reply) => interaction.editReply(reply),
        async () => {
            const result = await loadPlayerDetails<
                WorkerPanel,
                LiveServerFacts | "unavailable"
            >(interaction, {
                readPanel: (id) =>
                    interaction.guildId
                        ? ports.readPanel(interaction.guildId, id)
                        : Promise.resolve(null),
                readLive: (panel) => ports.readFacts(panel),
                canView: (panel) => ports.canView(interaction, panel),
            })
            const view =
                result?.data === "unavailable"
                    ? playerListUnavailableView(copy.players)
                    : panelPlayersView({
                          panel: result?.panel ?? {
                              _id: "",
                              revision: 0,
                          },
                          serverName: result?.panel.servers[0]?.name ?? null,
                          facts: result?.data ?? null,
                          page: result?.page ?? 0,
                          language,
                          emoji: await ports.emoji(interaction),
                      })
            return editPayload(view, { language })
        },
        12_000,
        editPayload(playerListUnavailableView(copy.players), { language })
    )
}

export const panelInteractions: InteractionFeature = {
    name: "public-panels",
    register(registry) {
        registry
            .button("logi:players:", (interaction) =>
                handlePlayersButton(interaction)
            )
            .button("report:", (interaction) => handlePlayerReport(interaction))
            .stringSelect("report:", (interaction) =>
                handlePlayerReport(interaction)
            )
            .modal("report:", (interaction) => handlePlayerReport(interaction))
    },
}
