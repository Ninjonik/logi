import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { UserSettingsForm } from "@/components/app/user-settings-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";
import { getSteamProfileCached } from "@/lib/steam";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: dictionary.userSettings.title,
    description: dictionary.userSettings.description,
  };
}

export default async function UserSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const user = await getCurrentPlayer();

  if (!user) {
    return null;
  }

  const steamProfile = await getSteamProfileCached(user.id, user.steamId);

  return (
    <>
      <PageHeader title={dictionary.userSettings.title} description={dictionary.userSettings.description} />
      <div className="px-4 lg:px-6">
        <UserSettingsForm user={user} dictionary={dictionary} steamProfile={steamProfile} />
      </div>
    </>
  );
}
