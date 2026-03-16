"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Database, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { formatBytes } from "@/lib/utils";
import type { Dataset } from "@/types/dataset";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-gray-100 text-gray-800",
  uploading: "bg-blue-100 text-blue-800",
  uploaded: "bg-blue-100 text-blue-800",
  preprocessing: "bg-yellow-100 text-yellow-800",
  preprocessed: "bg-green-100 text-green-800",
  labeling: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
};

function DatasetCard({ dataset }: { dataset: Dataset }) {
  return (
    <Link href={`/datasets/${dataset.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{dataset.name}</CardTitle>
            <Badge variant="secondary" className={STATUS_COLORS[dataset.status] || ""}>
              {dataset.status}
            </Badge>
          </div>
          {dataset.description && (
            <CardDescription className="line-clamp-2">{dataset.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              {dataset.image_count} images
            </span>
            <span>{formatBytes(dataset.total_size_bytes)}</span>
            <span>{dataset.label_config.length} labels</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Created {new Date(dataset.created_at).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DatasetsPage() {
  const { datasets, isLoading, fetchDatasets } = useDatasetStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const filteredDatasets = datasets.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Datasets</h1>
          <p className="text-muted-foreground">Manage your image datasets</p>
        </div>
        <Button asChild>
          <Link href="/datasets/new">
            <Plus className="mr-2 h-4 w-4" />
            New Dataset
          </Link>
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3 mb-6">
        <Input
          placeholder="Search datasets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="uploading">Uploading</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="preprocessing">Preprocessing</SelectItem>
            <SelectItem value="preprocessed">Preprocessed</SelectItem>
            <SelectItem value="labeling">Labeling</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDatasets.length === 0 ? (
        <Card className="p-12 text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">
            {datasets.length === 0 ? "No datasets yet" : "No matching datasets"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {datasets.length === 0
              ? "Create your first dataset to get started."
              : "Try adjusting your search or filter."}
          </p>
          {datasets.length === 0 && (
            <Button asChild>
              <Link href="/datasets/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Dataset
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDatasets.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      )}
    </div>
  );
}
