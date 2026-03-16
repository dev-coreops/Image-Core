"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GitBranch, Plus, Download, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import type { DatasetVersion, CreateVersionRequest } from "@/types/version";

export default function VersionsPage() {
  const params = useParams();
  const datasetId = params.id as string;

  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [annotationFormat, setAnnotationFormat] = useState("coco");

  const loadVersions = async () => {
    try {
      const res = await apiClient.get<{ items: DatasetVersion[] }>(
        `/api/v1/datasets/${datasetId}/versions`
      );
      setVersions(res.items);
    } catch {
      toast.error("Failed to load versions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [datasetId]);

  // Poll when any version is processing
  useEffect(() => {
    const hasProcessing = versions.some((v) => v.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      loadVersions();
    }, 5000);
    return () => clearInterval(interval);
  }, [versions]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const body: CreateVersionRequest = {
        annotation_format: annotationFormat,
      };
      if (name.trim()) body.name = name.trim();
      if (description.trim()) body.description = description.trim();

      await apiClient.post(`/api/v1/datasets/${datasetId}/versions`, body);
      toast.success("Version creation started");
      setDialogOpen(false);
      setName("");
      setDescription("");
      loadVersions();
    } catch {
      toast.error("Failed to create version");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Version History</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
            <Plus className="h-4 w-4" />
            Create Version
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Version</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="versionName">Name (optional)</Label>
                <Input
                  id="versionName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. v1 - initial labeling"
                />
              </div>
              <div>
                <Label htmlFor="versionDesc">Description (optional)</Label>
                <Textarea
                  id="versionDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What changed in this version?"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="annotationFormat">Annotation Format</Label>
                <Select value={annotationFormat} onValueChange={setAnnotationFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coco">COCO JSON</SelectItem>
                    <SelectItem value="yolo">YOLO</SelectItem>
                    <SelectItem value="voc">Pascal VOC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : versions.length === 0 ? (
        <Card className="p-12 text-center">
          <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No versions yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a version to snapshot the current state of your dataset.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => (
            <Card key={version.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      v{version.version_number}
                      {version.name && (
                        <span className="font-normal text-muted-foreground">
                          — {version.name}
                        </span>
                      )}
                    </CardTitle>
                    {version.description && (
                      <CardDescription className="mt-1">{version.description}</CardDescription>
                    )}
                  </div>
                  <Badge
                    variant={version.status === "completed" ? "default" : "secondary"}
                  >
                    {version.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {version.status === "processing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {version.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                  {version.image_count != null && <span>{version.image_count} images</span>}
                  {version.annotation_count != null && (
                    <span>{version.annotation_count} annotations</span>
                  )}
                  {version.total_size_bytes != null && (
                    <span>{formatBytes(version.total_size_bytes)}</span>
                  )}
                  <span>{version.annotation_format.toUpperCase()}</span>
                  <span>{new Date(version.created_at).toLocaleDateString()}</span>
                </div>

                {version.label_distribution &&
                  Object.keys(version.label_distribution).length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-1">Label Distribution</div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(version.label_distribution).map(([label, count]) => (
                          <span key={label} className="text-xs px-2 py-1 bg-muted rounded">
                            {label}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {version.status === "completed" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005"}/api/v1/datasets/${datasetId}/versions/${version.id}/manifest`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Manifest
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005"}/api/v1/datasets/${datasetId}/versions/${version.id}/annotations`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Annotations
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
