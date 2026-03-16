"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check, ChevronRight, Upload, FolderUp, Loader2, HardDrive, Cloud, Database, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LabelClassConfig } from "@/types/dataset";

const DEFAULT_COLORS = [
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#06b6d4",
];

const STEP_LABELS = ["Basic Info", "Label Classes", "Upload Images"];

type SourceType = "upload" | "cloud" | "database" | "api" | "streaming";

const SOURCE_TYPES: {
  id: SourceType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "upload", label: "Local Upload", subtitle: "Upload files from disk", icon: HardDrive },
  { id: "cloud", label: "Cloud Storage", subtitle: "S3, GCS, Azure Blob", icon: Cloud },
  { id: "database", label: "Database", subtitle: "PostgreSQL, MySQL..", icon: Database },
  { id: "api", label: "REST API", subtitle: "HTTP endpoints", icon: Globe },
  { id: "streaming", label: "Streaming", subtitle: "Kafka, Kinesis", icon: Radio },
];

export default function NewDatasetPage() {
  const router = useRouter();
  const { createDataset } = useDatasetStore();

  // Step state
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType>("upload");

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Label Classes
  const [labelClasses, setLabelClasses] = useState<LabelClassConfig[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(DEFAULT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 3: Upload
  const [createdDatasetId, setCreatedDatasetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addLabel = () => {
    if (!newLabel.trim()) return;
    if (labelClasses.some((lc) => lc.name === newLabel.trim())) {
      toast.error("Label class already exists");
      return;
    }
    setLabelClasses([...labelClasses, { name: newLabel.trim(), color: newLabelColor }]);
    setNewLabel("");
    setNewLabelColor(DEFAULT_COLORS[(labelClasses.length + 1) % DEFAULT_COLORS.length]);
  };

  const removeLabel = (index: number) => {
    setLabelClasses(labelClasses.filter((_, i) => i !== index));
  };

  const handleStep1Next = () => {
    if (sourceType !== "upload") {
      toast.error("This data source type is not yet supported");
      return;
    }
    if (!name.trim()) {
      toast.error("Dataset name is required");
      return;
    }
    setStep(2);
  };

  const handleStep2Next = async () => {
    setIsSubmitting(true);
    try {
      const dataset = await createDataset({
        name: name.trim(),
        description: description.trim() || undefined,
        label_config: labelClasses,
      });
      setCreatedDatasetId(dataset.id);
      toast.success("Dataset created");
      setStep(3);
    } catch {
      toast.error("Failed to create dataset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif"]);

  const filterImageFiles = (files: File[]): File[] =>
    files.filter((f) => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      return f.type.startsWith("image/") || IMAGE_EXTENSIONS.has(ext);
    });

  const handleFileUpload = async (files: FileList, fromFolder = false) => {
    if (!files.length || !createdDatasetId) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      let fileList = Array.from(files);
      if (fromFolder) {
        fileList = filterImageFiles(fileList);
        if (!fileList.length) {
          toast.error("No image files found in the selected folder");
          setUploading(false);
          return;
        }
      }

      const presignRes = await apiClient.post<{
        uploads: { filename: string; s3_key: string; presigned_url: string }[];
      }>(`/api/v1/datasets/${createdDatasetId}/presign-upload`, {
        files: fileList.map((f) => ({
          filename: f.name,
          content_type: f.type,
          size_bytes: f.size,
        })),
      });

      for (let i = 0; i < presignRes.uploads.length; i++) {
        const upload = presignRes.uploads[i];
        const file = fileList[i];
        await apiClient.uploadToS3(upload.presigned_url, file);
        setUploadProgress(Math.round(((i + 1) / fileList.length) * 90));
      }

      await apiClient.post(`/api/v1/datasets/${createdDatasetId}/register-images`, {
        images: presignRes.uploads.map((u, i) => ({
          s3_key: u.s3_key,
          filename: u.filename,
          size_bytes: fileList[i].size,
          content_type: fileList[i].type,
        })),
      });

      setUploadProgress(100);
      setUploadedCount((prev) => prev + fileList.length);
      toast.success(`Uploaded ${fileList.length} images`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Dataset</h1>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, idx) => {
          const s = idx + 1;
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  s < step
                    ? "bg-primary text-primary-foreground"
                    : s === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              <span
                className={cn("text-sm", s === step ? "font-medium" : "text-muted-foreground")}
              >
                {label}
              </span>
              {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <>
          {/* Data Source Type Selector */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Data Source Type</CardTitle>
              <CardDescription>Choose documents or datasets to index</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {SOURCE_TYPES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSourceType(st.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-lg border p-4 text-center transition-colors cursor-pointer",
                      sourceType === st.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {st.id !== "upload" && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5">
                        Soon
                      </Badge>
                    )}
                    <st.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{st.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{st.subtitle}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {sourceType === "upload" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Basic Info</CardTitle>
                  <CardDescription>Name and description for your dataset</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Traffic Detection Dataset"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleStep1Next();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this dataset for?"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end mt-6">
                <Button variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button onClick={handleStep1Next}>Next</Button>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <Cloud className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-medium">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  The {SOURCE_TYPES.find((s) => s.id === sourceType)?.label} data source type is not yet available.
                  Select Local Upload to continue.
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Step 2: Label Classes */}
      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Label Classes</CardTitle>
              <CardDescription>Define the annotation labels for this dataset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border p-0.5"
                />
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. car, person, truck"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLabel();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addLabel}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {labelClasses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {labelClasses.map((lc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                    >
                      <input
                        type="color"
                        value={lc.color}
                        onChange={(e) => {
                          const updated = [...labelClasses];
                          updated[i] = { ...updated[i], color: e.target.value };
                          setLabelClasses(updated);
                        }}
                        className="w-4 h-4 rounded-full cursor-pointer border-0 p-0"
                      />
                      <span>{lc.name}</span>
                      <button
                        type="button"
                        onClick={() => removeLabel(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleStep2Next} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Continue"
              )}
            </Button>
          </div>
        </>
      )}

      {/* Step 3: Upload Images */}
      {step === 3 && createdDatasetId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Upload Images
                <Badge variant="outline" className="text-[10px] font-normal gap-1">
                  <Cloud className="h-3 w-3" />
                  MinIO Storage
                </Badge>
              </CardTitle>
              <CardDescription>
                Images are uploaded to MinIO Cloud Storage. You can also upload later from the dataset page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Drag & drop images or a folder here, or
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Select Files
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <FolderUp className="h-3.5 w-3.5 mr-1.5" />
                        Select Folder
                      </Button>
                    </div>
                  </>
                )}
                {uploadedCount > 0 && !uploading && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {uploadedCount} images uploaded so far
                  </p>
                )}
              </div>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
              {/* Hidden folder input */}
              {/* @ts-expect-error — webkitdirectory is a non-standard but widely supported attribute */}
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                webkitdirectory=""
                directory=""
                multiple
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files, true);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
              {uploading && <Progress value={uploadProgress} className="mt-1" />}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => router.push(`/datasets/${createdDatasetId}`)}
            >
              {uploadedCount > 0 ? "Done" : "Skip"}
            </Button>
            {uploadedCount > 0 && (
              <Button onClick={() => router.push(`/datasets/${createdDatasetId}`)}>
                Go to Dataset
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
