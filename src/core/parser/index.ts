import { parse as svgsonParse, type INode } from 'svgson';
import svgpath from 'svgpath';
import { v4 as uuidv4 } from 'uuid';
import type { Layer, LayerProperties, FillValue, Color } from '../../types';
import { parseTransform, type Matrix } from './normalise';
import { convertArcsToBeziersInPath } from './pathConvert';

const LAYER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiplyMatrix(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function parseColor(str: string | undefined): Color | null {
  if (!str || str === 'none' || str === 'transparent') return null;
  const hex = str.startsWith('#') ? str : null;
  if (hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgb = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] !== undefined ? +rgb[4] : 1 };
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000',
    green: '#008000', blue: '#0000ff',
  };
  return named[str] ? parseColor(named[str]) : { r: 0, g: 0, b: 0, a: 1 };
}

function shapeToPath(name: string, a: Record<string, string>): string {
  switch (name) {
    case 'rect': {
      const x = +a.x || 0, y = +a.y || 0;
      const w = +a.width || 0, h = +a.height || 0;
      const rx = +a.rx || +a.ry || 0;
      if (rx === 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      const r = Math.min(rx, w / 2, h / 2);
      return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
    }
    case 'circle': {
      const cx = +a.cx || 0, cy = +a.cy || 0, r = +a.r || 0;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'ellipse': {
      const cx = +a.cx || 0, cy = +a.cy || 0, rx = +a.rx || 0, ry = +a.ry || 0;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case 'line':
      return `M ${+a.x1 || 0} ${+a.y1 || 0} L ${+a.x2 || 0} ${+a.y2 || 0}`;
    case 'polyline':
    case 'polygon': {
      const coords = (a.points ?? '').trim().split(/[\s,]+/).map(Number);
      const parts: string[] = [];
      for (let i = 0; i + 1 < coords.length; i += 2) {
        parts.push(`${i === 0 ? 'M' : 'L'} ${coords[i]} ${coords[i + 1]}`);
      }
      if (name === 'polygon') parts.push('Z');
      return parts.join(' ');
    }
    case 'path':
      return a.d ?? '';
    default:
      return '';
  }
}

function normalisePathData(d: string, matrix: Matrix): string {
  if (!d) return '';
  try {
    let path = svgpath(d).abs().toString();
    path = convertArcsToBeziersInPath(path);
    path = svgpath(path).matrix([matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]]).toString();
    return path;
  } catch {
    return d;
  }
}

function makeEmptyProps(): LayerProperties {
  const empty = <T>(val: T) => ({ keyframes: [{ frame: 0, value: val, easeIn: { x: 1, y: 1 }, easeOut: { x: 0, y: 0 } }] });
  return {
    transform: empty({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0 }),
    opacity: empty(100),
    strokeColor: empty<Color>({ r: 0, g: 0, b: 0, a: 1 }),
    strokeWidth: empty(1),
    strokeOpacity: empty(100),
    trimStart: empty(0),
    trimEnd: empty(100),
    trimOffset: empty(0),
    fill: empty<FillValue>({ type: 'none' }),
    strokeDash: empty([]),
    cornerRadius: empty(0),
    fontSize: empty(16),
    letterSpacing: empty(0),
  };
}

const LEAF_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const GROUP_TAGS = new Set(['g', 'svg', 'symbol', 'a', 'switch']);

interface WalkCtx {
  layers: Layer[];
  defs: Map<string, INode>;
  totalFrames: number;
  colorIdx: { v: number };
  warnings: string[];
}

function nextColor(ctx: WalkCtx): string {
  const c = LAYER_COLORS[ctx.colorIdx.v % LAYER_COLORS.length];
  ctx.colorIdx.v++;
  return c;
}

function makeLeafLayer(
  tagName: string,
  attrs: Record<string, string>,
  matrix: Matrix,
  parentId: string | null,
  ctx: WalkCtx,
): Layer | null {
  const pathData = normalisePathData(shapeToPath(tagName, attrs), matrix);
  if (!pathData) return null;

  const props = makeEmptyProps();

  const fillColor = parseColor(attrs.fill);
  if (fillColor && attrs.fill !== 'none') {
    const fillOpacity = parseFloat(attrs['fill-opacity'] ?? attrs['opacity'] ?? '1') * 100;
    props.fill.keyframes[0].value = { type: 'solid', color: fillColor, opacity: fillOpacity };
  }

  const strokeColor = parseColor(attrs.stroke);
  if (strokeColor && attrs.stroke !== 'none') {
    props.strokeColor.keyframes[0].value = strokeColor;
    props.strokeOpacity.keyframes[0].value = parseFloat(attrs['stroke-opacity'] ?? '1') * 100;
  }
  const strokeWidth = parseFloat(attrs['stroke-width'] ?? '1');
  if (!isNaN(strokeWidth)) props.strokeWidth.keyframes[0].value = strokeWidth;

  return {
    id: uuidv4(),
    name: attrs.id || attrs['data-name'] || tagName,
    type: tagName as Layer['type'],
    visible: true,
    locked: false,
    color: nextColor(ctx),
    inPoint: 0,
    outPoint: ctx.totalFrames,
    pathData,
    properties: props,
    groupId: parentId,
    children: [],
    parentId,
  };
}

function makeGroupLayer(name: string, parentId: string | null, ctx: WalkCtx): Layer {
  return {
    id: uuidv4(),
    name,
    type: 'group',
    visible: true,
    locked: false,
    color: nextColor(ctx),
    inPoint: 0,
    outPoint: ctx.totalFrames,
    pathData: '',
    properties: makeEmptyProps(),
    groupId: parentId,
    children: [],
    parentId,
  };
}

let groupCounter = 0;

function walk(node: INode, parentId: string | null, parentMatrix: Matrix, ctx: WalkCtx): void {
  if (node.name === 'defs') return;
  if (node.type === 'text') return;

  if (node.name === 'use') {
    const href = node.attributes?.href ?? node.attributes?.['xlink:href'] ?? '';
    const ref = ctx.defs.get(href.replace('#', ''));
    if (ref) {
      const useMatrix = node.attributes?.transform ? parseTransform(node.attributes.transform) : IDENTITY;
      walk({ ...ref, attributes: { ...ref.attributes, ...node.attributes, transform: '' } }, parentId, multiplyMatrix(parentMatrix, useMatrix), ctx);
    }
    return;
  }

  const localMatrix = node.attributes?.transform ? parseTransform(node.attributes.transform) : IDENTITY;
  const combined = multiplyMatrix(parentMatrix, localMatrix);

  if (GROUP_TAGS.has(node.name)) {
    // <svg> root and direct children: don't create a group layer for the root
    const isRoot = node.name === 'svg' && parentId === null;
    let nextParentId = parentId;
    if (!isRoot && (node.name === 'g' || node.name === 'symbol')) {
      const groupName = node.attributes?.id || node.attributes?.['data-name'] || `Group ${++groupCounter}`;
      const group = makeGroupLayer(groupName, parentId, ctx);
      ctx.layers.push(group);
      nextParentId = group.id;
    }
    for (const child of node.children ?? []) {
      walk(child, nextParentId, combined, ctx);
    }
    return;
  }

  if (LEAF_TAGS.has(node.name)) {
    const layer = makeLeafLayer(node.name, node.attributes ?? {}, combined, parentId, ctx);
    if (layer) ctx.layers.push(layer);
    return;
  }

  if (node.name === 'image') {
    ctx.warnings.push('<image> is not supported and was skipped.');
    return;
  }
  if (node.name === 'text') {
    ctx.warnings.push('<text> is not yet rendered.');
  }
}

export interface ParseResult {
  layers: Layer[];
  width: number;
  height: number;
  warnings: string[];
}

export async function parseSvg(svgString: string, totalFrames = 120): Promise<ParseResult> {
  groupCounter = 0;
  const ast = await svgsonParse(svgString, { camelcase: false });

  const viewBox = ast.attributes?.viewBox?.split(/[\s,]+/).map(Number) ?? [];
  const width = viewBox[2] || parseFloat(ast.attributes?.width ?? '100');
  const height = viewBox[3] || parseFloat(ast.attributes?.height ?? '100');

  const defs = new Map<string, INode>();
  const collectDefs = (n: INode) => {
    if (n.name === 'defs') {
      for (const def of n.children ?? []) {
        if (def.attributes?.id) defs.set(def.attributes.id, def);
      }
    } else {
      for (const child of n.children ?? []) collectDefs(child);
    }
  };
  collectDefs(ast);

  const ctx: WalkCtx = {
    layers: [],
    defs,
    totalFrames,
    colorIdx: { v: 0 },
    warnings: [],
  };

  walk(ast, null, IDENTITY, ctx);

  // Prune empty groups (groups with no descendants that produced layers)
  const hasDescendants = new Set<string>();
  for (const l of ctx.layers) {
    let p: string | null = l.parentId;
    while (p) {
      hasDescendants.add(p);
      const parent = ctx.layers.find((x) => x.id === p);
      p = parent?.parentId ?? null;
    }
  }
  const pruned = ctx.layers.filter((l) => l.type !== 'group' || hasDescendants.has(l.id));

  return { layers: pruned, width, height, warnings: ctx.warnings };
}
