import { create } from "zustand";

type Viewport = "desktop" | "tablet" | "mobile";

interface PreviewState {
  viewport: Viewport;
  isRefreshing: boolean;
  setViewport: (viewport: Viewport) => void;
  setRefreshing: (refreshing: boolean) => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  viewport: "desktop",
  isRefreshing: false,
  setViewport: (viewport) => set({ viewport }),
  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
}));
