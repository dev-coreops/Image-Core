export interface ImageRecord {
  id: string;
  dataset_id: string;
  filename: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  format: string | null;
  status: string;
  exclusion_reason: string | null;
  presigned_url: string | null;
  created_at: string;
}

export interface FileUploadRequest {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface PresignedUploadItem {
  filename: string;
  s3_key: string;
  presigned_url: string;
}
