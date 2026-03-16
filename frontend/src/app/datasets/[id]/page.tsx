"use client";

import Link from "next/link";
import {
  Upload,
  Cog,
  Tag,
  GitBranch,
  ArrowRight,
  ImageIcon,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { formatBytes } from "@/lib/utils";

function getNextStep(status: string, datasetId: string) {
  switch (status) {
    case "created":
    case "uploading":
      return {
        title: "Upload Images",
        description: "Add images to your dataset to get started.",
        href: `/datasets/${datasetId}/images`,
        icon: Upload,
      };
    case "uploaded":
      return {
        title: "Configure Preprocessing",
        description: "Set up validation, normalization, and augmentation for your images.",
        href: `/datasets/${datasetId}/preprocess`,
        icon: Cog,
      };
    case "preprocessing":
      return {
        title: "Preprocessing in Progress",
        description: "Your images are being processed. Check the Preprocess tab for progress.",
        href: `/datasets/${datasetId}/preprocess`,
        icon: Cog,
      };
    case "preprocessed":
      return {
        title: "Start Labeling",
        description: "Your images are ready. Begin annotating them with labels.",
        href: `/datasets/${datasetId}/label`,
        icon: Tag,
      };
    case "labeling":
      return {
        title: "Create a Version",
        description: "Snapshot your labeled dataset to create a versioned export.",
        href: `/datasets/${datasetId}/versions`,
        icon: GitBranch,
      };
    case "completed":
      return null;
    default:
      return null;
  }
}

export default function DatasetOverviewPage() {
  const { currentDataset } = useDatasetStore();

  if (!currentDataset) return null;

  const dataset = currentDataset;
  const nextStep = getNextStep(dataset.status, dataset.id);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{dataset.image_count}</div>
            <div className="text-sm text-muted-foreground">Images</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatBytes(dataset.total_size_bytes)}</div>
            <div className="text-sm text-muted-foreground">Total Size</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{dataset.label_config.length}</div>
            <div className="text-sm text-muted-foreground">Label Classes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{dataset.source_type}</div>
            <div className="text-sm text-muted-foreground">Source</div>
          </CardContent>
        </Card>
      </div>

      {/* Label classes */}
      {dataset.label_config.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Label Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dataset.label_config.map((lc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: lc.color }}
                  />
                  <span>{lc.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Step CTA */}
      {nextStep ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <nextStep.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{nextStep.title}</div>
              <div className="text-sm text-muted-foreground">{nextStep.description}</div>
            </div>
            <Button asChild>
              <Link href={nextStep.href}>
                Go
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : dataset.status === "completed" ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-800">Dataset Complete</div>
              <div className="text-sm text-green-600">
                All pipeline stages are finished. You can view versions or export data.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
