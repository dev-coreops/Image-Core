"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  ImageIcon,
  Grid3x3,
  List,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { apiClient } from "@/lib/api-client";
import { cn, formatBytes } from "@/lib/utils";
import { toast } from "sonner";
import type { ImageRecord } from "@/types/image";

export default function ImagesPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const { currentDataset, fetchDataset, updateDataset } = useDatasetStore();

  const [images, setImages] = useState<ImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(
    async (cursor?: string) => {
      try {
        const res = await apiClient.get<{
          items: ImageRecord[];
          next_cursor: string | null;
        }>(
          `/api/v1/datasets/${datasetId}/images?limit=50${cursor ? `&cursor=${cursor}` : ""}`
        );
        if (cursor) {
          setImages((prev) => [...prev, ...res.items]);
        } else {
          setImages(res.items);
        }
        setNextCursor(res.next_cursor);
      } catch {
        // Dataset may not have images yet
      }
    },
    [datasetId]
  );

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    setFileProgress({});

    try {
      const fileList = Array.from(files);

      const presignRes = await apiClient.post<{
        uploads: { filename: string; s3_key: string; presigned_url: string }[];
      }>(`/api/v1/datasets/${datasetId}/presign-upload`, {
        files: fileList.map((f) => ({
          filename: f.name,
          content_type: f.type,
          size_bytes: f.size,
        })),
      });

      for (let i = 0; i < presignRes.uploads.length; i++) {
        const upload = presignRes.uploads[i];
        const file = fileList[i];
        setFileProgress((prev) => ({ ...prev, [file.name]: 0 }));
        await apiClient.uploadToS3(upload.presigned_url, file);
        setFileProgress((prev) => ({ ...prev, [file.name]: 100 }));
        setUploadProgress(Math.round(((i + 1) / fileList.length) * 90));
      }

      await apiClient.post(`/api/v1/datasets/${datasetId}/register-images`, {
        images: presignRes.uploads.map((u, i) => ({
          s3_key: u.s3_key,
          filename: u.filename,
          size_bytes: fileList[i].size,
          content_type: fileList[i].type,
        })),
      });

      await updateDataset(datasetId, { status: "uploaded" });

      setUploadProgress(100);
      toast.success(`Uploaded ${fileList.length} images`);
      fetchDataset(datasetId);
      loadImages();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setFileProgress({});
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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
              isDragging ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : "Click or drag images here"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            disabled={uploading}
          />
          {uploading && (
            <>
              <Progress value={uploadProgress} className="mt-3" />
              {Object.keys(fileProgress).length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {Object.entries(fileProgress).map(([name, pct]) => (
                    <div key={name} className="flex items-center gap-2 text-xs">
                      <span className="truncate w-40">{name}</span>
                      <Progress value={pct} className="flex-1 h-1.5" />
                      <span className="w-8 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Image gallery */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Images ({currentDataset?.image_count ?? images.length})
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-square rounded-lg overflow-hidden bg-muted relative group"
                  >
                    {img.presigned_url ? (
                      <img
                        src={img.presigned_url}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.filename}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="flex items-center gap-3 p-2 rounded-lg border"
                  >
                    <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                      {img.presigned_url ? (
                        <img
                          src={img.presigned_url}
                          alt={img.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{img.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {img.width && img.height ? `${img.width}x${img.height}` : ""}
                        {img.size_bytes ? ` · ${formatBytes(img.size_bytes)}` : ""}
                        {img.format ? ` · ${img.format.toUpperCase()}` : ""}
                      </div>
                    </div>
                    <Badge variant="secondary">{img.status}</Badge>
                  </div>
                ))}
              </div>
            )}

            {nextCursor && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setLoadingMore(true);
                    await loadImages(nextCursor);
                    setLoadingMore(false);
                  }}
                  disabled={loadingMore}
                >
                  {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next step CTA */}
      {images.length > 0 && !uploading && currentDataset &&
        ["uploaded", "uploading", "created"].includes(currentDataset.status) && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href={`/datasets/${datasetId}/preprocess`}>
              Continue to Preprocessing
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      )}

      {images.length === 0 && !uploading && (
        <Card className="p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No images yet</h3>
          <p className="text-muted-foreground">
            Upload images using the zone above to get started.
          </p>
        </Card>
      )}
    </div>
  );
}
