"use client"

import { Loader2, PencilLine, Save } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Field = {
    label: string
    value?: string | boolean | number
    multiline?: boolean
    inputType?: "text" | "color"
}

export function EditableResourceDetail({
    title,
    description,
    fields,
    canEdit,
    dictionary,
    extra,
    startInEditMode = false,
    createMode = false,
    onSave,
}: {
    title: string
    description?: string
    fields: Field[]
    canEdit: boolean
    dictionary: Dictionary
    extra?: React.ReactNode
    startInEditMode?: boolean
    createMode?: boolean
    onSave?: () => Promise<void> | void
}) {
    const [isEditing, setIsEditing] = useState(startInEditMode || createMode)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        startTransition(() => {
            if (!onSave) {
                toast.info(dictionary.common.notAvailable)
                return
            }

            Promise.resolve(onSave())
                .then(() => {
                    setIsEditing(false)
                    toast.success(dictionary.common.save)
                })
                .catch(() => {
                    toast.error(dictionary.common.error)
                })
        })
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    {description ? (
                        <p className="text-muted-foreground mt-2 text-sm">
                            {description}
                        </p>
                    ) : null}
                </div>
                {canEdit && !createMode ? (
                    <Button
                        variant={isEditing ? "secondary" : "default"}
                        onClick={() => setIsEditing((value) => !value)}
                        className="rounded-xl"
                    >
                        <PencilLine className="size-4" />
                        {dictionary.common.edit}
                    </Button>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    {fields.map((field) => (
                        <div
                            key={field.label}
                            className={field.multiline ? "md:col-span-2" : ""}
                        >
                            <div className="mb-2 text-sm font-medium">
                                {field.label}
                            </div>
                            {isEditing ? (
                                typeof field.value === "boolean" ? (
                                    <div className="border-input flex h-10 items-center rounded-xl border px-3">
                                        <Switch checked={field.value} />
                                    </div>
                                ) : field.multiline ? (
                                    <Textarea
                                        defaultValue={String(field.value ?? "")}
                                        className="min-h-28 rounded-xl"
                                    />
                                ) : (
                                    <Input
                                        type={field.inputType ?? "text"}
                                        defaultValue={String(field.value ?? "")}
                                        className="rounded-xl"
                                    />
                                )
                            ) : (
                                <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
                                    {String(
                                        field.value ?? dictionary.shared.notSet
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {extra}
                {isEditing ? (
                    <div className="flex flex-wrap gap-3">
                        <Button
                            className="rounded-xl"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 size-4" />
                            )}
                            {dictionary.common.save}
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setIsEditing(false)}
                            disabled={isPending}
                        >
                            {dictionary.common.cancel}
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
