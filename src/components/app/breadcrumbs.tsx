"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { Guild } from "@/types/domain";
import React from "react";

export function AppBreadcrumbs({
  dictionary,
  locale,
  servers,
}: {
  dictionary: Dictionary;
  locale: Locale;
  servers: Guild[];
}) {
  const pathname = usePathname();
  const params = useParams();

  const serverId = params.serverId as string | undefined;
  const eventId = params.eventId as string | undefined;
  const rosterId = params.rosterId as string | undefined;
  const groupId = params.groupId as string | undefined;
  const presetId = params.presetId as string | undefined;
  const assignmentId = params.assignmentId as string | undefined;
  const server = servers.find((item) => item.id === serverId);

  const segments = pathname.split("/").filter(Boolean);
  
  // Skip the locale segment
  const breadcrumbSegments = segments.slice(1);

  const items: { label: string; href: string; isLast: boolean }[] = [];

  let currentHref = `/${locale}`;

  breadcrumbSegments.forEach((segment, index) => {
    currentHref += `/${segment}`;
    const isLast = index === breadcrumbSegments.length - 1;

    // Skip technical segments like "dashboard", "servers"
    if (segment === "dashboard" || segment === "servers") return;

    let label = segment;

    // Map segments to i18n labels or dynamic names
    if (segment === serverId) {
      label = server?.name || dictionary.sidebar.workspace;
    } else if (segment === "calendar") {
      label = dictionary.sidebar.calendar;
    } else if (segment === "events") {
      label = dictionary.sidebar.events;
    } else if (segment === "rosters") {
      label = dictionary.sidebar.rosters;
    } else if (segment === "groups") {
      label = dictionary.sidebar.groups;
    } else if (segment === "topic-presets") {
      label = dictionary.sidebar.topicPresets;
    } else if (segment === "squad-presets") {
      label = dictionary.sidebar.squadPresets;
    } else if (segment === "users") {
      label = dictionary.sidebar.users;
    } else if (segment === "settings") {
      label = dictionary.sidebar.serverSettings;
    } else if (segment === "create") {
      label = dictionary.common.create;
    } else if (segment === eventId) {
      label = dictionary.event.infoTitle;
    } else if (segment === rosterId) {
      label = dictionary.roster.title;
    } else if (segment === groupId) {
      label = dictionary.sidebar.groups;
    } else if (segment === presetId) {
      if (pathname.includes("squad-presets")) {
        label = dictionary.presets.squadPresetMetaFallback;
      } else {
        label = dictionary.presets.topicPresetMetaFallback;
      }
    } else if (segment === assignmentId) {
      label = dictionary.sidebar.users;
    }

    items.push({ label, href: currentHref, isLast });
  });

  if (items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/${locale}/dashboard`}>{dictionary.sidebar.home}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, index) => (
          <React.Fragment key={item.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
