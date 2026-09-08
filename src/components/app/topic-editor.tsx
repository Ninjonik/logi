"use client"

import { PencilLine, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import {
    DiscordMarkdownText,
    DiscordMarkdownTextarea,
} from "@/components/app/discord-markdown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Topic } from "@/types/domain"

export function TopicEditor({
    topics,
    canEdit,
    dictionary,
    startInEditMode = false,
}: {
    topics: Topic[]
    canEdit: boolean
    dictionary: Dictionary
    startInEditMode?: boolean
}) {
    const [isEditing, setIsEditing] = useState(startInEditMode)
    const [draftTopics, setDraftTopics] = useState(
        topics.map((topic, index) => ({
            ...topic,
            id: topic.id ?? `topic-${index + 1}`,
        }))
    )

    function updateTopic(
        id: string,
        field: keyof Topic,
        value: string | string[]
    ) {
        setDraftTopics((current) =>
            current.map((topic) =>
                topic.id === id ? { ...topic, [field]: value } : topic
            )
        )
    }

    function addTopic() {
        setDraftTopics((current) => [
            ...current,
            {
                id: `topic-${current.length + 1}`,
                title: dictionary.presets.newTopic,
                body: "",
                attachments: [],
            },
        ])
    }

    function removeTopic(id: string) {
        setDraftTopics((current) => current.filter((topic) => topic.id !== id))
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>{dictionary.presets.topics}</CardTitle>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {dictionary.presets.topicEditorDescription}
                    </p>
                </div>
                {canEdit ? (
                    <div className="flex gap-2">
                        <Button
                            variant={isEditing ? "secondary" : "default"}
                            className="rounded-xl"
                            onClick={() => setIsEditing((value) => !value)}
                        >
                            <PencilLine className="size-4" />
                            {dictionary.common.edit}
                        </Button>
                        {isEditing ? (
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={addTopic}
                            >
                                <Plus className="size-4" />
                                {dictionary.presets.addTopic}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
                {draftTopics.map((topic) => (
                    <div
                        key={topic.id}
                        className="border-border/60 rounded-2xl border p-4"
                    >
                        {isEditing ? (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={topic.title}
                                        onChange={(event) =>
                                            updateTopic(
                                                topic.id!,
                                                "title",
                                                event.target.value
                                            )
                                        }
                                        className="rounded-xl"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-xl"
                                        onClick={() => removeTopic(topic.id!)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <DiscordMarkdownTextarea
                                    value={topic.body ?? ""}
                                    onChange={(value) =>
                                        updateTopic(topic.id!, "body", value)
                                    }
                                    className="rounded-xl"
                                    rows={6}
                                    hideToolbar={!isEditing}
                                    preview="live"
                                />
                                <Textarea
                                    value={topic.attachments.join("\n")}
                                    onChange={(event) =>
                                        updateTopic(
                                            topic.id!,
                                            "attachments",
                                            event.target.value
                                                .split("\n")
                                                .map((line) => line.trim())
                                                .filter(Boolean)
                                        )
                                    }
                                    className="min-h-20 rounded-xl"
                                    placeholder={
                                        dictionary.presets.attachmentPlaceholder
                                    }
                                />
                            </div>
                        ) : (
                            <>
                                <div className="font-medium">{topic.title}</div>
                                <DiscordMarkdownText
                                    markdown={topic.body}
                                    className="text-muted-foreground mt-2 text-sm"
                                />
                                {topic.attachments.length ? (
                                    <div className="text-muted-foreground mt-3 text-xs">
                                        {topic.attachments.length}{" "}
                                        {
                                            dictionary.presets
                                                .attachmentCountSuffix
                                        }
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                ))}
                {isEditing ? (
                    <div className="flex gap-3">
                        <Button className="rounded-xl">
                            {dictionary.common.save}
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setIsEditing(false)}
                        >
                            {dictionary.common.cancel}
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
