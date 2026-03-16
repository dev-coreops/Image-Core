"use client";

import { useParams } from "next/navigation";
import { Tag, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6",
];

interface LabelClass {
  name: string;
  color: string;
}

export default function LabelPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const { currentDataset, fetchDataset } = useDatasetStore();
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(DEFAULT_COLORS[0]);
  const [editedLabels, setEditedLabels] = useState<LabelClass[] | null>(null);

  if (!currentDataset) return null;

  const dataset = currentDataset;
  const hasProject = !!dataset.annotation_project_id;
  const labelToolUrl = `${process.env.NEXT_PUBLIC_LABEL_TOOL_URL || "http://localhost:8080"}/projects/${dataset.annotation_project_id}`;
  const labels = editedLabels ?? dataset.label_config;
  const hasUnsavedChanges = editedLabels !== null;

  const handleAddLabel = () => {
    const trimmed = newLabelName.trim();
    if (!trimmed) return;
    if (labels.some((lc) => lc.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Label class already exists");
      return;
    }
    const updated = [...labels, { name: trimmed, color: newLabelColor }];
    setEditedLabels(updated);
    setNewLabelName("");
    // Pick next color
    setNewLabelColor(DEFAULT_COLORS[updated.length % DEFAULT_COLORS.length]);
  };

  const handleRemoveLabel = (index: number) => {
    const updated = labels.filter((_, i) => i !== index);
    setEditedLabels(updated);
  };

  const handleSaveLabels = async () => {
    if (!editedLabels) return;
    setIsSaving(true);
    try {
      await apiClient.patch(`/api/v1/datasets/${datasetId}`, {
        label_config: editedLabels,
      });
      toast.success("Label classes saved");
      setEditedLabels(null);
      fetchDataset(datasetId);
    } catch {
      toast.error("Failed to save label classes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLabeling = async () => {
    if (labels.length === 0) {
      toast.error("Add at least one label class before creating a project");
      return;
    }
    // Save any unsaved labels first
    if (editedLabels) {
      setIsSaving(true);
      try {
        await apiClient.patch(`/api/v1/datasets/${datasetId}`, {
          label_config: editedLabels,
        });
        setEditedLabels(null);
      } catch {
        toast.error("Failed to save label classes");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    setIsStarting(true);
    try {
      const res = await apiClient.post<{
        annotation_project_id: string;
        label_tool_url: string;
      }>(`/api/v1/datasets/${datasetId}/start-labeling`);
      toast.success("Labeling project created");
      fetchDataset(datasetId);
      window.open(res.label_tool_url, "_blank");
    } catch {
      toast.error("Failed to start labeling");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Label class editor — only before project is created */}
      {!hasProject && (
        <Card>
          <CardHeader>
            <CardTitle>Label Classes</CardTitle>
            <CardDescription>
              Define the classes you want to annotate in your images.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing labels */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels.map((lc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: lc.color }}
                    />
                    <span>{lc.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(i)}
                      className="ml-1 text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new label */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                className="w-8 h-8 rounded border cursor-pointer bg-transparent"
              />
              <Input
                placeholder="Label name (e.g. car, person, tree)"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddLabel}
                disabled={!newLabelName.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Save button */}
            {hasUnsavedChanges && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveLabels}
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Label Classes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditedLabels(null)}
                >
                  Discard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Read-only label display after project is created */}
      {hasProject && dataset.label_config.length > 0 && (
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

      {/* Labeling status */}
      {!hasProject ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Start Labeling
            </CardTitle>
            <CardDescription>
              Create a labeling project to begin annotating your preprocessed images.
              This will set up a Label Studio project with your configured label classes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleStartLabeling}
              disabled={isStarting || labels.length === 0}
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Tag className="h-4 w-4 mr-2" />
              )}
              Create Labeling Project
            </Button>
            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Add at least one label class above to create a project.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-purple-500" />
              Labeling in Progress
            </CardTitle>
            <CardDescription>
              Your labeling project is set up. Use Label Studio to annotate your images.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Project ID: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{dataset.annotation_project_id}</code>
            </div>
            <Button asChild>
              <a href={labelToolUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Label Studio
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
