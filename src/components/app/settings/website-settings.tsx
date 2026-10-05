import { MembershipIntegrationSettings } from "@/components/app/membership-integration-settings"
import { WebsiteEventPolicySettings } from "@/components/app/website-event-policy-settings"
import { SettingsStep } from "@/components/app/settings/settings-step"
import { CustomLoginLink } from "@/components/app/custom-login-link"
import { SsoApplications } from "@/components/app/sso-applications"
import { ApiKeyManager } from "@/components/app/api-key-manager"
import type { Dictionary } from "@/i18n/dictionaries"

/**
 * Clan website and sign-in (design G5): the API key, sign-in through Logi and
 * what the website may do for members, in the order they build on each other.
 */
export function WebsiteSettings({
    serverId,
    dictionary,
    guildLoginUrl,
}: {
    serverId: string
    dictionary: Dictionary
    guildLoginUrl: string
}) {
    const web = dictionary.integrationSettings.web
    return (
        <div className="space-y-6">
            <SettingsStep id="website-apiKeys" number={1} title={web.stepKey}>
                <ApiKeyManager serverId={serverId} dictionary={dictionary} />
            </SettingsStep>
            <SettingsStep id="website-login" number={2} title={web.stepLogin}>
                <CustomLoginLink
                    url={guildLoginUrl}
                    label={web.loginPage}
                    dictionary={dictionary}
                />
                <SsoApplications
                    serverId={serverId}
                    dictionary={dictionary}
                    title={web.ssoApps}
                />
            </SettingsStep>
            <SettingsStep
                id="website-webAccess"
                number={3}
                title={web.stepMembers}
            >
                <div className="space-y-6">
                    <MembershipIntegrationSettings
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                    <WebsiteEventPolicySettings
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </div>
            </SettingsStep>
            <p className="text-muted-foreground text-sm">{web.footer}</p>
        </div>
    )
}
