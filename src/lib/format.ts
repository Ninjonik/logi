export function formatDateTime(value: string, timezone?: string, locale: string = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string, timezone?: string, locale: string = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: string, timezone?: string, locale: string = "en-GB") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateKey(value: string, timezone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}
