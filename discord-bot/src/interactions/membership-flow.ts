import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
} from "discord.js"

import type { ClanLanguage } from "../../../src/lib/clan-language"
import type { GameId } from "../../../src/domain/games/game"

export type MembershipFlowStep =
    "game" | "specialization" | "account" | "questions" | "review"

type FlowAnswer = { label: string; value: string }

const copy = {
    en: {
        title: "Membership application",
        steps: ["Game", "Specialization", "Account", "Form", "Review"],
        selectGame: "Choose the game you want to join.",
        selectSpecialization: "Choose your preferred specialization.",
        linkAccount: "Link a platform account before continuing.",
        accountReady: "Your platform account is linked.",
        form: "Complete the application form.",
        review: "Review your application before submitting it.",
        infantry: "Infantry",
        armour: "Armour",
        link: "Link account",
        continue: "Continue",
        openForm: "Open form",
        submit: "Agree and submit",
        back: "Back",
        cancel: "Cancel",
        cancelled: "Application cancelled. Nothing was submitted.",
        game: "Game",
        specialization: "Specialization",
        account: "Platform account",
        notLinked: "Not linked",
        linked: "Linked",
    },
    cs: {
        title: "Členská přihláška",
        steps: ["Hra", "Specializace", "Účet", "Formulář", "Kontrola"],
        selectGame: "Vyberte hru, do které se hlásíte.",
        selectSpecialization: "Vyberte preferovanou specializaci.",
        linkAccount: "Před pokračováním propojte platformní účet.",
        accountReady: "Váš platformní účet je propojený.",
        form: "Vyplňte formulář přihlášky.",
        review: "Před odesláním zkontrolujte přihlášku.",
        infantry: "Pěchota",
        armour: "Tank",
        link: "Propojit účet",
        continue: "Pokračovat",
        openForm: "Otevřít formulář",
        submit: "Souhlasím a odeslat",
        back: "Zpět",
        cancel: "Zrušit",
        cancelled: "Přihláška byla zrušena. Nic nebylo odesláno.",
        game: "Hra",
        specialization: "Specializace",
        account: "Platformní účet",
        notLinked: "Nepropojený",
        linked: "Propojený",
    },
    de: {
        title: "Mitgliedschaftsbewerbung",
        steps: ["Spiel", "Spezialisierung", "Konto", "Formular", "Prüfung"],
        selectGame: "Wähle das Spiel, für das du dich bewirbst.",
        selectSpecialization: "Wähle deine bevorzugte Spezialisierung.",
        linkAccount: "Verknüpfe ein Plattformkonto, bevor du fortfährst.",
        accountReady: "Dein Plattformkonto ist verknüpft.",
        form: "Fülle das Bewerbungsformular aus.",
        review: "Prüfe deine Bewerbung vor dem Absenden.",
        infantry: "Infanterie",
        armour: "Panzer",
        link: "Konto verknüpfen",
        continue: "Weiter",
        openForm: "Formular öffnen",
        submit: "Zustimmen und absenden",
        back: "Zurück",
        cancel: "Abbrechen",
        cancelled: "Bewerbung abgebrochen. Es wurde nichts eingereicht.",
        game: "Spiel",
        specialization: "Spezialisierung",
        account: "Plattformkonto",
        notLinked: "Nicht verknüpft",
        linked: "Verknüpft",
    },
} as const

function flowId(draftId: string, action: string) {
    return `membership-flow:${draftId}:${action}`
}

function gameLabel(gameId: GameId) {
    return gameId === "hell_let_loose"
        ? "Hell Let Loose"
        : gameId === "hell_let_loose_vietnam"
          ? "Hell Let Loose: Vietnam"
          : "Wardogs"
}

export function buildMembershipFlowMessage(input: {
    language: ClanLanguage
    draftId: string
    step: MembershipFlowStep
    gameId?: GameId
    specialization?: "infantry" | "armour"
    platformLinked: boolean
    answers?: FlowAnswer[]
}) {
    const text = copy[input.language]
    const stepIndex = [
        "game",
        "specialization",
        "account",
        "questions",
        "review",
    ].indexOf(input.step)
    const progress = text.steps
        .map(
            (label, index) =>
                `${index < stepIndex ? "✓" : index === stepIndex ? "●" : "○"} ${label}`
        )
        .join("  →  ")
    const container = new ContainerBuilder().setAccentColor(0x5865f2)
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${text.title}\n${progress}`)
    )
    container.addSeparatorComponents(new SeparatorBuilder())

    if (input.step === "game") {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(text.selectGame)
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                ...(
                    [
                        "hell_let_loose",
                        "hell_let_loose_vietnam",
                        "wardogs",
                    ] as const
                ).map((gameId) =>
                    new ButtonBuilder()
                        .setCustomId(flowId(input.draftId, `game:${gameId}`))
                        .setLabel(gameLabel(gameId))
                        .setStyle(ButtonStyle.Primary)
                )
            )
        )
    } else if (input.step === "specialization") {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(text.selectSpecialization)
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        flowId(input.draftId, "specialization:infantry")
                    )
                    .setLabel(text.infantry)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(flowId(input.draftId, "specialization:armour"))
                    .setLabel(text.armour)
                    .setStyle(ButtonStyle.Secondary)
            )
        )
    } else if (input.step === "account") {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                input.platformLinked ? text.accountReady : text.linkAccount
            )
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        flowId(
                            input.draftId,
                            input.platformLinked ? "questions" : "link"
                        )
                    )
                    .setLabel(input.platformLinked ? text.continue : text.link)
                    .setStyle(ButtonStyle.Primary)
            )
        )
    } else if (input.step === "questions") {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(text.form)
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(flowId(input.draftId, "questions"))
                    .setLabel(text.openForm)
                    .setStyle(ButtonStyle.Primary)
            )
        )
    } else {
        const summary = [
            text.review,
            `**${text.game}:** ${input.gameId ? gameLabel(input.gameId) : "—"}`,
            `**${text.specialization}:** ${input.specialization ? text[input.specialization] : "—"}`,
            `**${text.account}:** ${input.platformLinked ? text.linked : text.notLinked}`,
            ...(input.answers?.map(
                (answer) => `**${answer.label}:** ${answer.value}`
            ) ?? []),
        ].join("\n")
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(summary)
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(flowId(input.draftId, "back"))
                    .setLabel(text.back)
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(flowId(input.draftId, "submit"))
                    .setLabel(text.submit)
                    .setStyle(ButtonStyle.Success)
            )
        )
    }

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(flowId(input.draftId, "cancel"))
                .setLabel(text.cancel)
                .setStyle(ButtonStyle.Danger)
        )
    )
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

export function buildMembershipFlowCancelledMessage(language: ClanLanguage) {
    const container = new ContainerBuilder().setAccentColor(0x6b7280)
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(copy[language].cancelled)
    )
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}
