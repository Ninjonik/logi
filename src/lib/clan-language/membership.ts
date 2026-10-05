import { clanCopy, type ClanLanguage } from "./core"

/** Membership applications, their panel and the account step of the application (`platformFlow`). */
export type MembershipMessages = {
    panels: {
        membershipManagedFooter: string
        membershipApplications: string
        membershipApply: string
        membershipChooseGame: string
        membershipChooseCategory: string
    }
    platformFlow?: {
        title: string
        membershipIntro: string
        linkIntro: string
        startButton: string
        addAnotherButton: string
        unlinkButton: string
        manageDescription: string
        linkedFieldTitle: string
        playedBeforePrompt: string
        playedBeforePlaceholder: string
        playedBeforeYes: string
        playedBeforeYesDescription: string
        playedBeforeNo: string
        playedBeforeNoDescription: string
        playerSearchIntro: string
        playerSearchPlaceholder: string
        playerSearchNoMatches: string
        playerSearchEmptyOption: string
        playerSearchEmptyDescription: string
        playerSearchButton: string
        playerSearchModalTitle: string
        playerSearchModalLabel: string
        playerSearchModalPlaceholder: string
        platformIntro: string
        platformPlaceholder: string
        platformSteam: string
        platformEpic: string
        platformXbox: string
        platformPlaystation: string
        guideLinkLabel: string
        submitIdButton: string
        continueWithIdButton: string
        linkedSuccess: string
        linkedAndContinuing: string
        mockLinkedSuccess: string
        invalidPlatformId: string
        unlinkPrompt: string
        unlinkPlaceholder: string
        invalidAction: string
        invalidModal: string
        invalidSearchModal: string
        guides: {
            steam: {
                label: string
                help: string
                stepOne: string
                stepTwo: string
                stepThree: string
            }
            epic: {
                label: string
                help: string
                stepOne: string
                stepTwo: string
                stepThree: string
            }
            xbox: {
                label: string
                help: string
                stepOne: string
                stepTwo: string
                stepThree: string
            }
            playstation: {
                label: string
                help: string
                stepOne: string
                stepTwo: string
                stepThree: string
            }
        }
    }
    platformFlowCsFallback?: NonNullable<MembershipMessages["platformFlow"]>
    membership: {
        serverOnly: string
        unavailable: string
        alreadyInClan: string
        openApplicationExists: string
        dmSent: string
        dmFailed: string
        modalTitle: string
        setupIncomplete: string
        alreadyAssigned: string
        parentChannelNotText: string
        createAssignmentFailed: string
        createThreadFailed: string
        recordFailed: string
        introFailed: string
        created: string
        closeCommandThreadOnly: string
        guildUnavailable: string
        notTracked: string
        alreadyClosed: string
        unableToVerifyPermissions: string
        noClosePermission: string
        closeDmClosed: string
        /** Stands in for `{guildName}` when the server name cannot be read. */
        serverFallback: string
        noCloseReasonProvided: string
        closeEmbedTitle: string
        closedByLabel: string
        closedAtLabel: string
        outcomeLabel: string
        reasonLabel: string
        closeAuditReason: string
        closeReply: string
        closeReplyWithReason: string
        platformIdButton: string
        platformIdDmIntro: string
        platformIdDmInstruction: string
        platformIdReadyDm: string
        platformIdReadyInteraction: string
        threadTitle: string
        category: string
        createdBy: string
        openedBy: string
        initialStatus: string
        statusPending: string
        statusRecruit: string
        statusMember: string
        statusMercenary: string
    }
}

const membershipMessages: Record<ClanLanguage, MembershipMessages> = {
    en: {
        panels: {
            membershipManagedFooter: "Managed by Logi memberships",
            membershipApplications: "Applications",
            membershipApply: "Sign up",
            membershipChooseGame: "Choose the game you want to join.",
            membershipChooseCategory: "Choose a membership category.",
        },
        platformFlow: {
            title: "Link your platform ID",
            membershipIntro:
                "Before we can continue your clan application, you need to link a platform ID here in Discord.",
            linkIntro:
                "Link your platform ID here in Discord.",
            startButton: "Link your platform ID",
            addAnotherButton: "Add another platform ID",
            unlinkButton: "Unlink a platform ID",
            manageDescription: "Manage your linked platform IDs below.",
            linkedFieldTitle: "Linked platform IDs",
            playedBeforePrompt: "Have you played on this clan server before?",
            playedBeforePlaceholder: "Choose one option",
            playedBeforeYes: "Yes",
            playedBeforeYesDescription:
                "Search for your player from people who have already played on this clan's configured servers.",
            playedBeforeNo: "No",
            playedBeforeNoDescription:
                "Choose your platform and enter your platform ID manually.",
            playerSearchIntro:
                "Search for your player, then pick the matching entry from the players found on this clan's configured servers.",
            playerSearchPlaceholder: "Select your player name",
            playerSearchNoMatches:
                "No matching players were found on this clan's configured servers.",
            playerSearchEmptyOption: "No search results yet",
            playerSearchEmptyDescription:
                "Click Search player to load matching players",
            playerSearchButton: "Search player",
            playerSearchModalTitle: "Search player",
            playerSearchModalLabel: "Player name or code",
            playerSearchModalPlaceholder: "Type part of the name or player ID",
            platformIntro: "Choose your platform.",
            platformPlaceholder: "Select your platform",
            platformSteam: "Steam",
            platformEpic: "Epic Games",
            platformXbox: "Xbox",
            platformPlaystation: "PlayStation",
            guideLinkLabel: "Guide",
            submitIdButton: "Enter platform ID",
            continueWithIdButton: "Enter platform ID and continue",
            linkedSuccess: "Your platform ID has been linked successfully.",
            linkedAndContinuing:
                "Your platform ID has been linked. Continuing with your clan application now.",
            mockLinkedSuccess: "Your platform ID has been linked successfully.",
            invalidPlatformId: "Enter a platform ID without spaces.",
            unlinkPrompt: "Select the platform ID you want to unlink.",
            unlinkPlaceholder: "Select a platform ID to unlink",
            invalidAction: "This platform link action is no longer valid.",
            invalidModal: "This platform link modal is no longer valid.",
            invalidSearchModal: "This player search modal is no longer valid.",
            guides: {
                steam: {
                    label: "Steam64 ID",
                    help: "You need the long Steam64 number for your account.",
                    stepOne: "Open the guide.",
                    stepTwo: "Find the Steam64 ID shown there.",
                    stepThree: "Copy that long number into the next step.",
                },
                epic: {
                    label: "Epic Account ID",
                    help: "You need your Epic Account ID.",
                    stepOne: "Open the guide.",
                    stepTwo: "Open your Epic account details.",
                    stepThree: "Copy the Account ID into the next step.",
                },
                xbox: {
                    label: "Xbox ID",
                    help: "Use the same platform guidance you already use today for Xbox.",
                    stepOne: "Open the guide.",
                    stepTwo: "Confirm the correct Xbox profile identifier.",
                    stepThree: "Paste that identifier into the next step.",
                },
                playstation: {
                    label: "PlayStation ID",
                    help: "Use the same platform guidance you already use today for PlayStation.",
                    stepOne: "Open the guide.",
                    stepTwo:
                        "Confirm the correct PlayStation profile identifier.",
                    stepThree: "Paste that identifier into the next step.",
                },
            },
        },
        platformFlowCsFallback: {
            title: "Propojit platform ID",
            membershipIntro:
                "Než budeme pokračovat s vaší klanovou přihláškou, musíte si tady v Discordu propojit platform ID.",
            linkIntro:
                "Propojte si platform ID přímo tady v Discordu.",
            startButton: "Propojit platform ID",
            addAnotherButton: "Přidat další platform ID",
            unlinkButton: "Odpojit platform ID",
            manageDescription:
                "Níže můžete spravovat svá propojená platform ID.",
            linkedFieldTitle: "Propojená platform ID",
            playedBeforePrompt:
                "Hrál(a) jste už dříve na serveru tohoto klanu?",
            playedBeforePlaceholder: "Vyberte jednu možnost",
            playedBeforeYes: "Ano",
            playedBeforeYesDescription:
                "Vyhledáte svého hráče mezi lidmi, kteří už hráli na serverech nastavených pro tento klan.",
            playedBeforeNo: "Ne",
            playedBeforeNoDescription:
                "Vyberete platformu a zadáte platform ID ručně.",
            playerSearchIntro:
                "Vyhledejte svého hráče a pak vyberte odpovídající záznam z hráčů nalezených na serverech nastavených pro tento klan.",
            playerSearchPlaceholder: "Vyberte jméno hráče",
            playerSearchNoMatches:
                "Na serverech nastavených pro tento klan nebyli nalezeni žádní odpovídající hráči.",
            playerSearchEmptyOption: "Zatím žádné výsledky hledání",
            playerSearchEmptyDescription:
                "Kliknutím na Hledat hráče načtete odpovídající hráče",
            playerSearchButton: "Hledat hráče",
            playerSearchModalTitle: "Hledat hráče",
            playerSearchModalLabel: "Jméno hráče nebo kód",
            playerSearchModalPlaceholder: "Napište část jména nebo player ID",
            platformIntro: "Vyberte platformu.",
            platformPlaceholder: "Vyberte platformu",
            platformSteam: "Steam",
            platformEpic: "Epic Games",
            platformXbox: "Xbox",
            platformPlaystation: "PlayStation",
            guideLinkLabel: "Návod",
            submitIdButton: "Zadat platform ID",
            continueWithIdButton: "Zadat ID a pokračovat",
            linkedSuccess: "Vaše platform ID bylo úspěšně propojeno.",
            linkedAndContinuing:
                "Vaše platform ID bylo propojeno. Pokračuji s klanovou přihláškou.",
            mockLinkedSuccess: "Vaše platform ID bylo úspěšně propojeno.",
            invalidPlatformId: "Zadejte platform ID bez mezer.",
            unlinkPrompt: "Vyberte platform ID, které chcete odpojit.",
            unlinkPlaceholder: "Vyberte platform ID k odpojení",
            invalidAction: "Tato akce propojení platform ID už není platná.",
            invalidModal:
                "Tento modal pro propojení platform ID už není platný.",
            invalidSearchModal: "Tento modal pro hledání hráče už není platný.",
            guides: {
                steam: {
                    label: "Steam64 ID",
                    help: "Potřebujete dlouhé číselné Steam64 ID svého účtu.",
                    stepOne: "Otevřete návod.",
                    stepTwo: "Najděte zobrazené Steam64 ID.",
                    stepThree: "Zkopírujte toto dlouhé číslo do dalšího kroku.",
                },
                epic: {
                    label: "Epic Account ID",
                    help: "Potřebujete své Epic Account ID.",
                    stepOne: "Otevřete návod.",
                    stepTwo: "Otevřete detaily svého Epic účtu.",
                    stepThree: "Zkopírujte Account ID do dalšího kroku.",
                },
                xbox: {
                    label: "Xbox ID",
                    help: "Je to identifikátor vašeho Xbox profilu.",
                    stepOne: "Otevřete návod.",
                    stepTwo: "Potvrďte správný identifikátor Xbox profilu.",
                    stepThree: "Vložte tento identifikátor do dalšího kroku.",
                },
                playstation: {
                    label: "PlayStation ID",
                    help: "Je to identifikátor vašeho PlayStation profilu.",
                    stepOne: "Otevřete návod.",
                    stepTwo:
                        "Potvrďte správný identifikátor PlayStation profilu.",
                    stepThree: "Vložte tento identifikátor do dalšího kroku.",
                },
            },
        },
        membership: {
            serverOnly: "Applications can only be opened inside a server.",
            unavailable:
                "Membership applications are, at the moment, disabled.",
            alreadyInClan:
                "You are already added to this clan. Ask staff if your membership status needs to be changed.",
            openApplicationExists:
                "You already have an open clan application. Wait for staff to close it before opening another.",
            dmSent: "I sent you a DM with a direct link to submit your platform ID. Open it here: {link}. Submit it there, then click this button again.",
            dmFailed:
                "I could not DM you. Use this one-time link to submit your platform ID, then click the button again: {link}",
            modalTitle: "Clan application",
            setupIncomplete: "Membership application setup is incomplete.",
            alreadyAssigned: "You are already assigned to this clan.",
            parentChannelNotText:
                "Application parent channel is not a text channel.",
            createAssignmentFailed:
                "I couldn't create the membership assignment for this application. Please try again.",
            createThreadFailed:
                "I couldn't create the application thread, so no application was opened. Check the bot's permissions and try again.",
            recordFailed:
                "The application could not be recorded, so the thread was closed. Please try again.",
            introFailed:
                "Your clan application thread was created, but I couldn't post the intro message: {url}",
            created: "Your clan application has been created: {url}",
            closeCommandThreadOnly:
                "Use this command inside an application thread.",
            guildUnavailable:
                "Unable to resolve the guild for this application.",
            notTracked:
                "This thread is not tracked as a membership application.",
            alreadyClosed: "This application is already closed.",
            unableToVerifyPermissions:
                "Unable to verify your permissions for this application.",
            noClosePermission:
                "You do not have permission to close this application.",
            closeDmClosed:
                "Your clan application #{number} in **{guildName}** has been closed.",
            serverFallback: "Discord",
            noCloseReasonProvided: "No close reason was provided.",
            closeEmbedTitle: "Application closed",
            closedByLabel: "Closed by",
            closedAtLabel: "Closed at",
            outcomeLabel: "Outcome",
            reasonLabel: "Reason",
            closeAuditReason: "Application closed",
            closeReply: "Application closed as {outcome}.",
            closeReplyWithReason:
                "Application closed as {outcome}. Reason: {reason}",
            platformIdButton: "Submit platform ID",
            platformIdDmIntro:
                "Before we can continue your clan application, we need a platform ID we can match to the game.",
            platformIdDmInstruction:
                "Use the button below to open the one-time submission page. When it says successful, close it and click the application button again in Discord.",
            platformIdReadyDm:
                "Your platform ID is saved. You can join the clan now. Open the clan application message here and click it again: {link}",
            platformIdReadyInteraction:
                "Your platform ID is saved. You can join the clan now. Open the clan application message here and click it again: {link}",
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
    },
    cs: {
        panels: {
            membershipManagedFooter: "Spravováno přes Logi přihlášky",
            membershipApplications: "Přihlášky",
            membershipApply: "Přihlásit se",
            membershipChooseGame: "Vyberte hru, do které se chcete přihlásit.",
            membershipChooseCategory: "Vyberte členskou kategorii.",
        },
        membership: {
            serverOnly: "Přihlášky lze otevřít pouze uvnitř serveru.",
            unavailable: "Členské přihlášky teď nejsou dostupné.",
            alreadyInClan:
                "V tomto klanu už jste přidaní. Pokud je potřeba změnit váš členský stav, kontaktujte staff.",
            openApplicationExists:
                "Už máte otevřenou klanovou přihlášku. Počkejte, až ji staff uzavře, než otevřete další.",
            dmSent: "Poslal jsem vám DM s přímým odkazem pro zadání vašeho platform ID. Otevřete ho tady: {link}. Vyplňte ho tam a potom na toto tlačítko klikněte znovu.",
            dmFailed:
                "Nepodařilo se mi vám poslat DM. Použijte tento jednorázový odkaz pro zadání vašeho platform ID a potom klikněte na tlačítko znovu: {link}",
            modalTitle: "Klanová přihláška",
            setupIncomplete: "Nastavení členských přihlášek není kompletní.",
            alreadyAssigned: "K tomuto klanu už jste přiřazení.",
            parentChannelNotText:
                "Nadřazený kanál přihlášek není textový kanál.",
            createAssignmentFailed:
                "Nepodařilo se vytvořit členské přiřazení pro tuto přihlášku. Zkuste to prosím znovu.",
            createThreadFailed:
                "Nepodařilo se vytvořit vlákno přihlášky, takže žádná přihláška nebyla otevřena. Zkontrolujte oprávnění bota a zkuste to znovu.",
            recordFailed:
                "Přihlášku se nepodařilo uložit, takže bylo vlákno uzavřeno. Zkuste to prosím znovu.",
            introFailed:
                "Vlákno vaší klanové přihlášky bylo vytvořeno, ale nepodařilo se odeslat úvodní zprávu: {url}",
            created: "Vaše klanová přihláška byla vytvořena: {url}",
            closeCommandThreadOnly:
                "Tento příkaz použijte uvnitř vlákna přihlášky.",
            guildUnavailable: "Nepodařilo se určit server pro tuto přihlášku.",
            notTracked: "Toto vlákno není evidováno jako členská přihláška.",
            alreadyClosed: "Tato přihláška je už uzavřená.",
            unableToVerifyPermissions:
                "Nepodařilo se ověřit vaše oprávnění pro tuto přihlášku.",
            noClosePermission: "Nemáte oprávnění tuto přihlášku uzavřít.",
            closeDmClosed:
                "Vaše klanová přihláška #{number} v **{guildName}** byla uzavřena.",
            serverFallback: "Discordu",
            noCloseReasonProvided: "Nebyl uveden důvod uzavření.",
            closeEmbedTitle: "Přihláška uzavřena",
            closedByLabel: "Uzavřel",
            closedAtLabel: "Uzavřeno",
            outcomeLabel: "Výsledek",
            reasonLabel: "Důvod",
            closeAuditReason: "Přihláška uzavřena",
            closeReply: "Přihláška uzavřena jako {outcome}.",
            closeReplyWithReason:
                "Přihláška uzavřena jako {outcome}. Důvod: {reason}",
            platformIdButton: "Zadat platform ID",
            platformIdDmIntro:
                "Než budeme moci pokračovat s vaší klanovou přihláškou, potřebujeme platform ID, které můžeme spárovat s hrou.",
            platformIdDmInstruction:
                "Použijte tlačítko níže pro otevření jednorázové stránky pro odeslání. Až uvidíte úspěšné potvrzení, zavřete ji a v Discordu znovu klikněte na tlačítko přihlášky.",
            platformIdReadyDm:
                "Vaše platform ID je uložené. Teď už se můžete do klanu přihlásit. Otevřete si znovu zprávu s přihláškou tady a klikněte na ni znovu: {link}",
            platformIdReadyInteraction:
                "Vaše platform ID je uložené. Teď už se můžete do klanu přihlásit. Otevřete si znovu zprávu s přihláškou tady a klikněte na ni znovu: {link}",
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
    },
    de: {
        panels: {
            membershipManagedFooter: "Verwaltet via Logi-Mitgliedschaften",
            membershipApplications: "Bewerbungen",
            membershipApply: "Anmelden",
            membershipChooseGame: "Wähle das Spiel, dem du beitreten möchtest.",
            membershipChooseCategory: "Wähle eine Mitgliedschaftskategorie.",
        },
        platformFlow: {
            title: "Verknüpfen Sie Ihre Platform ID",
            membershipIntro:
                "Bevor wir mit Ihrer Clan-Bewerbung fortfahren können, müssen Sie hier in Discord eine Platform ID verknüpfen.",
            linkIntro:
                "Verknüpfen Sie Ihre Platform ID hier in Discord.",
            startButton: "Platform ID verknüpfen",
            addAnotherButton: "Weitere Platform ID hinzufügen",
            unlinkButton: "Platform ID trennen",
            manageDescription:
                "Verwalten Sie unten Ihre verknüpften Platform IDs.",
            linkedFieldTitle: "Verknüpfte Platform IDs",
            playedBeforePrompt:
                "Haben Sie schon einmal auf diesem Clan-Server gespielt?",
            playedBeforePlaceholder: "Wählen Sie eine Option",
            playedBeforeYes: "Ja",
            playedBeforeYesDescription:
                "Suchen Sie Ihren Spieler unter Personen, die bereits auf den konfigurierten Servern dieses Clans gespielt haben.",
            playedBeforeNo: "Nein",
            playedBeforeNoDescription:
                "Wählen Sie Ihre Plattform und geben Sie Ihre Platform ID manuell ein.",
            playerSearchIntro:
                "Suchen Sie Ihren Spieler und wählen Sie dann den passenden Eintrag aus den Spielern auf den konfigurierten Servern dieses Clans.",
            playerSearchPlaceholder: "Wählen Sie Ihren Spielernamen",
            playerSearchNoMatches:
                "Auf den konfigurierten Servern dieses Clans wurden keine passenden Spieler gefunden.",
            playerSearchEmptyOption: "Noch keine Suchergebnisse",
            playerSearchEmptyDescription:
                "Klicken Sie auf Spieler suchen, um passende Spieler zu laden",
            playerSearchButton: "Spieler suchen",
            playerSearchModalTitle: "Spieler suchen",
            playerSearchModalLabel: "Spielername oder Code",
            playerSearchModalPlaceholder:
                "Geben Sie einen Teil des Namens oder der Spieler-ID ein",
            platformIntro:
                "Wählen Sie Ihre Plattform. Ich zeige dieselbe Anleitungs-Kopie wie den aktuellen Website-Flow und lasse Sie dann Ihre Platform ID eingeben.",
            platformPlaceholder: "Wählen Sie Ihre Plattform",
            platformSteam: "Steam",
            platformEpic: "Epic Games",
            platformXbox: "Xbox",
            platformPlaystation: "PlayStation",
            guideLinkLabel: "Anleitung",
            submitIdButton: "Platform ID eingeben",
            continueWithIdButton: "Platform ID eingeben und fortfahren",
            linkedSuccess: "Ihre Platform ID wurde erfolgreich verknüpft.",
            linkedAndContinuing:
                "Ihre Platform ID wurde verknüpft. Ihre Clan-Bewerbung wird nun fortgesetzt.",
            mockLinkedSuccess: "Ihre Platform ID wurde erfolgreich verknüpft.",
            invalidPlatformId:
                "Geben Sie eine Platform ID ohne Leerzeichen ein.",
            unlinkPrompt:
                "Wählen Sie die Platform ID, die Sie trennen möchten.",
            unlinkPlaceholder: "Wählen Sie eine Platform ID zum Trennen",
            invalidAction: "Diese Platform-Link-Aktion ist nicht mehr gültig.",
            invalidModal: "Dieses Platform-Link-Modal ist nicht mehr gültig.",
            invalidSearchModal:
                "Dieses Spielersuche-Modal ist nicht mehr gültig.",
            guides: {
                steam: {
                    label: "Steam64 ID",
                    help: "Sie benötigen die lange Steam64-Nummer Ihres Kontos.",
                    stepOne: "Öffnen Sie die Anleitung.",
                    stepTwo: "Finden Sie die dort angezeigte Steam64 ID.",
                    stepThree:
                        "Kopieren Sie diese lange Nummer in den nächsten Schritt.",
                },
                epic: {
                    label: "Epic Account ID",
                    help: "Sie benötigen Ihre Epic Account ID.",
                    stepOne: "Öffnen Sie die Anleitung.",
                    stepTwo: "Öffnen Sie Ihre Epic-Kontodetails.",
                    stepThree:
                        "Kopieren Sie die Account ID in den nächsten Schritt.",
                },
                xbox: {
                    label: "Xbox ID",
                    help: "Nutzen Sie dieselbe Plattform-Anleitung, die Sie heute bereits für Xbox verwenden.",
                    stepOne: "Öffnen Sie die Anleitung.",
                    stepTwo: "Bestätigen Sie die korrekte Xbox-Profilkennung.",
                    stepThree:
                        "Fügen Sie diese Kennung in den nächsten Schritt ein.",
                },
                playstation: {
                    label: "PlayStation ID",
                    help: "Nutzen Sie dieselbe Plattform-Anleitung, die Sie heute bereits für PlayStation verwenden.",
                    stepOne: "Öffnen Sie die Anleitung.",
                    stepTwo:
                        "Bestätigen Sie die korrekte PlayStation-Profilkennung.",
                    stepThree:
                        "Fügen Sie diese Kennung in den nächsten Schritt ein.",
                },
            },
        },
        membership: {
            serverOnly:
                "Bewerbungen können nur innerhalb eines Servers geöffnet werden.",
            unavailable: "Mitgliedschaftsbewerbungen sind derzeit deaktiviert.",
            alreadyInClan:
                "Sie sind diesem Clan bereits hinzugefügt. Fragen Sie das Staff-Team, wenn Ihr Mitgliedschaftsstatus geändert werden muss.",
            openApplicationExists:
                "Sie haben bereits eine offene Clan-Bewerbung. Warten Sie, bis das Staff-Team sie schließt, bevor Sie eine weitere öffnen.",
            dmSent: "Ich habe Ihnen eine DM mit einem direkten Link zur Eingabe Ihrer Platform ID gesendet. Öffnen Sie ihn hier: {link}. Reichen Sie sie dort ein und klicken Sie dann erneut auf diesen Button.",
            dmFailed:
                "Ich konnte Ihnen keine DM senden. Nutzen Sie diesen einmaligen Link zur Eingabe Ihrer Platform ID und klicken Sie dann erneut auf den Button: {link}",
            modalTitle: "Clan-Bewerbung",
            setupIncomplete: "Das Bewerbungs-Setup ist unvollständig.",
            alreadyAssigned: "Sie sind diesem Clan bereits zugeordnet.",
            parentChannelNotText:
                "Der Bewerbungs-Eltern-Channel ist kein Text-Channel.",
            createAssignmentFailed:
                "Ich konnte die Mitgliedschafts-Zuweisung für diese Bewerbung nicht erstellen. Bitte versuchen Sie es erneut.",
            createThreadFailed:
                "Ich konnte den Bewerbungs-Thread nicht erstellen, daher wurde keine Bewerbung geöffnet. Prüfen Sie die Berechtigungen des Bots und versuchen Sie es erneut.",
            recordFailed:
                "Die Bewerbung konnte nicht gespeichert werden, daher wurde der Thread geschlossen. Bitte versuchen Sie es erneut.",
            introFailed:
                "Ihr Clan-Bewerbungs-Thread wurde erstellt, aber ich konnte die Intro-Nachricht nicht posten: {url}",
            created: "Ihre Clan-Bewerbung wurde erstellt: {url}",
            closeCommandThreadOnly:
                "Nutzen Sie diesen Befehl innerhalb eines Bewerbungs-Threads.",
            guildUnavailable:
                "Der Server für diese Bewerbung konnte nicht ermittelt werden.",
            notTracked:
                "Dieser Thread wird nicht als Mitgliedschaftsbewerbung geführt.",
            alreadyClosed: "Diese Bewerbung ist bereits geschlossen.",
            unableToVerifyPermissions:
                "Ihre Berechtigungen für diese Bewerbung konnten nicht geprüft werden.",
            noClosePermission:
                "Sie haben keine Berechtigung, diese Bewerbung zu schließen.",
            closeDmClosed:
                "Ihre Clan-Bewerbung #{number} in **{guildName}** wurde geschlossen.",
            serverFallback: "Discord",
            noCloseReasonProvided: "Es wurde kein Schließungsgrund angegeben.",
            closeEmbedTitle: "Bewerbung geschlossen",
            closedByLabel: "Geschlossen von",
            closedAtLabel: "Geschlossen am",
            outcomeLabel: "Ergebnis",
            reasonLabel: "Grund",
            closeAuditReason: "Bewerbung geschlossen",
            closeReply: "Bewerbung geschlossen als {outcome}.",
            closeReplyWithReason:
                "Bewerbung geschlossen als {outcome}. Grund: {reason}",
            platformIdButton: "Platform ID einreichen",
            platformIdDmIntro:
                "Bevor wir mit Ihrer Clan-Bewerbung fortfahren können, benötigen wir eine Platform ID, die wir Spiel zuordnen können.",
            platformIdDmInstruction:
                "Nutzen Sie den Button unten, um die einmalige Einreichungsseite zu öffnen. Wenn dort erfolgreich steht, schließen Sie sie und klicken Sie in Discord erneut auf den Bewerbungs-Button.",
            platformIdReadyDm:
                "Ihre Platform ID ist gespeichert. Sie können dem Clan jetzt beitreten. Öffnen Sie hier die Clan-Bewerbungsnachricht und klicken Sie erneut darauf: {link}",
            platformIdReadyInteraction:
                "Ihre Platform ID ist gespeichert. Sie können dem Clan jetzt beitreten. Öffnen Sie hier die Clan-Bewerbungsnachricht und klicken Sie erneut darauf: {link}",
            threadTitle: "Bewerbung #{number}",
            category: "Kategorie",
            createdBy: "Erstellt von",
            openedBy: "Geöffnet von {creatorTag}",
            initialStatus: "Anfangsstatus",
            statusPending: "Ausstehend",
            statusRecruit: "Recruit",
            statusMember: "Member",
            statusMercenary: "Mercenary",
        },
    },
}

/** The membership copy in the clan language; unknown languages read English. */
export const getMembershipMessages = clanCopy(membershipMessages)
