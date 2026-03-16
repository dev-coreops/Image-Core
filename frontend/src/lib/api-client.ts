const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";

export class APIError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API Error ${status}`);
    this.status = status;
    this.body = body;
  }
}

class ImageDataAPIClient {
  // TODO: Replace with real authentication (e.g. session tokens, OAuth)
  // These dev headers are only suitable for local development
  private headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Organization-ID":
      process.env.NEXT_PUBLIC_ORG_ID || "dev-org-001",
    "X-Project-ID":
      process.env.NEXT_PUBLIC_PROJECT_ID || "dev-project-001",
    "X-User-ID":
      process.env.NEXT_PUBLIC_USER_ID || "dev-user-001",
  };

  private async parseErrorBody(res: Response): Promise<unknown> {
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json();
    }
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers });
    if (!res.ok) throw new APIError(res.status, await this.parseErrorBody(res));
    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new APIError(res.status, await this.parseErrorBody(res));
    return res.json();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new APIError(res.status, await this.parseErrorBody(res));
    return res.json();
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) throw new APIError(res.status, await this.parseErrorBody(res));
  }

  async uploadToS3(presignedUrl: string, file: File): Promise<void> {
    const res = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) throw new APIError(res.status, "S3 upload failed");
  }
}

export const apiClient = new ImageDataAPIClient();
