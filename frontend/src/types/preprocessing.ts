export interface ValidationConfig {
  min_width: number;
  min_height: number;
  max_file_size_mb: number;
  allowed_formats: string[];
}

export interface NormalizationConfig {
  target_format: string;
  target_quality: number;
  fix_orientation: boolean;
  convert_rgb: boolean;
  max_dimension: number | null;
}

export interface DeduplicationConfig {
  enabled: boolean;
  method: string;
  hash_size: number;
  threshold: number;
}

export interface AugmentationOperation {
  type: string;
  probability: number;
  limit?: number;
  brightness_limit?: number;
}

export interface AugmentationConfig {
  enabled: boolean;
  operations: AugmentationOperation[];
  augmentations_per_image: number;
}

export interface PreprocessConfig {
  validation: ValidationConfig;
  normalization: NormalizationConfig;
  deduplication: DeduplicationConfig;
  augmentation: AugmentationConfig;
}

export interface PreprocessingJob {
  id: string;
  dataset_id: string;
  status: string;
  progress: number;
  vm_ip: string | null;
  images_total: number;
  images_processed: number;
  images_excluded: number;
  exclusion_summary: Record<string, number> | null;
  logs: string | null;
  error_message: string | null;
  resource_usage: Record<string, number> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
