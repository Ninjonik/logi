"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

type ThemeOption = "light" | "dark" | "system";

const themeOptions: Array<{
  value: ThemeOption;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme : "system";
  const activeOption = themeOptions.find((option) => option.value === activeTheme) ?? themeOptions[2];
  const ActiveIcon = activeOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full px-3">
          <ActiveIcon className="mr-2 size-4" />
          {activeOption.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={activeTheme} onValueChange={(value) => setTheme(value as ThemeOption)}>
          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <Icon className="size-4" />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
