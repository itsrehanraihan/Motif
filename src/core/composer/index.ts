import type { Project, Layer, AnimatableProp, Keyframe, Transform, Color, FillValue } from '../../types';

// Lottie JSON types (simplified)
interface LottieJSON {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: 0;
  assets: unknown[];
  layers: LottieLayer[];
}

interface LottieLayer {
  ddd: 0;
  ind: number;
  ty: number;
  nm: string;
  sr: 1;
  ks: LottieTransform;
  ao: 0;
  shapes?: LottieShape[];
  ip: number;
  op: number;
  st: number;
  bm: 0;
}

interface LottieValue {
  a: 0 | 1;
  k: unknown;
}

interface LottieTransform {
  o: LottieValue;
  r: LottieValue;
  p: LottieValue;
  a: LottieValue;
  s: LottieValue;
}

interface LottieShape {
  ty: string;
  [key: string]: unknown;
}

function colorToLottie(c: Color): [number, number, number, number] {
  return [c.r / 255, c.g / 255, c.b / 255, c.a];
}

function makeLottieValue<T>(prop: AnimatableProp<T>, transform: (v: T) => unknown): LottieValue {
  if (prop.keyframes.length === 0) return { a: 0, k: 0 };
  if (prop.keyframes.length === 1) {
    return { a: 0, k: transform(prop.keyframes[0].value) };
  }

  const k = prop.keyframes.map((kf: Keyframe<T>, i: number) => {
    const next = prop.keyframes[i + 1];
    return {
      t: kf.frame,
      s: [transform(kf.value)],
      e: next ? [transform(next.value)] : [transform(kf.value)],
      i: { x: [kf.easeIn.x], y: [kf.easeIn.y] },
      o: { x: [kf.easeOut.x], y: [kf.easeOut.y] },
    };
  });

  return { a: 1, k };
}

function makeTransformLottie(layer: Layer): LottieTransform {
  const t = layer.properties.transform;
  const opacity = layer.properties.opacity;

  const pos = makeLottieValue(t, (v: Transform) => [v.x, v.y]);
  const rot = makeLottieValue(t, (v: Transform) => v.rotation);
  const scale = makeLottieValue(t, (v: Transform) => [v.scaleX * 100, v.scaleY * 100]);
  const anchor = makeLottieValue(t, (v: Transform) => [v.anchorX, v.anchorY]);
  const op = makeLottieValue(opacity, (v: number) => v);

  return {
    o: op as LottieValue,
    r: rot as LottieValue,
    p: pos as LottieValue,
    a: anchor as LottieValue,
    s: scale as LottieValue,
  };
}

function pathToLottie(d: string): LottieShape {
  // Parse SVG path data into Lottie bezier format
  const tokens = d.match(/[MmCcLlHhVvZzQqTtSsAa]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g) ?? [];
  const vertices: [number, number][] = [];
  const inTangents: [number, number][] = [];
  const outTangents: [number, number][] = [];
  let closed = false;
  let i = 0;
  let cx = 0, cy = 0;

  function addVertex(x: number, y: number, ix = 0, iy = 0, ox = 0, oy = 0) {
    vertices.push([x, y]);
    inTangents.push([ix - x, iy - y]);
    outTangents.push([ox - x, oy - y]);
    cx = x; cy = y;
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': {
        const x = +tokens[i++], y = +tokens[i++];
        addVertex(x, y);
        break;
      }
      case 'L': {
        const x = +tokens[i++], y = +tokens[i++];
        addVertex(x, y);
        break;
      }
      case 'C': {
        const cp1x = +tokens[i++], cp1y = +tokens[i++];
        const cp2x = +tokens[i++], cp2y = +tokens[i++];
        const x = +tokens[i++], y = +tokens[i++];
        // Update out tangent of last vertex
        if (vertices.length > 0) {
          outTangents[outTangents.length - 1] = [cp1x - cx, cp1y - cy];
        }
        addVertex(x, y, cp2x, cp2y, x, y);
        break;
      }
      case 'Z':
      case 'z':
        closed = true;
        break;
      default:
        break;
    }
  }

  return {
    ty: 'sh',
    ks: {
      a: 0,
      k: {
        i: inTangents,
        o: outTangents,
        v: vertices,
        c: closed,
      },
    },
  };
}

function makeFillShape(fill: AnimatableProp<FillValue>): LottieShape | null {
  const kf = fill.keyframes[0];
  if (!kf || kf.value.type === 'none') return null;
  if (kf.value.type === 'solid') {
    return {
      ty: 'fl',
      nm: 'Fill',
      o: { a: 0, k: kf.value.opacity },
      c: { a: 0, k: colorToLottie(kf.value.color) },
      r: 1,
    };
  }
  return null;
}

function makeStrokeShape(layer: Layer): LottieShape | null {
  const sc = layer.properties.strokeColor.keyframes[0]?.value;
  const sw = layer.properties.strokeWidth.keyframes[0]?.value ?? 0;
  if (!sc || sw === 0) return null;
  return {
    ty: 'st',
    nm: 'Stroke',
    o: { a: 0, k: layer.properties.strokeOpacity.keyframes[0]?.value ?? 100 },
    c: { a: 0, k: colorToLottie(sc) },
    w: { a: 0, k: sw },
    lc: 2,
    lj: 2,
    ml: 4,
  };
}

function makeTrimShape(layer: Layer): LottieShape | null {
  const ts = layer.properties.trimStart;
  const te = layer.properties.trimEnd;
  if (ts.keyframes.length === 0 && te.keyframes.length === 0) return null;
  const start = makeLottieValue(ts, (v: number) => v);
  const end = makeLottieValue(te, (v: number) => v);
  return { ty: 'tm', s: start, e: end, o: { a: 0, k: 0 } };
}

function layerToLottie(layer: Layer, index: number, fps: number, totalFrames: number): LottieLayer {
  const shapes: LottieShape[] = [];

  if (layer.pathData) {
    shapes.push(pathToLottie(layer.pathData));
  }

  const fill = makeFillShape(layer.properties.fill);
  if (fill) shapes.push(fill);

  const stroke = makeStrokeShape(layer);
  if (stroke) shapes.push(stroke);

  const trim = makeTrimShape(layer);
  if (trim) shapes.push(trim);

  return {
    ddd: 0,
    ind: index,
    ty: 4, // shape layer
    nm: layer.name,
    sr: 1,
    ks: makeTransformLottie(layer),
    ao: 0,
    shapes,
    ip: layer.inPoint,
    op: layer.outPoint,
    st: 0,
    bm: 0,
  };
}

export function composeProject(project: Project): LottieJSON {
  const layers = project.layers
    .filter((l) => l.visible)
    .map((l, i) => layerToLottie(l, i, project.fps, project.totalFrames));

  return {
    v: '5.9.0',
    fr: project.fps,
    ip: 0,
    op: project.totalFrames,
    w: project.width,
    h: project.height,
    nm: project.name,
    ddd: 0,
    assets: [],
    layers,
  };
}
