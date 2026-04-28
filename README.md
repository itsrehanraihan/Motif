# Motif — CLAUDE.md

This file is read by Claude Code at the start of every session. It contains
everything you need to work on this codebase without asking for context.

---

## What is Motif?

Motif is a browser-based SVG-to-Lottie motion editor. Users import any SVG
icon, animate its properties on a keyframe timeline (stroke trim, opacity,
transform, colour, gradient), and export production-ready Lottie JSON — with
no After Effects, no install, no login wall.

The core user loop is: **import SVG → auto-animation plays → tweak on
timeline → export .json**. Target time: under 90 seconds for a first-time user.

Codename: Motif. Product name: Motif. Do not call it "the app" or invent
other names.

---

## Tech Stack (pinned — do not suggest alternatives)

| Layer | Technology | Notes |
|---|---|---|
| UI framework | React 18 | Concurrent mode. Use useTransition for heavy ops. |
| Language | TypeScript 5 | Strict mode. `noImplicitAny: true`. Zero `any` types in core/. |
| Build | Vite 5 | SVGs imported as `?raw` strings. Workers via `?worker`. |
| Styling | Tailwind CSS + CSS Modules | Tailwind for layout/spacing. CSS Modules for component-specific. |
| State | Zustand + Immer | Zustand stores. Immer for all scene graph mutations. |
| SVG parsing | svgson + svgpath | svgson → AST. svgpath → path normalisation. |
| Geometry | @flatten-js/core | Path length, bounding box, geometric ops. |
| Lottie preview | lottie-web | Loaded on demand after first SVG import. |
| Interpolation | bezier-easing | Cubic bezier value interpolation for the playback engine. |
| Drag | @use-gesture/react | ALL drag interactions: timeline keyframes, canvas handles, scrub. |
| GIF export | gif.js | Web Worker encoder. Loaded on demand. |
| MP4 export | @ffmpeg/ffmpeg (WASM) | ~10MB. Pro only. Loaded on demand. |
| ZIP / .lottie | JSZip | dotLottie package creation. |
| Colour | chroma-js | Colour space conversion (RGB, HSL, hex, interpolation). |
| Testing | Vitest + Testing Library + Playwright | Unit, integration, E2E. |
| Errors | Sentry | Source maps uploaded. Filter localhost. |
| Analytics | Plausible | Privacy-first. No PII. |
| Deploy | Cloudflare Pages + Workers | CDN + edge proxy for URL import CORS. |

---

## Project Structure

```
motif/
├── CLAUDE.md                  ← you are here
├── src/
│   ├── core/                  ← ZERO React dependencies. Pure TS functions.
│   │   ├── parser/            ← SVG string → Layer[]
│   │   │   ├── index.ts       ← public API: parseSvg(svgString): Layer[]
│   │   │   ├── normalise.ts   ← flatten groups, resolve transforms
│   │   │   ├── pathConvert.ts ← shapes → paths, arc → bezier
│   │   │   └── svgToLottie.ts ← path commands → Lottie bezier {v,i,o}
│   │   ├── composer/          ← Scene graph → Lottie JSON
│   │   │   ├── index.ts       ← public API: composeProject(project): LottieJSON
│   │   │   ├── layers.ts      ← Layer → Lottie layer object
│   │   │   ├── keyframes.ts   ← AnimatableProp → Lottie keyframe array
│   │   │   └── shapes.ts      ← path + properties → Lottie shapes[] array
│   │   ├── interpolator/      ← Frame + keyframes → current value
│   │   │   └── index.ts       ← interpolate<T>(prop, frame): T
│   │   └── commands/          ← Undo/redo command pattern
│   │       ├── index.ts       ← executeCommand(), undo(), redo()
│   │       └── types.ts       ← Command interface, all command classes
│   ├── store/
│   │   ├── project.ts         ← Zustand store: Project scene graph
│   │   ├── ui.ts              ← Zustand store: editor UI state (selection, playhead, zoom)
│   │   └── history.ts         ← Zustand store: undo/redo history stack
│   ├── workers/
│   │   ├── parser.worker.ts   ← Web Worker: runs core/parser off main thread
│   │   ├── composer.worker.ts ← Web Worker: runs core/composer off main thread
│   │   └── gif.worker.ts      ← Web Worker: gif.js encoder
│   ├── components/
│   │   ├── canvas/            ← SVG canvas renderer + selection + transform handles
│   │   ├── timeline/          ← Timeline ruler, tracks, keyframe diamonds
│   │   ├── inspector/         ← Property inspector panels (transform, stroke, fill, easing)
│   │   ├── layers/            ← Layer list panel
│   │   ├── toolbar/           ← Top bar + canvas toolbar
│   │   └── shared/            ← Colour picker, gradient editor, bezier editor, number input
│   ├── hooks/
│   │   ├── usePlayback.ts     ← RAF loop, currentFrame ref, play/pause
│   │   ├── useKeyframes.ts    ← Add/remove/move keyframes, reads from store
│   │   └── useExport.ts       ← Triggers composer worker, handles download
│   └── types/
│       └── index.ts           ← All shared TypeScript interfaces (see Data Model below)
├── tests/
│   ├── unit/                  ← Vitest: core/ modules
│   ├── integration/           ← Vitest + Testing Library
│   └── e2e/                   ← Playwright
└── public/
    └── demo/                  ← Demo SVG icons for onboarding (checkmark, arrow, etc.)
```

**Dependency rule**: `core/` → no imports from `components/`, `store/`, or `hooks/`.
Components and hooks can import from `core/` and `store/`. `store/` can import
from `core/commands/`.

---

## Data Model (source of truth)

These are the canonical TypeScript interfaces. Use them exactly — do not
rename fields, do not add fields without updating this file.

```typescript
// src/types/index.ts

export interface Project {
  id: string;                    // uuid v4
  name: string;
  fps: 24 | 30 | 60;            // default: 60
  totalFrames: number;
  width: number;                 // artboard px (from SVG viewBox)
  height: number;
  background: string | null;     // hex string or null (transparent)
  layers: Layer[];
  presets: AnimationPreset[];
  version: number;               // schema version, start at 1
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;                 // accent colour for UI chrome (auto-assigned)
  inPoint: number;               // frame — when this layer becomes active
  outPoint: number;              // frame — when this layer becomes inactive
  pathData: string;              // normalised SVG path string (absolute commands only)
  properties: LayerProperties;
  groupId: string | null;        // null if not in a group
}

export interface LayerProperties {
  transform:       AnimatableProp<Transform>;
  opacity:         AnimatableProp<number>;        // 0–100
  strokeColor:     AnimatableProp<Color>;
  strokeWidth:     AnimatableProp<number>;        // px
  strokeOpacity:   AnimatableProp<number>;        // 0–100
  trimStart:       AnimatableProp<number>;        // 0–100 percent
  trimEnd:         AnimatableProp<number>;        // 0–100 percent
  trimOffset:      AnimatableProp<number>;        // -360 to 360 degrees
  fill:            AnimatableProp<FillValue>;
  strokeDash:      AnimatableProp<DashArray>;
}

export interface AnimatableProp<T> {
  keyframes: Keyframe<T>[];      // MUST stay sorted ascending by frame at all times
}

export interface Keyframe<T> {
  frame: number;
  value: T;
  easeIn:  BezierHandle;         // control point for incoming interpolation
  easeOut: BezierHandle;         // control point for outgoing interpolation
}

export interface BezierHandle {
  x: number;   // 0–1
  y: number;   // can go outside 0–1 for overshoot/bounce
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;    // 1.0 = 100%
  scaleY: number;
  rotation: number;  // degrees
  anchorX: number;
  anchorY: number;
}

export type Color = {
  r: number;   // 0–255
  g: number;
  b: number;
  a: number;   // 0–1
};

export type FillValue =
  | { type: 'none' }
  | { type: 'solid'; color: Color; opacity: number }
  | { type: 'linear'; stops: GradientStop[]; startX: number; startY: number; endX: number; endY: number; opacity: number }
  | { type: 'radial'; stops: GradientStop[]; centerX: number; centerY: number; radius: number; opacity: number };

export interface GradientStop {
  position: number;   // 0–1
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
```

### Interpreting AnimatableProp keyframe arrays

- `keyframes.length === 0` → use layer/property default value. Property is not animated.
- `keyframes.length === 1` → static value. Never interpolates. The single keyframe holds the value.
- `keyframes.length >= 2` → animated. Interpolate between keyframes using `bezier-easing`.

---

## Zustand Store Shape

```typescript
// store/project.ts
interface ProjectStore {
  project: Project;
  setProject: (updater: (draft: Project) => void) => void;   // always use Immer draft
}

// store/ui.ts
interface UIStore {
  selectedLayerIds: string[];
  currentFrame: number;           // source of truth for playhead position (UI display only)
  isPlaying: boolean;
  zoom: number;                   // canvas zoom, 0.1–8.0
  timelineZoom: number;           // timeline horizontal zoom, 1–10
  activeTool: 'select' | 'hand' | 'zoom';
  canvasBackground: string | null;
}

// store/history.ts
interface HistoryStore {
  past: Command[];                // max 50 entries
  future: Command[];
  execute: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
}
```

All store mutations go through `setProject(draft => { draft.layers[i].name = 'foo' })`.
Never mutate store state directly outside of the Immer updater.

---

## Command Pattern (Undo/Redo)

Every user action that modifies the scene graph MUST be wrapped in a Command.

```typescript
// core/commands/types.ts
export interface Command {
  readonly description: string;   // human-readable, shown in history panel
  execute(): void;
  undo(): void;
}
```

Examples of existing commands (add new ones in `core/commands/`):
- `AddKeyframeCommand` — adds a keyframe, undo removes it
- `MoveKeyframeCommand` — changes a keyframe's frame number, undo restores original
- `SetPropertyValueCommand` — sets a static property value
- `ReorderLayersCommand` — changes layer z-order
- `RenameLayerCommand` — changes layer name

**Batching**: Dragging a keyframe across many frames generates ONE command on
`pointerup`, not one per pixel. Accumulate intermediate values in the handler,
commit on end.

**Typing in inputs**: Generate ONE command on `blur`, not on every keystroke.
Use local component state while typing, commit to store on blur.

---

## Playback Engine Rules

These are non-negotiable. Do not deviate.

1. **Use `requestAnimationFrame`, never `setInterval`** for the playback loop.
2. **`currentFrame` during playback is a `useRef`, not `useState`**. Storing
   it in React state causes unnecessary re-renders at 60fps.
3. **Only sync `currentFrame` to the UI store at display rate** (debounced, or
   on every RAF tick but batched with React's concurrent mode).
4. **`renderFrame(frame: number)`** reads the scene graph, calls `interpolate()`
   for every animated property, and updates the SVG DOM directly. It must not
   trigger a full React re-render.
5. The RAF loop lives in `hooks/usePlayback.ts` and is the only place that
   drives the animation clock.

```typescript
// hooks/usePlayback.ts — shape (do not deviate from this structure)
export function usePlayback() {
  const frameRef = useRef(0);
  const rafRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  const tick = (time: number) => {
    const delta = time - (lastTimeRef.current ?? time);
    lastTimeRef.current = time;
    frameRef.current += (delta / 1000) * fps;
    if (frameRef.current >= totalFrames) {
      // handle loop / stop
    }
    renderFrame(frameRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  // play(), pause(), seek(frame) methods
}
```

---

## Canvas Rendering Rules

- **Render via SVG DOM, not `<canvas>`**. The canvas area is an `<svg>` element.
  This gives free hit-testing, CSS transforms, and selection handles.
- **Only re-render layers that changed** at the current frame. Use a dirty-flag
  per layer to skip unchanged layers.
- **60fps target for ≤ 80 paths**. Gracefully drop to 30fps for larger scenes.
- Transform handles are absolutely positioned `<div>` elements overlaid on the
  SVG, not SVG elements themselves.
- `@use-gesture/react` handles all pointer interactions on the canvas.

---

## Lottie Composer Rules

- The composer runs in `workers/composer.worker.ts` — never on the main thread.
- **Stagger is implemented via `ip` (in-point) offsets**, not delay keyframes.
  Layer N has `ip = N * staggerFrames`. This is the correct Lottie approach.
- SVG path coordinates must be normalised to Lottie coordinate space:
  top-left origin, matching the SVG viewBox dimensions.
- Arc commands (`A`) must be converted to cubic bezier approximations before
  passing to the composer. Lottie does not support arcs.
- Lottie bezier format: `{ v: [[x,y],...], i: [[ix,iy],...], o: [[ox,oy],...], c: boolean }`
  where `i` and `o` are **relative** to their vertex.
- For static properties (no keyframes): `{ a: 0, k: VALUE }`.
- For animated properties: `{ a: 1, k: [{ t, s, e, i, o }, ...] }`.

---

## SVG Parser Rules

- Parser runs in `workers/parser.worker.ts` — never on the main thread.
- All path commands must be converted to **absolute uppercase** before any
  further processing. Use `svgpath` for this.
- Transform resolution order: translate → rotate → scale → skewX → skewY →
  matrix. Apply parent transforms to children recursively.
- `<use>` elements must be expanded inline before parsing.
- `<symbol>` definitions must be inlined at point of use.
- Unsupported elements (`<image>`, `<text>`, `<foreignObject>`) → emit a
  warning via `postMessage({ type: 'warning', ... })`, do not throw.
- Fill-only paths (stroke: none or not set) → auto-convert to stroke using
  an outline algorithm. Emit a `{ type: 'info', message: 'fill converted to stroke' }` message.

---

## Hard Rules (never violate these)

- **No `any` types in `core/`**. Use `unknown` and narrow it.
- **No React imports in `core/`**. Core modules are pure TypeScript.
- **No direct store mutations**. Always use `setProject(draft => ...)`.
- **No `setInterval` in the playback engine**. Only `requestAnimationFrame`.
- **No raster `<canvas>` for main rendering**. The main canvas is SVG.
- **No storing `currentFrame` in React state during playback**. Use `useRef`.
- **All scene graph modifications go through a Command**. No raw store edits
  from component event handlers.
- **Keyframe arrays must stay sorted by frame**. Any function that inserts a
  keyframe must re-sort or insert at the correct position.
- **GIF and MP4 exports are Pro only**. Gate them behind `user.plan === 'pro'`
  check before triggering the export worker.
- **ffmpeg.wasm is loaded on demand**. Never import it at startup.
- **lottie-web is loaded on demand**. Import it only after the first SVG is parsed.

---

## Key Algorithms (implement as described)

### Arc-to-bezier conversion
Convert SVG `A` (arc) commands to cubic bezier approximations. Split arcs
greater than 90° into multiple segments. Each quarter-circle arc becomes one
cubic bezier. Use the standard parametric approximation:
`k ≈ 0.5522847498` (the magic constant for circular arc approximation).

### Property interpolation
```typescript
// core/interpolator/index.ts
import BezierEasing from 'bezier-easing';

function interpolate<T>(prop: AnimatableProp<T>, frame: number): T {
  if (prop.keyframes.length === 0) return getDefault<T>();
  if (prop.keyframes.length === 1) return prop.keyframes[0].value;

  const next = prop.keyframes.find(k => k.frame > frame);
  if (!next) return prop.keyframes[prop.keyframes.length - 1].value;
  const prev = prop.keyframes[prop.keyframes.indexOf(next) - 1];

  const t = (frame - prev.frame) / (next.frame - prev.frame);
  const easing = BezierEasing(prev.easeOut.x, prev.easeOut.y, next.easeIn.x, next.easeIn.y);
  const easedT = easing(t);

  return lerpValue(prev.value, next.value, easedT);
}
```

Colour interpolation: lerp each channel (r, g, b, a) separately in sRGB space.
Gradient interpolation: lerp each stop's colour and position independently.
Discrete types (fill type, line cap): step function — use `prev.value` until
exactly `next.frame`.

### Stagger application
```typescript
function applyStagger(layers: Layer[], config: StaggerConfig, fps: number): Layer[] {
  const ordered = orderLayers(layers, config.direction);
  return ordered.map((layer, i) => {
    const delayFrames = Math.round((config.staggerMs * i * (1 - config.overlapPercent / 100)) / (1000 / fps));
    const durationFrames = Math.round(config.durationMs / (1000 / fps));
    // Write trim keyframes: trimEnd goes 0→100 over durationFrames, starting at delayFrames
    return addTrimKeyframes(layer, delayFrames, durationFrames, config);
  });
}
```

---

## Current Build Status

Update this section as phases complete.

- [ ] Phase 1 — Foundation (Weeks 1–4): parser, composer, interpolator, basic shell
- [ ] Phase 2 — Timeline & Keyframes (Weeks 5–8)
- [ ] Phase 3 — Canvas Interaction (Weeks 9–11)
- [ ] Phase 4 — Export & Polish (Weeks 12–14)

Currently working on: **Phase 1 — not started**

---

## What's Already Decided (do not re-litigate)

- Canvas rendering: SVG DOM (not raster canvas, not WebGL)
- State: Zustand + Immer (not Redux, not Context, not Jotai)
- Playback: RAF + ref (not state-based ticker)
- Stagger: via Lottie `ip`/`op` offsets (not delay keyframes)
- Undo/redo: Command pattern with Immer patches (not full state snapshots)
- Interpolation: cubic bezier via `bezier-easing` (not custom easing math)
- Export worker: Web Worker for composer (not main thread)

---

## How to Ask Me to Build Something

Be specific about the module. Good prompts:

- "Implement `core/parser/normalise.ts` — the function that flattens nested SVG groups and resolves all transform attributes"
- "Build the `AddKeyframeCommand` class in `core/commands/` following the Command interface"
- "Write `core/interpolator/index.ts` using the algorithm in the Key Algorithms section"
- "Build the timeline ruler component — the horizontal strip at the top of the track area that shows frame numbers"

Avoid:
- "Build the whole app" (too large for one session)
- "Make it work" (not specific enough)
- "Add some animation" (no module or interface reference)

When starting a new module, I will always read this CLAUDE.md first and
confirm my understanding of the relevant interfaces before writing code.
