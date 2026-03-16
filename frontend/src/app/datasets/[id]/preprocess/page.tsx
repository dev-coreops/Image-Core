"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Play, CheckCircle, XCircle, Loader2, ArrowRight, RotateCcw, ImageIcon, Monitor, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { usePreprocessingStore } from "@/stores/usePreprocessingStore";
import { PreprocessingConfigSummary } from "@/components/dataset/PreprocessingConfigSummary";
import { toast } from "sonner";
import type { PreprocessConfig } from "@/types/preprocessing";

const DEFAULT_CONFIG: PreprocessConfig = {
  validation: {
    min_width: 32,
    min_height: 32,
    max_file_size_mb: 50,
    allowed_formats: ["jpeg", "png", "webp", "bmp", "tiff"],
  },
  normalization: {
    target_format: "jpeg",
    target_quality: 95,
    fix_orientation: true,
    convert_rgb: true,
    max_dimension: null,
  },
  deduplication: {
    enabled: true,
    method: "phash",
    hash_size: 16,
    threshold: 8,
  },
  augmentation: {
    enabled: false,
    operations: [],
    augmentations_per_image: 2,
  },
};

export default function PreprocessPage() {
  const params = useParams();
  const datasetId = params.id as string;
  const { currentDataset, fetchDataset } = useDatasetStore();
  const { currentJob, startPreprocessing, pollJobStatus, stopPolling } = usePreprocessingStore();

  const [vmIp, setVmIp] = useState("");
  const [config, setConfig] = useState<PreprocessConfig>(DEFAULT_CONFIG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provider, setProvider] = useState("localhost");

  // Dummy state for cloud provider forms (no backend)
  const [azureHost, setAzureHost] = useState("");
  const [azureSshPort, setAzureSshPort] = useState("22");
  const [azureUsername, setAzureUsername] = useState("");
  const [azureSshKey, setAzureSshKey] = useState("");
  const [awsInstanceId, setAwsInstanceId] = useState("");
  const [awsRegion, setAwsRegion] = useState("");
  const [awsKeyPair, setAwsKeyPair] = useState("");
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpZone, setGcpZone] = useState("");
  const [gcpInstanceName, setGcpInstanceName] = useState("");

  const isCloudProvider = provider !== "localhost";

  useEffect(() => {
    pollJobStatus(datasetId);
    return () => stopPolling();
  }, [datasetId, pollJobStatus, stopPolling]);

  // Refresh dataset when job reaches terminal state
  useEffect(() => {
    if (currentJob?.status === "completed" || currentJob?.status === "failed") {
      fetchDataset(datasetId);
    }
  }, [currentJob?.status, datasetId, fetchDataset]);

  const handleStart = async () => {
    if (isCloudProvider) {
      toast.info("Cloud provider support coming soon");
      return;
    }
    if (!vmIp.trim()) {
      toast.error("VM IP address is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await startPreprocessing(datasetId, vmIp.trim(), config);
      fetchDataset(datasetId);
      pollJobStatus(datasetId);
      toast.success("Preprocessing started");
    } catch {
      toast.error("Failed to start preprocessing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRunning = currentJob && ["queued", "running", "pending"].includes(currentJob.status);
  const isComplete = currentJob?.status === "completed";
  const isFailed = currentJob?.status === "failed";

  // Get saved config from dataset for the summary
  const savedConfig = currentDataset?.preprocessing_config as PreprocessConfig | null;

  return (
    <div className="space-y-6">
      {/* Completed State */}
      {isComplete && currentJob && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Preprocessing Complete
              </CardTitle>
              <CardDescription>
                Your dataset has been processed and is ready for labeling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{currentJob.images_processed}</div>
                  <div className="text-muted-foreground">Images Processed</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{currentJob.images_excluded}</div>
                  <div className="text-muted-foreground">Excluded</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold flex items-center justify-center gap-1">
                    <ImageIcon className="h-5 w-5" />
                    {currentJob.images_total}
                  </div>
                  <div className="text-muted-foreground">Original</div>
                </div>
              </div>
              {currentJob.exclusion_summary && Object.keys(currentJob.exclusion_summary).length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Exclusion Reasons</div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(currentJob.exclusion_summary).map(([reason, count]) => (
                      <span key={reason} className="text-xs px-2 py-1 bg-muted rounded">
                        {reason}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {currentJob.logs && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    View Pipeline Logs
                  </summary>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap mt-2">
                    {currentJob.logs}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Config Summary */}
          {savedConfig && <PreprocessingConfigSummary config={savedConfig} />}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                usePreprocessingStore.getState().stopPolling();
                usePreprocessingStore.setState({ currentJob: null });
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-run Preprocessing
            </Button>
            <Button asChild>
              <Link href={`/datasets/${datasetId}/label`}>
                Continue to Labeling
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </>
      )}

      {/* Running State */}
      {isRunning && currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </CardTitle>
            <CardDescription>
              This may take a few minutes depending on the number of images.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={currentJob.progress} />
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium">{currentJob.images_processed}</div>
                <div className="text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="font-medium">{currentJob.images_excluded}</div>
                <div className="text-muted-foreground">Excluded</div>
              </div>
              <div>
                <div className="font-medium">{currentJob.progress}%</div>
                <div className="text-muted-foreground">Progress</div>
              </div>
            </div>
            {currentJob.logs && (
              <div>
                <div className="text-sm font-medium mb-1">Logs</div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                  {currentJob.logs}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed State Banner */}
      {isFailed && currentJob && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Preprocessing Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentJob.error_message && (
              <div className="text-sm text-destructive">{currentJob.error_message}</div>
            )}
            {currentJob.logs && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                  View Pipeline Logs
                </summary>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap mt-2">
                  {currentJob.logs}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Config Form — only when no job or failed */}
      {(!currentJob || isFailed) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Instance</CardTitle>
              <CardDescription>Select the compute provider for the preprocessing worker</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selector Cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: "localhost", label: "Localhost", icon: Monitor, subtitle: "Local machine" },
                  { id: "azure", label: "Azure", icon: Cloud, subtitle: "Azure VM" },
                  { id: "aws", label: "AWS", icon: Cloud, subtitle: "EC2 Instance" },
                  { id: "gcp", label: "GCP", icon: Cloud, subtitle: "Compute Engine" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 text-center transition-colors ${
                      provider === p.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    {p.id !== "localhost" && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5">
                        Soon
                      </Badge>
                    )}
                    <p.icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.subtitle}</span>
                  </button>
                ))}
              </div>

              <Separator />

              {/* Localhost Form */}
              {provider === "localhost" && (
                <div>
                  <Label htmlFor="vmIp">VM IP Address</Label>
                  <Input
                    id="vmIp"
                    value={vmIp}
                    onChange={(e) => setVmIp(e.target.value)}
                    placeholder="e.g. 34.56.78.90 or localhost"
                  />
                </div>
              )}

              {/* Azure Form (dummy) */}
              {provider === "azure" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Host / IP</Label>
                    <Input value={azureHost} onChange={(e) => setAzureHost(e.target.value)} placeholder="e.g. 10.0.0.4" />
                  </div>
                  <div>
                    <Label>SSH Port</Label>
                    <Input value={azureSshPort} onChange={(e) => setAzureSshPort(e.target.value)} placeholder="22" />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input value={azureUsername} onChange={(e) => setAzureUsername(e.target.value)} placeholder="azureuser" />
                  </div>
                  <div className="col-span-2">
                    <Label>SSH Private Key</Label>
                    <Textarea value={azureSshKey} onChange={(e) => setAzureSshKey(e.target.value)} placeholder="-----BEGIN RSA PRIVATE KEY-----" rows={3} className="font-mono text-xs" />
                  </div>
                </div>
              )}

              {/* AWS Form (dummy) */}
              {provider === "aws" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Instance ID</Label>
                    <Input value={awsInstanceId} onChange={(e) => setAwsInstanceId(e.target.value)} placeholder="i-0abcdef1234567890" />
                  </div>
                  <div>
                    <Label>Region</Label>
                    <Input value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} placeholder="us-east-1" />
                  </div>
                  <div>
                    <Label>Key Pair Name</Label>
                    <Input value={awsKeyPair} onChange={(e) => setAwsKeyPair(e.target.value)} placeholder="my-key-pair" />
                  </div>
                </div>
              )}

              {/* GCP Form (dummy) */}
              {provider === "gcp" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Project ID</Label>
                    <Input value={gcpProjectId} onChange={(e) => setGcpProjectId(e.target.value)} placeholder="my-project-123" />
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <Input value={gcpZone} onChange={(e) => setGcpZone(e.target.value)} placeholder="us-central1-a" />
                  </div>
                  <div>
                    <Label>Instance Name</Label>
                    <Input value={gcpInstanceName} onChange={(e) => setGcpInstanceName(e.target.value)} placeholder="preprocessing-vm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validation (always on)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min Width</Label>
                <Input
                  type="number"
                  value={config.validation.min_width}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      validation: { ...config.validation, min_width: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <Label>Min Height</Label>
                <Input
                  type="number"
                  value={config.validation.min_height}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      validation: { ...config.validation, min_height: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Normalization (always on)</CardTitle>
              <CardDescription>Format standardization and orientation fixes</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Format</Label>
                <Select
                  value={config.normalization.target_format}
                  onValueChange={(v) =>
                    setConfig({
                      ...config,
                      normalization: { ...config.normalization, target_format: v },
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quality</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={config.normalization.target_quality}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      normalization: { ...config.normalization, target_quality: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fixOrientation"
                  checked={config.normalization.fix_orientation}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      normalization: { ...config.normalization, fix_orientation: e.target.checked },
                    })
                  }
                />
                <Label htmlFor="fixOrientation">Fix EXIF orientation</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="convertRgb"
                  checked={config.normalization.convert_rgb}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      normalization: { ...config.normalization, convert_rgb: e.target.checked },
                    })
                  }
                />
                <Label htmlFor="convertRgb">Convert to RGB</Label>
              </div>
              <div className="col-span-2">
                <Label>Max Dimension (optional)</Label>
                <Input
                  type="number"
                  value={config.normalization.max_dimension ?? ""}
                  placeholder="No limit"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      normalization: {
                        ...config.normalization,
                        max_dimension: e.target.value ? Number(e.target.value) : null,
                      },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deduplication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dedupEnabled"
                  checked={config.deduplication.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      deduplication: { ...config.deduplication, enabled: e.target.checked },
                    })
                  }
                />
                <Label htmlFor="dedupEnabled">Enable deduplication</Label>
              </div>
              {config.deduplication.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Method</Label>
                    <Input value={config.deduplication.method} disabled />
                  </div>
                  <div>
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      value={config.deduplication.threshold}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          deduplication: {
                            ...config.deduplication,
                            threshold: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Augmentation</CardTitle>
              <CardDescription>Generate additional training images with transformations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="augEnabled"
                  checked={config.augmentation.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      augmentation: { ...config.augmentation, enabled: e.target.checked },
                    })
                  }
                />
                <Label htmlFor="augEnabled">Enable augmentation</Label>
              </div>
              {config.augmentation.enabled && (
                <>
                  <div>
                    <Label>Augmentations per image</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={config.augmentation.augmentations_per_image}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          augmentation: {
                            ...config.augmentation,
                            augmentations_per_image: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Operations</Label>
                    <div className="space-y-2">
                      {["horizontal_flip", "vertical_flip", "rotate", "brightness_contrast", "blur", "noise"].map((op) => {
                        const existing = config.augmentation.operations.find(
                          (o: { type: string }) => o.type === op
                        );
                        return (
                          <div key={op} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={!!existing}
                              onChange={(e) => {
                                const ops = e.target.checked
                                  ? [...config.augmentation.operations, { type: op, probability: 0.5 }]
                                  : config.augmentation.operations.filter(
                                      (o: { type: string }) => o.type !== op
                                    );
                                setConfig({
                                  ...config,
                                  augmentation: { ...config.augmentation, operations: ops },
                                });
                              }}
                            />
                            <span className="text-sm w-40 capitalize">{op.replace(/_/g, " ")}</span>
                            {existing && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Probability</Label>
                                <Input
                                  type="number"
                                  step={0.1}
                                  min={0}
                                  max={1}
                                  value={existing.probability}
                                  className="w-20 h-8 text-xs"
                                  onChange={(e) => {
                                    const ops = config.augmentation.operations.map(
                                      (o: { type: string; probability: number }) =>
                                        o.type === op ? { ...o, probability: Number(e.target.value) } : o
                                    );
                                    setConfig({
                                      ...config,
                                      augmentation: { ...config.augmentation, operations: ops },
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end items-center gap-3">
            {isCloudProvider && (
              <Badge variant="secondary">Coming Soon</Badge>
            )}
            <Button onClick={handleStart} disabled={isSubmitting || isCloudProvider}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Preprocessing
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
