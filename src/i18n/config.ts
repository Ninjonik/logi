import {routing} from "@/i18n/routing";

export const defaultLocale = routing.defaultLocale;

export const locales = routing.locales;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
