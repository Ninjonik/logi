import {
    EmbedBuilder,
    escapeMarkdown,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js"
import {
    dataGameSchema,
    gameDataSettingsSchema,
} from "../../../src/domain/game-data/contracts"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { convex, references } from "../convex"
import { withTimeout } from "../utils"
import { env } from "../environment"
import type { z } from "zod"

type Settings = z.infer<typeof gameDataSettingsSchema>
type Game = z.infer<typeof dataGameSchema>
const gameNames = { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" }
const sourceNames = {
    hll_crcon: "HLL CRCON",
    wardogs_rcon: "Wardogs RCON",
    wardogs_warcon: "Wardogs Warcon",
    wardogs_public_directory: "[Wardog Servers](https://wardogservers.com)",
}

function displayText(value: string) {
    return escapeMarkdown(
        value
            .replace(/[\p{Cc}\p{Cf}]/gu, " ")
            .trim()
            .replace(/@/g, "@\u200b")
            .slice(0, 120)
    )
}

export function buildServerStatusCommand() {
    const messages = getClanDiscordMessages("en").serverStatus
    return new SlashCommandBuilder()
        .setName("server-status")
        .setDescription(messages.description)
        .setDescriptionLocalizations({
            cs: getClanDiscordMessages("cs").serverStatus.description,
            de: getClanDiscordMessages("de").serverStatus.description,
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("game")
                .setDescription(messages.gameOption)
                .setDescriptionLocalizations({
                    cs: getClanDiscordMessages("cs").serverStatus.gameOption,
                    de: getClanDiscordMessages("de").serverStatus.gameOption,
                })
                .setRequired(true)
                .addChoices(
                    { name: "Hell Let Loose", value: "hell_let_loose" },
                    { name: "Wardogs", value: "wardogs" }
                )
        )
}

export function buildServerStatusReply(
    language: string,
    guildId: string,
    game: Game,
    settings: Settings
) {
    const messages = getClanDiscordMessages(language).serverStatus
    const connections = settings.connections.filter(
        ({ snapshot }) =>
            snapshot.guildId === guildId && snapshot.gameId === game
    )
    const shown = connections.slice(0, 5)
    const embed = new EmbedBuilder()
        .setTitle(`${messages.title} · ${gameNames[game]}`)
        .setDescription(
            connections.length ? messages.intro : messages.noConnections
        )
        .setColor(0x5865f2)
    for (const { snapshot, health } of shown) {
        const freshness = !health.enabled
            ? messages.disabled
            : snapshot.freshness === "unavailable"
              ? messages.noData
              : messages[snapshot.freshness]
        embed.addFields({
            name: displayText(snapshot.displayName ?? "") || messages.server,
            value: [
                `${messages.state}: **${messages[snapshot.state]}** · ${freshness}`,
                `${messages.players}: ${snapshot.players ?? "?"} / ${snapshot.capacity ?? "?"}`,
                `${messages.map}: ${displayText(snapshot.map ?? "") || messages.unknown}`,
                `${messages.observed}: ${snapshot.observedAt ? `<t:${Math.floor(Date.parse(snapshot.observedAt) / 1000)}:R>` : messages.unknown}`,
                `${messages.provider}: ${sourceNames[snapshot.provider]}`,
            ].join("\n"),
        })
    }
    if (connections.length)
        embed.setFooter({
            text: messages.shown
                .replace("{shown}", String(shown.length))
                .replace("{total}", String(connections.length)),
        })
    return { embeds: [embed], allowedMentions: { parse: [] } }
}

export async function handleServerStatusCommand(
    interaction: ChatInputCommandInteraction
) {
    const messages = getClanDiscordMessages(interaction.locale).serverStatus
    if (
        !interaction.guildId ||
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
        await interaction.reply({
            content: messages.forbidden,
            flags: MessageFlags.Ephemeral,
        })
        return
    }
    const game = dataGameSchema.safeParse(interaction.options.getString("game"))
    if (!game.success) {
        await interaction.reply({
            content: messages.invalidGame,
            flags: MessageFlags.Ephemeral,
        })
        return
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    let settings: Settings
    try {
        settings = gameDataSettingsSchema.parse(
            await withTimeout(
                convex.query(references.getGameDataConnections, {
                    secret: env.internalSecret,
                    guildId: interaction.guildId,
                }),
                10_000,
                "Stored game server status"
            )
        )
    } catch {
        await interaction.editReply({ content: messages.unavailable })
        return
    }
    await interaction.editReply(
        buildServerStatusReply(
            interaction.locale,
            interaction.guildId,
            game.data,
            settings
        )
    )
}
