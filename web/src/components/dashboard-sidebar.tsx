"use client";

import {
  ChartBarIcon,
  GaugeIcon,
  ListChecksIcon,
  MapPinIcon,
  PlayCircleIcon,
  TrafficSignalIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterContainer,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navMain = [
  { title: "Live State", url: "/", icon: <GaugeIcon /> },
  { title: "Decision Log", url: "/decisions", icon: <ListChecksIcon /> },
  { title: "Evaluation", url: "/evaluation", icon: <ChartBarIcon /> },
  { title: "Scenarios", url: "/scenarios", icon: <PlayCircleIcon /> },
];

export function SidebarMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
  }[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                render={<Link href={item.url} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarFooter() {
  return (
    <SidebarFooterContainer>
      <Card className="gap-2 py-4 shadow-none">
        <CardHeader className="gap-1.5 px-4">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <MapPinIcon className="size-4 shrink-0" />
            Sapon Under-bridge Junction
          </CardTitle>
          <CardDescription>
            Abeokuta, Ogun State — the real junction this simulation is
            calibrated against.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 text-xs text-muted-foreground">
          Four-way junction, calibrated for peak and off-peak traffic.
        </CardContent>
      </Card>
    </SidebarFooterContainer>
  );
}

export function DashboardSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/" />}
            >
              <TrafficSignalIcon className="size-5!" />
              <span className="text-sm font-semibold">MaHanya</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMain items={navMain} />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
