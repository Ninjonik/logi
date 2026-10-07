import { fillTemplate } from "../discord-messages/format"
import { seenDay } from "../discord-commands/text"
import { GAME_LABELS } from "../games/game"

import {
    APPLICATION_LIMITS,
    categoryGame,
    type AccountPlatform,
    type ApplicationQuestion,
} from "./application-form"
import type {
    ApplicationAnswers,
    PlannedField,
    PlannedWindow,
} from "./application-plan"
import type { ApplicationCopy } from "./application-copy"
import type { PreviousPlayer } from "./previous-players"
import { categoryName } from "./application-views"

/**
 * The fields of one application window as the applicant sees them: label,
 * description, control, placeholder and prefilled values (L6-18..L6-37).
 * The bot turns them into a Discord modal, the web form (Variant B, N4-42)
 * into form controls and the settings page into its window preview (N4-25),
 * so all three ask the same thing in the same words.
 */

export type FieldOption = {
    value: string
    label: string
    description?: string
}

export type FieldControl =
    | {
          kind: "text"
          paragraph: boolean
          /** A number question: digits only on the web. */
          numeric: boolean
          maxLength: number
          placeholder?: string
          value?: string
      }
    | {
          kind: "select"
          multi: boolean
          min: number
          max: number
          placeholder: string
          options: FieldOption[]
          /** Option values chosen before. */
          values: string[]
      }
    | {
          /** A clan member ("Kdo tě k nám pozval?"): a member select. */
          kind: "member"
          placeholder: string
          value?: string
      }

export type ApplicationFieldModel = {
    /** The field ID the answers are saved under (`games`, `q-<id>`, …). */
    id: string
    label: string
    description?: string
    required: boolean
    control: FieldControl
}

export type WindowPrefill = {
    answers: ApplicationAnswers
    verifiedSteamId?: string | null
    /** The applicant's accounts already in Logi (`steam:…`), N4-15. */
    linkedPlatformIds?: readonly string[]
}

export const cutText = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value

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

/**
 * "Steam · naposledy so 3. 10. na Vlci #1"; an older date has no weekday:
 * "Epic · naposledy 12. 9. na Vlci #2" (L6-29).
 */
export function lastSeenText(
    copy: ApplicationCopy,
    player: PreviousPlayer,
    timeZone: string,
    now: number
) {
    const date =
        seenDay(player.lastSeenAt, copy.locale, timeZone, now) ??
        player.lastSeenAt.slice(0, 10)
    const platform = copy.platforms[player.platform]
    return player.serverName
        ? fillTemplate(copy.fields.previous.seen, {
              platform,
              date,
              server: player.serverName,
          })
        : fillTemplate(copy.fields.previous.seenNoServer, { platform, date })
}

function text(input: {
    paragraph?: boolean
    numeric?: boolean
    maxLength: number
    placeholder?: string
    value?: string | null
}): FieldControl {
    return {
        kind: "text",
        paragraph: input.paragraph ?? false,
        numeric: input.numeric ?? false,
        maxLength: input.maxLength,
        ...(input.placeholder
            ? {
                  placeholder: cutText(
                      input.placeholder,
                      APPLICATION_LIMITS.placeholder
                  ),
              }
            : {}),
        ...(input.value
            ? { value: cutText(input.value, input.maxLength) }
            : {}),
    }
}

function field(
    id: string,
    label: string,
    description: string | undefined,
    required: boolean,
    control: FieldControl
): ApplicationFieldModel {
    return {
        id,
        label: cutText(label, APPLICATION_LIMITS.label),
        ...(description?.trim()
            ? {
                  description: cutText(
                      description.trim(),
                      APPLICATION_LIMITS.help
                  ),
              }
            : {}),
        required,
        control,
    }
}

/** A clan question as a field; Ano-ne is a select of "Ano" and "Ne". */
export function questionField(
    copy: ApplicationCopy,
    id: string,
    question: ApplicationQuestion,
    values: readonly string[]
): ApplicationFieldModel {
    const optionalPlaceholder = question.required
        ? undefined
        : copy.fields.optional
    switch (question.type) {
        case "short_text":
        case "number":
            return field(
                id,
                question.label,
                question.help,
                question.required,
                text({
                    numeric: question.type === "number",
                    maxLength:
                        question.type === "number"
                            ? 20
                            : APPLICATION_LIMITS.shortAnswer,
                    placeholder: question.placeholder ?? optionalPlaceholder,
                    value: values[0],
                })
            )
        case "long_text":
            return field(
                id,
                question.label,
                question.help,
                question.required,
                text({
                    paragraph: true,
                    maxLength: APPLICATION_LIMITS.longAnswer,
                    placeholder: question.placeholder ?? optionalPlaceholder,
                    value: values[0],
                })
            )
        case "member":
            return field(id, question.label, question.help, question.required, {
                kind: "member",
                placeholder:
                    question.placeholder ?? copy.fields.memberPlaceholder,
                ...(values[0] ? { value: values[0] } : {}),
            })
        default: {
            const options =
                question.type === "yes_no"
                    ? [
                          { id: "yes", label: copy.fields.yes },
                          { id: "no", label: copy.fields.no },
                      ]
                    : (question.options ?? [])
            const multi = question.type === "multi_select"
            const max = multi
                ? Math.min(question.maxValues ?? options.length, options.length)
                : 1
            const min = multi
                ? (question.minValues ?? (question.required ? 1 : 0))
                : question.required
                  ? 1
                  : 0
            return field(id, question.label, question.help, question.required, {
                kind: "select",
                multi,
                min: Math.min(min, max),
                max: Math.max(1, max),
                placeholder: cutText(
                    question.placeholder ?? copy.fields.selectPlaceholder,
                    150
                ),
                options: options
                    .slice(0, APPLICATION_LIMITS.options)
                    .map((option) => ({
                        value: option.id,
                        label: cutText(
                            option.label,
                            APPLICATION_LIMITS.optionLabel
                        ),
                    })),
                values: values.filter((value) =>
                    options.some((option) => option.id === value)
                ),
            })
        }
    }
}

/** One planned field as the applicant sees it, prefilled from the draft. */
export function applicationFieldModel(
    copy: ApplicationCopy,
    planned: PlannedField,
    prefill: WindowPrefill,
    timeZone: string,
    /** "Now" for the last-seen dates of found players. */
    now: number
): ApplicationFieldModel {
    const { answers } = prefill
    switch (planned.kind) {
        case "games":
            return field(
                planned.id,
                copy.fields.games.label,
                copy.fields.games.help,
                true,
                {
                    kind: "select",
                    multi: true,
                    min: 1,
                    max: planned.options.length,
                    placeholder: copy.fields.games.placeholder,
                    options: planned.options.map((game) => ({
                        value: game,
                        label: GAME_LABELS[game],
                    })),
                    values: answers.games.filter((game) =>
                        planned.options.includes(game)
                    ),
                }
            )
        case "category":
            return field(
                planned.id,
                copy.fields.category.label,
                copy.fields.category.help,
                true,
                {
                    kind: "select",
                    multi: false,
                    min: 1,
                    max: 1,
                    placeholder: copy.fields.category.placeholder,
                    options: planned.options.slice(0, 25).map((category) => ({
                        value: category.id,
                        label: cutText(categoryName(category), 100),
                        description: cutText(
                            [
                                GAME_LABELS[categoryGame(category)],
                                category.description?.trim(),
                            ]
                                .filter(Boolean)
                                .join(" · "),
                            100
                        ),
                    })),
                    values:
                        answers.categoryId &&
                        planned.options.some(
                            (category) => category.id === answers.categoryId
                        )
                            ? [answers.categoryId]
                            : [],
                }
            )
        case "inGameName":
            return field(
                planned.id,
                copy.fields.name.label,
                copy.fields.name.help,
                true,
                text({
                    maxLength: APPLICATION_LIMITS.inGameName,
                    value: answers.inGameName,
                })
            )
        case "previousPlayer": {
            const chosen = answers.accounts.previousPlayer
            return field(
                planned.id,
                copy.fields.previous.label,
                fillTemplate(copy.fields.previous.help, {
                    name: answers.inGameName ?? "",
                }),
                false,
                {
                    kind: "select",
                    multi: false,
                    min: 0,
                    max: 1,
                    placeholder: copy.fields.selectPlaceholder,
                    options: [
                        ...planned.candidates.map((player) => ({
                            value: player.key,
                            label: cutText(player.name, 100),
                            description: cutText(
                                lastSeenText(copy, player, timeZone, now),
                                100
                            ),
                        })),
                        {
                            value: "none",
                            label: copy.fields.previous.none,
                            description: copy.fields.previous.noneHelp,
                        },
                    ],
                    values: chosen ? [chosen] : [],
                }
            )
        }
        case "account": {
            const platform = planned.platform
            const value =
                answers.accounts[platform] ??
                (platform === "steam" ? prefill.verifiedSteamId : undefined) ??
                linkedAccount(prefill.linkedPlatformIds, platform)
            return platform === "steam"
                ? field(
                      planned.id,
                      copy.fields.steam.label,
                      copy.fields.steam.help,
                      false,
                      text({ maxLength: 120, value })
                  )
                : field(
                      planned.id,
                      copy.fields[platform].label,
                      undefined,
                      false,
                      text({
                          maxLength: APPLICATION_LIMITS.accountId,
                          placeholder: copy.fields[platform].placeholder,
                          value,
                      })
                  )
        }
        case "question":
            return questionField(
                copy,
                planned.id,
                planned.question,
                answers.answers[planned.question.id] ?? []
            )
    }
}

/**
 * Every field of a window, at most five: the web form (Variant B) uses the
 * same windows as Discord, so one form works in both.
 */
export function windowFieldModels(
    copy: ApplicationCopy,
    input: {
        window: PlannedWindow
        prefill: WindowPrefill
        timeZone: string
        /** "Now" for the last-seen dates of found players. */
        now: number
    }
): ApplicationFieldModel[] {
    return input.window.fields
        .slice(0, APPLICATION_LIMITS.fieldsPerWindow)
        .map((planned) =>
            applicationFieldModel(
                copy,
                planned,
                input.prefill,
                input.timeZone,
                input.now
            )
        )
}
