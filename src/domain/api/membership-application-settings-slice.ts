import { z } from "zod"

import {
    applicationFormSchema,
    categoryAsksSpecialization,
    categoryGame,
    isHellLetLoose,
    parseApplicationForm,
    resolveApplicationForm,
    validateApplicationForm,
    type ApplicationCategory,
} from "../membership/application-form"
import { getApplicationMessages } from "../../lib/clan-language/application"

import { defineClanSettingsSlice } from "./settings-slices"

/**
 * `/api/v1` clan settings slice `membershipApplication` ("Přihláška do klanu",
 * N4-B09): the application switch, panel channel and text, the thread
 * channel, the after-submit switches, the form in windows, the per-category
 * specialization question and the web form switch (Variant B). Decisions on
 * applications are buttons in the Discord thread and are deliberately not
 * an API operation (see `configuration-coverage.md`); panel images are
 * uploaded in the dashboard and referenced here by URL.
 */

const discordId = z.string().regex(/^\d{17,20}$/)

export const membershipApplicationApiSchema = z.object({
    enabled: z.boolean(),
    panelChannelId: z.string().nullable(),
    threadChannelId: z.string().nullable(),
    panelTitle: z.string(),
    panelText: z.string(),
    panelImageUrl: z.string().nullable(),
    welcomeMessage: z.string().nullable(),
    mentionSupportRoles: z.boolean(),
    autoRecruitOnApply: z.boolean(),
    inviteSupportMembersIndividually: z.boolean(),
    sendConfirmationDm: z.boolean(),
    /** Unfinished applications are deleted after this many hours. */
    draftTtlHours: z.literal(24),
    webFormEnabled: z.boolean(),
    /** `default` until the clan saves its own form. */
    formSource: z.enum(["default", "custom"]),
    form: applicationFormSchema,
    categories: z.array(
        z.object({
            id: z.string(),
            label: z.string(),
            game: z.string(),
            askSpecialization: z.boolean(),
        })
    ),
})
export type MembershipApplicationApiView = z.infer<
    typeof membershipApplicationApiSchema
>

export const membershipApplicationPatchSchema = z
    .strictObject({
        enabled: z.boolean(),
        panelChannelId: discordId.nullable(),
        threadChannelId: discordId.nullable(),
        panelTitle: z.string().trim().min(1).max(256),
        panelText: z.string().trim().max(4096),
        welcomeMessage: z.string().trim().max(1200).nullable(),
        mentionSupportRoles: z.boolean(),
        autoRecruitOnApply: z.boolean(),
        inviteSupportMembersIndividually: z.boolean(),
        sendConfirmationDm: z.boolean(),
        webFormEnabled: z.boolean(),
        /**
         * The whole form; null returns to the default form. Window field
         * counts and category filters are checked against the clan's
         * categories when the patch is applied.
         */
        form: applicationFormSchema.nullable(),
        /** Category ID → ask "Specializace" (Hell Let Loose categories only). */
        askSpecialization: z.record(z.string().max(40), z.boolean()),
    })
    .partial()

type StoredCategory = ApplicationCategory & { label?: string }
type StoredSettings = Record<string, unknown> & {
    enabled?: boolean
    submitChannelId?: string
    applicationParentChannelId?: string
    panelTitle?: string
    panelDescription?: string
    panelImageUrl?: string
    applicationWelcomeMessage?: string
    autoAssignRecruitOnApply?: boolean
    inviteSupportMembersIndividually?: boolean
    mentionSupportRoles?: boolean
    sendConfirmationDm?: boolean
    webFormEnabled?: boolean
    applicationForm?: unknown
    categories?: StoredCategory[]
}

const storedSettings = (
    config: Readonly<Record<string, unknown>> | null
): StoredSettings | null => {
    const value = config?.membershipSettings
    return value && typeof value === "object" ? (value as StoredSettings) : null
}

export const membershipApplicationSettingsSlice = defineClanSettingsSlice({
    key: "membershipApplication",
    description:
        "Clan application (Discord windows and the optional web form): the applications switch, panel channel and text, thread channel, after-submit switches, the form in windows with its questions, the per-category specialization question and the web form switch. Decisions on applications are Discord thread actions and are not part of the API.",
    schema: membershipApplicationApiSchema,
    patchSchema: membershipApplicationPatchSchema,
    read: ({ discordConfig }) => {
        const settings = storedSettings(discordConfig)
        const categories = settings?.categories ?? []
        const language =
            typeof discordConfig?.defaultLanguage === "string"
                ? discordConfig.defaultLanguage
                : "en"
        const stored = applicationFormSchema.safeParse(
            settings?.applicationForm
        )
        return {
            enabled: settings?.enabled ?? false,
            panelChannelId: settings?.submitChannelId ?? null,
            threadChannelId: settings?.applicationParentChannelId ?? null,
            panelTitle: settings?.panelTitle ?? "",
            panelText: settings?.panelDescription ?? "",
            panelImageUrl: settings?.panelImageUrl ?? null,
            welcomeMessage: settings?.applicationWelcomeMessage ?? null,
            mentionSupportRoles: settings?.mentionSupportRoles ?? true,
            autoRecruitOnApply: settings?.autoAssignRecruitOnApply ?? false,
            inviteSupportMembersIndividually:
                settings?.inviteSupportMembersIndividually ?? true,
            sendConfirmationDm: settings?.sendConfirmationDm ?? true,
            draftTtlHours: 24 as const,
            webFormEnabled: settings?.webFormEnabled === true,
            formSource: stored.success
                ? ("custom" as const)
                : ("default" as const),
            form: resolveApplicationForm(
                settings?.applicationForm,
                categories,
                getApplicationMessages(language).defaultForm
            ),
            categories: categories.map((category) => ({
                id: category.id,
                label: category.label?.trim() || category.id,
                game: category.gameId ?? "hell_let_loose",
                askSpecialization: categoryAsksSpecialization(category),
            })),
        }
    },
    toPatch: (patch, { discordConfig }) => ({
        membershipSettings: nextSettings(patch, storedSettings(discordConfig)),
    }),
    verify: (patch, { discordConfig }) => {
        const current = storedSettings(discordConfig)
        const categories = current?.categories ?? []
        for (const [id, ask] of Object.entries(patch.askSpecialization ?? {})) {
            const category = categories.find((item) => item.id === id)
            if (!category) return `askSpecialization.${id}: unknown category`
            if (ask && !isHellLetLoose(categoryGame(category)))
                return `askSpecialization.${id}: only Hell Let Loose categories ask for a specialization`
        }
        const next = nextSettings(patch, current)
        // The rules of the dashboard's save (src/lib/validation/discord-settings.ts).
        if (next.enabled) {
            if (!next.submitChannelId)
                return "panelChannelId: pick the panel channel before switching applications on"
            if (!next.applicationParentChannelId)
                return "threadChannelId: pick the thread channel before switching applications on"
            if (!next.panelTitle?.trim())
                return "panelTitle: the panel needs a title"
            if (!next.panelDescription?.trim())
                return "panelText: the panel needs a text"
            if (!next.categories?.length)
                return "enabled: add at least one category in the dashboard first"
        }
        // A stored custom form must still fit when a category starts asking
        // for a specialization; the default form is rebuilt to fit.
        const form = parseApplicationForm(next.applicationForm)
        if (!form) return null
        const issue = validateApplicationForm(form, next.categories ?? [])[0]
        return issue
            ? `form.${issue.window}${issue.questionId ? `.${issue.questionId}` : ""}: ${issue.code}`
            : null
    },
})

type MembershipApplicationPatch = z.infer<
    typeof membershipApplicationPatchSchema
>

/** The stored membership settings after a patch. */
function nextSettings(
    patch: MembershipApplicationPatch,
    stored: StoredSettings | null
): StoredSettings {
    const current: StoredSettings = stored ?? {
        enabled: false,
        panelTitle: "",
        panelDescription: "",
        autoAssignRecruitOnApply: false,
        categories: [],
    }
    const next: StoredSettings = { ...current }
    const set = <K extends keyof StoredSettings>(
        key: K,
        value: StoredSettings[K] | null | undefined
    ) => {
        if (value === undefined) return
        if (value === null) delete next[key]
        else next[key] = value
    }
    set("enabled", patch.enabled)
    set("submitChannelId", patch.panelChannelId)
    set("applicationParentChannelId", patch.threadChannelId)
    set("panelTitle", patch.panelTitle)
    set("panelDescription", patch.panelText)
    set(
        "applicationWelcomeMessage",
        patch.welcomeMessage === undefined
            ? undefined
            : patch.welcomeMessage || null
    )
    set("mentionSupportRoles", patch.mentionSupportRoles)
    set("autoAssignRecruitOnApply", patch.autoRecruitOnApply)
    set(
        "inviteSupportMembersIndividually",
        patch.inviteSupportMembersIndividually
    )
    set("sendConfirmationDm", patch.sendConfirmationDm)
    set("webFormEnabled", patch.webFormEnabled)
    set("applicationForm", patch.form)
    const askSpecialization = patch.askSpecialization
    if (askSpecialization)
        next.categories = (current.categories ?? []).map((category) =>
            askSpecialization[category.id] === undefined
                ? category
                : {
                      ...category,
                      askSpecialization: askSpecialization[category.id],
                  }
        )
    return next
}
