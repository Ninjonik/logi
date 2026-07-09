import type { Dictionary } from "@/i18n/dictionaries";
import type { EventStatus } from "@/types/domain";

export function getEventStatusMeta(status: EventStatus, dictionary: Dictionary) {
  switch (status) {
    case "registration":
      return { label: dictionary.event.statuses.registration, active: true };
    case "closed":
      return { label: dictionary.event.statuses.closed, active: false };
    case "starting":
      return { label: dictionary.event.statuses.starting, active: true };
    case "concluded":
      return { label: dictionary.event.statuses.concluded, active: false };
  }
}
