import { z } from "zod"

import {
    MESSAGE_ICON_DENSITIES,
    normalizeAccentColor,
} from "@/domain/discord-messages/message-style"
import { supportedClanLanguages } from "@/lib/clan-language/core"
import { supportedTimezones } from "@/lib/discord-timezones"

const discordIdField = z
    .string()
    .trim()
    .regex(/^\d*$/, "Discord IDs must contain only digits.")
    .optional()
    .transform((value) => value || undefined)

/** A Discord ID a settings page may clear; blank and `null` both mean "clear". */
const clearableDiscordIdField = z
    .union([
        z
            .string()
            .trim()
            .regex(/^\d*$/, "Discord IDs must contain only digits."),
        z.null(),
    ])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null))

const rosterScoreField = z
    .number()
    .int("Roster scores must be whole numbers.")
    .min(-1000)
    .max(1000)

const rosterScoreSettingsSchema = z.object({
    noCategory: rosterScoreField,
    declined: rosterScoreField,
    rosterPresent: rosterScoreField,
    reservePresent: rosterScoreField,
    rosterAbsent: rosterScoreField,
    reserveAbsent: rosterScoreField,
    excusedAbsence: rosterScoreField,
})

const imageUrlField = z
    .string()
    .trim()
    .max(512, "Image URLs must be 512 characters or fewer.")
    .optional()
    .transform((value) => value || undefined)
    .refine(
        (value) => !value || /^https?:\/\//i.test(value),
        "Image URLs must start with http:// or https://."
    )

const statsSettingsSchema = z.object({
    enabled: z.boolean(),
    games: z.object({ hell_let_loose: z.boolean(), wardogs: z.boolean() }),
    defaultShareChannelId: discordIdField.refine(
        (value) => !value || /^\d{17,20}$/.test(value),
        "Channel IDs must be 17 to 20 digits."
    ),
})

/**
 * The clan's message style; the submitted style replaces the stored one. A
 * blank or `null` colour means Logi amber.
 */
const messageStyleSchema = z
    .object({
        accentColor: z
            .union([
                z
                    .string()
                    .trim()
                    .regex(
                        /^(#[0-9a-f]{6})?$/i,
                        "The clan colour must be a hex colour such as #E8A33D."
                    ),
                z.null(),
            ])
            .optional()
            .transform((value) => normalizeAccentColor(value)),
        iconDensity: z.enum(MESSAGE_ICON_DENSITIES),
    })
    .strict()

const playerStatsServerSchema = z.object({
    token: z.string().trim().min(1, "Server stats token is required."),
    url: z.string().trim().url("Server stats URL must be a valid URL."),
})

const ticketModalQuestionSchema = z.object({
    id: z.string().trim().min(1).max(40),
    label: z
        .string()
        .trim()
        .min(1, "Question label is required.")
        .max(45, "Question labels can be up to 45 characters."),
    placeholder: z
        .string()
        .trim()
        .max(100, "Question placeholders can be up to 100 characters.")
        .optional()
        .transform((value) => value || undefined),
    style: z.enum(["short", "paragraph"]),
    required: z.boolean(),
})

const ticketCategorySchema = z.object({
    id: z.string().trim().min(1).max(40),
    emoji: z
        .string()
        .trim()
        .max(100, "Category emoji must be 100 characters or fewer.")
        .optional()
        .transform((value) => value || undefined),
    label: z
        .string()
        .trim()
        .max(80, "Category label can be up to 80 characters.")
        .optional()
        .transform((value) => value || undefined),
    description: z
        .string()
        .trim()
        .max(240, "Category description can be up to 240 characters.")
        .optional()
        .transform((value) => value || undefined),
    supportRoleIds: z
        .array(
            z
                .string()
                .trim()
                .regex(/^\d+$/, "Role IDs must contain only digits.")
        )
        .max(25),
    modalQuestions: z
        .array(ticketModalQuestionSchema)
        .max(5, "Discord modals can have up to 5 questions."),
})

const membershipCategorySchema = ticketCategorySchema.extend({
    gameId: z
        .enum(["hell_let_loose", "hell_let_loose_vietnam", "wardogs"])
        .optional(),
    recruitRoleIds: z
        .array(
            z
                .string()
                .trim()
                .regex(/^\d+$/, "Role IDs must contain only digits.")
        )
        .max(25),
    finalRoleIds: z
        .array(
            z
                .string()
                .trim()
                .regex(/^\d+$/, "Role IDs must contain only digits.")
        )
        .max(25),
    assignmentType: z.enum(["member", "reserve_member", "mercenary"]),
    autoAssignRecruitOnApply: z.boolean().optional(),
})

const ticketSettingsSchema = z
    .object({
        enabled: z.boolean(),
        submitChannelId: discordIdField,
        ticketParentChannelId: discordIdField,
        panelTitle: z
            .string()
            .trim()
            .max(256, "Discord embed titles can be up to 256 characters."),
        panelDescription: z
            .string()
            .trim()
            .max(
                4096,
                "Discord embed descriptions can be up to 4096 characters."
            ),
        panelImageUrl: imageUrlField,
        categories: z
            .array(ticketCategorySchema)
            .max(20, "Keep ticket categories to 20 or fewer buttons."),
    })
    .superRefine((value, ctx) => {
        if (!value.enabled) {
            return
        }

        if (!value.submitChannelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["submitChannelId"],
                message: "Pick a submit channel for tickets.",
            })
        }

        if (!value.ticketParentChannelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["ticketParentChannelId"],
                message: "Pick a parent text channel for ticket threads.",
            })
        }

        if (!value.panelTitle.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["panelTitle"],
                message: "Ticket panel title is required.",
            })
        }

        if (!value.panelDescription.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["panelDescription"],
                message: "Ticket panel description is required.",
            })
        }

        if (!value.categories.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["categories"],
                message: "Add at least one ticket category.",
            })
        }

        const usedIds = new Set<string>()
        for (const [index, category] of value.categories.entries()) {
            const label = category.label?.trim()
            const emoji = category.emoji?.trim()
            if (!label && !emoji) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["categories", index, "label"],
                    message:
                        "Each ticket category needs at least a label or an emoji.",
                })
            }

            if (usedIds.has(category.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["categories", index, "id"],
                    message: "Ticket category IDs must be unique.",
                })
            }
            usedIds.add(category.id)
        }
    })

const membershipSettingsSchema = z
    .object({
        enabled: z.boolean(),
        submitChannelId: discordIdField,
        applicationParentChannelId: discordIdField,
        panelTitle: z
            .string()
            .trim()
            .max(256, "Discord embed titles can be up to 256 characters."),
        panelDescription: z
            .string()
            .trim()
            .max(
                4096,
                "Discord embed descriptions can be up to 4096 characters."
            ),
        panelImageUrl: imageUrlField,
        applicationWelcomeMessage: z
            .string()
            .trim()
            .max(
                1200,
                "Application welcome messages can be up to 1200 characters."
            )
            .optional()
            .transform((value) => value || undefined),
        autoAssignRecruitOnApply: z.boolean(),
        roleSyncEnabled: z.boolean().optional(),
        inviteSupportMembersIndividually: z.boolean().optional(),
        rosterScoreSettings: rosterScoreSettingsSchema.optional(),
        categories: z
            .array(membershipCategorySchema)
            .max(20, "Keep membership categories to 20 or fewer buttons."),
    })
    .superRefine((value, ctx) => {
        if (!value.enabled) {
            return
        }

        if (!value.submitChannelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["submitChannelId"],
                message: "Pick a submit channel for clan applications.",
            })
        }

        if (!value.applicationParentChannelId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["applicationParentChannelId"],
                message: "Pick a parent text channel for application threads.",
            })
        }

        if (!value.panelTitle.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["panelTitle"],
                message: "Application panel title is required.",
            })
        }

        if (!value.panelDescription.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["panelDescription"],
                message: "Application panel description is required.",
            })
        }

        if (!value.categories.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["categories"],
                message: "Add at least one application category.",
            })
        }

        const usedIds = new Set<string>()
        for (const [index, category] of value.categories.entries()) {
            if (!category.label?.trim() && !category.emoji?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["categories", index, "label"],
                    message:
                        "Each application category needs at least a label or an emoji.",
                })
            }

            if (usedIds.has(category.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["categories", index, "id"],
                    message: "Application category IDs must be unique.",
                })
            }

            usedIds.add(category.id)

            if (
                value.inviteSupportMembersIndividually === false &&
                category.supportRoleIds.length > 10
            ) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["categories", index, "supportRoleIds"],
                    message:
                        "Role-ping invitations support at most 10 roles per category.",
                })
            }
        }
    })

const gameDiscordOverridesSchema = z.object({
    announcementsChannelId: discordIdField,
    eventInfoChannelId: discordIdField,
    forumCategoryId: discordIdField,
    meetingChannelId: discordIdField,
    squadVoiceCategoryId: discordIdField,
    playerStatsServers: z.array(playerStatsServerSchema).max(20).optional(),
    membershipSettings: membershipSettingsSchema.optional(),
    membershipPanelMessageId: z.string().optional(),
    membershipPanelLastConfigUpdatedAt: z.string().optional(),
})

/**
 * A settings page submits only the settings it owns. Omitted fields keep their
 * stored values; `null` or a blank Discord ID clears that one field.
 */
export const discordSettingsPatchSchema = z.object({
    timezone: z.enum(supportedTimezones).optional(),
    defaultLanguage: z.enum(supportedClanLanguages).optional(),
    announcementsChannelId: clearableDiscordIdField,
    eventInfoChannelId: clearableDiscordIdField,
    errorsChannelId: clearableDiscordIdField,
    calendarChannelId: clearableDiscordIdField,
    calendarCategories: z
        .array(z.string().trim().min(1).max(80))
        .max(20)
        .optional(),
    forumCategoryId: clearableDiscordIdField,
    meetingChannelId: clearableDiscordIdField,
    squadVoiceCategoryId: clearableDiscordIdField,
    clanRoleId: clearableDiscordIdField,
    dashboardAdminRoleId: clearableDiscordIdField,
    playerStatsServers: z
        .array(playerStatsServerSchema)
        .max(20, "Keep stats server connections to 20 or fewer.")
        .optional(),
    ticketSettings: ticketSettingsSchema.optional(),
    membershipSettings: membershipSettingsSchema.optional(),
    statsSettings: statsSettingsSchema.optional(),
    messageStyle: messageStyleSchema.optional(),
    gameOverrides: z
        .object({
            hell_let_loose: gameDiscordOverridesSchema.optional(),
            hell_let_loose_vietnam: gameDiscordOverridesSchema.optional(),
            wardogs: gameDiscordOverridesSchema.optional(),
        })
        .optional(),
})

export type DiscordSettingsPatch = z.infer<typeof discordSettingsPatchSchema>
