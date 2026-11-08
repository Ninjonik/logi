import type {
    ButtonInteraction,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
} from "discord.js"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getSelfGroupMessages } from "../../../src/lib/clan-language/self-groups"
import { errorCard } from "../../../src/domain/discord-messages/message-view"
import { makeFunctionReference } from "convex/server"
import type { InteractionFeature } from "./registry"
import { replyToClicker } from "../events/replies"
import { replyPrivately } from "../ui/replies"
import { revalidateAppData } from "../cache"
import { MessageFlags } from "discord.js"
import { createHash } from "node:crypto"
import { env } from "../environment"
import { convex } from "../convex"

type GroupOption = {
    id: string
    name: string
    gameId: string
    selected: boolean
}
type SelfGroupContext = {
    language: string
    style?: { accentColor?: string; iconDensity?: "sparse" | "rich" }
    games: { id: string; name: string }[]
    groups: GroupOption[]
}
const optionsReference = makeFunctionReference<
    "query",
    { secret: string; guildId: string; userId: string },
    SelfGroupContext
>("selfGroups:options")
const setReference = makeFunctionReference<
    "mutation",
    {
        secret: string
        guildId: string
        userId: string
        groupId: string
        enabled: boolean
        gameId: string
    },
    string
>("selfGroups:set")
type SelfInteraction =
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ChatInputCommandInteraction

const gameToken = (gameId: string) =>
    createHash("sha256").update(gameId).digest("hex").slice(0, 16)

export function selfGroupsView(
    context: SelfGroupContext,
    userId: string,
    requestedPage = 0,
    saved = false,
    selectedGame?: string
): MessageView {
    const copy = getSelfGroupMessages(context.language)
    const game =
        context.games.find((item) => item.id === selectedGame) ??
        (context.games.length === 1 ? context.games[0] : undefined)
    if (!game && context.games.length > 1) {
        const page = Math.max(
            0,
            Math.min(requestedPage, Math.ceil(context.games.length / 25) - 1)
        )
        return {
            accent: "clan",
            ephemeral: true,
            header: { title: copy.gameTitle },
            blocks: [
                { kind: "text", markdown: copy.gameHint },
                {
                    kind: "select",
                    select: {
                        id: `self-groups:game:${userId}:0`,
                        placeholder: copy.gamePlaceholder,
                        options: context.games
                            .slice(page * 25, page * 25 + 25)
                            .map((item) => ({
                                value: item.id,
                                label: item.name.slice(0, 100),
                            })),
                    },
                },
                ...(context.games.length > 25
                    ? [
                          {
                              kind: "buttons" as const,
                              buttons: [
                                  {
                                      kind: "action" as const,
                                      id: `self-groups:games:${userId}:${page - 1}`,
                                      label: copy.previous,
                                      style: "secondary" as const,
                                      disabled: page === 0,
                                  },
                                  {
                                      kind: "action" as const,
                                      id: `self-groups:games:${userId}:${page + 1}`,
                                      label: copy.next,
                                      style: "secondary" as const,
                                      disabled:
                                          (page + 1) * 25 >=
                                          context.games.length,
                                  },
                              ],
                          },
                      ]
                    : []),
            ],
        }
    }
    const groups = context.groups.filter((group) => group.gameId === game?.id)
    const token = game ? gameToken(game.id) : "none"
    const page = Math.max(
        0,
        Math.min(requestedPage, Math.ceil(groups.length / 25) - 1)
    )
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            title: `${saved ? copy.saved : copy.title}${game ? ` · ${game.name}` : ""}`.slice(
                0,
                200
            ),
        },
        blocks: [
            ...(context.games.length > 1
                ? [
                      {
                          kind: "buttons" as const,
                          buttons: [
                              {
                                  kind: "action" as const,
                                  id: `self-groups:games:${userId}:0`,
                                  label: copy.changeGame,
                                  style: "secondary" as const,
                              },
                          ],
                      },
                  ]
                : []),
            {
                kind: "text",
                markdown: groups.length ? copy.hint : copy.empty,
            },
            ...(groups.length
                ? [
                      {
                          kind: "select" as const,
                          select: {
                              id: `self-groups:select:${userId}:${page}:${token}`,
                              placeholder: copy.placeholder,
                              options: groups
                                  .slice(page * 25, page * 25 + 25)
                                  .map((group) => ({
                                      value: `${group.selected ? "remove" : "add"}:${group.id}`,
                                      label: `${group.selected ? "✓ " : ""}${group.name}`.slice(
                                          0,
                                          100
                                      ),
                                      description:
                                          `${group.selected ? copy.remove : copy.add} · ${game?.name ?? group.gameId}`.slice(
                                              0,
                                              100
                                          ),
                                  })),
                          },
                      },
                  ]
                : []),
            ...(groups.length > 25
                ? [
                      {
                          kind: "buttons" as const,
                          buttons: [
                              {
                                  kind: "action" as const,
                                  id: `self-groups:page:${userId}:${page - 1}:${token}`,
                                  label: copy.previous,
                                  style: "secondary" as const,
                                  disabled: page === 0,
                              },
                              {
                                  kind: "action" as const,
                                  id: `self-groups:page:${userId}:${page + 1}:${token}`,
                                  label: copy.next,
                                  style: "secondary" as const,
                                  disabled: (page + 1) * 25 >= groups.length,
                              },
                          ],
                      },
                  ]
                : []),
        ],
    }
}

async function handle(interaction: SelfInteraction, changed: () => void) {
    if (!interaction.guildId) return
    if (interaction.isChatInputCommand())
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    else await interaction.deferUpdate()
    const context = await convex.query(optionsReference, {
        secret: env.internalSecret,
        guildId: interaction.guildId,
        userId: interaction.user.id,
    })
    const copy = getSelfGroupMessages(context.language)
    const kit = { language: context.language, style: context.style }
    let page = 0
    let selectedGame: string | undefined
    let saved = false
    if (!interaction.isChatInputCommand()) {
        const [, route, owner, rawPage, token] = interaction.customId.split(":")
        if (owner !== interaction.user.id) {
            await replyPrivately(
                interaction,
                errorCard({ title: copy.notAllowed, body: copy.hint }),
                kit
            )
            return
        }
        page = Number(rawPage)
        if (!Number.isInteger(page)) page = 0
        selectedGame = context.games.find(
            (game) => gameToken(game.id) === token
        )?.id
        if (route === "game" && interaction.isStringSelectMenu()) {
            selectedGame = context.games.find(
                (game) => game.id === interaction.values[0]
            )?.id
            page = 0
        } else if (route === "games") {
            selectedGame = undefined
        } else if (route === "select" && interaction.isStringSelectMenu()) {
            const [action, groupId] = (interaction.values[0] ?? "").split(":")
            if (
                !["add", "remove"].includes(action) ||
                !selectedGame ||
                !context.groups.some(
                    (group) =>
                        group.id === groupId && group.gameId === selectedGame
                )
            ) {
                await replyPrivately(
                    interaction,
                    errorCard({ title: copy.notAllowed, body: copy.hint }),
                    kit
                )
                return
            }
            try {
                await convex.mutation(setReference, {
                    secret: env.internalSecret,
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    groupId,
                    gameId: selectedGame,
                    enabled: action === "add",
                })
                await revalidateAppData({
                    type: "assignment-changed",
                    serverId: interaction.guildId,
                    userId: interaction.user.id,
                })
                saved = true
                changed()
            } catch (error) {
                const message = error instanceof Error ? error.message : ""
                const title = message.includes(
                    "self_groups:membership_required"
                )
                    ? copy.membership
                    : message.includes("self_groups:primary_group")
                      ? copy.primary
                      : copy.failed
                await replyPrivately(
                    interaction,
                    errorCard({ title, body: copy.hint }),
                    kit
                )
                return
            }
        }
    }
    const current = saved
        ? await convex.query(optionsReference, {
              secret: env.internalSecret,
              guildId: interaction.guildId,
              userId: interaction.user.id,
          })
        : context
    if (interaction.isChatInputCommand())
        await replyPrivately(
            interaction,
            selfGroupsView(
                current,
                interaction.user.id,
                page,
                saved,
                selectedGame
            ),
            kit
        )
    else
        await replyToClicker(
            interaction,
            selfGroupsView(
                current,
                interaction.user.id,
                page,
                saved,
                selectedGame
            ),
            { ...kit, replaceCard: true }
        )
}

export const selfGroupsInteractions: InteractionFeature = {
    name: "self-groups",
    register(registry, context) {
        const handler = (interaction: SelfInteraction) =>
            handle(interaction, context.triggerPollSoon)
        registry
            .command("groups", handler)
            .button("self-groups:", handler)
            .stringSelect("self-groups:", handler)
    },
}
