import type { ClanLanguage } from "@/lib/clan-language"
import { getDictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"

/**
 * Ticket and membership panels still showing the previous language's default
 * title or description follow the new clan language; custom text is kept.
 */
export function remapLocalizedDefaults(
    config: DiscordConfig | null,
    nextLanguage: ClanLanguage
) {
    if (!config) {
        return {
            ticketSettings: undefined,
            membershipSettings: undefined,
        }
    }

    const previousLanguage = config.defaultLanguage ?? "en"
    if (previousLanguage === nextLanguage) {
        return {
            ticketSettings: config.ticketSettings,
            membershipSettings: config.membershipSettings,
        }
    }

    const previousDictionary = getDictionary(previousLanguage)
    const nextDictionary = getDictionary(nextLanguage)

    return {
        ticketSettings: config.ticketSettings
            ? {
                  ...config.ticketSettings,
                  panelTitle:
                      config.ticketSettings.panelTitle ===
                      previousDictionary.ticketSettings.defaultPanelTitle
                          ? nextDictionary.ticketSettings.defaultPanelTitle
                          : config.ticketSettings.panelTitle,
                  panelDescription:
                      config.ticketSettings.panelDescription ===
                      previousDictionary.ticketSettings.defaultPanelDescription
                          ? nextDictionary.ticketSettings
                                .defaultPanelDescription
                          : config.ticketSettings.panelDescription,
              }
            : config.ticketSettings,
        membershipSettings: config.membershipSettings
            ? {
                  ...config.membershipSettings,
                  panelTitle:
                      config.membershipSettings.panelTitle ===
                      previousDictionary.membershipSettings.defaultPanelTitle
                          ? nextDictionary.membershipSettings.defaultPanelTitle
                          : config.membershipSettings.panelTitle,
                  panelDescription:
                      config.membershipSettings.panelDescription ===
                      previousDictionary.membershipSettings
                          .defaultPanelDescription
                          ? nextDictionary.membershipSettings
                                .defaultPanelDescription
                          : config.membershipSettings.panelDescription,
              }
            : config.membershipSettings,
    }
}
