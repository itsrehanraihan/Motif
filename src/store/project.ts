import { create } from 'zustand';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import type { Project, Layer } from '../types';

function makeEmptyProject(): Project {
  return {
    id: uuidv4(),
    name: 'Untitled',
    fps: 60,
    totalFrames: 180,
    width: 800,
    height: 600,
    background: null,
    layers: [],
    presets: [],
    version: 1,
  };
}

interface ProjectStore {
  project: Project;
  setProject: (updater: (draft: Project) => void) => void;
  setProjectDirect: (project: Project) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updater: (layer: Layer) => void) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: makeEmptyProject(),

  setProject: (updater) =>
    set((state) => ({
      project: produce(state.project, updater),
    })),

  setProjectDirect: (project) => set({ project }),

  addLayer: (layer) =>
    set((state) => ({
      project: produce(state.project, (draft) => {
        draft.layers.unshift(layer);
      }),
    })),

  removeLayer: (id) =>
    set((state) => ({
      project: produce(state.project, (draft) => {
        draft.layers = draft.layers.filter((l) => l.id !== id);
      }),
    })),

  updateLayer: (id, updater) =>
    set((state) => ({
      project: produce(state.project, (draft) => {
        const layer = draft.layers.find((l) => l.id === id);
        if (layer) updater(layer);
      }),
    })),
}));
