export function normalizeDiscordMarkdown(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.replace(/\r\n?/g, "\n").trim();
}

export function truncateDiscordMarkdown(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function formatDiscordMarkdown(value?: string | null, maxLength?: number) {
  const normalized = normalizeDiscordMarkdown(value);
  return typeof maxLength === "number" ? truncateDiscordMarkdown(normalized, maxLength) : normalized;
}
