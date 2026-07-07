function getFormatter(timeZone: string, withSeconds: boolean) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hourCycle: "h23",
  });
}

function partsToObject(parts: Intl.DateTimeFormatPart[]) {
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
    second: Number(parts.find((part) => part.type === "second")?.value ?? "0"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = partsToObject(getFormatter(timeZone, true).formatToParts(date));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function toDateTimeLocalInTimeZone(value: string | undefined, timeZone: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = partsToObject(getFormatter(timeZone, false).formatToParts(date));
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function fromDateTimeLocalInTimeZone(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return new Date(value).toISOString();
  }

  const [, year, month, day, hour, minute] = match;
  const utcGuess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset).toISOString();
}
