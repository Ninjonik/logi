export const supportedClanLanguages = ["en", "cs"] as const;

export type ClanLanguage = (typeof supportedClanLanguages)[number];

type ClanDiscordMessages = {
  locale: string;
  buttons: {
    acknowledgeAttendance: string;
    attend: string;
    addToCalendar: string;
    decline: string;
  };
  interaction: {
    unableToLoadEventContext: string;
    signupServerOnly: string;
    registrationClosed: string;
    invalidSignupButton: string;
    unableToResolveMembership: string;
    missingRequiredRole: string;
    signupUpdated: string;
    markedNotAttending: string;
    attendanceNotOpen: string;
    rosterNotPublished: string;
    notOnRoster: string;
    attendanceAcknowledged: string;
  };
  reminders: {
    title: string;
    body: string;
    meeting: string;
    eventThread: string;
    openInDiscord: string;
  };
  embed: {
    map: string;
    side: string;
    cap: string;
    server: string;
    password: string;
    description: string;
    registrationEnds: string;
    meeting: string;
    matchStart: string;
    status: string;
    managedFooter: string;
    nobodyYet: string;
    notAttending: string;
  };
  forum: {
    matchInformation: string;
    noExtraNotes: string;
    map: string;
    side: string;
    cap: string;
    server: string;
    serverPassword: string;
    gameStart: string;
    notSet: string;
    managedFooter: string;
    debrief: string;
    debriefTitle: string;
    debriefDescription: string;
  };
  statuses: {
    registration: string;
    closed: string;
    starting: string;
    concluded: string;
  };
  calendar: {
    fallbackDetails: string;
    fallbackLocation: string;
  };
  rosterImage: {
    roster: string;
    unknown: string;
    server: string;
    password: string;
    meeting: string;
    matchStart: string;
    stats: string;
    assigned: string;
    cap: string;
    reserves: string;
    noReserves: string;
    details: string;
    description: string;
    notes: string;
    openSlot: string;
    slots: string;
  };
};

const clanDiscordMessages: Record<ClanLanguage, ClanDiscordMessages> = {
  en: {
    locale: "en-GB",
    buttons: {
      acknowledgeAttendance: "Acknowledge attendance",
      attend: "Attend",
      addToCalendar: "Add to Calendar",
      decline: "Decline",
    },
    interaction: {
      unableToLoadEventContext: "Unable to load event context.",
      signupServerOnly: "Signup buttons can only be used from the server event message.",
      registrationClosed: "Registration is already closed for this event.",
      invalidSignupButton: "That signup button is no longer valid.",
      unableToResolveMembership: "Unable to resolve your server membership.",
      missingRequiredRole: "You do not have the required Discord role for this signup.",
      signupUpdated: "Signup updated.",
      markedNotAttending: "Marked as not attending.",
      attendanceNotOpen: "Attendance acknowledgement is not open right now.",
      rosterNotPublished: "Roster is not published for this event yet.",
      notOnRoster: "You are not on the roster for this event.",
      attendanceAcknowledged: "Attendance acknowledged.",
    },
    reminders: {
      title: "Attendance check for",
      body: "Please acknowledge before the meeting if you can still make it.",
      meeting: "Meeting",
      eventThread: "Event thread",
      openInDiscord: "open in Discord",
    },
    embed: {
      map: "Map",
      side: "Side",
      cap: "Cap",
      server: "Server",
      password: "Password",
      description: "Description",
      registrationEnds: "Registration Ends",
      meeting: "Headcount / Meeting",
      matchStart: "Match Start",
      status: "Status",
      managedFooter: "Managed via Logi • Times adapt to your device",
      nobodyYet: "*Nobody yet*",
      notAttending: "Not Attending",
    },
    forum: {
      matchInformation: "Match information",
      noExtraNotes: "No extra notes yet.",
      map: "Map",
      side: "Side",
      cap: "Cap",
      server: "Server",
      serverPassword: "Server password",
      gameStart: "Game start",
      notSet: "Not set",
      managedFooter: "Managed from Logi in",
      debrief: "Debrief",
      debriefTitle: "Debrief",
      debriefDescription: "Use this thread for after-action notes, lessons learned, and follow-up discussion.",
    },
    statuses: {
      registration: "Registration",
      closed: "Closed",
      starting: "Starting",
      concluded: "Concluded",
    },
    calendar: {
      fallbackDetails: "Operation briefing from Logi.",
      fallbackLocation: "Discord",
    },
    rosterImage: {
      roster: "Roster",
      unknown: "Unknown",
      server: "Server",
      password: "Password",
      meeting: "Meeting",
      matchStart: "Match Start",
      stats: "Stats",
      assigned: "assigned",
      cap: "Cap",
      reserves: "Reserves",
      noReserves: "No reserves",
      details: "Details",
      description: "Description",
      notes: "Notes",
      openSlot: "Open slot",
      slots: "slots",
    },
  },
  cs: {
    locale: "cs-CZ",
    buttons: {
      acknowledgeAttendance: "Potvrdit účast",
      attend: "Zúčastním se",
      addToCalendar: "Přidat do kalendáře",
      decline: "Odmítnout",
    },
    interaction: {
      unableToLoadEventContext: "Nepodařilo se načíst kontext akce.",
      signupServerOnly: "Tlačítka přihlášení fungují pouze u zprávy akce na serveru.",
      registrationClosed: "Registrace na tuto akci je již uzavřena.",
      invalidSignupButton: "Toto tlačítko přihlášení už není platné.",
      unableToResolveMembership: "Nepodařilo se ověřit vaše členství na serveru.",
      missingRequiredRole: "Pro toto přihlášení nemáte požadovanou Discord roli.",
      signupUpdated: "Přihlášení bylo upraveno.",
      markedNotAttending: "Označeno jako neúčast.",
      attendanceNotOpen: "Potvrzování účasti teď není otevřené.",
      rosterNotPublished: "Soupiska pro tuto akci ještě není publikovaná.",
      notOnRoster: "Na soupisce této akce nejste.",
      attendanceAcknowledged: "Účast byla potvrzena.",
    },
    reminders: {
      title: "Kontrola účasti pro",
      body: "Prosím potvrďte účast před srazem, pokud stále můžete dorazit.",
      meeting: "Sraz",
      eventThread: "Vlákno akce",
      openInDiscord: "otevřít na Discordu",
    },
    embed: {
      map: "Mapa",
      side: "Strana",
      cap: "Cap",
      server: "Server",
      password: "Heslo",
      description: "Popis",
      registrationEnds: "Konec registrace",
      meeting: "Sraz / Headcount",
      matchStart: "Start zápasu",
      status: "Stav",
      managedFooter: "Spravováno přes Logi • Časy se přizpůsobí vašemu zařízení",
      nobodyYet: "*Zatím nikdo*",
      notAttending: "Neúčastní se",
    },
    forum: {
      matchInformation: "Informace o zápasu",
      noExtraNotes: "Zatím žádné další poznámky.",
      map: "Mapa",
      side: "Strana",
      cap: "Cap",
      server: "Server",
      serverPassword: "Heslo na server",
      gameStart: "Start zápasu",
      notSet: "Nenastaveno",
      managedFooter: "Spravováno z Logi v pásmu",
      debrief: "Debrief",
      debriefTitle: "Debrief",
      debriefDescription: "Použijte toto vlákno pro poznámky po akci, zjištěné zkušenosti a navazující diskuzi.",
    },
    statuses: {
      registration: "Registrace",
      closed: "Uzavřeno",
      starting: "Začíná",
      concluded: "Ukončeno",
    },
    calendar: {
      fallbackDetails: "Briefing k operaci z Logi.",
      fallbackLocation: "Discord",
    },
    rosterImage: {
      roster: "Soupiska",
      unknown: "Neznámé",
      server: "Server",
      password: "Heslo",
      meeting: "Sraz",
      matchStart: "Start zápasu",
      stats: "Statistiky",
      assigned: "obsazeno",
      cap: "Cap",
      reserves: "Zálohy",
      noReserves: "Bez záloh",
      details: "Detaily",
      description: "Popis",
      notes: "Poznámky",
      openSlot: "Volný slot",
      slots: "slotů",
    },
  },
};

export function getClanDiscordMessages(language?: string) {
  return clanDiscordMessages[isClanLanguage(language) ? language : "en"];
}

export function getIntlLocaleForClanLanguage(language?: string) {
  return getClanDiscordMessages(language).locale;
}

export function isClanLanguage(value: string | undefined | null): value is ClanLanguage {
  return supportedClanLanguages.includes((value ?? "") as ClanLanguage);
}
