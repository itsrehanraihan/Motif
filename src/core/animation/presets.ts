import type { Layer, BezierHandle, Transform, Color } from '../../types';

// Easing curves matching Jitter / Figma defaults
const EASE_OUT_QUART: { in: BezierHandle; out: BezierHandle } = {
  in: { x: 0.25, y: 1 },
  out: { x: 0.25, y: 1 },
};
const EASE_IN_OUT: { in: BezierHandle; out: BezierHandle } = {
  in: { x: 0.65, y: 0 },
  out: { x: 0.35, y: 1 },
};
const EASE_OUT_BACK: { in: BezierHandle; out: BezierHandle } = {
  in: { x: 0.34, y: 1.56 },
  out: { x: 0.34, y: 1.56 },
};

export type PresetCategory = 'in' | 'out' | 'loop';

export interface AnimationPresetDef {
  id: string;
  name: string;
  category: PresetCategory;
  emoji: string;
  apply: (layer: Layer, ctx: PresetContext) => Layer;
}

export interface PresetContext {
  fps: number;
  totalFrames: number;
  startFrame: number;
  durationFrames: number;
}

function baseTransform(layer: Layer): Transform {
  return (
    layer.properties.transform.keyframes[0]?.value ?? {
      x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0,
    }
  );
}

function makeTransformKfs(
  start: number,
  end: number,
  from: Transform,
  to: Transform,
  easing = EASE_OUT_QUART,
) {
  return [
    { frame: start, value: from, easeIn: easing.in, easeOut: easing.out },
    { frame: end, value: to, easeIn: easing.in, easeOut: easing.out },
  ];
}

function makeNumberKfs(
  start: number,
  end: number,
  from: number,
  to: number,
  easing = EASE_OUT_QUART,
) {
  return [
    { frame: start, value: from, easeIn: easing.in, easeOut: easing.out },
    { frame: end, value: to, easeIn: easing.in, easeOut: easing.out },
  ];
}

function clone(layer: Layer): Layer {
  return {
    ...layer,
    properties: {
      ...layer.properties,
      transform: { keyframes: [...layer.properties.transform.keyframes] },
      opacity: { keyframes: [...layer.properties.opacity.keyframes] },
      trimEnd: { keyframes: [...layer.properties.trimEnd.keyframes] },
      trimStart: { keyframes: [...layer.properties.trimStart.keyframes] },
    },
  };
}

// ── Reveal In ────────────────────────────────────────────────────────────────

const fadeIn: AnimationPresetDef = {
  id: 'fade-in',
  name: 'Fade In',
  category: 'in',
  emoji: '🌫',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const slideInUp: AnimationPresetDef = {
  id: 'slide-in-up',
  name: 'Slide In Up',
  category: 'in',
  emoji: '⬆',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(
      ctx.startFrame, end,
      { ...t, y: t.y + 60 },
      t,
    );
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const slideInDown: AnimationPresetDef = {
  id: 'slide-in-down', name: 'Slide In Down', category: 'in', emoji: '⬇',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(ctx.startFrame, end, { ...t, y: t.y - 60 }, t);
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const slideInLeft: AnimationPresetDef = {
  id: 'slide-in-left', name: 'Slide In Left', category: 'in', emoji: '➡',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(ctx.startFrame, end, { ...t, x: t.x - 60 }, t);
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const slideInRight: AnimationPresetDef = {
  id: 'slide-in-right', name: 'Slide In Right', category: 'in', emoji: '⬅',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(ctx.startFrame, end, { ...t, x: t.x + 60 }, t);
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const scaleIn: AnimationPresetDef = {
  id: 'scale-in', name: 'Scale In', category: 'in', emoji: '🔍',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(
      ctx.startFrame, end,
      { ...t, scaleX: 0, scaleY: 0 },
      t,
    );
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const popIn: AnimationPresetDef = {
  id: 'pop-in', name: 'Pop In', category: 'in', emoji: '💥',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(
      ctx.startFrame, end,
      { ...t, scaleX: 0.3, scaleY: 0.3 },
      t,
      EASE_OUT_BACK,
    );
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const rotateIn: AnimationPresetDef = {
  id: 'rotate-in', name: 'Rotate In', category: 'in', emoji: '🔄',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(
      ctx.startFrame, end,
      { ...t, rotation: t.rotation - 90, scaleX: 0.5, scaleY: 0.5 },
      t,
    );
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100);
    return out;
  },
};

const drawIn: AnimationPresetDef = {
  id: 'draw-in', name: 'Draw In', category: 'in', emoji: '✏',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    out.properties.trimEnd.keyframes = makeNumberKfs(ctx.startFrame, end, 0, 100, EASE_IN_OUT);
    out.properties.opacity.keyframes = [
      { frame: ctx.startFrame, value: 100, easeIn: EASE_OUT_QUART.in, easeOut: EASE_OUT_QUART.out },
    ];
    return out;
  },
};

// ── Reveal Out ───────────────────────────────────────────────────────────────

const fadeOut: AnimationPresetDef = {
  id: 'fade-out', name: 'Fade Out', category: 'out', emoji: '🌫',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 100, 0);
    return out;
  },
};

const scaleOut: AnimationPresetDef = {
  id: 'scale-out', name: 'Scale Out', category: 'out', emoji: '🔍',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(ctx.startFrame, end, t, { ...t, scaleX: 0, scaleY: 0 });
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 100, 0);
    return out;
  },
};

const slideOutDown: AnimationPresetDef = {
  id: 'slide-out-down', name: 'Slide Out Down', category: 'out', emoji: '⬇',
  apply(layer, ctx) {
    const out = clone(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    const t = baseTransform(layer);
    out.properties.transform.keyframes = makeTransformKfs(ctx.startFrame, end, t, { ...t, y: t.y + 60 });
    out.properties.opacity.keyframes = makeNumberKfs(ctx.startFrame, end, 100, 0);
    return out;
  },
};

// ── Loop ─────────────────────────────────────────────────────────────────────

const pulse: AnimationPresetDef = {
  id: 'pulse', name: 'Pulse', category: 'loop', emoji: '💗',
  apply(layer, ctx) {
    const out = clone(layer);
    const t = baseTransform(layer);
    const mid = ctx.startFrame + Math.round(ctx.durationFrames / 2);
    const end = ctx.startFrame + ctx.durationFrames;
    out.properties.transform.keyframes = [
      { frame: ctx.startFrame, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: mid, value: { ...t, scaleX: t.scaleX * 1.1, scaleY: t.scaleY * 1.1 }, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: end, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
    ];
    return out;
  },
};

const float: AnimationPresetDef = {
  id: 'float', name: 'Float', category: 'loop', emoji: '🪶',
  apply(layer, ctx) {
    const out = clone(layer);
    const t = baseTransform(layer);
    const q = Math.round(ctx.durationFrames / 4);
    out.properties.transform.keyframes = [
      { frame: ctx.startFrame, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q, value: { ...t, y: t.y - 8 }, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q * 2, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q * 3, value: { ...t, y: t.y + 8 }, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + ctx.durationFrames, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
    ];
    return out;
  },
};

const wobble: AnimationPresetDef = {
  id: 'wobble', name: 'Wobble', category: 'loop', emoji: '〰',
  apply(layer, ctx) {
    const out = clone(layer);
    const t = baseTransform(layer);
    const q = Math.round(ctx.durationFrames / 4);
    out.properties.transform.keyframes = [
      { frame: ctx.startFrame, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q, value: { ...t, rotation: t.rotation - 6 }, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q * 2, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + q * 3, value: { ...t, rotation: t.rotation + 6 }, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
      { frame: ctx.startFrame + ctx.durationFrames, value: t, easeIn: EASE_IN_OUT.in, easeOut: EASE_IN_OUT.out },
    ];
    return out;
  },
};

const spin: AnimationPresetDef = {
  id: 'spin', name: 'Spin', category: 'loop', emoji: '🌀',
  apply(layer, ctx) {
    const out = clone(layer);
    const t = baseTransform(layer);
    const end = ctx.startFrame + ctx.durationFrames;
    out.properties.transform.keyframes = [
      { frame: ctx.startFrame, value: t, easeIn: { x: 0.5, y: 0.5 }, easeOut: { x: 0.5, y: 0.5 } },
      { frame: end, value: { ...t, rotation: t.rotation + 360 }, easeIn: { x: 0.5, y: 0.5 }, easeOut: { x: 0.5, y: 0.5 } },
    ];
    return out;
  },
};

const bounce: AnimationPresetDef = {
  id: 'bounce', name: 'Bounce', category: 'loop', emoji: '🏀',
  apply(layer, ctx) {
    const out = clone(layer);
    const t = baseTransform(layer);
    const q = Math.round(ctx.durationFrames / 4);
    out.properties.transform.keyframes = [
      { frame: ctx.startFrame, value: t, easeIn: { x: 0.65, y: 0 }, easeOut: { x: 0.35, y: 1 } },
      { frame: ctx.startFrame + q * 2, value: { ...t, y: t.y - 30 }, easeIn: { x: 0.65, y: 0 }, easeOut: { x: 0.35, y: 1 } },
      { frame: ctx.startFrame + ctx.durationFrames, value: t, easeIn: { x: 0.65, y: 0 }, easeOut: { x: 0.35, y: 1 } },
    ];
    return out;
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const PRESETS: AnimationPresetDef[] = [
  fadeIn, slideInUp, slideInDown, slideInLeft, slideInRight,
  scaleIn, popIn, rotateIn, drawIn,
  fadeOut, scaleOut, slideOutDown,
  pulse, float, wobble, spin, bounce,
];

export function getPresetsByCategory(cat: PresetCategory): AnimationPresetDef[] {
  return PRESETS.filter((p) => p.category === cat);
}

export function findPreset(id: string): AnimationPresetDef | undefined {
  return PRESETS.find((p) => p.id === id);
}

// ── Bulk apply with stagger (for "import → auto-animation") ──────────────────

export interface ApplyConfig {
  presetId: string;
  fps: number;
  totalFrames: number;
  durationMs: number;
  staggerMs: number;
}

export function applyPresetToLayers(layers: Layer[], cfg: ApplyConfig): Layer[] {
  const preset = findPreset(cfg.presetId);
  if (!preset) return layers;

  const durationFrames = Math.max(1, Math.round((cfg.durationMs * cfg.fps) / 1000));
  const staggerFrames = Math.round((cfg.staggerMs * cfg.fps) / 1000);

  return layers.map((layer, i) => {
    const startFrame = Math.min(i * staggerFrames, Math.max(0, cfg.totalFrames - durationFrames));
    return preset.apply(layer, {
      fps: cfg.fps,
      totalFrames: cfg.totalFrames,
      startFrame,
      durationFrames,
    });
  });
}
