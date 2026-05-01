import type { INode } from 'svgson';

// Resolve SVG transform attribute into a 3x3 matrix [a,b,c,d,e,f]
type Matrix = [number, number, number, number, number, number];

const identity: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function parseTransform(attr: string): Matrix {
  let m = identity;
  const re = /(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(attr)) !== null) {
    const fn = match[1];
    const args = match[2].trim().split(/[\s,]+/).map(Number);
    let t: Matrix = identity;

    switch (fn) {
      case 'matrix':
        t = [args[0], args[1], args[2], args[3], args[4], args[5]];
        break;
      case 'translate':
        t = [1, 0, 0, 1, args[0], args[1] ?? 0];
        break;
      case 'rotate': {
        const angle = (args[0] * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (args.length >= 3) {
          const cx = args[1], cy = args[2];
          t = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        } else {
          t = [cos, sin, -sin, cos, 0, 0];
        }
        break;
      }
      case 'scale':
        t = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
        break;
      case 'skewX': {
        const ta = Math.tan((args[0] * Math.PI) / 180);
        t = [1, 0, ta, 1, 0, 0];
        break;
      }
      case 'skewY': {
        const ta = Math.tan((args[0] * Math.PI) / 180);
        t = [1, ta, 0, 1, 0, 0];
        break;
      }
    }
    m = multiply(m, t);
  }
  return m;
}

export function applyMatrixToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// Walk SVG AST and flatten groups, resolving transforms
export type { Matrix };
export interface FlatNode {
  id: string;
  name: string;
  tagName: string;
  attrs: Record<string, string>;
  matrix: Matrix;
}

export function flattenSvgTree(node: INode, parentMatrix: Matrix = identity, defs: Map<string, INode> = new Map()): FlatNode[] {
  const results: FlatNode[] = [];

  // Collect defs first
  if (node.name === 'defs') {
    for (const child of node.children ?? []) {
      if (child.attributes?.id) {
        defs.set(child.attributes.id, child);
      }
    }
    return results;
  }

  // Expand <use> elements
  if (node.name === 'use') {
    const href = node.attributes?.href ?? node.attributes?.['xlink:href'] ?? '';
    const refId = href.replace('#', '');
    const ref = defs.get(refId);
    if (ref) {
      const useMatrix = node.attributes?.transform ? parseTransform(node.attributes.transform) : identity;
      const combined = multiply(parentMatrix, useMatrix);
      return flattenSvgTree({ ...ref, attributes: { ...ref.attributes, ...node.attributes, transform: '' } }, combined, defs);
    }
    return results;
  }

  const localMatrix = node.attributes?.transform ? parseTransform(node.attributes.transform) : identity;
  const combined = multiply(parentMatrix, localMatrix);

  const groupLike = ['g', 'svg', 'symbol', 'a', 'switch'];

  if (groupLike.includes(node.name)) {
    for (const child of node.children ?? []) {
      results.push(...flattenSvgTree(child, combined, defs));
    }
    return results;
  }

  const leafTags = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image'];
  if (leafTags.includes(node.name)) {
    results.push({
      id: node.attributes?.id ?? '',
      name: node.attributes?.id ?? node.name,
      tagName: node.name,
      attrs: node.attributes ?? {},
      matrix: combined,
    });
  }

  return results;
}
