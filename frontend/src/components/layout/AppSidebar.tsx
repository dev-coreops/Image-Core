"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  Plus,
  LayoutDashboard,
  ImageIcon,
  Cog,
  Tag,
  GitBranch,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useDatasetStore } from "@/stores/useDatasetStore";

const navItems = [
  { title: "Datasets", href: "/datasets", icon: Database },
  { title: "New Dataset", href: "/datasets/new", icon: Plus },
];

const pipelineItems = [
  { title: "Overview", segment: "", icon: LayoutDashboard },
  { title: "Images", segment: "/images", icon: ImageIcon },
  { title: "Preprocess", segment: "/preprocess", icon: Cog },
  { title: "Label", segment: "/label", icon: Tag },
  { title: "Versions", segment: "/versions", icon: GitBranch },
];

function extractDatasetId(pathname: string): string | null {
  const match = pathname.match(/^\/datasets\/([^/]+)/);
  if (match && match[1] !== "new") return match[1];
  return null;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { currentDataset } = useDatasetStore();
  const datasetId = extractDatasetId(pathname);

  const isActive = (href: string) => {
    if (href === "/datasets/new") return pathname === href;
    if (href === "/datasets")
      return pathname === "/datasets" || (pathname.startsWith("/datasets/") && pathname !== "/datasets/new");
    return pathname === href;
  };

  const isPipelineActive = (segment: string) => {
    if (!datasetId) return false;
    const base = `/datasets/${datasetId}`;
    if (segment === "") return pathname === base;
    return pathname.startsWith(`${base}${segment}`);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Database className="h-5 w-5" />
          <span className="text-base font-semibold">ImageDataCore</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dataset pipeline nav — only when inside a dataset */}
        {datasetId && currentDataset && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="truncate" title={currentDataset.name}>
                {currentDataset.name}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {pipelineItems.map((item) => (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton
                        asChild
                        isActive={isPipelineActive(item.segment)}
                      >
                        <Link href={`/datasets/${datasetId}${item.segment}`}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
