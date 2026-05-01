import type { Layer, BezierHandle, Transform } from '../../types';

const LINEAR_IN: BezierHandle = { x: 0.5, y: 0.5 };
const LINEAR_OUT: BezierHandle = { x: 0.5, y: 0.5 };

export interface JitterConfig {
  fps: number;
  totalFrames: number;
  amplitudePx?: number; // max positional offset
  amplitudeDeg?: number; // max rotation offset
  amplitudeScale?: number; // max scale variation
  steps?: number; // keyframes per layer
  staggerMs?: number; // per-layer phase offset so layers don't all jitter in sync
}

/**
 * Seeded pseudo-random so the same import gives the same animation.
 * Layers feel "alive" but deterministic.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Continuous jitter loop:
 *  - small rotation oscillation
 *  - tiny x/y offset
 *  - subtle scale pulse
 *
 * Distributed across the full timeline length, looping (first kf == last kf).
 * Each layer is seeded by its index so motion doesn't move in lockstep.
 */
export function applyJitterAnimation(layers: Layer[], cfg: JitterConfig): Layer[] {
  const amplitudePx = cfg.amplitudePx ?? 3;
  const amplitudeDeg = cfg.amplitudeDeg ?? 4;
  const amplitudeScale = cfg.amplitudeScale ?? 0.04;
  const steps = cfg.steps ?? 8;
  const staggerFrames = Math.round(((cfg.staggerMs ?? 50) * cfg.fps) / 1000);

  return layers.map((layer, i) => {
    const rand = mulberry32(((layer.id.charCodeAt(0) || 1) * 7919 + i * 31) | 0);

    const baseTransform: Transform = layer.properties.transform.keyframes[0]?.value ?? {
      x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0,
    };

    const keyframes: { frame: number; value: Transform; easeIn: BezierHandle; easeOut: BezierHandle }[] = [];

    for (let s = 0; s <= steps; s++) {
      const baseFrame = Math.round((s / steps) * cfg.totalFrames);
      const frame = Math.max(0, Math.min(cfg.totalFrames, baseFrame + (i % 2 === 0 ? 0 : staggerFrames)));

      // Last step matches first to make the loop seamless
      const isLast = s === steps;
      const isFirst = s === 0;
      const r = isLast || isFirst ? 0 : rand() * 2 - 1; // [-1, 1]
      const r2 = isLast || isFirst ? 0 : rand() * 2 - 1;
      const r3 = isLast || isFirst ? 0 : rand() * 2 - 1;
      const r4 = isLast || isFirst ? 0 : rand() * 2 - 1;

      keyframes.push({
        frame,
        value: {
          ...baseTransform,
          x: baseTransform.x + r * amplitudePx,
          y: baseTransform.y + r2 * amplitudePx,
          rotation: baseTransform.rotation + r3 * amplitudeDeg,
          scaleX: baseTransform.scaleX * (1 + r4 * amplitudeScale),
          scaleY: baseTransform.scaleY * (1 + r4 * amplitudeScale),
        },
        easeIn: LINEAR_IN,
        easeOut: LINEAR_OUT,
      });
    }

    // De-duplicate keyframes that landed on the same frame
    const seen = new Set<number>();
    const dedup = keyframes.filter((k) => {
      if (seen.has(k.frame)) return false;
      seen.add(k.frame);
      return true;
    });

    return {
      ...layer,
      properties: {
        ...layer.properties,
        transform: { keyframes: dedup },
      },
    };
  });
}

// Re-export under old name so callers don't break
export { applyJitterAnimation as applyDrawOnAnimation };
