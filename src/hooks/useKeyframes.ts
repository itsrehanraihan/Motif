import { useCallback } from 'react';
import { useProjectStore } from '../store/project';
import { useUIStore } from '../store/ui';
import { useHistoryStore } from '../store/history';
import { AddKeyframeCommand, RemoveKeyframeCommand, MoveKeyframeCommand } from '../core/commands';
import type { LayerProperties, BezierHandle } from '../types';

const DEFAULT_EASE_OUT: BezierHandle = { x: 0.25, y: 0.1 };
const DEFAULT_EASE_IN: BezierHandle = { x: 0.25, y: 1.0 };

export function useKeyframes() {
  const { project, setProject } = useProjectStore();
  const { currentFrame, selectedLayerIds } = useUIStore();
  const { execute } = useHistoryStore();

  const addKeyframe = useCallback(
    (layerId: string, propKey: keyof LayerProperties, value?: unknown) => {
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer) return;

      const prop = layer.properties[propKey];
      const currentValue = value ?? prop.keyframes[0]?.value;
      if (currentValue === undefined) return;

      const cmd = new AddKeyframeCommand(
        layerId,
        propKey,
        {
          frame: currentFrame,
          value: currentValue,
          easeIn: DEFAULT_EASE_IN,
          easeOut: DEFAULT_EASE_OUT,
        },
        setProject,
      );
      execute(cmd);
    },
    [project, currentFrame, setProject, execute],
  );

  const removeKeyframe = useCallback(
    (layerId: string, propKey: keyof LayerProperties, frame: number) => {
      const cmd = new RemoveKeyframeCommand(layerId, propKey, frame, setProject);
      execute(cmd);
    },
    [setProject, execute],
  );

  const moveKeyframe = useCallback(
    (layerId: string, propKey: keyof LayerProperties, fromFrame: number, toFrame: number) => {
      const cmd = new MoveKeyframeCommand(layerId, propKey, fromFrame, toFrame, setProject);
      execute(cmd);
    },
    [setProject, execute],
  );

  const addKeyframeForSelectedLayers = useCallback(
    (propKey: keyof LayerProperties) => {
      for (const id of selectedLayerIds) {
        addKeyframe(id, propKey);
      }
    },
    [selectedLayerIds, addKeyframe],
  );

  return { addKeyframe, removeKeyframe, moveKeyframe, addKeyframeForSelectedLayers };
}
