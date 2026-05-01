import type { Command } from './types';
import type { Layer, Keyframe, AnimatableProp, Project } from '../../types';

export type SetProjectFn = (updater: (draft: Project) => void) => void;

export class AddKeyframeCommand<T> implements Command {
  readonly description = 'Add keyframe';

  constructor(
    private layerId: string,
    private propKey: keyof import('../../types').LayerProperties,
    private keyframe: Keyframe<T>,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<T>;
      const insertIdx = prop.keyframes.findIndex((k) => k.frame > this.keyframe.frame);
      if (insertIdx === -1) {
        prop.keyframes.push(this.keyframe);
      } else {
        prop.keyframes.splice(insertIdx, 0, this.keyframe);
      }
    });
  }

  undo(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<T>;
      prop.keyframes = prop.keyframes.filter((k) => k.frame !== this.keyframe.frame);
    });
  }
}

export class RemoveKeyframeCommand<T> implements Command {
  readonly description = 'Remove keyframe';
  private removed: Keyframe<T> | null = null;

  constructor(
    private layerId: string,
    private propKey: keyof import('../../types').LayerProperties,
    private frame: number,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<T>;
      const idx = prop.keyframes.findIndex((k) => k.frame === this.frame);
      if (idx !== -1) {
        this.removed = prop.keyframes[idx] as Keyframe<T>;
        prop.keyframes.splice(idx, 1);
      }
    });
  }

  undo(): void {
    if (!this.removed) return;
    const kf = this.removed;
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<T>;
      const insertIdx = prop.keyframes.findIndex((k) => k.frame > kf.frame);
      if (insertIdx === -1) {
        prop.keyframes.push(kf);
      } else {
        prop.keyframes.splice(insertIdx, 0, kf);
      }
    });
  }
}

export class MoveKeyframeCommand implements Command {
  readonly description = 'Move keyframe';

  constructor(
    private layerId: string,
    private propKey: keyof import('../../types').LayerProperties,
    private fromFrame: number,
    private toFrame: number,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this._move(this.fromFrame, this.toFrame);
  }

  undo(): void {
    this._move(this.toFrame, this.fromFrame);
  }

  private _move(from: number, to: number): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<unknown>;
      const kf = prop.keyframes.find((k) => k.frame === from);
      if (kf) {
        kf.frame = to;
        prop.keyframes.sort((a, b) => a.frame - b.frame);
      }
    });
  }
}

export class RenameLayerCommand implements Command {
  readonly description = 'Rename layer';

  constructor(
    private layerId: string,
    private newName: string,
    private oldName: string,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (layer) layer.name = this.newName;
    });
  }

  undo(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (layer) layer.name = this.oldName;
    });
  }
}

export class ReorderLayersCommand implements Command {
  readonly description = 'Reorder layers';

  constructor(
    private fromIndex: number,
    private toIndex: number,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this._reorder(this.fromIndex, this.toIndex);
  }

  undo(): void {
    this._reorder(this.toIndex, this.fromIndex);
  }

  private _reorder(from: number, to: number): void {
    this.setProject((draft) => {
      const [item] = draft.layers.splice(from, 1);
      draft.layers.splice(to, 0, item);
    });
  }
}

export class SetPropertyValueCommand<T> implements Command {
  readonly description = 'Set property value';

  constructor(
    private layerId: string,
    private propKey: keyof import('../../types').LayerProperties,
    private newValue: T,
    private oldValue: T,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this._set(this.newValue);
  }

  undo(): void {
    this._set(this.oldValue);
  }

  private _set(val: T): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      const prop = layer.properties[this.propKey] as AnimatableProp<T>;
      if (prop.keyframes.length >= 1) {
        prop.keyframes[0].value = val;
      }
    });
  }
}

export class AddLayerCommand implements Command {
  readonly description = 'Add layer';

  constructor(
    private layer: Layer,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      draft.layers.unshift(this.layer);
    });
  }

  undo(): void {
    this.setProject((draft) => {
      draft.layers = draft.layers.filter((l) => l.id !== this.layer.id);
    });
  }
}

export class DeleteLayerCommand implements Command {
  readonly description = 'Delete layer';
  private index = 0;
  private snapshot: Layer | null = null;

  constructor(
    private layerId: string,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      this.index = draft.layers.findIndex((l) => l.id === this.layerId);
      if (this.index !== -1) {
        this.snapshot = draft.layers[this.index];
        draft.layers.splice(this.index, 1);
      }
    });
  }

  undo(): void {
    if (!this.snapshot) return;
    const layer = this.snapshot;
    const index = this.index;
    this.setProject((draft) => {
      draft.layers.splice(index, 0, layer);
    });
  }
}

export class SetLayerRangeCommand implements Command {
  readonly description = 'Set layer range';
  private prev: { inPoint: number; outPoint: number } | null = null;

  constructor(
    private layerId: string,
    private inPoint: number,
    private outPoint: number,
    private setProject: SetProjectFn,
  ) {}

  execute(): void {
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      if (!this.prev) this.prev = { inPoint: layer.inPoint, outPoint: layer.outPoint };
      layer.inPoint = this.inPoint;
      layer.outPoint = this.outPoint;
    });
  }

  undo(): void {
    if (!this.prev) return;
    const prev = this.prev;
    this.setProject((draft) => {
      const layer = draft.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
      layer.inPoint = prev.inPoint;
      layer.outPoint = prev.outPoint;
    });
  }
}

export type { Command };
