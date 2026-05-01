import BezierEasing from 'bezier-easing';
import type { AnimatableProp, Keyframe, Transform, Color, FillValue, DashArray, BezierHandle } from '../../types';

const LINEAR: BezierHandle = { x: 0, y: 0 };
const LINEAR_END: BezierHandle = { x: 1, y: 1 };

function defaultTransform(): Transform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0 };
}

function defaultColor(): Color {
  return { r: 0, g: 0, b: 0, a: 1 };
}

function defaultFill(): FillValue {
  return { type: 'none' };
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: Color, b: Color, t: number): Color {
  return {
    r: Math.round(lerpNumber(a.r, b.r, t)),
    g: Math.round(lerpNumber(a.g, b.g, t)),
    b: Math.round(lerpNumber(a.b, b.b, t)),
    a: lerpNumber(a.a, b.a, t),
  };
}

function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: lerpNumber(a.x, b.x, t),
    y: lerpNumber(a.y, b.y, t),
    scaleX: lerpNumber(a.scaleX, b.scaleX, t),
    scaleY: lerpNumber(a.scaleY, b.scaleY, t),
    rotation: lerpNumber(a.rotation, b.rotation, t),
    anchorX: lerpNumber(a.anchorX, b.anchorX, t),
    anchorY: lerpNumber(a.anchorY, b.anchorY, t),
  };
}

function lerpFill(a: FillValue, b: FillValue, t: number): FillValue {
  if (a.type !== b.type) return t < 0.5 ? a : b;
  if (a.type === 'none' || b.type === 'none') return t < 0.5 ? a : b;
  if (a.type === 'solid' && b.type === 'solid') {
    return {
      type: 'solid',
      color: lerpColor(a.color, b.color, t),
      opacity: lerpNumber(a.opacity, b.opacity, t),
    };
  }
  return t < 0.5 ? a : b;
}

function lerpDashArray(a: DashArray, b: DashArray, t: number): DashArray {
  const len = Math.min(a.length, b.length);
  return Array.from({ length: len }, (_, i) => ({
    dash: lerpNumber(a[i].dash, b[i].dash, t),
    gap: lerpNumber(a[i].gap, b[i].gap, t),
  }));
}

function lerpValue<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') {
    return lerpNumber(a, b, t) as unknown as T;
  }
  if (isTransform(a) && isTransform(b)) {
    return lerpTransform(a, b, t) as unknown as T;
  }
  if (isColor(a) && isColor(b)) {
    return lerpColor(a, b, t) as unknown as T;
  }
  if (isFillValue(a) && isFillValue(b)) {
    return lerpFill(a, b, t) as unknown as T;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return lerpDashArray(a as unknown as DashArray, b as unknown as DashArray, t) as unknown as T;
  }
  return t < 0.5 ? a : b;
}

function isTransform(v: unknown): v is Transform {
  return typeof v === 'object' && v !== null && 'scaleX' in v;
}

function isColor(v: unknown): v is Color {
  return typeof v === 'object' && v !== null && 'r' in v && 'g' in v && 'b' in v && 'a' in v;
}

function isFillValue(v: unknown): v is FillValue {
  return typeof v === 'object' && v !== null && 'type' in v;
}

function getEasing(prev: Keyframe<unknown>, next: Keyframe<unknown>): (t: number) => number {
  const { easeOut } = prev;
  const { easeIn } = next;
  if (
    easeOut.x === 0 && easeOut.y === 0 && easeIn.x === 1 && easeIn.y === 1
  ) {
    return (t: number) => t;
  }
  return BezierEasing(easeOut.x, easeOut.y, easeIn.x, easeIn.y);
}

export function interpolate<T>(prop: AnimatableProp<T>, frame: number): T | undefined {
  if (prop.keyframes.length === 0) return undefined;
  if (prop.keyframes.length === 1) return prop.keyframes[0].value;

  const kfs = prop.keyframes;
  if (frame <= kfs[0].frame) return kfs[0].value;
  if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1].value;

  const nextIdx = kfs.findIndex((k) => k.frame > frame);
  if (nextIdx === -1) return kfs[kfs.length - 1].value;

  const prev = kfs[nextIdx - 1];
  const next = kfs[nextIdx];

  const rawT = (frame - prev.frame) / (next.frame - prev.frame);
  const easing = getEasing(prev as Keyframe<unknown>, next as Keyframe<unknown>);
  const easedT = easing(rawT);

  return lerpValue(prev.value, next.value, easedT);
}

export function interpolateNumber(prop: AnimatableProp<number>, frame: number, defaultVal: number): number {
  const v = interpolate(prop, frame);
  return v !== undefined ? v : defaultVal;
}

export function interpolateTransform(prop: AnimatableProp<Transform>, frame: number): Transform {
  const v = interpolate(prop, frame);
  return v !== undefined ? v : defaultTransform();
}

export function interpolateColor(prop: AnimatableProp<Color>, frame: number): Color {
  const v = interpolate(prop, frame);
  return v !== undefined ? v : defaultColor();
}

export function interpolateFill(prop: AnimatableProp<FillValue>, frame: number): FillValue {
  const v = interpolate(prop, frame);
  return v !== undefined ? v : defaultFill();
}

export { LINEAR, LINEAR_END };
