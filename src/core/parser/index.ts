import { parse as svgsonParse } from 'svgson';
import svgpath from 'svgpath';
import { v4 as uuidv4 } from 'uuid';
import type { Layer, LayerProperties, FillValue, Color } from '../../types';
import { flattenSvgTree, applyMatrixToPoint, type FlatNode, type Matrix } from './normalise';
import { convertArcsToBeziersInPath } from './pathConvert';

const LAYER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

function colorIdx(i: number): string {
  return LAYER_COLORS[i % LAYER_COLORS.length];
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
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] !== undefined ? +rgb[4] : 1 };
  }
  // Named colors - just basic ones
  const named: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000',
    green: '#008000', blue: '#0000ff', none: 'none',
  };
  return named[str] ? parseColor(named[str]) : { r: 0, g: 0, b: 0, a: 1 };
}

function shapeToPath(node: FlatNode): string {
  const a = node.attrs;
  switch (node.tagName) {
    case 'rect': {
      const x = +a.x || 0, y = +a.y || 0;
      const w = +a.width || 0, h = +a.height || 0;
      const rx = +a.rx || +a.ry || 0;
      if (rx === 0) {
        return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      }
      const r = Math.min(rx, w / 2, h / 2);
      return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
    }
    case 'circle': {
      const cx = +a.cx || 0, cy = +a.cy || 0, r = +a.r || 0;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'ellipse': {
      const cx = +a.cx || 0, cy = +a.cy || 0;
      const rx = +a.rx || 0, ry = +a.ry || 0;
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case 'line': {
      return `M ${+a.x1 || 0} ${+a.y1 || 0} L ${+a.x2 || 0} ${+a.y2 || 0}`;
    }
    case 'polyline':
    case 'polygon': {
      const pts = (a.points ?? '').trim().split(/[\s,]+/);
      const coords: number[] = pts.map(Number);
      const parts: string[] = [];
      for (let i = 0; i + 1 < coords.length; i += 2) {
        parts.push(`${i === 0 ? 'M' : 'L'} ${coords[i]} ${coords[i + 1]}`);
      }
      if (node.tagName === 'polygon') parts.push('Z');
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
    // Apply matrix transform to path points
    path = svgpath(path).matrix([matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]]).toString();
    return path;
  } catch {
    return d;
  }
}

function makeEmptyProps(totalFrames: number): LayerProperties {
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

function nodeToLayer(node: FlatNode, index: number, totalFrames: number): Layer {
  const pathData = normalisePathData(shapeToPath(node), node.matrix);
  const props = makeEmptyProps(totalFrames);

  // Parse fill
  const fillStr = node.attrs.fill ?? node.attrs['data-fill'];
  const fillColor = parseColor(fillStr);
  if (fillColor && fillStr !== 'none') {
    const fillOpacity = parseFloat(node.attrs['fill-opacity'] ?? node.attrs['opacity'] ?? '1') * 100;
    props.fill.keyframes[0].value = { type: 'solid', color: fillColor, opacity: fillOpacity };
  }

  // Parse stroke
  const strokeStr = node.attrs.stroke;
  const strokeColor = parseColor(strokeStr);
  if (strokeColor && strokeStr !== 'none') {
    props.strokeColor.keyframes[0].value = strokeColor;
    const strokeOpacity = parseFloat(node.attrs['stroke-opacity'] ?? '1') * 100;
    props.strokeOpacity.keyframes[0].value = strokeOpacity;
  }

  const strokeWidth = parseFloat(node.attrs['stroke-width'] ?? '1');
  if (!isNaN(strokeWidth)) props.strokeWidth.keyframes[0].value = strokeWidth;

  const id = node.id || uuidv4();
  return {
    id,
    name: node.name || `Layer ${index + 1}`,
    type: node.tagName as Layer['type'],
    visible: true,
    locked: false,
    color: colorIdx(index),
    inPoint: 0,
    outPoint: totalFrames,
    pathData,
    properties: props,
    groupId: null,
    children: [],
    parentId: null,
  };
}

export interface ParseResult {
  layers: Layer[];
  width: number;
  height: number;
  warnings: string[];
}

export async function parseSvg(svgString: string, totalFrames = 120): Promise<ParseResult> {
  const warnings: string[] = [];
  const ast = await svgsonParse(svgString, { camelcase: false });

  const viewBox = ast.attributes?.viewBox?.split(/[\s,]+/).map(Number) ?? [];
  const width = viewBox[2] || parseFloat(ast.attributes?.width ?? '100');
  const height = viewBox[3] || parseFloat(ast.attributes?.height ?? '100');

  const defs = new Map<string, import('svgson').INode>();

  // Pre-populate defs
  for (const child of ast.children ?? []) {
    if (child.name === 'defs') {
      for (const def of child.children ?? []) {
        if (def.attributes?.id) defs.set(def.attributes.id, def);
      }
    }
  }

  const flatNodes = flattenSvgTree(ast, [1, 0, 0, 1, 0, 0] as Matrix, defs);

  const layers: Layer[] = [];
  for (let i = 0; i < flatNodes.length; i++) {
    const node = flatNodes[i];
    if (node.tagName === 'image') {
      warnings.push(`<image> elements are not supported and were skipped.`);
      continue;
    }
    if (node.tagName === 'text') {
      warnings.push(`<text> elements are not fully supported.`);
    }
    const layer = nodeToLayer(node, i, totalFrames);
    if (layer.pathData) {
      layers.push(layer);
    }
  }

  return { layers, width, height, warnings };
}
