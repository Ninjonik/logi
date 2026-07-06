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
      title={createMode ? dictionary.event.createTitle : dictionary.event.infoTitle}
      description={
        createMode
          ? dictionary.event.createDescription
          : dictionary.event.infoDescription
      }
      canEdit={canEdit}
      dictionary={dictionary}
      startInEditMode={createMode}
      fields={[
        { label: dictionary.event.fields.name, value: draft.name },
        { label: dictionary.event.fields.description, value: draft.description, multiline: true },
        { label: dictionary.event.fields.server, value: draft.server },
        { label: dictionary.event.fields.serverPassword, value: draft.serverPassword ?? "" },
        { label: dictionary.event.fields.map, value: draft.map },
        { label: dictionary.event.fields.side, value: draft.side },
        { label: dictionary.event.fields.capMode, value: draft.cap },
        { label: dictionary.event.fields.registrationEnd, value: formatDateTime(draft.registrationEnd) },
        { label: dictionary.event.fields.meetingStart, value: formatDateTime(draft.meetingStart) },
        { label: dictionary.event.fields.gameStart, value: formatDateTime(draft.gameStart) },
        { label: dictionary.event.fields.gameEnd, value: formatDateTime(draft.gameEnd) },
        { label: dictionary.event.fields.notes, value: draft.notes, multiline: true },
        { label: dictionary.event.fields.pingClan, value: draft.pingClan },
      ]}
    />
  );
}
