"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { DatasetHeader } from "@/components/dataset/DatasetHeader";
import { DatasetPipelineTabs } from "@/components/dataset/DatasetPipelineTabs";

export default function DatasetLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const datasetId = params.id as string;
  const { currentDataset, fetchDataset, isLoading } = useDatasetStore();

  useEffect(() => {
    fetchDataset(datasetId);
  }, [datasetId, fetchDataset]);

  // Show skeleton only on first load when we have no data yet
  if (!currentDataset) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <DatasetHeader dataset={currentDataset} />
      <div className="mt-4">
        <DatasetPipelineTabs dataset={currentDataset} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
