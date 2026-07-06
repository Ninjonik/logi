"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/i18n/dictionaries";

type Field = {
  label: string;
  value?: string | boolean | number;
  multiline?: boolean;
  inputType?: "text" | "color";
};

export function EditableResourceDetail({
  title,
  description,
  fields,
  canEdit,
  dictionary,
  extra,
  startInEditMode = false,
}: {
  title: string;
  description?: string;
  fields: Field[];
  canEdit: boolean;
  dictionary: Dictionary;
  extra?: React.ReactNode;
  startInEditMode?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(startInEditMode);

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {canEdit ? (
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
            <div key={field.label} className={field.multiline ? "md:col-span-2" : ""}>
              <div className="mb-2 text-sm font-medium">{field.label}</div>
              {isEditing ? (
                typeof field.value === "boolean" ? (
                  <div className="flex h-10 items-center rounded-xl border border-input px-3">
                    <Switch checked={field.value} />
                  </div>
                ) : field.multiline ? (
                  <Textarea defaultValue={String(field.value ?? "")} className="min-h-28 rounded-xl" />
                ) : (
                  <Input type={field.inputType ?? "text"} defaultValue={String(field.value ?? "")} className="rounded-xl" />
                )
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                  {String(field.value ?? "Not set")}
                </div>
              )}
            </div>
          ))}
        </div>
        {extra}
        {isEditing ? (
          <div className="flex flex-wrap gap-3">
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
