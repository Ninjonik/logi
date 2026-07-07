"use client";

import { useQuery } from "convex/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { AppUser } from "@/types/domain";

type NotificationObject = Record<string, never>;

interface UserContextState {
  user: AppUser | null | undefined;
  setUser: Dispatch<SetStateAction<AppUser | null | undefined>>;
  notifications: NotificationObject[];
  setNotifications: Dispatch<SetStateAction<NotificationObject[]>>;
}

const UserContext = createContext<UserContextState | undefined>(undefined);

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserContextProvider");
  }
  return context;
}

export function UserContextProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AppUser | null;
}) {
  const [user, setUser] = useState<AppUser | null | undefined>(initialUser);
  const [notifications, setNotifications] = useState<NotificationObject[]>([]);

  const liveUser = useQuery(
    api.players.getById,
    initialUser?.id
      ? {
          userId: initialUser.id,
        }
      : "skip",
  );

  useEffect(() => {
    if (liveUser !== undefined) {
      setUser(liveUser);
    }
  }, [liveUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      notifications,
      setNotifications,
    }),
    [notifications, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
