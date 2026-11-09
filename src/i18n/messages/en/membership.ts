export const membershipMessages = {
    ticketSettings: {
        questionsTitle: "Questions in the form",
        questionsCount: "{count} of {max}",
        edit: "Edit",
        doneEditing: "Done",
        removeQuestion: "Remove question",
        requiredShort: "required",
        optionalShort: "optional",
        untitledQuestion: "Untitled question",
        noQuestionsShort:
            "No questions: the thread opens right after the click.",
        enabledLabel: "On",
        enabledAria: "Tickets on",
        flowLabel: "How a ticket works",
        flow: {
            pick: "A member picks a category in the panel",
            form: "Fills in a short form",
            thread: "A private thread with support opens",
            close: "Support closes it and the author gets a DM",
        },
        panelSection: "Panel",
        panelChannel: "Channel with the panel",
        threadChannel: "Where threads open",
        threadChannelHint:
            "The bot needs to be able to create private threads here.",
        threadChannelOk: "The bot can open private threads here",
        categoriesShort: "Categories",
        categoriesEditorNote: "Each category is one button in the panel.",
        headingLabel: "Heading",
        textLabel: "Text",
        imageOptional: "optional",
        previewTitle: "Preview in Discord",
        panelColor: "Panel colour",
        panelColorHint: "Empty = the clan colour. Hex, e.g. #E8A33D.",
        panelColorInvalid: "The colour must be hex, e.g. #E8A33D.",
        threadTitle: "Thread card title",
        threadTitlePlaceholder: "{author} is reporting a player",
        threadTitleHint:
            "{author} is the author's name, {category} the category. Empty reads “{author} · {category}”.",
        columns: {
            button: "Button",
            handledBy: "Who answers",
            questions: "Questions",
            actions: "Actions",
        },
        nobodyAdmins: "nobody, only Logi administrators",
        removeCategory: "Remove category",
        untitledCategory: "Untitled category",
        noCategoriesDescription:
            "Each category becomes a button in the panel, for example Report a player or Bot problem.",
        saveNote: "Saves ticket settings.",
        saveAndRefresh: "Save and update the panel",
        discard: "Discard",
        unsaved: "Unsaved changes",
        title: "Ticket settings",
        pageDescription:
            "Configure the ticket panel, categories, staff roles, and modal questions for Discord tickets.",
        enableTitle: "Enable ticket system",
        enableDescription:
            "Post a configurable ticket panel in Discord and open private ticket threads from its category buttons.",
        submitChannel: "Submit ticket channel",
        parentChannel: "Ticket thread parent channel",
        panelTitle: "Panel embed title",
        panelDescription: "Panel embed description",
        panelDescriptionPlaceholder:
            "Explain how members should use this ticket panel.",
        image: "Thumbnail image",
        embedLimitNotice: "The panel text in Discord is currently using",
        embedLimitExceeded:
            "(too long, trim some category descriptions before saving).",
        categoriesTitle: "Ticket categories",
        categoriesDescription:
            "Each category becomes a button and can optionally open a Discord modal before the ticket thread is created.",
        addCategory: "Add category",
        categoryLabel: "Category",
        buttonText: "Button text",
        buttonTextPlaceholder: "Report a player",
        emoji: "Emoji",
        pickServerEmoji: "Pick a server emoji",
        typeAnyEmoji: "or type any emoji",
        categoryDescription: "Description",
        categoryDescriptionPlaceholder:
            "Shown in the panel after the category name, e.g. “behaviour on the server”.",
        supportRoles: "Support roles invited to this ticket",
        modalQuestions: "Modal questions",
        modalQuestionsDescription:
            "Discord supports up to 5 text inputs per modal.",
        addQuestion: "Add question",
        questionLabel: "Question",
        questionText: "Question label",
        questionTextPlaceholder: "What happened?",
        inputStyle: "Input style",
        shortInput: "Short",
        paragraphInput: "Paragraph",
        placeholder: "Placeholder",
        required: "Required",
        noQuestions:
            "No modal questions yet. If you leave this empty, clicking the button will create the ticket immediately.",
        noCategories: "No ticket categories yet.",
        defaultPanelTitle: "Need help?",
        defaultPanelDescription:
            "Choose what you need help with. A private thread opens that only you and the admins can see.",
        incompleteTitle: "Ticket panel setup is incomplete",
        incompleteDescription:
            "The ticket system is enabled, but the Discord ticket panel will not be posted and ticket threads cannot open until you finish: {items}.",
        routingInfoTitle: "How ticket routing works",
        routingInfoDescription:
            "Category support roles are invited into new ticket threads automatically. Dashboard administrators can manage tickets but are not added to every thread.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Logi ID (Discord not linked)",
        title: "Membership role operations",
        refresh: "Refresh",
        loading: "Loading…",
        description:
            "Latest 100 staff or application operations across games. Saving a member queues a change; only a verified Discord result is marked applied. Denied, superseded and failed operations are removed 30 days after they finished.",
        error: "Role operations are unavailable. Refresh to try again.",
        empty: "No managed role operations yet.",
        target: "Member Discord ID",
        actor: "Actor Discord ID",
        origin: "Source",
        version: "Version",
        updated: "Updated",
        audit: "Attempt history",
        auditDescription:
            "Latest 5 attempts shown; up to 20 retained per operation. A daily check that confirms the roles adds no attempt. Times are UTC. Reason codes help diagnose failures.",
        reason: "Reason",
        status: {
            pending: "Pending",
            running: "In progress",
            retry_scheduled: "Retry scheduled",
            applied: "Applied",
            denied: "Denied",
            superseded: "Superseded",
            failed: "Failed",
        },
        provenance: {
            dashboard: "Administrator",
            recruitment: "Recruitment staff",
            application: "Member application",
            rollback: "Application rollback",
        },
        hint: {
            pending: "The bot will check permissions before changing roles.",
            running:
                "The bot is checking Discord and applying the current request.",
            retry_scheduled:
                "The bot will retry automatically after the waiting period.",
            applied:
                "Discord roles matched this request at the last check. The bot checks again once a day.",
            denied: "Check staff access, membership, bot permissions and role hierarchy, then save a new member request.",
            superseded:
                "The assignment or policy changed. Only a new authorized request can apply the updated state.",
            failed: "Automatic retries stopped. Resolve the cause and save a new member request.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "clan role not set",
        applicationsTitle: "Join requests",
        applicationsChannel: "The Apply button in #{channel}",
        applicationsNoChannel:
            "Choose the panel channel under Panel and threads.",
        roleSyncToggleTitle: "Role sync",
        roleSyncToggleDescription:
            "Logi adds and removes roles by member status. It is switched on and off together with join requests.",
        roleSyncOn: "On",
        roleSyncOff: "Off",
        roleSyncSwitchDescription:
            "Logi adds and removes roles by member status. It also works while applications are switched off.",
        skipPendingCategoryTitle: "Skip waiting and add straight as a recruit",
        skipPendingCategoryHelp: "Main members only.",
        categoryDescriptionHelp:
            "In the panel it follows the name and the game; in window 1 it sits under the category name.",
        addRole: "role",
        addRoleAria: "Add a role: {status}",
        removeRole: "Remove role {role}",
        roleSearch: "Search roles",
        roleEmpty: "No other role.",
        tabsLabel: "Membership sections",
        tabs: {
            categories: "Categories",
            panel: "Panel and threads",
            scores: "Attendance points",
            roleChanges: "Role changes",
        },
        categoryButtonTitle: "In the panel and window 1",
        categoryText: "Name",
        categoryDescriptionLabel: "Description",
        resultTitle: "After approval the player becomes",
        rolesByStatus: "Roles by status",
        statusPending: "Waiting for a decision",
        statusRecruit: "Recruit",
        noRoles: "no roles",
        includeClanRoleTitle: "Give the clan role",
        includeClanRoleRecruitHelp:
            "Grant the clan role while this category is a recruit.",
        includeClanRoleFinalHelp:
            "Grant the clan role when this category is approved, including mercenaries.",
        handledBy: "Who handles requests",
        handledByAdmins: "and Logi administrators",
        clanRoleNote:
            "{role} is the clan role from Roles and access. Configure it separately for each category and status below.",
        clanRoleMissingNote:
            "The clan role is not set yet. Choose it in Roles and access; it applies to every category.",
        clanRoleLink: "Open Roles and access",
        missingFinalRole: "final role missing",
        missingRecruitRole: "recruit role missing",
        removeCategory: "Remove category",
        noCategoriesDescription:
            "Each category is one option in the application, for example main member, reserve or mercenary.",
        rolePlaceholder: "Add a role",
        saveNote: "Saves membership settings.",
        discard: "Discard",
        saveShort: "Save",
        unsaved: "Unsaved changes",
        title: "Membership settings",
        pageDescription:
            "Configure the Discord application embed, required application categories, and default assignment behavior for new clan members.",
        enableTitle: "Enable membership applications",
        enableDescription:
            "Post a clan application embed in Discord and open staff-managed private threads from it.",
        submitChannel: "Submit embed channel",
        parentChannel: "Application thread parent",
        skipPendingTitle: "Skip pending phase",
        skipPendingDescription:
            "New member applications start as recruits immediately after submission.",
        inviteSupportMembersIndividuallyTitle:
            "Add support-role members individually",
        inviteSupportMembersIndividuallyDescription:
            "On: Logi adds everyone with the category's support roles to each application's thread, one by one. Off: Logi does not add them, and they only get into the thread when their support role is mentioned there; Discord does that only for roles with fewer than 100 members. Logi admins can handle applications in Logi without being in the thread.",
        panelTitle: "Panel title",
        panelDescription: "Panel description",
        welcomeMessage: "Application thread welcome message",
        welcomeMessageDescription:
            "Posted above the application summary in each private thread. Use {applicant}, {support_roles}, and {category} for live Discord mentions and the selected category.",
        welcomeMessagePlaceholder:
            "Hi {applicant}, thanks for applying. {support_roles} will be with you shortly.",
        image: "Thumbnail image",
        applicationThumbnail: "Application thumbnail",
        specializationTitle: "Ask for specialization",
        specializationDescription:
            "Show Infantry and Armour as a step in the Discord application wizard. Wardogs never shows this step.",
        categoryGame: "Game",
        categoryDetails: "Category details",
        categoryRoles: "Roles and access",
        categoryRolesDescription:
            "Choose the roles Logi manages after approval and the staff who can access the application thread.",
        categoriesTitle: "Application categories",
        categoriesDescription:
            "Each category becomes a button. Modal questions are optional and reuse the same pattern as tickets.",
        addCategory: "Add category",
        buttonLabel: "Button label",
        applicationResult: "Application result",
        recruitRole: "Recruit role for this category",
        recruitRolePlaceholder: "Recruit role",
        finalRole: "Final role for this category",
        finalRolePlaceholder: "Final role",
        modalQuestionsDescription: "Up to 5 text fields.",
        noQuestions:
            "No modal questions yet. Leave this empty if the category should open the thread immediately after the precheck.",
        noCategories: "No application categories yet.",
        embedFieldUsage: "Embed field usage: {length} / {max}",
        embedFieldTooLong:
            "(too long, trim category descriptions before saving)",
        incompleteTitle: "Membership panel setup is incomplete",
        incompleteDescription:
            "Applications are enabled, but the Discord membership panel will not be posted and application threads cannot open until you set {items}.",
        roleSyncTitle: "How membership role sync works",
        roleSyncDescription:
            "Pending applications do not assign membership roles. Recruit status uses the clan role plus the category recruit role, and active status uses the clan role plus the category final role when those roles are configured. Membership changes are queued; verify the result in Membership settings → Membership role operations.",
        rosterScoreDescription:
            "Set per-server score changes after the event concludes. Leaving everything at 0 disables automatic score movement.",
        rosterScoreNoCategory: "No category / no reaction",
        rosterScorePresentRoster: "Reacted and present in roster",
        rosterScorePresentReserve: "Reacted and present in reserves",
        rosterScoreAbsentRoster: "Reacted and absent from roster",
        rosterScoreAbsentReserve: "Reacted and absent from reserves",
        rosterScoreExcusedAbsence: "Reacted, absent, but had notice",
        rolesMissingTitle: "Some membership roles are not configured",
        rolesMissingClanRole: "The base clan role is not set. ",
        rolesMissingRecruitRole: "Recruit role missing: {categories}. ",
        rolesMissingFinalRole: "Final role missing: {categories}. ",
        rolesMissingSummary:
            "In those cases, Logi will still track the application state, but Discord role changes will be partial or skipped.",
        save: "Save membership settings",
        saved: "Membership settings saved.",
        saveError: "Unable to save membership settings.",
    },
    userManagement: {
        previousPage: "Previous",
        nextPage: "Next",
        canAddMemberOrMercenary:
            "Can be added as a member, reserve member or mercenary.",
        mercenaryOnly:
            "Already belongs to another clan; can only be added as a mercenary.",
        missingPlayerLink:
            "Missing a player? Ask them to run /link in Discord to register with Logi. Players already assigned here are excluded.",
        missingPlayerApplication:
            "They can also submit a clan membership application.",

        grantAdminAccess: "Make admin",
        removeAdminAccess: "Remove admin access",
        adminAccessGranted: "Player is now an admin.",
        adminAccessRemoved: "Player admin access removed.",
        recheckDisplayName: "Recheck display name",
        recheckingDisplayName: "Checking display name…",
        displayNameUpdated: "Display name updated.",
        displayNameUnchanged: "Display name is already up to date.",
        displayNameRecheckFailed:
            "Unable to recheck the display name. Check that the player is in the Discord server and the bot can access them.",
        adminAccessUpdateFailed: "Unable to update player admin access.",
        title: "Players",
        description: "Manage clan members and mercenaries.",
        addMember: "Add as member",
        addReserveMember: "Add as reserve member",
        addMerc: "Add as mercenary",
        removeMember: "Remove member",
        removeMerc: "Remove mercenary",
        memberLabel: "Main member",
        reserveMemberLabel: "Reserve member",
        mercLabel: "Mercenary",
        eligibleMembers: "Eligible for member",
        eligibleMercs: "Eligible for mercenary",
        blocked: "Not eligible",
        searchPlaceholder: "Discord name, server display name or Discord ID",
        noResults: "No matching players found in the system.",
        rulesTitle: "Assignment rules",
        rulesMember:
            "A player can only become a main member if they do not already belong to another main clan.",
        rulesMerc:
            "A player can be a mercenary for other clans, but cannot be both member and mercenary in the same clan.",
        rulesSystem: "Search finds players with an existing Logi account.",
        tablePlayer: "Player",
        tableType: "Type",
        tableGroup: "Group",
        tableStatus: "Status",
        tableScore: "Score",
        platformId: "Platform ID",
        playerNote: "Player note",
        platformNotConnected: "Platform ID not set",
        platformConnectedAs: "Platform ID set as {platformId}",
        platformIdNoSpaces: "Platform ID cannot contain spaces.",
        platformAlreadyLinked:
            "This platform ID is already linked to another player.",
        paused: "Paused",
        active: "Active",
        membershipStatus: "Membership status",
        pendingLabel: "Pending",
        recruitLabel: "Recruit",
        addPlayer: "Add player",
        autoLinkPlatformIds: "Auto-link Platform IDs",
        autoLinkPlatformIdsDescription:
            "Scan imported event scoreboards, strip your clan tag from player names, and fill in matching platform IDs automatically.",
        autoLinkPlatformIdsHint:
            "Enter the clan tag exactly as it appears before player names in imported events. Example: VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "Linked {linked} platform IDs from {players} matched player entries.",
        autoLinkPlatformIdsPartial:
            "Skipped some results: {ambiguous} ambiguous, {conflicts} conflicts, {failed} failed events.",
        dedupePlayerStats: "Dedupe player stats",
        dedupePlayerStatsDescription:
            "Remove duplicate imported match rows for this clan's events and keep the better non-Unknown copy when possible.",
        dedupePlayerStatsHint:
            "This only cleans imported player stats for events that belong to this clan. It does not touch other clans' matches.",
        dedupePlayerStatsSuccess:
            "Removed {matches} duplicate match rows across {users} players.",
        refreshPerformanceHistory: "Refresh clan & player stats",
        refreshPerformanceHistorySuccess: "Clan and player stats refreshed.",
        refreshPerformanceHistoryError:
            "Unable to refresh clan and player stats.",
        mergeUsers: "Merge users",
        mergeUsersDescription:
            "Merge two accounts completely. The primary account wins whenever both accounts contain overlapping data.",
        mergeUsersPrimary: "Primary account",
        mergeUsersSecondary: "Secondary account",
        mergeUsersPickPrimary: "Pick the account to keep",
        mergeUsersPickSecondary: "Pick the account to merge into it",
        mergeUsersHint:
            "This rewrites player stats, imported matches, assignments, rosters, and embedded event references to the primary account.",
        mergeUsersConfirm: "Merge accounts",
        mergeUsersSuccess: "Accounts merged.",
        clanTag: "Clan tag",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Import Discord members",
        importDiscordMembersDescription:
            "Import everyone who has a chosen Discord role into player management.",
        importDiscordMembersHint:
            "Imported players get no primary group. Matching Discord-required group roles are added as secondary groups.",
        membershipMigration: "Migrate membership by role",
        membershipMigrationDescription:
            "Pick a Discord role and the membership state it should map to for existing clan assignments.",
        membershipMigrationTarget: "Target membership state",
        membershipMigrationHint:
            "Only players already assigned in this clan are updated. Unassigned Discord members are skipped.",
        membershipMigrationSuccess: "Updated {updated} player(s) to {status}.",
        membershipMigrationSkippedUnassigned:
            "Skipped {count} Discord member(s) without a clan assignment.",
        membershipMigrationSkippedUnchanged:
            "Skipped {count} player(s) already in that membership state.",
        linkMissingDiscordIds: "Link missing Discord IDs",
        linkMissingDiscordIdsDescription:
            "Match imported players without Discord IDs against members of a selected Discord role.",
        linkMissingDiscordIdsHint:
            "Names are normalized before matching and the first matching Discord member is linked.",
        linkMissingDiscordIdsSuccess:
            "Linked {linked} imported player(s) from {scanned} candidate(s).",
        linkMissingDiscordIdsMerged:
            "Merged {count} imported player record(s) into existing Discord-linked users.",
        discordSourceRole: "Discord source role",
        discordImportSuccess:
            "Imported {players} players from {matched} matching Discord members.",
        discordImportSkipped:
            "{count} matching Discord member(s) were skipped because they could not be imported with the selected assignment type.",
        editAssignment: "Edit assignment",
        playerSearch: "Player search",
        assignmentType: "Assignment type",
        primaryGroup: "Primary group",
        secondaryGroups: "Secondary groups",
        noGroup: "No primary group",
        noSecondaryGroups: "No secondary groups",
        pauseMembership: "Pause membership",
        pauseHelp: "Use this for inactivity or temporary absence.",
        pauseNote: "Pause note",
        pauseNoteRequired: "Add a pause note when membership is paused.",
        pickPlayerFirst: "Pick a player from the in-system search list first.",
        currentAssignment: "Current assignment",
        mainClan: "Main clan",
        none: "None",
        assignmentDescription:
            "Edit assignment type, group, paused membership state, or remove the player from this clan.",
        assignmentMetaDescription:
            "Edit clan membership, mercenary role, group, and pause state.",
        assignmentTitleSuffix: "assignment",
        averageDescription: "Average across the last {count} matches.",
        storedAverageDescription: "Average across {count} imported matches.",
        averageKills: "Avg kills",
        averageKd: "Avg K/D",
        averageDeaths: "Avg deaths",
        averageOffense: "Avg offense",
        averageDefense: "Avg defense",
        averageSupport: "Avg support",
        matchKills: "Kills",
        matchKd: "K/D",
        matchDeaths: "Deaths",
        matchOffense: "Offense",
        matchDefense: "Defense",
        matchSupport: "Support",
        matchHistorySearch: "Search match history...",
        matchHistoryEvent: "Event",
        matchHistoryPlayedAt: "Played",
        removePlayerFromClan: "Remove the player from this clan.",
        removePlayerConfirm:
            "Remove this player from the clan? This will delete their assignment.",
        saveError: "Unable to save the player assignment.",
        deleteError: "Unable to delete the player assignment.",
        assignmentSaved: "Player assignment saved.",
        assignmentCreated: "Player assignment created.",
        assignmentDeleted: "Player assignment deleted.",
        primaryGroupRequired: "Pick a primary group before saving.",
        alreadyAssigned: "This player is already assigned to this clan.",
        mercenaryRecruitStatusError:
            "Mercenaries cannot use the recruit status.",
        reserveMemberRecruitStatusError:
            "Reserve members cannot use the recruit status.",
        roleSyncTitle: "How membership role sync works",
        roleSyncDescription:
            "Group-linked Discord roles sync from the selected primary and secondary groups. Membership roles only sync for non-pending members, and recruit or active status depends on the clan role plus the linked membership category roles when available. Membership changes are queued; verify the result in Membership settings → Membership role operations.",
        missingClanRoleTitle: "Clan role is not configured",
        missingClanRoleDescription:
            "This player can still be marked as recruit or active in Logi, but no base clan role will be added in Discord until the clan role is set in clan settings.",
        missingMembershipCategoryTitle:
            "This assignment is not linked to a membership category",
        missingMembershipCategoryDescription:
            "Recruit and final category roles cannot be synced for manual assignments without a linked membership application category. Only the clan role and group-linked roles can be applied in Discord.",
        missingCategoryRolesTitle: "Membership category roles are incomplete",
        missingRecruitRoleDescription:
            "This category has no recruit role configured. ",
        missingFinalRoleDescription:
            "This category has no final role configured. ",
        missingCategoryRolesSummary:
            "Logi will keep the membership status here, but the matching Discord role will not be added for that stage.",
        platformIdsHint:
            "Separate several IDs with commas. A Steam ID has 17 digits and starts with 7656119; write Xbox and PlayStation IDs as xbox:… or psn:….",
        platformIdsInvalid: "Fix the marked platform IDs before saving.",
        platformIssues: {
            steam_format:
                "Not a Steam ID: it must have 17 digits and start with 7656119.",
            epic_format: "Not an Epic Games ID.",
            too_long: "Too long for a platform ID.",
            duplicate: "Listed twice; it is saved once.",
            linked_elsewhere: "Already linked to {name}.",
        },
        grantAdminTitle: "Make {name} an admin?",
        grantAdminDescription:
            "{name} can then change this clan's settings, matches, rosters and members in the Logi dashboard. You can remove the access later.",
        removeAdminTitle: "Remove admin access from {name}?",
        removeAdminDescription:
            "{name} stays in the clan but can no longer manage it in the dashboard, unless a Discord role still grants access.",
        removePlayerTitle: "Remove {name} from the clan?",
        removePlayerDescription:
            "Their assignment, groups and membership status in this clan are deleted, and Logi removes the Discord roles it manages for them. Match history stays.",
    },
} as const
