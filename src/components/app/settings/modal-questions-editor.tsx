"use client"

import { Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { TicketModalQuestion } from "@/types/domain"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/** Discord shows at most five text inputs in one form. */
export const MAX_MODAL_QUESTIONS = 5

function makeQuestionId() {
    return `question-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The questions a member answers before a ticket or application thread opens:
 * a short list with an inline editor for one question at a time.
 */
export function ModalQuestionsEditor({
    questions,
    onChange,
    dictionary,
    description,
}: {
    questions: TicketModalQuestion[]
    onChange(questions: TicketModalQuestion[]): void
    dictionary: Dictionary
    description?: string
}) {
    const t = dictionary.ticketSettings
    const id = useId()
    const [editing, setEditing] = useState<string | null>(null)

    function patch(questionId: string, value: Partial<TicketModalQuestion>) {
        onChange(
            questions.map((question) =>
                question.id === questionId
                    ? { ...question, ...value }
                    : question
            )
        )
    }

    return (
        <section aria-labelledby={`${id}-title`} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3
                    id={`${id}-title`}
                    className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                    {t.questionsTitle}
                </h3>
                <span className="text-muted-foreground text-xs">
                    {t.questionsCount
                        .replace("{count}", String(questions.length))
                        .replace("{max}", String(MAX_MODAL_QUESTIONS))}
                </span>
            </div>
            {description ? (
                <p className="text-muted-foreground text-sm">{description}</p>
            ) : null}
            {questions.length ? (
                <ul className="divide-border/60 border-border/60 divide-y rounded-xl border">
                    {questions.map((question) => {
                        const open = editing === question.id
                        return (
                            <li key={question.id} className="space-y-3 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium break-words">
                                            {question.label.trim() ||
                                                t.untitledQuestion}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {question.style === "paragraph"
                                                ? t.paragraphInput
                                                : t.shortInput}{" "}
                                            ·{" "}
                                            {question.required
                                                ? t.requiredShort
                                                : t.optionalShort}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg"
                                        aria-expanded={open}
                                        onClick={() =>
                                            setEditing(
                                                open ? null : question.id
                                            )
                                        }
                                    >
                                        {open ? t.doneEditing : t.edit}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="rounded-lg"
                                        aria-label={`${t.removeQuestion}: ${question.label.trim() || t.untitledQuestion}`}
                                        onClick={() =>
                                            onChange(
                                                questions.filter(
                                                    (item) =>
                                                        item.id !== question.id
                                                )
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                {open ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor={`${id}-${question.id}-label`}
                                            >
                                                {t.questionText}
                                            </Label>
                                            <Input
                                                id={`${id}-${question.id}-label`}
                                                value={question.label}
                                                maxLength={45}
                                                placeholder={
                                                    t.questionTextPlaceholder
                                                }
                                                onChange={(event) =>
                                                    patch(question.id, {
                                                        label: event.target
                                                            .value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor={`${id}-${question.id}-placeholder`}
                                            >
                                                {t.placeholder}
                                            </Label>
                                            <Input
                                                id={`${id}-${question.id}-placeholder`}
                                                value={
                                                    question.placeholder ?? ""
                                                }
                                                maxLength={100}
                                                onChange={(event) =>
                                                    patch(question.id, {
                                                        placeholder:
                                                            event.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor={`${id}-${question.id}-style`}
                                            >
                                                {t.inputStyle}
                                            </Label>
                                            <Select
                                                value={question.style}
                                                onValueChange={(value) =>
                                                    patch(question.id, {
                                                        style:
                                                            value ===
                                                            "paragraph"
                                                                ? "paragraph"
                                                                : "short",
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id={`${id}-${question.id}-style`}
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="short">
                                                        {t.shortInput}
                                                    </SelectItem>
                                                    <SelectItem value="paragraph">
                                                        {t.paragraphInput}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-2 self-end pb-2">
                                            <Switch
                                                id={`${id}-${question.id}-required`}
                                                checked={question.required}
                                                onCheckedChange={(checked) =>
                                                    patch(question.id, {
                                                        required: checked,
                                                    })
                                                }
                                            />
                                            <Label
                                                htmlFor={`${id}-${question.id}-required`}
                                                className="font-normal"
                                            >
                                                {t.required}
                                            </Label>
                                        </div>
                                    </div>
                                ) : null}
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <p className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-3 text-sm">
                    {t.noQuestionsShort}
                </p>
            )}
            <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={questions.length >= MAX_MODAL_QUESTIONS}
                onClick={() => {
                    const question: TicketModalQuestion = {
                        id: makeQuestionId(),
                        label: "",
                        placeholder: "",
                        style: "short",
                        required: true,
                    }
                    onChange([...questions, question])
                    setEditing(question.id)
                }}
            >
                <Plus className="size-4" />
                {t.addQuestion}
            </Button>
        </section>
    )
}
