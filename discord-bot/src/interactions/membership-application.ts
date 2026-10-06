import {
    MessageFlags,
    type ButtonInteraction,
    type Guild,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    APPLICATION_BUTTON_PREFIX,
    APPLICATION_WINDOW_PREFIX,
    applicationConfirmationDmView,
    applicationErrors,
    applicationFixView,
    applicationProgressView,
    applicationSentView,
    openWindowId,
    parseApplicationButton,
    parseWindowModalId,
} from "../../../src/domain/membership/application-views"
import {
    EMPTY_APPLICATION_ANSWERS,
    nextWindow,
    planApplication,
    type ApplicationAnswers,
} from "../../../src/domain/membership/application-plan"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"
import { applicationGames } from "../../../src/domain/membership/application-form"
import { matchesGameScope } from "../../../src/domain/games/game"

import {
    claimApplicationSubmission,
    discardApplicationDraft,
    loadApplicationState,
    releaseApplicationSubmission,
    saveApplicationWindow,
    type ApplicationState,
    type ApplicationSubmission,
} from "./membership-application-store"
import {
    applicationThreadName,
    createApplicationThread,
    threadUrl,
    type Applicant,
} from "./membership-application-create"
import {
    editPayload,
    interactionReplyPayload,
    messagePayload,
} from "../ui/message-kit"
import {
    buildWindowModal,
    readWindowValues,
} from "./membership-application-modals"
import { watchVerifiedSteam } from "./membership-steam-watch"
import { dmSettingsUrl } from "../events/match-context"
import type { InteractionFeature } from "./registry"
import { interactionLanguage } from "../ui/replies"
import { env } from "../environment"
import { logWarn } from "../log"

/**
 * The clan application in Discord windows (board L6): "Podat přihlášku" opens
 * window 1, every window is saved and one private message between windows
 * shows the progress and "Pokračovat"; the review sends the application and
 * only then the bot creates the thread and the card.
 */

type Kit = { language: string; style: ApplicationState["messageStyle"] }

const kit = (
    state: Pick<ApplicationState, "language" | "messageStyle">
): Kit => ({
    language: state.language,
    style: state.messageStyle,
})

/** "Ověřit Steam přes web": the account page with the verified Steam link (v0.9). */
export const verifySteamUrl = (language: string) =>
    `${env.appSiteUrl}/${language}/dashboard/settings/user`

export function applicantOf(
    interaction: ButtonInteraction | ModalSubmitInteraction
): Applicant {
    const member = interaction.member
    const displayName =
        member &&
        "displayName" in member &&
        typeof member.displayName === "string"
            ? member.displayName
            : undefined
    return {
        id: interaction.user.id,
        name:
            displayName ??
            interaction.user.globalName ??
            interaction.user.username,
        tag: interaction.user.tag,
        avatar: interaction.user.displayAvatarURL(),
    }
}

function planFor(state: ApplicationState, answers: ApplicationAnswers) {
    return planApplication({
        form: state.form,
        categories: state.categories,
        answers,
        previousPlayers: state.previousPlayers,
    })
}

function progressView(
    state: ApplicationState,
    draftId: string,
    answers: ApplicationAnswers
) {
    return applicationProgressView(getApplicationMessages(state.language), {
        clanName: state.clanName,
        draftId,
        plan: planFor(state, answers),
        answers,
        verifiedSteamId: state.verifiedSteamId,
        verifySteamUrl: verifySteamUrl(state.language),
    })
}

/** Edits the private progress message in place, or answers privately. */
async function show(
    interaction:
        | ButtonInteraction
        | ModalSubmitInteraction
        | StringSelectMenuInteraction,
    view: MessageView,
    options: Kit
) {
    const privateView = { ...view, ephemeral: true }
    if (!interaction.replied && !interaction.deferred) {
        if (
            (interaction.isButton() || interaction.isStringSelectMenu()) &&
            interaction.message.flags.has(MessageFlags.Ephemeral)
        ) {
            await interaction.update(editPayload(privateView, options))
            return
        }
        if (
            interaction.isModalSubmit() &&
            interaction.isFromMessage() &&
            interaction.message.flags.has(MessageFlags.Ephemeral)
        ) {
            await interaction.update(editPayload(privateView, options))
            return
        }
    }
    if (interaction.deferred || interaction.replied)
        await interaction.editReply(editPayload(privateView, options))
    else await interaction.reply(interactionReplyPayload(privateView, options))
}

const clanFullyJoined = (state: ApplicationState) => {
    const games = applicationGames(state.categories)
    return (
        games.length > 0 &&
        games.every((game) =>
            state.assignedGames.some((assigned) =>
                matchesGameScope(assigned, game)
            )
        )
    )
}

function gateCard(state: ApplicationState | null, guild: Guild | null) {
    const copy = getApplicationMessages(state?.language)
    if (!state?.enabled)
        return applicationErrors.closed(copy, guild?.systemChannelId)
    if (state.openApplication)
        return applicationErrors.openApplication(copy, {
            number: state.openApplication.number,
            threadUrl: threadUrl(
                guild?.id ?? "",
                state.openApplication.threadId
            ),
        })
    if (clanFullyJoined(state))
        return applicationErrors.alreadyInClan(copy, {
            clanName: state.clanName || guild?.name || "",
            ticketChannelId: state.ticketChannelId,
        })
    return null
}

/** Watches for the web Steam verification while window 2 is next (L6-27). */
function watchSteamFor(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    state: ApplicationState,
    draftId: string,
    answers: ApplicationAnswers
) {
    if (state.verifiedSteamId) return
    const next = nextWindow(planFor(state, answers), answers)
    if (next?.kind !== "accounts" || !interaction.guildId) return
    watchVerifiedSteam({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        onVerified: async (fresh) => {
            const draft = fresh.draft
            if (!draft || draft.id !== draftId) return
            await interaction.editReply(
                editPayload(
                    {
                        ...progressView(fresh, draft.id, draft.answers),
                        ephemeral: true,
                    },
                    kit(fresh)
                )
            )
        },
    })
}

/** "Podat přihlášku" on the panel (L6-14): window 1, or the saved progress. */
export async function handleApplicationStart(interaction: ButtonInteraction) {
    if (!interaction.guildId) return
    const state = await loadApplicationState(
        interaction.guildId,
        interaction.user.id
    )
    const gate = gateCard(state, interaction.guild)
    const options: Kit = state
        ? kit(state)
        : {
              language:
                  (await interactionLanguage(interaction.guildId)) ?? "en",
              style: null,
          }
    if (gate || !state) {
        await interaction.reply(interactionReplyPayload(gate!, options))
        return
    }
    const copy = getApplicationMessages(state.language)
    if (state.draft) {
        // A saved application continues where it stopped (L6-53).
        await interaction.reply(
            interactionReplyPayload(
                {
                    ...progressView(state, state.draft.id, state.draft.answers),
                    ephemeral: true,
                },
                options
            )
        )
        watchSteamFor(interaction, state, state.draft.id, state.draft.answers)
        return
    }
    const plan = planFor(state, EMPTY_APPLICATION_ANSWERS)
    await interaction.showModal(
        buildWindowModal(copy, {
            draftId: "new",
            plan,
            window: plan.windows[0]!,
            prefill: {
                answers: EMPTY_APPLICATION_ANSWERS,
                verifiedSteamId: state.verifiedSteamId,
                linkedPlatformIds: state.linkedPlatformIds,
            },
            timeZone: state.timeZone,
        })
    )
}

/** One window submitted: saved, then the progress message (L6-07, L6-08). */
export async function handleWindowModal(interaction: ModalSubmitInteraction) {
    const parsed = parseWindowModalId(interaction.customId)
    if (!parsed || !interaction.guildId) return
    const state = await loadApplicationState(
        interaction.guildId,
        interaction.user.id
    )
    const options: Kit = state
        ? kit(state)
        : {
              language:
                  (await interactionLanguage(interaction.guildId)) ?? "en",
              style: null,
          }
    const copy = getApplicationMessages(options.language)
    if (!state?.enabled) {
        await show(
            interaction,
            applicationErrors.closed(copy, interaction.guild?.systemChannelId),
            options
        )
        return
    }
    const draft = state.draft
    if (parsed.draftId !== "new" && draft?.id !== parsed.draftId) {
        await show(
            interaction,
            applicationErrors.expired(copy, state.panelChannelId),
            options
        )
        return
    }
    const answers = draft?.answers ?? EMPTY_APPLICATION_ANSWERS
    const plan = planFor(state, answers)
    const window = plan.windows.find((item) => item.id === parsed.windowId)
    if (!window) {
        // The form changed while the window was open (L6-53).
        const next = nextWindow(plan, answers, state.verifiedSteamId)
        const saved = plan.windows
            .filter((item) => answers.completedWindows.includes(item.id))
            .map((item) => copy.windowNames[item.kind])
        await show(
            interaction,
            applicationErrors.windowExpired(copy, {
                savedSteps: [...new Set(saved)],
                windowName: copy.windowNames[next?.kind ?? "about"],
                continueId: openWindowId(
                    draft?.id ?? "new",
                    next?.id ?? "about"
                ),
            }),
            options
        )
        return
    }
    const result = await saveApplicationWindow({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        draftId: draft?.id,
        windowId: window.id,
        values: readWindowValues(interaction, window),
    })
    if (!result.ok) {
        if (result.reason === "invalid" && draft)
            await show(
                interaction,
                applicationFixView(copy, {
                    clanName: state.clanName,
                    draftId: draft.id,
                    plan,
                    window,
                    issues: result.issues ?? [],
                }),
                options
            )
        else if (result.reason === "invalid")
            // Window 1 without a draft yet: the issues are the reason itself.
            await show(
                interaction,
                applicationFixView(copy, {
                    clanName: state.clanName,
                    draftId: "new",
                    plan,
                    window,
                    issues: result.issues ?? [],
                }),
                options
            )
        else
            await show(
                interaction,
                result.reason === "disabled"
                    ? applicationErrors.closed(
                          copy,
                          interaction.guild?.systemChannelId
                      )
                    : applicationErrors.expired(copy, state.panelChannelId),
                options
            )
        return
    }
    // Fresh state: the in-game name changes the found players (L6-B06).
    const fresh =
        (await loadApplicationState(
            interaction.guildId,
            interaction.user.id
        )) ?? state
    await show(
        interaction,
        progressView(fresh, result.draftId, result.answers),
        options
    )
    watchSteamFor(interaction, fresh, result.draftId, result.answers)
}

async function sendConfirmationDm(
    interaction: ButtonInteraction,
    submission: ApplicationSubmission,
    number: number,
    url: string
) {
    if (submission.config.membershipSettings?.sendConfirmationDm === false)
        return
    const copy = getApplicationMessages(submission.config.defaultLanguage)
    await interaction.user
        .send(
            messagePayload(
                applicationConfirmationDmView(copy, {
                    clanName:
                        submission.clanName || interaction.guild?.name || "",
                    number,
                    threadUrl: url,
                    settingsUrl: dmSettingsUrl(
                        submission.config.defaultLanguage
                    ),
                }),
                {
                    language: submission.config.defaultLanguage,
                    style: submission.config.messageStyle,
                }
            )
        )
        .catch(() => null)
}

/** "Pokračovat", "Upravit", "Odeslat přihlášku" and "Zrušit" on the progress message. */
export async function handleApplicationButton(interaction: ButtonInteraction) {
    const parsed = parseApplicationButton(interaction.customId)
    if (!parsed || !interaction.guildId || !interaction.guild) return
    const state = await loadApplicationState(
        interaction.guildId,
        interaction.user.id
    )
    const options: Kit = state
        ? kit(state)
        : {
              language:
                  (await interactionLanguage(interaction.guildId)) ?? "en",
              style: null,
          }
    const copy = getApplicationMessages(options.language)
    if (!state?.enabled) {
        await show(
            interaction,
            applicationErrors.closed(copy, interaction.guild.systemChannelId),
            options
        )
        return
    }
    const draft = state.draft
    // "new" is window 1 before the first save (L6-53 "Pokračovat").
    if (parsed.draftId === "new" && !draft) {
        if (parsed.action === "open") await handleApplicationStart(interaction)
        else
            await show(
                interaction,
                applicationErrors.cancelled(copy, state.panelChannelId),
                options
            )
        return
    }
    if (!draft || draft.id !== parsed.draftId) {
        await show(
            interaction,
            applicationErrors.expired(copy, state.panelChannelId),
            options
        )
        return
    }
    if (parsed.action === "cancel") {
        await discardApplicationDraft({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            draftId: draft.id,
        })
        await show(
            interaction,
            applicationErrors.cancelled(copy, state.panelChannelId),
            options
        )
        return
    }
    const plan = planFor(state, draft.answers)
    if (parsed.action === "open") {
        const window =
            plan.windows.find((item) => item.id === parsed.windowId) ??
            nextWindow(plan, draft.answers, state.verifiedSteamId)
        if (!window) {
            await show(
                interaction,
                progressView(state, draft.id, draft.answers),
                options
            )
            return
        }
        await interaction.showModal(
            buildWindowModal(copy, {
                draftId: draft.id,
                plan,
                window,
                prefill: {
                    answers: draft.answers,
                    verifiedSteamId: state.verifiedSteamId,
                    linkedPlatformIds: state.linkedPlatformIds,
                },
                timeZone: state.timeZone,
            })
        )
        return
    }

    // "Odeslat přihlášku": only now the thread is created (L6-B04).
    const claim = await claimApplicationSubmission({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        draftId: draft.id,
        source: "discord",
    })
    if (!claim.ok) {
        switch (claim.reason) {
            case "busy":
                await interaction.deferUpdate()
                return
            case "incomplete":
                await show(
                    interaction,
                    progressView(state, draft.id, draft.answers),
                    options
                )
                return
            case "open-application":
                await show(
                    interaction,
                    applicationErrors.openApplication(copy, {
                        number: claim.number ?? 0,
                        threadUrl: threadUrl(
                            interaction.guildId,
                            claim.threadId ?? ""
                        ),
                    }),
                    options
                )
                return
            case "in-clan":
                await show(
                    interaction,
                    applicationErrors.alreadyInClan(copy, {
                        clanName: state.clanName || interaction.guild.name,
                        ticketChannelId: state.ticketChannelId,
                    }),
                    options
                )
                return
            case "disabled":
                await show(
                    interaction,
                    applicationErrors.closed(
                        copy,
                        interaction.guild.systemChannelId
                    ),
                    options
                )
                return
            default:
                await show(
                    interaction,
                    applicationErrors.expired(copy, state.panelChannelId),
                    options
                )
                return
        }
    }
    await interaction.deferUpdate()
    const applicant = applicantOf(interaction)
    const result = await createApplicationThread({
        guild: interaction.guild,
        applicant,
        submission: claim.submission,
    })
    if (!result.ok) {
        await releaseApplicationSubmission(draft.id, result.failedAt).catch(
            (error) =>
                logWarn("interaction", "Could not release an application", {
                    guildId: interaction.guildId,
                    error,
                })
        )
        await show(interaction, applicationErrors.sendFailed(copy), options)
        return
    }
    const url = threadUrl(interaction.guildId, result.threadId)
    await show(
        interaction,
        applicationSentView(copy, {
            threadId: result.threadId,
            threadUrl: url,
        }),
        options
    )
    await sendConfirmationDm(interaction, claim.submission, result.number, url)
}

/** Buttons and windows of the wizard before the redesign end politely (L4-25). */
export async function handleLegacyApplication(
    interaction:
        ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction
) {
    if (!interaction.guildId) return
    const state = await loadApplicationState(
        interaction.guildId,
        interaction.user.id
    )
    const options: Kit = state
        ? kit(state)
        : {
              language:
                  (await interactionLanguage(interaction.guildId)) ?? "en",
              style: null,
          }
    await show(
        interaction,
        applicationErrors.expired(
            getApplicationMessages(options.language),
            state?.panelChannelId
        ),
        options
    )
}

/**
 * After the `/link` guide linked an account inside the application (L4-60,
 * "Zadat ID a pokračovat"): the guide's message becomes the application's
 * progress message again, and window 2 opens with the linked account filled
 * in (N4-15).
 */
export async function continueApplicationAfterLink(
    interaction:
        | ButtonInteraction
        | ModalSubmitInteraction
        | StringSelectMenuInteraction,
    draftId: string
) {
    if (!interaction.guildId) return
    const state = await loadApplicationState(
        interaction.guildId,
        interaction.user.id
    )
    const options: Kit = state
        ? kit(state)
        : {
              language:
                  (await interactionLanguage(interaction.guildId)) ?? "en",
              style: null,
          }
    if (!state?.enabled || !state.draft || state.draft.id !== draftId) {
        await show(
            interaction,
            applicationErrors.expired(
                getApplicationMessages(options.language),
                state?.panelChannelId
            ),
            options
        )
        return
    }
    await show(
        interaction,
        progressView(state, state.draft.id, state.draft.answers),
        options
    )
}

export { applicationThreadName }

export const membershipApplicationInteractions: InteractionFeature = {
    name: "membership-application",
    register(registry) {
        registry
            // The panel button; its ID is unchanged so older panels still work.
            .button("membership:", handleApplicationStart)
            .button("membership-flow:", handleLegacyApplication)
            .button("membership-reuse:", handleLegacyApplication)
            .modal("membership-modal:", handleLegacyApplication)
            .modal("membership-flow-modal:", handleLegacyApplication)
            // Old wizard windows that asked for the account and the questions together.
            .modal("plink-apply:", handleLegacyApplication)
            .modal("plink-mock-apply:", handleLegacyApplication)
            // The old wizard's account step; `/link`'s own old IDs
            // (`plink:<step>:l:`) are longer and route to link.ts.
            .button("plink:", handleLegacyApplication)
            .stringSelect("plink:", handleLegacyApplication)
            .modal("plink-modal:", handleLegacyApplication)
            .modal("plink-search:", handleLegacyApplication)
            .button(APPLICATION_BUTTON_PREFIX, handleApplicationButton)
            .modal(APPLICATION_WINDOW_PREFIX, handleWindowModal)
    },
}
