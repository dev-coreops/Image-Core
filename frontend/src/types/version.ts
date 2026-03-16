export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_number: number;
  name: string | null;
  description: string | null;
  status: string;
  image_count: number | null;
  annotation_count: number | null;
  total_size_bytes: number | null;
  label_distribution: Record<string, number> | null;
  annotation_format: string;
  s3_manifest_key: string | null;
  s3_annotations_key: string | null;
  s3_meta_key: string | null;
  preprocessing_config: Record<string, unknown> | null;
  label_config: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export interface CreateVersionRequest {
  name?: string;
  description?: string;
  annotation_format?: string;
}
