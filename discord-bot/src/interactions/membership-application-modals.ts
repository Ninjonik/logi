import {
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    type ModalSubmitInteraction,
} from "discord.js"

import type {
    ApplicationAnswers,
    ApplicationPlan,
    PlannedField,
    PlannedWindow,
    WindowValues,
} from "../../../src/domain/membership/application-plan"
import {
    APPLICATION_LIMITS,
    categoryGame,
    type AccountPlatform,
    type ApplicationQuestion,
} from "../../../src/domain/membership/application-form"
import {
    categoryName,
    windowModalId,
    windowTitle,
} from "../../../src/domain/membership/application-views"
import type { ApplicationCopy } from "../../../src/domain/membership/application-copy"
import type { PreviousPlayer } from "../../../src/domain/membership/previous-players"
import { fillTemplate } from "../../../src/domain/discord-messages/format"
import { GAME_LABELS } from "../../../src/domain/games/game"

/**
 * One window of the application as a Discord modal (L6-18..L6-37): labels
 * with descriptions, text inputs, single and multiple selects and a member
 * select, at most five fields, prefilled with what the applicant saved
 * ("Upravit" reopens a window with its values, L6-09).
 */

const cut = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value

export type WindowPrefill = {
    answers: ApplicationAnswers
    verifiedSteamId?: string | null
    /** The applicant's accounts already in Logi (`steam:…`), N4-15. */
    linkedPlatformIds?: readonly string[]
}

/** The account an applicant already has in Logi for a platform. */
export function linkedAccount(
    linked: readonly string[] | undefined,
    platform: AccountPlatform
) {
    const prefix = `${platform}:`
    const value = linked?.find((id) => id.toLowerCase().startsWith(prefix))
    if (value) return value.slice(prefix.length)
    // Older links stored a bare Steam64 ID.
    return platform === "steam"
        ? linked?.find((id) => /^7656119\d{10}$/.test(id))
        : undefined
}

function lastSeen(
    copy: ApplicationCopy,
    player: PreviousPlayer,
    timeZone: string
) {
    let date: string
    try {
        date = new Intl.DateTimeFormat(copy.locale, {
            weekday: player.lastSeenAt ? "short" : undefined,
            day: "numeric",
            month: "numeric",
            timeZone,
        }).format(new Date(player.lastSeenAt))
    } catch {
        date = player.lastSeenAt.slice(0, 10)
    }
    const platform = copy.platforms[player.platform]
    return player.serverName
        ? fillTemplate(copy.fields.previous.seen, {
              platform,
              date,
              server: player.serverName,
          })
        : fillTemplate(copy.fields.previous.seenNoServer, { platform, date })
}

function textInput(
    id: string,
    input: {
        style?: TextInputStyle
        required: boolean
        max: number
        placeholder?: string
        value?: string
    }
) {
    const builder = new TextInputBuilder()
        .setCustomId(id)
        .setStyle(input.style ?? TextInputStyle.Short)
        .setRequired(input.required)
        .setMaxLength(input.max)
    if (input.placeholder)
        builder.setPlaceholder(
            cut(input.placeholder, APPLICATION_LIMITS.placeholder)
        )
    if (input.value) builder.setValue(cut(input.value, input.max))
    return builder
}

function label(text: string, description?: string) {
    const builder = new LabelBuilder().setLabel(
        cut(text, APPLICATION_LIMITS.label)
    )
    if (description?.trim())
        builder.setDescription(cut(description.trim(), APPLICATION_LIMITS.help))
    return builder
}

function questionLabel(
    copy: ApplicationCopy,
    field: { id: string; question: ApplicationQuestion },
    answers: ApplicationAnswers
) {
    const { question } = field
    const values = answers.answers[question.id] ?? []
    const builder = label(question.label, question.help)
    switch (question.type) {
        case "short_text":
        case "number":
            return builder.setTextInputComponent(
                textInput(field.id, {
                    required: question.required,
                    max:
                        question.type === "number"
                            ? 20
                            : APPLICATION_LIMITS.shortAnswer,
                    placeholder:
                        question.placeholder ??
                        (question.required ? undefined : copy.fields.optional),
                    value: values[0],
                })
            )
        case "long_text":
            return builder.setTextInputComponent(
                textInput(field.id, {
                    style: TextInputStyle.Paragraph,
                    required: question.required,
                    max: APPLICATION_LIMITS.longAnswer,
                    placeholder:
                        question.placeholder ??
                        (question.required ? undefined : copy.fields.optional),
                    value: values[0],
                })
            )
        case "member": {
            const select = new UserSelectMenuBuilder()
                .setCustomId(field.id)
                .setPlaceholder(
                    question.placeholder ?? copy.fields.memberPlaceholder
                )
                .setMinValues(question.required ? 1 : 0)
                .setMaxValues(1)
                .setRequired(question.required)
            if (values[0]) select.setDefaultUsers(values[0])
            return builder.setUserSelectMenuComponent(select)
        }
        default: {
            const options =
                question.type === "yes_no"
                    ? [
                          { id: "yes", label: copy.fields.yes },
                          { id: "no", label: copy.fields.no },
                      ]
                    : (question.options ?? [])
            const multi = question.type === "multi_select"
            const min = multi
                ? (question.minValues ?? (question.required ? 1 : 0))
                : question.required
                  ? 1
                  : 0
            const max = multi
                ? Math.min(question.maxValues ?? options.length, options.length)
                : 1
            const select = new StringSelectMenuBuilder()
                .setCustomId(field.id)
                .setPlaceholder(
                    cut(
                        question.placeholder ?? copy.fields.selectPlaceholder,
                        150
                    )
                )
                .setMinValues(Math.min(min, max))
                .setMaxValues(Math.max(1, max))
                .setRequired(question.required)
                .addOptions(
                    options
                        .slice(0, APPLICATION_LIMITS.options)
                        .map((option) => ({
                            value: option.id,
                            label: cut(
                                option.label,
                                APPLICATION_LIMITS.optionLabel
                            ),
                            ...(values.includes(option.id)
                                ? { default: true }
                                : {}),
                        }))
                )
            return builder.setStringSelectMenuComponent(select)
        }
    }
}

function fieldLabel(
    copy: ApplicationCopy,
    plan: ApplicationPlan,
    field: PlannedField,
    prefill: WindowPrefill,
    timeZone: string
): LabelBuilder {
    const { answers } = prefill
    switch (field.kind) {
        case "games":
            return label(
                copy.fields.games.label,
                copy.fields.games.help
            ).setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(field.id)
                    .setPlaceholder(copy.fields.games.placeholder)
                    .setMinValues(1)
                    .setMaxValues(field.options.length)
                    .setRequired(true)
                    .addOptions(
                        field.options.map((game) => ({
                            value: game,
                            label: GAME_LABELS[game],
                            ...(answers.games.includes(game)
                                ? { default: true }
                                : {}),
                        }))
                    )
            )
        case "category":
            return label(
                copy.fields.category.label,
                copy.fields.category.help
            ).setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(field.id)
                    .setPlaceholder(copy.fields.category.placeholder)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setRequired(true)
                    .addOptions(
                        field.options.slice(0, 25).map((category) => ({
                            value: category.id,
                            label: cut(categoryName(category), 100),
                            description: cut(
                                [
                                    GAME_LABELS[categoryGame(category)],
                                    category.description?.trim(),
                                ]
                                    .filter(Boolean)
                                    .join(" · "),
                                100
                            ),
                            ...(answers.categoryId === category.id
                                ? { default: true }
                                : {}),
                        }))
                    )
            )
        case "inGameName":
            return label(
                copy.fields.name.label,
                copy.fields.name.help
            ).setTextInputComponent(
                textInput(field.id, {
                    required: true,
                    max: APPLICATION_LIMITS.inGameName,
                    value: answers.inGameName,
                })
            )
        case "previousPlayer":
            return label(
                copy.fields.previous.label,
                fillTemplate(copy.fields.previous.help, {
                    name: answers.inGameName ?? "",
                })
            ).setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(field.id)
                    .setPlaceholder(copy.fields.selectPlaceholder)
                    .setMinValues(0)
                    .setMaxValues(1)
                    .setRequired(false)
                    .addOptions([
                        ...field.candidates.map((player) => ({
                            value: player.key,
                            label: cut(player.name, 100),
                            description: cut(
                                lastSeen(copy, player, timeZone),
                                100
                            ),
                            ...(answers.accounts.previousPlayer === player.key
                                ? { default: true }
                                : {}),
                        })),
                        {
                            value: "none",
                            label: copy.fields.previous.none,
                            description: copy.fields.previous.noneHelp,
                            ...(answers.accounts.previousPlayer === "none"
                                ? { default: true }
                                : {}),
                        },
                    ])
            )
        case "account": {
            const platform = field.platform
            const value =
                answers.accounts[platform] ??
                (platform === "steam" ? prefill.verifiedSteamId : undefined) ??
                linkedAccount(prefill.linkedPlatformIds, platform)
            const copyFor =
                platform === "steam"
                    ? {
                          label: copy.fields.steam.label,
                          help: copy.fields.steam.help,
                          placeholder: undefined,
                      }
                    : {
                          label: copy.fields[platform].label,
                          help: undefined,
                          placeholder: copy.fields[platform].placeholder,
                      }
            return label(copyFor.label, copyFor.help).setTextInputComponent(
                textInput(field.id, {
                    required: false,
                    max:
                        platform === "steam"
                            ? 120
                            : APPLICATION_LIMITS.accountId,
                    placeholder: copyFor.placeholder,
                    value: value ?? undefined,
                })
            )
        }
        case "question":
            return questionLabel(copy, field, answers)
    }
}

/** The modal of one window, ready for `showModal`. */
export function buildWindowModal(
    copy: ApplicationCopy,
    input: {
        draftId: string
        plan: ApplicationPlan
        window: PlannedWindow
        prefill: WindowPrefill
        timeZone: string
    }
) {
    return new ModalBuilder()
        .setCustomId(windowModalId(input.draftId, input.window.id))
        .setTitle(windowTitle(copy, input.window, input.plan.totalSteps))
        .addLabelComponents(
            input.window.fields
                .slice(0, APPLICATION_LIMITS.fieldsPerWindow)
                .map((field) =>
                    fieldLabel(
                        copy,
                        input.plan,
                        field,
                        input.prefill,
                        input.timeZone
                    )
                )
        )
}

/** The submitted values of a window's fields; a missing field reads empty. */
export function readWindowValues(
    interaction: Pick<ModalSubmitInteraction, "fields">,
    window: PlannedWindow
): WindowValues {
    const values: Record<string, string[]> = {}
    for (const field of window.fields) {
        try {
            const component = interaction.fields.getField(field.id)
            if ("value" in component && typeof component.value === "string")
                values[field.id] = [component.value]
            else if ("values" in component && Array.isArray(component.values))
                values[field.id] = component.values.map(String)
            else if ("users" in component && component.users)
                values[field.id] = [...component.users.keys()]
            else values[field.id] = []
        } catch {
            values[field.id] = []
        }
    }
    return values
}
