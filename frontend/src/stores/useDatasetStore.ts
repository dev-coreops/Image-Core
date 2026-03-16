import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { Dataset, CreateDatasetRequest, UpdateDatasetRequest } from "@/types/dataset";

interface DatasetState {
  datasets: Dataset[];
  currentDataset: Dataset | null;
  isLoading: boolean;
  error: string | null;
  fetchDatasets: () => Promise<void>;
  fetchDataset: (id: string) => Promise<void>;
  createDataset: (data: CreateDatasetRequest) => Promise<Dataset>;
  updateDataset: (id: string, data: UpdateDatasetRequest) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  currentDataset: null,
  isLoading: false,
  error: null,

  fetchDatasets: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.get<{ items: Dataset[]; next_cursor: string | null; total: number | null }>(
        "/api/v1/datasets"
      );
      set({ datasets: res.items });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDataset: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const dataset = await apiClient.get<Dataset>(`/api/v1/datasets/${id}`);
      set({ currentDataset: dataset });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ isLoading: false });
    }
  },

  createDataset: async (data: CreateDatasetRequest) => {
    set({ error: null });
    const dataset = await apiClient.post<Dataset>("/api/v1/datasets", data);
    set((state) => ({ datasets: [dataset, ...state.datasets] }));
    return dataset;
  },

  updateDataset: async (id: string, data: UpdateDatasetRequest) => {
    set({ error: null });
    const updated = await apiClient.patch<Dataset>(`/api/v1/datasets/${id}`, data);
    set((state) => ({
      datasets: state.datasets.map((d) => (d.id === id ? updated : d)),
      currentDataset: state.currentDataset?.id === id ? updated : state.currentDataset,
    }));
  },

  deleteDataset: async (id: string) => {
    set({ error: null });
    await apiClient.delete(`/api/v1/datasets/${id}`);
    set((state) => ({
      datasets: state.datasets.filter((d) => d.id !== id),
      currentDataset: state.currentDataset?.id === id ? null : state.currentDataset,
    }));
  },
}));
