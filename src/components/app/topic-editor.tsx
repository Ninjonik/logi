"use client";

import { useState } from "react";
import { PencilLine, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Topic } from "@/types/domain";

export function TopicEditor({
  topics,
  canEdit,
  dictionary,
  startInEditMode = false,
}: {
  topics: Topic[];
  canEdit: boolean;
  dictionary: Dictionary;
  startInEditMode?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [draftTopics, setDraftTopics] = useState(
    topics.map((topic, index) => ({
      ...topic,
      id: topic.id ?? `topic-${index + 1}`,
    })),
  );

  function updateTopic(id: string, field: keyof Topic, value: string | string[]) {
    setDraftTopics((current) =>
      current.map((topic) => (topic.id === id ? { ...topic, [field]: value } : topic)),
    );
  }

  function addTopic() {
    setDraftTopics((current) => [
      ...current,
      { id: `topic-${current.length + 1}`, title: "New topic", body: "", attachments: [] },
    ]);
  }

  function removeTopic(id: string) {
    setDraftTopics((current) => current.filter((topic) => topic.id !== id));
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Topics</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Briefing topics are editable in the same admin edit flow as the preset details.
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant={isEditing ? "secondary" : "default"} className="rounded-xl" onClick={() => setIsEditing((value) => !value)}>
              <PencilLine className="size-4" />
              {dictionary.common.edit}
            </Button>
            {isEditing ? (
              <Button variant="outline" className="rounded-xl" onClick={addTopic}>
                <Plus className="size-4" />
                Add topic
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {draftTopics.map((topic) => (
          <div key={topic.id} className="rounded-2xl border border-border/60 p-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={topic.title}
                    onChange={(event) => updateTopic(topic.id!, "title", event.target.value)}
                    className="rounded-xl"
                  />
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => removeTopic(topic.id!)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Textarea
                  value={topic.body ?? ""}
                  onChange={(event) => updateTopic(topic.id!, "body", event.target.value)}
                  className="min-h-24 rounded-xl"
                />
                <Textarea
                  value={topic.attachments.join("\n")}
                  onChange={(event) =>
                    updateTopic(
                      topic.id!,
                      "attachments",
                      event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                    )
                  }
                  className="min-h-20 rounded-xl"
                  placeholder="One attachment URL per line"
                />
              </div>
            ) : (
              <>
                <div className="font-medium">{topic.title}</div>
                <p className="mt-2 text-sm text-muted-foreground">{topic.body}</p>
                {topic.attachments.length ? (
                  <div className="mt-3 text-xs text-muted-foreground">{topic.attachments.length} attachment(s)</div>
                ) : null}
              </>
            )}
          </div>
        ))}
        {isEditing ? (
          <div className="flex gap-3">
            <Button className="rounded-xl">{dictionary.common.save}</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsEditing(false)}>
              {dictionary.common.cancel}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
