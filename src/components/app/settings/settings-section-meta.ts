import {
    CalendarSync,
    ChartColumn,
    Database,
    Gamepad2,
    Globe,
    Hash,
    IdCard,
    Import,
    ListChecks,
    MessageSquareText,
    Server,
    ShieldCheck,
    Ticket,
    Trophy,
    UserPlus,
    Users,
    Webhook,
    type LucideIcon,
} from "lucide-react"

import type { SettingsSectionId } from "@/domain/workspaces/settings-sections"
import type { GameId } from "@/domain/games/game"

export const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
    profile: IdCard,
    games: Gamepad2,
    messages: MessageSquareText,
    channels: Hash,
    roles: ShieldCheck,
    stats: ChartColumn,
    membership: UserPlus,
    tickets: Ticket,
    "game-servers": Server,
    league: Trophy,
    website: Globe,
    calendar: CalendarSync,
    webhooks: Webhook,
    imports: Import,
    "helper-data": Database,
}

/** Match setup pages that live outside settings but belong to the Matches group. */
export const SETTINGS_PRESET_LINKS = [
    { key: "squadPresets", path: "squad-presets", icon: Users },
    { key: "topicPresets", path: "topic-presets", icon: ListChecks },
] as const

export function settingsHref(
    locale: string,
    serverId: string,
    section?: SettingsSectionId,
    gameId?: GameId
) {
    const base = `/${locale}/dashboard/servers/${serverId}/settings`
    const path = section ? `${base}/${section}` : base
    return gameId ? `${path}?game=${encodeURIComponent(gameId)}` : path
}
