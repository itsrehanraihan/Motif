import { create } from 'zustand';
import type { ToolType } from '../types';

interface UIStore {
  selectedLayerIds: string[];
  currentFrame: number;
  isPlaying: boolean;
  zoom: number;
  timelineZoom: number;
  activeTool: ToolType;
  canvasBackground: string | null;
  expandedLayers: Set<string>;
  expandedTimelineLayers: Set<string>;
  timelineHeight: number;

  setSelectedLayerIds: (ids: string[]) => void;
  toggleSelectLayer: (id: string, multi: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setTimelineZoom: (zoom: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setCanvasBackground: (bg: string | null) => void;
  toggleExpandedLayer: (id: string) => void;
  toggleExpandedTimelineLayer: (id: string) => void;
  setTimelineHeight: (h: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedLayerIds: [],
  currentFrame: 0,
  isPlaying: false,
  zoom: 1,
  timelineZoom: 1,
  activeTool: 'select',
  canvasBackground: null,
  expandedLayers: new Set(),
  expandedTimelineLayers: new Set(),
  timelineHeight: 240,

  setSelectedLayerIds: (ids) => set({ selectedLayerIds: ids }),

  toggleSelectLayer: (id, multi) =>
    set((state) => {
      if (multi) {
        const already = state.selectedLayerIds.includes(id);
        return {
          selectedLayerIds: already
            ? state.selectedLayerIds.filter((i) => i !== id)
            : [...state.selectedLayerIds, id],
        };
      }
      return { selectedLayerIds: [id] };
    }),

  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(8, zoom)) }),
  setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(1, Math.min(10, zoom)) }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCanvasBackground: (bg) => set({ canvasBackground: bg }),

  toggleExpandedLayer: (id) =>
    set((state) => {
      const next = new Set(state.expandedLayers);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedLayers: next };
    }),

  toggleExpandedTimelineLayer: (id) =>
    set((state) => {
      const next = new Set(state.expandedTimelineLayers);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedTimelineLayers: next };
    }),

  setTimelineHeight: (h) => set({ timelineHeight: Math.max(120, Math.min(600, h)) }),
}));
