"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ImageIcon, Cog, Tag, GitBranch, Lock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dataset } from "@/types/dataset";

interface Tab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Minimum statuses that unlock this tab */
  availableStatuses: string[];
  /** Statuses where this tab's work is "done" */
  completedStatuses: string[];
}

function getTabs(datasetId: string): Tab[] {
  return [
    {
      label: "Overview",
      href: `/datasets/${datasetId}`,
      icon: LayoutDashboard,
      availableStatuses: ["created", "uploading", "uploaded", "preprocessing", "preprocessed", "labeling", "completed"],
      completedStatuses: [],
    },
    {
      label: "Images",
      href: `/datasets/${datasetId}/images`,
      icon: ImageIcon,
      availableStatuses: ["created", "uploading", "uploaded", "preprocessing", "preprocessed", "labeling", "completed"],
      completedStatuses: [],
    },
    {
      label: "Preprocess",
      href: `/datasets/${datasetId}/preprocess`,
      icon: Cog,
      availableStatuses: ["uploaded", "preprocessing", "preprocessed", "labeling", "completed"],
      completedStatuses: ["preprocessed", "labeling", "completed"],
    },
    {
      label: "Label",
      href: `/datasets/${datasetId}/label`,
      icon: Tag,
      availableStatuses: ["preprocessed", "labeling", "completed"],
      completedStatuses: ["completed"],
    },
    {
      label: "Versions",
      href: `/datasets/${datasetId}/versions`,
      icon: GitBranch,
      availableStatuses: ["labeling", "completed"],
      completedStatuses: [],
    },
  ];
}

function isTabActive(pathname: string, tabHref: string, datasetId: string): boolean {
  // Overview tab: exact match only
  if (tabHref === `/datasets/${datasetId}`) {
    return pathname === tabHref;
  }
  // Other tabs: prefix match
  return pathname.startsWith(tabHref);
}

export function DatasetPipelineTabs({ dataset }: { dataset: Dataset }) {
  const pathname = usePathname();
  const tabs = getTabs(dataset.id);

  return (
    <div className="border-b">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Pipeline tabs">
        {tabs.map((tab) => {
          const available = tab.availableStatuses.includes(dataset.status);
          const completed = tab.completedStatuses.includes(dataset.status);
          const active = isTabActive(pathname, tab.href, dataset.id);

          if (!available) {
            return (
              <div
                key={tab.label}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                title={`Available after earlier stages are complete`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {completed ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <tab.icon className="h-3.5 w-3.5" />
              )}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
