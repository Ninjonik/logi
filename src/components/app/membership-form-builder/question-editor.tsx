"use client"

import { GripVertical, Plus, X } from "lucide-react"
import { useId, type KeyboardEvent } from "react"

import {
    addOption,
    categoryFilterEditable,
    categoryMatchesGame,
    gameFilterChoices,
    moveOption,
    removeOption,
    typeEditable,
    withCategory,
    withGame,
    withType,
    withoutFields,
} from "@/domain/membership/application-form-editing"
import {
    APPLICATION_LIMITS,
    APPLICATION_QUESTION_TYPES,
    type ApplicationCategory,
    type ApplicationQuestion,
    type ApplicationQuestionChoiceType,
} from "@/domain/membership/application-form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import { categoryName } from "@/domain/membership/application-views"
import { fillTemplate } from "@/domain/discord-messages/format"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type FormCopy = Dictionary["membershipApplication"]["form"]

/**
 * The open question in the builder (N4-18..N4-23): type, required, label
 * with Discord's 45-character counter, help, placeholder, options, the
 * multi-select bounds and the game and category filters.
 */
export function QuestionEditor({
    question,
    inAbout,
    categories,
    t,
    onChange,
    onDone,
}: {
    question: ApplicationQuestion
    /** Window 1 asks everyone: the applicant picks game and category there. */
    inAbout: boolean
    categories: readonly ApplicationCategory[]
    t: FormCopy
    onChange(question: ApplicationQuestion): void
    onDone(): void
}) {
    const id = useId()
    const e = t.editor
    const optionLabel = (index: number) =>
        fillTemplate(t.option, { number: String(index) })
    const isSelect =
        question.type === "select" || question.type === "multi_select"
    const options = question.options ?? []
    const games = gameFilterChoices(categories)
    const gameValue: GameId | "all" =
        question.game === "hell_let_loose_vietnam" &&
        !games.includes("hell_let_loose_vietnam")
            ? "hell_let_loose"
            : (question.game ?? "all")
    const shortGame = (game: GameId) => t.gameShort[game]

    function optionKeys(event: KeyboardEvent, optionId: string) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault()
        onChange(
            moveOption(question, optionId, event.key === "ArrowUp" ? -1 : 1)
        )
    }

    return (
        <div
            role="group"
            aria-label={fillTemplate(e.title, { name: question.label })}
            className="bg-background space-y-4 rounded-xl border p-4"
        >
            <div className="space-y-2">
                <Label htmlFor={`${id}-type`}>{e.type}</Label>
                <Select
                    value={question.type}
                    disabled={!typeEditable(question)}
                    onValueChange={(value) => {
                        const type = APPLICATION_QUESTION_TYPES.find(
                            (item) => item === value
                        )
                        if (type)
                            onChange(withType(question, type, optionLabel))
                    }}
                >
                    <SelectTrigger
                        id={`${id}-type`}
                        className="w-full rounded-lg"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(typeEditable(question)
                            ? APPLICATION_QUESTION_TYPES
                            : [question.type]
                        ).map((type) => (
                            <SelectItem key={type} value={type}>
                                {t.types[type as ApplicationQuestionChoiceType]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {!typeEditable(question) ? (
                    <p className="text-muted-foreground text-xs">
                        {e.typeFixed}
                    </p>
                ) : null}
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    id={`${id}-required`}
                    checked={question.required}
                    onCheckedChange={(required) =>
                        onChange({
                            ...question,
                            required,
                            ...(question.type === "multi_select"
                                ? {
                                      minValues: required
                                          ? Math.max(1, question.minValues ?? 1)
                                          : (question.minValues ?? 0),
                                  }
                                : {}),
                        })
                    }
                />
                <Label htmlFor={`${id}-required`} className="font-normal">
                    {e.required}
                </Label>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${id}-label`}>{e.label}</Label>
                <Input
                    id={`${id}-label`}
                    value={question.label}
                    maxLength={APPLICATION_LIMITS.label}
                    aria-describedby={`${id}-label-count`}
                    onChange={(event) =>
                        onChange({ ...question, label: event.target.value })
                    }
                    className="rounded-lg"
                />
                <p
                    id={`${id}-label-count`}
                    className="text-muted-foreground text-xs"
                >
                    {fillTemplate(e.labelCount, {
                        count: String(question.label.length),
                    })}
                </p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${id}-help`}>{e.help}</Label>
                <Input
                    id={`${id}-help`}
                    value={question.help ?? ""}
                    maxLength={APPLICATION_LIMITS.help}
                    aria-describedby={`${id}-help-hint`}
                    onChange={(event) =>
                        onChange(
                            withOptionalText(
                                question,
                                "help",
                                event.target.value
                            )
                        )
                    }
                    className="rounded-lg"
                />
                <p
                    id={`${id}-help-hint`}
                    className="text-muted-foreground text-xs"
                >
                    {e.helpHint}
                </p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor={`${id}-placeholder`}>{e.placeholder}</Label>
                <Input
                    id={`${id}-placeholder`}
                    value={question.placeholder ?? ""}
                    maxLength={APPLICATION_LIMITS.placeholder}
                    onChange={(event) =>
                        onChange(
                            withOptionalText(
                                question,
                                "placeholder",
                                event.target.value
                            )
                        )
                    }
                    className="rounded-lg"
                />
            </div>

            {isSelect ? (
                <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">
                        {e.options}
                    </legend>
                    <ul className="space-y-2">
                        {options.map((option, index) => {
                            const name =
                                option.label ||
                                fillTemplate(e.optionInput, {
                                    number: String(index + 1),
                                })
                            return (
                                <li
                                    key={option.id}
                                    className="flex items-center gap-2"
                                >
                                    <button
                                        type="button"
                                        aria-label={fillTemplate(e.moveOption, {
                                            name,
                                        })}
                                        title={t.moveHint}
                                        onKeyDown={(event) =>
                                            optionKeys(event, option.id)
                                        }
                                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
                                    >
                                        <GripVertical
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </button>
                                    <Input
                                        aria-label={fillTemplate(
                                            e.optionInput,
                                            { number: String(index + 1) }
                                        )}
                                        value={option.label}
                                        maxLength={
                                            APPLICATION_LIMITS.optionLabel
                                        }
                                        onChange={(event) =>
                                            onChange({
                                                ...question,
                                                options: options.map((item) =>
                                                    item.id === option.id
                                                        ? {
                                                              ...item,
                                                              label: event
                                                                  .target.value,
                                                          }
                                                        : item
                                                ),
                                            })
                                        }
                                        className="rounded-lg"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 rounded-md"
                                        aria-label={fillTemplate(
                                            e.removeOption,
                                            { name }
                                        )}
                                        disabled={options.length <= 1}
                                        onClick={() =>
                                            onChange(
                                                removeOption(
                                                    question,
                                                    option.id
                                                )
                                            )
                                        }
                                    >
                                        <X
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </li>
                            )
                        })}
                    </ul>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={
                                options.length >= APPLICATION_LIMITS.options
                            }
                            onClick={() =>
                                onChange(
                                    addOption(
                                        question,
                                        optionLabel(options.length + 1)
                                    )
                                )
                            }
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            {e.addOption}
                        </Button>
                        <span className="text-muted-foreground text-xs">
                            {e.maxOptions}
                        </span>
                    </div>
                </fieldset>
            ) : null}

            {question.type === "multi_select" ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={`${id}-min`} className="font-normal">
                        {e.selectFrom}
                    </Label>
                    <Input
                        id={`${id}-min`}
                        type="number"
                        inputMode="numeric"
                        min={question.required ? 1 : 0}
                        max={options.length}
                        value={String(
                            question.minValues ?? (question.required ? 1 : 0)
                        )}
                        onChange={(event) =>
                            onChange({
                                ...question,
                                minValues: boundedNumber(
                                    event.target.value,
                                    question.required ? 1 : 0,
                                    options.length
                                ),
                            })
                        }
                        className="w-16 rounded-lg"
                    />
                    <Label htmlFor={`${id}-max`} className="font-normal">
                        {e.selectTo}
                    </Label>
                    <Input
                        id={`${id}-max`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={options.length}
                        value={String(question.maxValues ?? options.length)}
                        onChange={(event) =>
                            onChange({
                                ...question,
                                maxValues: boundedNumber(
                                    event.target.value,
                                    1,
                                    Math.max(1, options.length)
                                ),
                            })
                        }
                        className="w-16 rounded-lg"
                    />
                </div>
            ) : null}

            {inAbout ? (
                <p className="text-muted-foreground text-xs">
                    {e.aboutNoFilters}
                </p>
            ) : (
                <>
                    {games.length > 1 ? (
                        <div className="space-y-2">
                            <p
                                id={`${id}-game`}
                                className="text-sm font-medium"
                            >
                                {e.game}
                            </p>
                            <SegmentedControl
                                labelledBy={`${id}-game`}
                                value={gameValue}
                                disabled={question.kind === "specialization"}
                                onChange={(value) =>
                                    onChange(
                                        withGame(
                                            question,
                                            value === "all" ? null : value
                                        )
                                    )
                                }
                                options={[
                                    ...games.map((game) => ({
                                        value: game as GameId | "all",
                                        label: shortGame(game),
                                    })),
                                    {
                                        value: "all" as const,
                                        label:
                                            games.length === 2
                                                ? e.gameBoth
                                                : e.gameAll,
                                    },
                                ]}
                            />
                        </div>
                    ) : null}
                    {categoryFilterEditable(question) ? (
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium">
                                {e.category}
                            </legend>
                            <p className="text-muted-foreground text-xs">
                                {e.categoryHint}
                            </p>
                            <ul className="space-y-2">
                                {categories.map((category) => {
                                    const matches = categoryMatchesGame(
                                        question,
                                        category
                                    )
                                    const checked = Boolean(
                                        matches &&
                                        question.categoryIds?.includes(
                                            category.id
                                        )
                                    )
                                    return (
                                        <li key={category.id}>
                                            <div className="flex items-start gap-2">
                                                <Checkbox
                                                    id={`${id}-category-${category.id}`}
                                                    checked={checked}
                                                    disabled={!matches}
                                                    aria-describedby={
                                                        matches
                                                            ? undefined
                                                            : `${id}-category-${category.id}-note`
                                                    }
                                                    onCheckedChange={(value) =>
                                                        onChange(
                                                            withCategory(
                                                                question,
                                                                category.id,
                                                                value === true
                                                            )
                                                        )
                                                    }
                                                    className="mt-0.5"
                                                />
                                                <Label
                                                    htmlFor={`${id}-category-${category.id}`}
                                                    className="block font-normal"
                                                >
                                                    <span className="block">
                                                        {categoryName(category)}
                                                    </span>
                                                    {!matches &&
                                                    question.game ? (
                                                        <span
                                                            id={`${id}-category-${category.id}-note`}
                                                            className="text-muted-foreground block text-xs"
                                                        >
                                                            {fillTemplate(
                                                                e.categoryOtherGame,
                                                                {
                                                                    game: GAME_LABELS[
                                                                        category.gameId ??
                                                                            "hell_let_loose"
                                                                    ],
                                                                    questionGame:
                                                                        shortGame(
                                                                            question.game
                                                                        ),
                                                                }
                                                            )}
                                                        </span>
                                                    ) : null}
                                                </Label>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </fieldset>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            {e.specializationNote}
                        </p>
                    )}
                </>
            )}

            <div className="flex justify-end">
                <Button type="button" className="rounded-lg" onClick={onDone}>
                    {e.done}
                </Button>
            </div>
        </div>
    )
}

/** Help and placeholder are left out when empty: Discord refuses empty texts. */
function withOptionalText(
    question: ApplicationQuestion,
    key: "help" | "placeholder",
    value: string
): ApplicationQuestion {
    const rest = withoutFields(question, [key])
    return value ? { ...rest, [key]: value } : rest
}

function boundedNumber(value: string, min: number, max: number) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return min
    return Math.max(min, Math.min(max, parsed))
}
