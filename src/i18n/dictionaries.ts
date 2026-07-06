import type { Locale } from "@/i18n/config";

const dictionaries = {
  en: {
    app: {
      name: "Logi",
      tagline: "Hell Let Loose event organizer",
      description:
        "Organize clan events, build rosters, publish briefings, and prepare Discord-connected operations.",
    },
    auth: {
      loginTitle: "Deploy your next operation",
      loginDescription:
        "Sign in with Discord to manage servers, publish rosters, and keep every briefing in one place.",
      loginButton: "Continue with Discord",
      loginHint: "Discord OAuth will be wired in later. This is a frontend-only preview.",
    },
    dashboard: {
      title: "Your servers",
      description:
        "Everything you manage, represent, or fight alongside is grouped here.",
      managedServers: "Managed servers",
      homeServer: "Main server",
      mercenaryServers: "Mercenary servers",
      openServer: "Open server",
      noServerTitle: "No servers yet",
      noServerDescription:
        "Once a Discord account is connected, your servers will appear here.",
    },
    sidebar: {
      home: "Home",
      overview: "Overview",
      calendar: "Calendar",
      events: "Events",
      topicPresets: "Topic presets",
      squadPresets: "Squad presets",
      rosters: "Rosters",
      users: "User management",
      serverSettings: "Server settings",
      userSettings: "User settings",
      serverLabel: "Active server",
      workspace: "Workspace",
      operations: "Operations",
      configuration: "Configuration",
    },
    common: {
      edit: "Edit mode",
      cancel: "Cancel",
      save: "Save changes",
      create: "Create new",
      publish: "Publish",
      published: "Published",
      unpublished: "Draft",
      upcoming: "Upcoming",
      past: "Past",
      viewDetails: "View details",
      notAvailable: "Not available yet",
      assigned: "Assigned",
      reserves: "Reserves",
      acknowledge: "Acknowledge",
      acknowledged: "Acknowledged",
      membersOnly: "Members only",
      adminOnly: "Admins only",
    },
    userSettings: {
      title: "User settings",
      description:
        "Prepare the profile, preferences, and Steam connection flow for later backend wiring.",
      steamConnected: "Steam linked",
      steamDisconnected: "Steam not linked",
      connectSteam: "Link Steam",
    },
    serverSettings: {
      title: "Server settings",
      description: "Manage how this server looks and who can run operations.",
    },
    userManagement: {
      title: "User management",
      description:
        "Add people from the existing system as main members or mercenaries while enforcing clan membership rules.",
      addMember: "Add as member",
      addMerc: "Add as mercenary",
      removeMember: "Remove member",
      removeMerc: "Remove mercenary",
      memberLabel: "Main member",
      mercLabel: "Mercenary",
      eligibleMembers: "Eligible for member",
      eligibleMercs: "Eligible for mercenary",
      blocked: "Not eligible",
      searchPlaceholder: "Search players in the system...",
      noResults: "No matching users found in the system.",
      rulesTitle: "Assignment rules",
      rulesMember:
        "A player can only become a main member if they do not already belong to another main clan.",
      rulesMerc:
        "A player can be a mercenary for other clans, but cannot be both member and mercenary in the same clan.",
      rulesSystem:
        "Search only returns users already present in our system, ready for backend autocomplete later.",
      tablePlayer: "Player",
      tableType: "Type",
      tableGroup: "Group",
      tableState: "State",
      paused: "Paused",
      active: "Active",
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
