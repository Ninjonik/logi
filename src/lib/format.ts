import { format } from "date-fns";

export function formatDateTime(value: string) {
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

export function formatDate(value: string) {
  return format(new Date(value), "d MMM yyyy");
}
