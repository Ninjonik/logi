"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import { eventSchema, type EventInput } from "@/lib/validation/event";
import type { EventRecord, TopicPreset } from "@/types/domain";

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return new Date(value).toISOString();
}

function FieldLabel({
                      label,
                      required,
                    }: {
  label: string;
  required?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-1 text-sm font-medium">
      <span>{label}</span>
      {required && <span className="text-destructive font-bold">*</span>}
    </div>
  );
}

export function EventFormPanel({
  event,
  serverId,
  locale,
  topicPresets,
  canEdit,
  dictionary,
  createMode = false,
}: {
  event: EventRecord;
  serverId: string;
  locale: string;
  topicPresets: TopicPreset[];
  canEdit: boolean;
  dictionary: Dictionary;
  createMode?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event.name ?? "",
      description: event.description ?? "",
      server: event.server ?? "",
      serverPassword: event.serverPassword ?? "",
      side: event.side ?? "",
      map: event.map ?? "",
      cap: event.cap ?? "",
      notes: event.notes ?? "",
      registrationEnd: toDateTimeLocal(event.registrationEnd),
      meetingStart: toDateTimeLocal(event.meetingStart),
      gameStart: toDateTimeLocal(event.gameStart),
      gameEnd: toDateTimeLocal(event.gameEnd),
      pingClan: event.pingClan,
      topicPresetId: event.topicPresetId ?? "",
    },
  });

  async function submit(values: EventInput) {
    const payload = {
      ...values,
      registrationEnd: fromDateTimeLocal(values.registrationEnd),
      meetingStart: fromDateTimeLocal(values.meetingStart),
      gameStart: fromDateTimeLocal(values.gameStart),
      gameEnd: fromDateTimeLocal(values.gameEnd),
      topicPresetId: values.topicPresetId || undefined,
    };

    const response = await fetch(
      createMode ? `/api/servers/${serverId}/events` : `/api/servers/${serverId}/events/${event.id}`,
      {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      form.setError("root", {
        message: body.error ?? "Unable to save event.",
      });
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/events/${createMode ? body.eventId : event.id}`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">{createMode ? dictionary.event.createTitle : dictionary.event.infoTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {createMode ? dictionary.event.createDescription : dictionary.event.infoDescription}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label={dictionary.event.fields.name} required  />
              <Input {...form.register("name")} className="rounded-xl" />
              {form.formState.errors.name ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.map}  />
              <Input {...form.register("map")} className="rounded-xl" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.description}  />
              <Textarea {...form.register("description")} className="min-h-24 rounded-xl" />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.side}  />
              <Input {...form.register("side")} className="rounded-xl" />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.capMode}  />
              <Input {...form.register("cap")} className="rounded-xl" />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.server}  />
              <Input {...form.register("server")} autoComplete="one-time-code" className="rounded-xl" />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.serverPassword}  />
              <Input {...form.register("serverPassword")} autoComplete={"new-password"} className="rounded-xl" />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.registrationEnd} required  />
              <Input type="datetime-local" {...form.register("registrationEnd")} className="rounded-xl" />
              {form.formState.errors.registrationEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.registrationEnd.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.meetingStart} required  />
              <Input type="datetime-local" {...form.register("meetingStart")} className="rounded-xl" />
              {form.formState.errors.meetingStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.meetingStart.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.gameStart} required  />
              <Input type="datetime-local" {...form.register("gameStart")} className="rounded-xl" />
              {form.formState.errors.gameStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameStart.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.gameEnd} required  />
              <Input type="datetime-local" {...form.register("gameEnd")} className="rounded-xl" />
              {form.formState.errors.gameEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameEnd.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.topicPreset}  />
              <Controller
                control={form.control}
                name="topicPresetId"
                render={({ field }) => (
                  <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{dictionary.event.noPreset}</SelectItem>
                      {topicPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.notes}  />
              <Textarea {...form.register("notes")} className="min-h-28 rounded-xl" />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <FieldLabel label={dictionary.event.fields.pingClan}  />
                </div>
                <Controller
                  control={form.control}
                  name="pingClan"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
              </div>
            </div>
          </div>
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={!canEdit || isPending || form.formState.isSubmitting}>
              {dictionary.common.save}
            </Button>
            <p className="self-center text-sm text-muted-foreground">
              {dictionary.event.saveHelp}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
