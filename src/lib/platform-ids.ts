export function parsePlatformIdsInput(value: string | string[] | undefined | null) {
  const values = Array.isArray(value) ? value : [value ?? ""];

  return [...new Set(
    values
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.replace(/\s+/g, "").trim())
      .filter(Boolean),
  )];
}

export function formatPlatformIds(value: string[] | undefined | null) {
  return value?.length ? value.join(", ") : "";
}
