import { create } from 'zustand';
import type { Command } from '../core/commands/types';

const MAX_HISTORY = 50;

interface HistoryStore {
  past: Command[];
  future: Command[];
  execute: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  execute: (cmd) => {
    cmd.execute();
    set((state) => {
      const past = [...state.past, cmd].slice(-MAX_HISTORY);
      return { past, future: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const cmd = past[past.length - 1];
    cmd.undo();
    set({
      past: past.slice(0, -1),
      future: [cmd, ...future],
      canUndo: past.length > 1,
      canRedo: true,
    });
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const cmd = future[0];
    cmd.execute();
    set({
      past: [...past, cmd],
      future: future.slice(1),
      canUndo: true,
      canRedo: future.length > 1,
    });
  },
}));
