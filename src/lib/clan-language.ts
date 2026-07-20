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
    attending: string;
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
  panels: {
    ticketManagedFooter: string;
    ticketCategories: string;
    membershipManagedFooter: string;
    membershipApplications: string;
  };
  commands: {
    closeTicketDescription: string;
    closeApplicationDescription: string;
    reasonOptionDescription: string;
    outcomeOptionDescription: string;
    outcomeDenied: string;
    outcomePending: string;
    outcomeRecruit: string;
    outcomeMember: string;
    outcomeMercenary: string;
  };
  ticket: {
    serverOnly: string;
    unavailable: string;
    modalTitle: string;
    setupIncomplete: string;
    parentChannelNotText: string;
    createThreadFailed: string;
    recordFailed: string;
    introFailed: string;
    created: string;
    closeCommandThreadOnly: string;
    notTracked: string;
    alreadyClosed: string;
    unableToVerifyPermissions: string;
    noClosePermission: string;
    closeDmClosed: string;
    noCloseReasonProvided: string;
    reasonLabel: string;
    closeAuditReason: string;
    closeReply: string;
    closeReplyWithReason: string;
    threadTitle: string;
    category: string;
    createdBy: string;
    openedBy: string;
  };
  membership: {
    serverOnly: string;
    unavailable: string;
    alreadyInClan: string;
    openApplicationExists: string;
    dmSent: string;
    dmFailed: string;
    modalTitle: string;
    setupIncomplete: string;
    alreadyAssigned: string;
    parentChannelNotText: string;
    createAssignmentFailed: string;
    createThreadFailed: string;
    recordFailed: string;
    introFailed: string;
    created: string;
    closeCommandThreadOnly: string;
    guildUnavailable: string;
    notTracked: string;
    alreadyClosed: string;
    unableToVerifyPermissions: string;
    noClosePermission: string;
    closeDmClosed: string;
    noCloseReasonProvided: string;
    outcomeLabel: string;
    reasonLabel: string;
    closeAuditReason: string;
    closeReply: string;
    closeReplyWithReason: string;
    platformIdButton: string;
    platformIdDmIntro: string;
    platformIdDmInstruction: string;
    threadTitle: string;
    category: string;
    createdBy: string;
    openedBy: string;
    initialStatus: string;
    statusPending: string;
    statusRecruit: string;
    statusMember: string;
    statusMercenary: string;
  };
  scheduledEvent: {
    map: string;
    side: string;
    cap: string;
    server: string;
    password: string;
    managedFallback: string;
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
      attending: "Attending",
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
    panels: {
      ticketManagedFooter: "Managed by Logi tickets",
      ticketCategories: "Categories",
      membershipManagedFooter: "Managed by Logi memberships",
      membershipApplications: "Applications",
    },
    commands: {
      closeTicketDescription: "Close the current ticket thread.",
      closeApplicationDescription: "Close the current membership application thread.",
      reasonOptionDescription: "Reason shown to the user in DMs.",
      outcomeOptionDescription: "What the applicant should become after closing.",
      outcomeDenied: "Denied",
      outcomePending: "Pending",
      outcomeRecruit: "Recruit",
      outcomeMember: "Member",
      outcomeMercenary: "Mercenary",
    },
    ticket: {
      serverOnly: "Tickets can only be opened inside a server.",
      unavailable: "Ticket setup is not available right now.",
      modalTitle: "Ticket details",
      setupIncomplete: "Ticket setup is incomplete.",
      parentChannelNotText: "Ticket parent channel is not a text channel.",
      createThreadFailed: "I couldn't create the ticket thread. Check the bot's permissions for the ticket parent channel.",
      recordFailed: "The ticket could not be recorded, so the thread was closed. Please try again.",
      introFailed: "Your ticket thread was created, but I couldn't post the intro message: {url}",
      created: "Your ticket has been created: {url}",
      closeCommandThreadOnly: "Use this command inside a ticket thread.",
      notTracked: "This thread is not tracked as a ticket.",
      alreadyClosed: "This ticket is already closed.",
      unableToVerifyPermissions: "Unable to verify your permissions for this ticket.",
      noClosePermission: "You do not have permission to close this ticket.",
      closeDmClosed: "Your ticket #{number} in **{guildName}** has been closed.",
      noCloseReasonProvided: "No close reason was provided.",
      reasonLabel: "Reason",
      closeAuditReason: "Ticket closed",
      closeReply: "Ticket closed.",
      closeReplyWithReason: "Ticket closed. Reason: {reason}",
      threadTitle: "Ticket #{number}",
      category: "Category",
      createdBy: "Created by",
      openedBy: "Opened by {creatorTag}",
    },
    membership: {
      serverOnly: "Applications can only be opened inside a server.",
      unavailable: "Membership applications are not available right now.",
      alreadyInClan: "You are already added to this clan. Ask staff if your membership status needs to be changed.",
      openApplicationExists: "You already have an open clan application. Wait for staff to close it before opening another.",
      dmSent: "I sent you a DM with a direct link to submit your platform ID. Submit it there, then click this button again.",
      dmFailed: "I could not DM you. Use this one-time link to submit your platform ID, then click the button again: {link}",
      modalTitle: "Clan application",
      setupIncomplete: "Membership application setup is incomplete.",
      alreadyAssigned: "You are already assigned to this clan.",
      parentChannelNotText: "Application parent channel is not a text channel.",
      createAssignmentFailed: "I couldn't create the membership assignment for this application. Please try again.",
      createThreadFailed: "I couldn't create the application thread, so no application was opened. Check the bot's permissions and try again.",
      recordFailed: "The application could not be recorded, so the thread was closed. Please try again.",
      introFailed: "Your clan application thread was created, but I couldn't post the intro message: {url}",
      created: "Your clan application has been created: {url}",
      closeCommandThreadOnly: "Use this command inside an application thread.",
      guildUnavailable: "Unable to resolve the guild for this application.",
      notTracked: "This thread is not tracked as a membership application.",
      alreadyClosed: "This application is already closed.",
      unableToVerifyPermissions: "Unable to verify your permissions for this application.",
      noClosePermission: "You do not have permission to close this application.",
      closeDmClosed: "Your clan application #{number} in **{guildName}** has been closed.",
      noCloseReasonProvided: "No close reason was provided.",
      outcomeLabel: "Outcome",
      reasonLabel: "Reason",
      closeAuditReason: "Application closed",
      closeReply: "Application closed as {outcome}.",
      closeReplyWithReason: "Application closed as {outcome}. Reason: {reason}",
      platformIdButton: "Submit platform ID",
      platformIdDmIntro: "Before we can continue your clan application, we need a platform ID we can match to Hell Let Loose.",
      platformIdDmInstruction: "Use the button below to open the one-time submission page. When it says successful, close it and click the application button again in Discord.",
      threadTitle: "Application #{number}",
      category: "Category",
      createdBy: "Created by",
      openedBy: "Opened by {creatorTag}",
      initialStatus: "Initial status",
      statusPending: "Pending",
      statusRecruit: "Recruit",
      statusMember: "Member",
      statusMercenary: "Mercenary",
    },
    scheduledEvent: {
      map: "Map",
      side: "Side",
      cap: "Cap",
      server: "Server",
      password: "Password",
      managedFallback: "Managed by Logi.",
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
      attending: "Účastní se",
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
    panels: {
      ticketManagedFooter: "Spravováno přes Logi tickety",
      ticketCategories: "Kategorie",
      membershipManagedFooter: "Spravováno přes Logi přihlášky",
      membershipApplications: "Přihlášky",
    },
    commands: {
      closeTicketDescription: "Uzavře aktuální ticket vlákno.",
      closeApplicationDescription: "Uzavře aktuální vlákno členské přihlášky.",
      reasonOptionDescription: "Důvod zobrazený uživateli v DM.",
      outcomeOptionDescription: "Čím se má žadatel po uzavření stát.",
      outcomeDenied: "Zamítnuto",
      outcomePending: "Čekající",
      outcomeRecruit: "Rekrut",
      outcomeMember: "Člen",
      outcomeMercenary: "Žoldák",
    },
    ticket: {
      serverOnly: "Tickety lze otevřít pouze uvnitř serveru.",
      unavailable: "Nastavení ticketů teď není dostupné.",
      modalTitle: "Detaily ticketu",
      setupIncomplete: "Nastavení ticketů není kompletní.",
      parentChannelNotText: "Nadřazený ticket kanál není textový kanál.",
      createThreadFailed: "Nepodařilo se vytvořit ticket vlákno. Zkontrolujte oprávnění bota pro nadřazený ticket kanál.",
      recordFailed: "Ticket se nepodařilo uložit, takže bylo vlákno uzavřeno. Zkuste to prosím znovu.",
      introFailed: "Vaše ticket vlákno bylo vytvořeno, ale nepodařilo se odeslat úvodní zprávu: {url}",
      created: "Váš ticket byl vytvořen: {url}",
      closeCommandThreadOnly: "Tento příkaz použijte uvnitř ticket vlákna.",
      notTracked: "Toto vlákno není evidováno jako ticket.",
      alreadyClosed: "Tento ticket je už uzavřen.",
      unableToVerifyPermissions: "Nepodařilo se ověřit vaše oprávnění pro tento ticket.",
      noClosePermission: "Nemáte oprávnění tento ticket uzavřít.",
      closeDmClosed: "Váš ticket #{number} v **{guildName}** byl uzavřen.",
      noCloseReasonProvided: "Nebyl uveden důvod uzavření.",
      reasonLabel: "Důvod",
      closeAuditReason: "Ticket uzavřen",
      closeReply: "Ticket uzavřen.",
      closeReplyWithReason: "Ticket uzavřen. Důvod: {reason}",
      threadTitle: "Ticket #{number}",
      category: "Kategorie",
      createdBy: "Vytvořil",
      openedBy: "Otevřel {creatorTag}",
    },
    membership: {
      serverOnly: "Přihlášky lze otevřít pouze uvnitř serveru.",
      unavailable: "Členské přihlášky teď nejsou dostupné.",
      alreadyInClan: "V tomto klanu už jste přidaní. Pokud je potřeba změnit váš členský stav, kontaktujte staff.",
      openApplicationExists: "Už máte otevřenou klanovou přihlášku. Počkejte, až ji staff uzavře, než otevřete další.",
      dmSent: "Poslal jsem vám DM s přímým odkazem pro zadání vašeho platform ID. Vyplňte ho tam a potom na toto tlačítko klikněte znovu.",
      dmFailed: "Nepodařilo se mi vám poslat DM. Použijte tento jednorázový odkaz pro zadání vašeho platform ID a potom klikněte na tlačítko znovu: {link}",
      modalTitle: "Klanová přihláška",
      setupIncomplete: "Nastavení členských přihlášek není kompletní.",
      alreadyAssigned: "K tomuto klanu už jste přiřazení.",
      parentChannelNotText: "Nadřazený kanál přihlášek není textový kanál.",
      createAssignmentFailed: "Nepodařilo se vytvořit členské přiřazení pro tuto přihlášku. Zkuste to prosím znovu.",
      createThreadFailed: "Nepodařilo se vytvořit vlákno přihlášky, takže žádná přihláška nebyla otevřena. Zkontrolujte oprávnění bota a zkuste to znovu.",
      recordFailed: "Přihlášku se nepodařilo uložit, takže bylo vlákno uzavřeno. Zkuste to prosím znovu.",
      introFailed: "Vlákno vaší klanové přihlášky bylo vytvořeno, ale nepodařilo se odeslat úvodní zprávu: {url}",
      created: "Vaše klanová přihláška byla vytvořena: {url}",
      closeCommandThreadOnly: "Tento příkaz použijte uvnitř vlákna přihlášky.",
      guildUnavailable: "Nepodařilo se určit server pro tuto přihlášku.",
      notTracked: "Toto vlákno není evidováno jako členská přihláška.",
      alreadyClosed: "Tato přihláška je už uzavřená.",
      unableToVerifyPermissions: "Nepodařilo se ověřit vaše oprávnění pro tuto přihlášku.",
      noClosePermission: "Nemáte oprávnění tuto přihlášku uzavřít.",
      closeDmClosed: "Vaše klanová přihláška #{number} v **{guildName}** byla uzavřena.",
      noCloseReasonProvided: "Nebyl uveden důvod uzavření.",
      outcomeLabel: "Výsledek",
      reasonLabel: "Důvod",
      closeAuditReason: "Přihláška uzavřena",
      closeReply: "Přihláška uzavřena jako {outcome}.",
      closeReplyWithReason: "Přihláška uzavřena jako {outcome}. Důvod: {reason}",
      platformIdButton: "Zadat platform ID",
      platformIdDmIntro: "Než budeme moci pokračovat s vaší klanovou přihláškou, potřebujeme platform ID, které můžeme spárovat s Hell Let Loose.",
      platformIdDmInstruction: "Použijte tlačítko níže pro otevření jednorázové stránky pro odeslání. Až uvidíte úspěšné potvrzení, zavřete ji a v Discordu znovu klikněte na tlačítko přihlášky.",
      threadTitle: "Přihláška #{number}",
      category: "Kategorie",
      createdBy: "Vytvořil",
      openedBy: "Otevřel {creatorTag}",
      initialStatus: "Počáteční stav",
      statusPending: "Čekající",
      statusRecruit: "Rekrut",
      statusMember: "Člen",
      statusMercenary: "Žoldák",
    },
    scheduledEvent: {
      map: "Mapa",
      side: "Strana",
      cap: "Cap",
      server: "Server",
      password: "Heslo",
      managedFallback: "Spravováno přes Logi.",
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
