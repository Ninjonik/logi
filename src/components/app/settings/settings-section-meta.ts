import {
    CalendarClock,
    CalendarSync,
    ChartColumn,
    Database,
    Gamepad2,
    Globe,
    Hash,
    IdCard,
    Import,
    LogIn,
    MessageSquareText,
    Server,
    ShieldCheck,
    Tags,
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
    "event-categories": Tags,
    "match-templates": CalendarClock,
    presets: Users,
    messages: MessageSquareText,
    channels: Hash,
    roles: ShieldCheck,
    stats: ChartColumn,
    membership: UserPlus,
    tickets: Ticket,
    "game-servers": Server,
    league: Trophy,
    website: Globe,
    login: LogIn,
    calendar: CalendarSync,
    webhooks: Webhook,
    imports: Import,
    "helper-data": Database,
}

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
