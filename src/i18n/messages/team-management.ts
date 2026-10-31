import type { Locale } from "../config"
const en = {
    title: "Team profile",
    clanAdministrator: "Clan administrator",
    uploadRateLimit:
        "Too many avatar uploads. Wait a few minutes and try again.",
    description:
        "Manage your team, players, competition entries and Discord connection.",
    edit: "Edit profile",
    avatar: "Team avatar",
    removeAvatar: "Remove avatar",
    avatarHint:
        "PNG, JPEG or WebP, up to 2 MiB. Save the profile to apply your avatar.",
    cancel: "Cancel",
    connection: "Discord connection",
    connectionHint:
        "Connect this team when you want to manage it with your clan. No bot installation is required.",
    createAndEnroll: "Create team and register",
    createAndEnrollHint:
        "The game is set by this competition. Your team can enter other competitions for the same game too.",
    createdNeedsPlayers:
        "Team created. Invite players to meet the minimum, then register the team here.",
    createdRegistrationFailed:
        "Team created, but registration could not complete. Check the requirements and register your existing team below.",
    createAndConnect: "Create and connect team",
    noClanTeam:
        "Your clan has no connected team yet. Create one or connect a team you already own below.",
    entries: "Competition entries",
    noEntries:
        "No competition entries yet. Choose a competition and register this team.",
    yourCompetitions: "Your competitions",
    browseCompetitions: "Join a competition",
    history: "Past applications and withdrawals",
    noCurrent: "Your clan is not entered in a competition yet.",
    noAvailable: "No other competitions are available for your team's game.",
    manageFixtures: "Manage registration and fixtures",
    stale: "This team changed while you were editing. Refresh and try again.",
    uploadError:
        "Could not upload the avatar. Use a PNG, JPEG or WebP up to 2 MiB and try again.",
    selectTeam: "Use an existing team",
    teamCreated: "Team created and registration submitted.",
}
type Messages = { [K in keyof typeof en]: string }
const cs: Messages = {
    title: "Profil týmu",
    clanAdministrator: "Správce klanu",
    uploadRateLimit:
        "Příliš mnoho nahraných avatarů. Počkejte několik minut a zkuste to znovu.",
    description:
        "Spravujte tým, hráče, přihlášky do soutěží a propojení s Discordem.",
    edit: "Upravit profil",
    avatar: "Avatar týmu",
    removeAvatar: "Odebrat avatar",
    avatarHint:
        "PNG, JPEG nebo WebP do 2 MiB. Avatar se použije po uložení profilu.",
    cancel: "Zrušit",
    connection: "Propojení s Discordem",
    connectionHint:
        "Propojte tým, pokud ho chcete spravovat se svým klanem. Instalace bota není nutná.",
    createAndEnroll: "Vytvořit tým a přihlásit",
    createAndEnrollHint:
        "Hru určuje tato soutěž. Stejný tým můžete přihlásit i do dalších soutěží pro stejnou hru.",
    createdNeedsPlayers:
        "Tým byl vytvořen. Pozvěte hráče pro splnění minima a poté zde tým přihlaste.",
    createdRegistrationFailed:
        "Tým byl vytvořen, ale přihlášení se nepodařilo dokončit. Zkontrolujte podmínky a níže přihlaste existující tým.",
    createAndConnect: "Vytvořit a propojit tým",
    noClanTeam:
        "Váš klan zatím nemá propojený tým. Vytvořte ho nebo níže propojte tým, který vlastníte.",
    entries: "Přihlášky do soutěží",
    noEntries: "Zatím žádné přihlášky. Vyberte soutěž a přihlaste tento tým.",
    yourCompetitions: "Vaše soutěže",
    browseCompetitions: "Přihlásit do soutěže",
    history: "Předchozí přihlášky a odhlášení",
    noCurrent: "Váš klan zatím není přihlášen do žádné soutěže.",
    noAvailable: "Pro hru vašeho týmu nejsou dostupné další soutěže.",
    manageFixtures: "Spravovat přihlášku a zápasy",
    stale: "Tým se během úprav změnil. Obnovte stránku a zkuste to znovu.",
    uploadError:
        "Avatar se nepodařilo nahrát. Použijte PNG, JPEG nebo WebP do 2 MiB a zkuste to znovu.",
    selectTeam: "Použít existující tým",
    teamCreated: "Tým byl vytvořen a přihláška odeslána.",
}
const de: Messages = {
    title: "Teamprofil",
    clanAdministrator: "Clanadministrator",
    uploadRateLimit:
        "Zu viele Avatar-Uploads. Warte einige Minuten und versuche es erneut.",
    description:
        "Verwalte Team, Spieler, Wettbewerbsmeldungen und Discord-Verbindung.",
    edit: "Profil bearbeiten",
    avatar: "Teamavatar",
    removeAvatar: "Avatar entfernen",
    avatarHint:
        "PNG, JPEG oder WebP bis 2 MiB. Speichere das Profil, um den Avatar zu übernehmen.",
    cancel: "Abbrechen",
    connection: "Discord-Verbindung",
    connectionHint:
        "Verbinde das Team, um es mit deinem Clan zu verwalten. Ein Bot ist nicht erforderlich.",
    createAndEnroll: "Team erstellen und anmelden",
    createAndEnrollHint:
        "Das Spiel wird vom Wettbewerb vorgegeben. Dasselbe Team kann auch an weiteren Wettbewerben für dieses Spiel teilnehmen.",
    createdNeedsPlayers:
        "Team erstellt. Lade Spieler ein, um die Mindestzahl zu erreichen, und melde das Team dann hier an.",
    createdRegistrationFailed:
        "Team erstellt, aber die Anmeldung konnte nicht abgeschlossen werden. Prüfe die Voraussetzungen und melde dein bestehendes Team unten an.",
    createAndConnect: "Team erstellen und verbinden",
    noClanTeam:
        "Dein Clan hat noch kein verbundenes Team. Erstelle eines oder verbinde unten ein Team, das dir gehört.",
    entries: "Wettbewerbsmeldungen",
    noEntries:
        "Noch keine Meldungen. Wähle einen Wettbewerb und melde dieses Team an.",
    yourCompetitions: "Deine Wettbewerbe",
    browseCompetitions: "An einem Wettbewerb teilnehmen",
    history: "Frühere Bewerbungen und Abmeldungen",
    noCurrent: "Dein Clan ist noch für keinen Wettbewerb angemeldet.",
    noAvailable:
        "Für das Spiel deines Teams sind keine weiteren Wettbewerbe verfügbar.",
    manageFixtures: "Anmeldung und Begegnungen verwalten",
    stale: "Das Team wurde während der Bearbeitung geändert. Lade die Seite neu und versuche es erneut.",
    uploadError:
        "Avatar konnte nicht hochgeladen werden. Verwende PNG, JPEG oder WebP bis 2 MiB und versuche es erneut.",
    selectTeam: "Bestehendes Team verwenden",
    teamCreated: "Team erstellt und Anmeldung eingereicht.",
}
export const getTeamManagementMessages = (locale: Locale): Messages =>
    locale === "cs" ? cs : locale === "de" ? de : en
