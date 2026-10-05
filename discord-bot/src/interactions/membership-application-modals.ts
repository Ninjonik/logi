import {
    LabelBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    type ModalSubmitInteraction,
} from "discord.js"

import {
    windowFieldModels,
    type ApplicationFieldModel,
    type WindowPrefill,
} from "../../../src/domain/membership/application-fields"
import type {
    ApplicationPlan,
    PlannedWindow,
    WindowValues,
} from "../../../src/domain/membership/application-plan"
import {
    windowModalId,
    windowTitle,
} from "../../../src/domain/membership/application-views"
import type { ApplicationCopy } from "../../../src/domain/membership/application-copy"

/**
 * One window of the application as a Discord modal (L6-18..L6-37): labels
 * with descriptions, text inputs, single and multiple selects and a member
 * select, at most five fields, prefilled with what the applicant saved
 * ("Upravit" reopens a window with its values, L6-09). The fields come from
 * `application-fields.ts`, which the web form and the dashboard preview use
 * too.
 */

export {
    linkedAccount,
    type WindowPrefill,
} from "../../../src/domain/membership/application-fields"

/** One field model as a Discord label with its component. */
function fieldLabel(model: ApplicationFieldModel): LabelBuilder {
    const label = new LabelBuilder().setLabel(model.label)
    if (model.description) label.setDescription(model.description)
    const control = model.control
    switch (control.kind) {
        case "text": {
            const input = new TextInputBuilder()
                .setCustomId(model.id)
                .setStyle(
                    control.paragraph
                        ? TextInputStyle.Paragraph
                        : TextInputStyle.Short
                )
                .setRequired(model.required)
                .setMaxLength(control.maxLength)
            if (control.placeholder) input.setPlaceholder(control.placeholder)
            if (control.value) input.setValue(control.value)
            return label.setTextInputComponent(input)
        }
        case "member": {
            const select = new UserSelectMenuBuilder()
                .setCustomId(model.id)
                .setPlaceholder(control.placeholder)
                .setMinValues(model.required ? 1 : 0)
                .setMaxValues(1)
                .setRequired(model.required)
            if (control.value) select.setDefaultUsers(control.value)
            return label.setUserSelectMenuComponent(select)
        }
        case "select":
            return label.setStringSelectMenuComponent(
                new StringSelectMenuBuilder()
                    .setCustomId(model.id)
                    .setPlaceholder(control.placeholder)
                    .setMinValues(control.min)
                    .setMaxValues(control.max)
                    .setRequired(model.required)
                    .addOptions(
                        control.options.map((option) => ({
                            value: option.value,
                            label: option.label,
                            ...(option.description
                                ? { description: option.description }
                                : {}),
                            ...(control.values.includes(option.value)
                                ? { default: true }
                                : {}),
                        }))
                    )
            )
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
            windowFieldModels(copy, {
                window: input.window,
                prefill: input.prefill,
                timeZone: input.timeZone,
            }).map(fieldLabel)
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
