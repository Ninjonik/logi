"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import React from "react";

export function AppBreadcrumbs({
  dictionary,
  locale,
}: {
  dictionary: Dictionary;
  locale: Locale;
}) {
  const pathname = usePathname();
  const params = useParams();

  const serverId = params.serverId as string | undefined;
  const eventId = params.eventId as string | undefined;
  const rosterId = params.rosterId as string | undefined;
  const groupId = params.groupId as string | undefined;
  const presetId = params.presetId as string | undefined;
  const assignmentId = params.assignmentId as string | undefined;

  // Live queries for dynamic names
  const server = useQuery(
    api.guilds.getById,
    serverId ? { guildId: serverId } : "skip"
  );
  const event = useQuery(
    api.events.getById,
    eventId ? { eventId: eventId as any } : "skip"
  );
  const roster = useQuery(
    api.serverData.getRosterById,
    rosterId ? { rosterId: rosterId as any } : "skip"
  );
  const group = useQuery(
    api.groups.getById,
    groupId ? { groupId: groupId as any } : "skip"
  );
  const squadPreset = useQuery(
    api.serverData.getSquadPresetById,
    presetId && pathname.includes("squad-presets") ? { presetId: presetId as any } : "skip"
  );
  const topicPreset = useQuery(
    api.serverData.getTopicPresetById,
    presetId && pathname.includes("topic-presets") ? { presetId: presetId as any } : "skip"
  );
  const assignment = useQuery(
    api.serverData.getAssignmentWithUser,
    assignmentId ? { assignmentId: assignmentId as any } : "skip"
  );

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
      label = event?.name || dictionary.common.unknown;
    } else if (segment === rosterId) {
      label = roster ? (event?.name ? `${event.name} ${dictionary.roster.title}` : dictionary.roster.title) : dictionary.common.unknown;
    } else if (segment === groupId) {
      label = group?.name || dictionary.common.unknown;
    } else if (segment === presetId) {
      if (pathname.includes("squad-presets")) {
        label = squadPreset?.name || dictionary.common.unknown;
      } else {
        label = topicPreset?.name || dictionary.common.unknown;
      }
    } else if (segment === assignmentId) {
      label = assignment?.userName || dictionary.common.unknown;
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
