"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type PlatformKey = "steam" | "epic" | "xbox" | "playstation";

const PLATFORM_GUIDES: Record<PlatformKey, string> = {
  steam: "https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC",
  epic: "https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535",
  xbox: "https://support.xbox.com/en-US/help/account-profile/profile/change-xbox-live-gamertag",
  playstation: "https://www.playstation.com/en-us/support/account/change-online-id/",
};

const SUCCESS_CLOSE_COPY: Record<Locale, string> = {
  en: "You can close this page now.",
  cs: "Tuto stránku teď můžete zavřít.",
};

export function PlatformIdLinkForm({
  token,
  userName,
  expired,
  locale,
  dictionary,
}: {
  token: string;
  userName: string;
  expired: boolean;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const [platform, setPlatform] = useState<PlatformKey | "">("");
  const [platformId, setPlatformId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedPlatform = platform ? dictionary.platformIdLink[platform] : null;
  const successCloseCopy = SUCCESS_CLOSE_COPY[locale];

  async function handleSubmit() {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/platform-id-link/${token}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ platform, platformId }),
      });
      const body = await response.json();
      if (response.ok) {
        setIsSuccess(true);
        return;
      }
      setErrorMessage(body.error ?? dictionary.platformIdLink.genericError);
    });
  }

  if (expired) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        {dictionary.platformIdLink.expired}
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-28 text-emerald-500 sm:size-36" strokeWidth={1.5} />
          <p className="mt-6 max-w-sm text-sm text-muted-foreground sm:text-base">{successCloseCopy}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.platformIdLink.title}</h1>
        <p className="text-sm text-muted-foreground">{dictionary.platformIdLink.description}</p>
      </div>
      <div className="flex justify-end">
        <LocaleSwitcher locale={locale} dictionary={dictionary} />
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        {dictionary.platformIdLink.userPrefix} <span className="font-medium text-foreground">{userName}</span>.
      </div>
      <div className="space-y-2">
        <Label>{dictionary.platformIdLink.platformLabel}</Label>
        <Select
          value={platform}
          onValueChange={(value) => {
            setPlatform(value as PlatformKey);
            setPlatformId("");
            setErrorMessage(null);
          }}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder={dictionary.platformIdLink.platformPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="steam">{dictionary.platformIdLink.steam.label}</SelectItem>
            <SelectItem value="epic">{dictionary.platformIdLink.epic.label}</SelectItem>
            <SelectItem value="xbox">{dictionary.platformIdLink.xbox.label}</SelectItem>
            <SelectItem value="playstation">{dictionary.platformIdLink.playstation.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedPlatform ? (
        <>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{selectedPlatform.label}</p>
            <p className="mt-2">{selectedPlatform.help}</p>
            <a
              href={selectedPlatform ? PLATFORM_GUIDES[platform as PlatformKey] : "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              {selectedPlatform.guideLabel ?? dictionary.platformIdLink.guideLabel}
            </a>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {selectedPlatform.steps.map((step: string) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-id">{selectedPlatform.idLabel}</Label>
            <Input
              id="platform-id"
              value={platformId}
              onChange={(event) => setPlatformId(event.target.value)}
              placeholder={selectedPlatform.placeholder}
              className="rounded-xl"
            />
          </div>

          <Button className="rounded-xl" onClick={handleSubmit} disabled={isPending || !platformId.trim()}>
            {dictionary.platformIdLink.submit}
          </Button>
        </>
      ) : null}

      {errorMessage ? <p className="text-sm text-muted-foreground">{errorMessage}</p> : null}
    </div>
  );
}
