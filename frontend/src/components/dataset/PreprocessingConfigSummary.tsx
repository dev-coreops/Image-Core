"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import type { PreprocessConfig } from "@/types/preprocessing";

export function PreprocessingConfigSummary({ config }: { config: PreprocessConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preprocessing Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Validation */}
        <div>
          <div className="font-medium mb-1">Validation</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
            <span>Min dimensions: {config.validation.min_width} x {config.validation.min_height}</span>
            <span>Max file size: {config.validation.max_file_size_mb} MB</span>
            <span className="col-span-2">
              Formats: {config.validation.allowed_formats.map((f) => f.toUpperCase()).join(", ")}
            </span>
          </div>
        </div>

        {/* Normalization */}
        <div>
          <div className="font-medium mb-1">Normalization</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
            <span>Format: {config.normalization.target_format.toUpperCase()}</span>
            <span>Quality: {config.normalization.target_quality}</span>
            <span className="flex items-center gap-1">
              Fix orientation: {config.normalization.fix_orientation ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
            </span>
            <span className="flex items-center gap-1">
              Convert RGB: {config.normalization.convert_rgb ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
            </span>
            {config.normalization.max_dimension && (
              <span>Max dimension: {config.normalization.max_dimension}px</span>
            )}
          </div>
        </div>

        {/* Deduplication */}
        <div>
          <div className="font-medium mb-1">Deduplication</div>
          {config.deduplication.enabled ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
              <span>Method: {config.deduplication.method}</span>
              <span>Threshold: {config.deduplication.threshold}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Disabled</span>
          )}
        </div>

        {/* Augmentation */}
        <div>
          <div className="font-medium mb-1">Augmentation</div>
          {config.augmentation.enabled ? (
            <div className="space-y-1">
              <div className="text-muted-foreground">
                {config.augmentation.augmentations_per_image} augmentations per image
              </div>
              <div className="flex flex-wrap gap-1.5">
                {config.augmentation.operations.map((op) => (
                  <Badge key={op.type} variant="secondary" className="text-xs">
                    {op.type.replace(/_/g, " ")} ({(op.probability * 100).toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Disabled</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
