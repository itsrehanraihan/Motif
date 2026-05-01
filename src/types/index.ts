export interface Project {
  id: string;
  name: string;
  fps: 24 | 30 | 60;
  totalFrames: number;
  width: number;
  height: number;
  background: string | null;
  layers: Layer[];
  presets: AnimationPreset[];
  version: number;
}

export type NodeType = 'frame' | 'group' | 'rect' | 'ellipse' | 'path' | 'image' | 'text' | 'svg';

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  locked: boolean;
  children: Node[];
  parentId: string | null;
}

export interface Layer {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  locked: boolean;
  color: string;
  inPoint: number;
  outPoint: number;
  pathData: string;
  properties: LayerProperties;
  groupId: string | null;
  children: Layer[];
  parentId: string | null;
}

export interface LayerProperties {
  transform: AnimatableProp<Transform>;
  opacity: AnimatableProp<number>;
  strokeColor: AnimatableProp<Color>;
  strokeWidth: AnimatableProp<number>;
  strokeOpacity: AnimatableProp<number>;
  trimStart: AnimatableProp<number>;
  trimEnd: AnimatableProp<number>;
  trimOffset: AnimatableProp<number>;
  fill: AnimatableProp<FillValue>;
  strokeDash: AnimatableProp<DashArray>;
  cornerRadius: AnimatableProp<number>;
  fontSize: AnimatableProp<number>;
  letterSpacing: AnimatableProp<number>;
}

export interface AnimatableProp<T> {
  keyframes: Keyframe<T>[];
}

export interface Keyframe<T> {
  frame: number;
  value: T;
  easeIn: BezierHandle;
  easeOut: BezierHandle;
}

export interface BezierHandle {
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
}

export type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type FillValue =
  | { type: 'none' }
  | { type: 'solid'; color: Color; opacity: number }
  | {
      type: 'linear';
      stops: GradientStop[];
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      opacity: number;
    }
  | {
      type: 'radial';
      stops: GradientStop[];
      centerX: number;
      centerY: number;
      radius: number;
      opacity: number;
    };

export interface GradientStop {
  position: number;
  color: Color;
}

export type DashArray = Array<{ dash: number; gap: number }>;

export interface AnimationPreset {
  id: string;
  name: string;
  staggerMs: number;
  durationMs: number;
  easeIn: BezierHandle;
  easeOut: BezierHandle;
  direction: 'index' | 'top-bottom' | 'left-right' | 'radial' | 'random';
  overlapPercent: number;
}

export type ToolType = 'select' | 'frame' | 'rect' | 'ellipse' | 'pen' | 'text' | 'image' | 'svg' | 'hand' | 'zoom';

export type EasingPreset = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring' | 'custom';

export interface SelectionState {
  layerIds: string[];
  keyframeIds: string[];
}
