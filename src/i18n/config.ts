export const defaultLocale = "en" as const;

export const locales = [defaultLocale] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
