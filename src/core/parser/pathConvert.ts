// Arc to cubic bezier approximation (k ≈ 0.5522847498)
const K = 0.5522847498;

interface Point {
  x: number;
  y: number;
}

interface CubicBezier {
  cp1: Point;
  cp2: Point;
  end: Point;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Convert a single arc segment to cubic bezier curves
// Based on SVG spec conversion algorithm
export function arcToBeziers(
  x1: number, y1: number,
  rx: number, ry: number,
  xAxisRotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number, y2: number,
): CubicBezier[] {
  if (x1 === x2 && y1 === y2) return [];
  if (rx === 0 || ry === 0) {
    return [{ cp1: { x: x1, y: y1 }, cp2: { x: x2, y: y2 }, end: { x: x2, y: y2 } }];
  }

  const phi = toRad(xAxisRotation);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;

  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  // Ensure radii are large enough
  const lambda = Math.sqrt(x1pSq / rxSq + y1pSq / rySq);
  if (lambda > 1) {
    rx = lambda * Math.abs(rx);
    ry = lambda * Math.abs(ry);
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const sq = Math.max(0, (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq));
  const coef = sign * Math.sqrt(sq);

  const cxp = coef * (rx * y1p / ry);
  const cyp = coef * -(ry * x1p / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  function angle(u: Point, v: Point): number {
    const dot = u.x * v.x + u.y * v.y;
    const len = Math.sqrt((u.x * u.x + u.y * u.y) * (v.x * v.x + v.y * v.y));
    const a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    return (u.x * v.y - u.y * v.x < 0 ? -1 : 1) * a;
  }

  let theta1 = angle({ x: 1, y: 0 }, { x: ux, y: uy });
  let dtheta = angle({ x: ux, y: uy }, { x: vx, y: vy });

  if (!sweepFlag && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweepFlag && dtheta < 0) dtheta += 2 * Math.PI;

  // Split into segments of at most 90 degrees
  const n = Math.ceil(Math.abs(dtheta) / (Math.PI / 2));
  const da = dtheta / n;
  const alpha = (4 / 3) * Math.tan(da / 4);

  const beziers: CubicBezier[] = [];

  for (let i = 0; i < n; i++) {
    const t1 = theta1 + i * da;
    const t2 = theta1 + (i + 1) * da;

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    const p1x = cx + cosPhi * rx * cos1 - sinPhi * ry * sin1;
    const p1y = cy + sinPhi * rx * cos1 + cosPhi * ry * sin1;
    const p2x = cx + cosPhi * rx * cos2 - sinPhi * ry * sin2;
    const p2y = cy + sinPhi * rx * cos2 + cosPhi * ry * sin2;

    const dx1 = -cosPhi * rx * sin1 - sinPhi * ry * cos1;
    const dy1 = -sinPhi * rx * sin1 + cosPhi * ry * cos1;
    const dx2 = -cosPhi * rx * sin2 - sinPhi * ry * cos2;
    const dy2 = -sinPhi * rx * sin2 + cosPhi * ry * cos2;

    beziers.push({
      cp1: { x: p1x + alpha * dx1, y: p1y + alpha * dy1 },
      cp2: { x: p2x - alpha * dx2, y: p2y - alpha * dy2 },
      end: { x: p2x, y: p2y },
    });
  }

  return beziers;
}

export function convertArcsToBeziersInPath(d: string): string {
  // Simple tokenizer for SVG path data
  const parts = d.match(/[MmZzLlHhVvCcSsQqTtAa][^MmZzLlHhVvCcSsQqTtAa]*/g) ?? [];
  const result: string[] = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;

  for (const part of parts) {
    const cmd = part[0];
    const nums = part.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);

    if (cmd === 'A' || cmd === 'a') {
      let i = 0;
      while (i + 6 < nums.length) {
        const rx = Math.abs(nums[i]);
        const ry = Math.abs(nums[i + 1]);
        const xRot = nums[i + 2];
        const large = nums[i + 3];
        const sweep = nums[i + 4];
        let ex = nums[i + 5];
        let ey = nums[i + 6];
        if (cmd === 'a') { ex += cx; ey += cy; }
        const beziers = arcToBeziers(cx, cy, rx, ry, xRot, large, sweep, ex, ey);
        for (const b of beziers) {
          result.push(`C ${b.cp1.x} ${b.cp1.y} ${b.cp2.x} ${b.cp2.y} ${b.end.x} ${b.end.y}`);
        }
        cx = ex; cy = ey;
        i += 7;
      }
    } else {
      result.push(part);
      // Track current position for relative arc handling
      if (cmd === 'M' || cmd === 'L') {
        cx = nums[nums.length - 2]; cy = nums[nums.length - 1];
        if (cmd === 'M') { sx = cx; sy = cy; }
      } else if (cmd === 'm' || cmd === 'l') {
        cx += nums[nums.length - 2]; cy += nums[nums.length - 1];
        if (cmd === 'm') { sx = cx; sy = cy; }
      } else if (cmd === 'Z' || cmd === 'z') {
        cx = sx; cy = sy;
      } else if (cmd === 'C') {
        cx = nums[nums.length - 2]; cy = nums[nums.length - 1];
      } else if (cmd === 'H') {
        cx = nums[nums.length - 1];
      } else if (cmd === 'h') {
        cx += nums[nums.length - 1];
      } else if (cmd === 'V') {
        cy = nums[nums.length - 1];
      } else if (cmd === 'v') {
        cy += nums[nums.length - 1];
      }
    }
  }
  return result.join(' ');
}
