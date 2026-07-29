import type { EventCategory, EventRecord } from "@/types/domain";

const FALLBACK_EVENT_COLOR = "#6b7280";

export function findEventCategory(
  categories: EventCategory[] | undefined,
  categoryId: string | undefined,
) {
  if (!categoryId) return null;
  return categories?.find((category) => category.id === categoryId) ?? null;
}

export function getEventCategoryLabel(
  event: Pick<EventRecord, "matchType">,
  categories: EventCategory[] | undefined,
) {
  const category = findEventCategory(categories, event.matchType);
  return category?.label ?? event.matchType ?? undefined;
}

export function getEventCategoryEmoji(
  event: Pick<EventRecord, "matchType">,
  categories: EventCategory[] | undefined,
) {
  return findEventCategory(categories, event.matchType)?.emoji;
}

export function getEventCategoryColor(
  event: Pick<EventRecord, "matchType">,
  categories: EventCategory[] | undefined,
) {
  return findEventCategory(categories, event.matchType)?.color ?? FALLBACK_EVENT_COLOR;
}

export function getEventCategoryPresentation(
  event: Pick<EventRecord, "matchType">,
  categories: EventCategory[] | undefined,
) {
  const category = findEventCategory(categories, event.matchType);
  return {
    id: category?.id ?? event.matchType,
    label: category?.label ?? event.matchType ?? undefined,
    emoji: category?.emoji,
    color: category?.color ?? FALLBACK_EVENT_COLOR,
  };
}
