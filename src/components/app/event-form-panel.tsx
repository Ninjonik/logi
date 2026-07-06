"use client";

import { useState } from "react";

import { EditableResourceDetail } from "@/components/app/editable-resource-detail";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EventRecord } from "@/types/domain";
import { formatDateTime } from "@/lib/format";

export function EventFormPanel({
  event,
  canEdit,
  dictionary,
  createMode = false,
}: {
  event: EventRecord;
  canEdit: boolean;
  dictionary: Dictionary;
  createMode?: boolean;
}) {
  const [draft] = useState(event);

  return (
    <EditableResourceDetail
      title={createMode ? "Create event" : "Event information"}
      description={
        createMode
          ? "This create flow intentionally matches the edit screen so backend wiring later can stay DRY."
          : "This page stays view-first for everyone, and admins can toggle it into edit mode without changing routes."
      }
      canEdit={canEdit}
      dictionary={dictionary}
      startInEditMode={createMode}
      fields={[
        { label: "Name", value: draft.name },
        { label: "Description", value: draft.description, multiline: true },
        { label: "Server", value: draft.server },
        { label: "Server password", value: draft.serverPassword ?? "" },
        { label: "Map", value: draft.map },
        { label: "Side", value: draft.side },
        { label: "Cap mode", value: draft.cap },
        { label: "Registration end", value: formatDateTime(draft.registrationEnd) },
        { label: "Meeting start", value: formatDateTime(draft.meetingStart) },
        { label: "Game start", value: formatDateTime(draft.gameStart) },
        { label: "Game end", value: formatDateTime(draft.gameEnd) },
        { label: "Notes", value: draft.notes, multiline: true },
        { label: "Ping clan", value: draft.pingClan },
      ]}
    />
  );
}
