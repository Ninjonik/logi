import {
    CalendarSync,
    Database,
    Gamepad2,
    Hash,
    IdCard,
    Images,
    KeyRound,
    LayoutTemplate,
    MessageSquareText,
    Server,
    ShieldCheck,
    SquareTerminal,
    Tag,
    Ticket,
    Trophy,
    Upload,
    UserCheck,
    UserRound,
    Webhook,
    type LucideIcon,
} from "lucide-react"

import type { SettingsSectionId } from "@/domain/workspaces/settings-sections"
import type { GuidedSetupPosition } from "@/domain/workspaces/guided-setup"
import type { GameId } from "@/domain/games/game"

export const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
    profile: IdCard,
    games: Gamepad2,
    "event-categories": Tag,
    "match-templates": LayoutTemplate,
    presets: UserRound,
    messages: MessageSquareText,
    channels: Hash,
    "panel-graphics": Images,
    roles: ShieldCheck,
    commands: SquareTerminal,
    membership: UserCheck,
    tickets: Ticket,
    "game-servers": Server,
    league: Trophy,
    website: KeyRound,
    calendar: CalendarSync,
    webhooks: Webhook,
    imports: Upload,
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

/** The setup guide (design B), open at `step` or, without one, at the first unfinished step. */
export function guidedSetupHref(
    locale: string,
    serverId: string,
    step?: GuidedSetupPosition
) {
    const path = `/${locale}/dashboard/servers/${serverId}/settings/setup`
    return step ? `${path}?step=${encodeURIComponent(step)}` : path
}
