export interface LabelClassConfig {
  name: string;
  color: string;
}

export interface Dataset {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  description: string | null;
  source_type: string;
  s3_bucket: string;
  s3_prefix: string;
  image_count: number;
  total_size_bytes: number;
  status: string;
  label_config: LabelClassConfig[];
  preprocessing_config: Record<string, unknown> | null;
  annotation_project_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  source_type?: string;
  label_config: LabelClassConfig[];
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
  status?: string;
  label_config?: LabelClassConfig[];
}
