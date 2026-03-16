import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { PreprocessConfig, PreprocessingJob } from "@/types/preprocessing";

interface PreprocessingState {
  currentJob: PreprocessingJob | null;
  isPolling: boolean;
  error: string | null;
  pollingInterval: ReturnType<typeof setInterval> | null;
  startPreprocessing: (datasetId: string, vmIp: string, config: PreprocessConfig) => Promise<void>;
  pollJobStatus: (datasetId: string) => void;
  stopPolling: () => void;
}

export const usePreprocessingStore = create<PreprocessingState>((set, get) => ({
  currentJob: null,
  isPolling: false,
  error: null,
  pollingInterval: null,

  startPreprocessing: async (datasetId: string, vmIp: string, config: PreprocessConfig) => {
    set({ error: null });
    try {
      await apiClient.post<{ job_id: string; status: string }>(
        `/api/v1/datasets/${datasetId}/preprocess`,
        { vm_ip: vmIp, config }
      );
      // Fetch the full job details
      const job = await apiClient.get<PreprocessingJob>(
        `/api/v1/datasets/${datasetId}/preprocess/latest`
      );
      set({ currentJob: job });
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  pollJobStatus: (datasetId: string) => {
    const { stopPolling } = get();
    stopPolling();

    // Do an initial fetch first; only start polling if a job exists
    const doFetch = async () => {
      try {
        const job = await apiClient.get<PreprocessingJob>(
          `/api/v1/datasets/${datasetId}/preprocess/latest`
        );
        set({ currentJob: job });
        return job;
      } catch {
        return null;
      }
    };

    doFetch().then((job) => {
      // Don't start polling if no job exists or job is already terminal
      if (!job || job.status === "completed" || job.status === "failed") {
        return;
      }

      const interval = setInterval(async () => {
        const updated = await doFetch();
        if (!updated || updated.status === "completed" || updated.status === "failed") {
          get().stopPolling();
        }
      }, 3000);

      set({ isPolling: true, pollingInterval: interval });
    });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    set({ isPolling: false, pollingInterval: null });
  },
}));
