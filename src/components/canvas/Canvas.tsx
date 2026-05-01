import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { useUIStore } from '../../store/ui';
import { useProjectStore } from '../../store/project';
import { useHistoryStore } from '../../store/history';
import { SetPropertyValueCommand } from '../../core/commands';
import { interpolateTransform } from '../../core/interpolator';
import type { Layer } from '../../types';

// ── Layer SVG element ────────────────────────────────────────────────────────

interface LayerElementProps {
  layer: Layer;
  frame: number;
  selected: boolean;
}

function LayerElement({ layer, frame, selected }: LayerElementProps) {
  const t = interpolateTransform(layer.properties.transform, frame);
  const transform = `translate(${t.x + t.anchorX}, ${t.y + t.anchorY}) rotate(${t.rotation}) scale(${t.scaleX}, ${t.scaleY}) translate(${-t.anchorX}, ${-t.anchorY})`;

  const fill = layer.properties.fill.keyframes[0]?.value;
  const fillAttr =
    fill?.type === 'solid'
      ? `rgba(${fill.color.r},${fill.color.g},${fill.color.b},${fill.color.a})`
      : 'none';

  const sc = layer.properties.strokeColor.keyframes[0]?.value;
  const strokeAttr = sc ? `rgba(${sc.r},${sc.g},${sc.b},${sc.a})` : 'none';
  const sw = layer.properties.strokeWidth.keyframes[0]?.value ?? 1;

  return (
    <g
      id={`layer-${layer.id}`}
      transform={transform}
      opacity={(layer.properties.opacity.keyframes[0]?.value ?? 100) / 100}
    >
      {selected && (
        <path
          d={layer.pathData}
          fill="none"
          stroke={layer.color}
          strokeWidth={2}
          strokeOpacity={0.5}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <path
        d={layer.pathData}
        fill={fillAttr}
        stroke={strokeAttr}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

// ── Selection handles overlay ────────────────────────────────────────────────

interface BBox {
  x: number; y: number; w: number; h: number;
}

function getLayerBBox(layer: Layer, svgEl: SVGSVGElement): BBox | null {
  const el = svgEl.querySelector(`#layer-${layer.id} path:last-child`) as SVGPathElement | null;
  if (!el) return null;
  try {
    const bbox = el.getBBox();
    return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
  } catch {
    return null;
  }
}

interface TransformHandlesProps {
  layers: Layer[];
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoom: number;
  panX: number;
  panY: number;
}

function TransformHandles({ layers, svgRef, zoom, panX, panY }: TransformHandlesProps) {
  const [bboxes, setBboxes] = useState<Record<string, BBox>>({});

  useEffect(() => {
    if (!svgRef.current) return;
    const timer = setTimeout(() => {
      if (!svgRef.current) return;
      const map: Record<string, BBox> = {};
      for (const l of layers) {
        const b = getLayerBBox(l, svgRef.current);
        if (b) map[l.id] = b;
      }
      setBboxes(map);
    }, 16);
    return () => clearTimeout(timer);
  }, [layers, svgRef]);

  return (
    <>
      {layers.map((l) => {
        const b = bboxes[l.id];
        if (!b || b.w === 0 || b.h === 0) return null;
        const sx = b.x * zoom + panX;
        const sy = b.y * zoom + panY;
        const sw = b.w * zoom;
        const sh = b.h * zoom;
        return (
          <div
            key={l.id}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: sw,
              height: sh,
              border: `1.5px solid ${l.color}`,
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          >
            {[
              { cursor: 'nwse-resize', top: -4, left: -4 },
              { cursor: 'ns-resize', top: -4, left: sw / 2 - 4 },
              { cursor: 'nesw-resize', top: -4, left: sw - 4 },
              { cursor: 'ew-resize', top: sh / 2 - 4, left: sw - 4 },
              { cursor: 'nwse-resize', top: sh - 4, left: sw - 4 },
              { cursor: 'ns-resize', top: sh - 4, left: sw / 2 - 4 },
              { cursor: 'nesw-resize', top: sh - 4, left: -4 },
              { cursor: 'ew-resize', top: sh / 2 - 4, left: -4 },
            ].map((h, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: h.top,
                  left: h.left,
                  width: 8,
                  height: 8,
                  background: 'white',
                  border: `1.5px solid ${l.color}`,
                  borderRadius: 2,
                  cursor: h.cursor,
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Marquee ──────────────────────────────────────────────────────────────────

interface Marquee {
  x: number; y: number; w: number; h: number;
}

// ── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas() {
  const { project, setProject } = useProjectStore();
  const { execute } = useHistoryStore();
  const {
    zoom, setZoom,
    currentFrame,
    selectedLayerIds, setSelectedLayerIds, toggleSelectLayer,
    activeTool,
  } = useUIStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panX, setPanX] = useState(60);
  const [panY, setPanY] = useState(60);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  // Center canvas on mount or project resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanX((rect.width - project.width * zoom) / 2);
    setPanY(Math.max(40, (rect.height - project.height * zoom) / 2));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.width, project.height]);

  const handleLayerDrag = useCallback(
    (layerId: string, dx: number, dy: number) => {
      const layer = project.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const t = layer.properties.transform.keyframes[0]?.value;
      if (!t) return;
      const newVal = { ...t, x: t.x + dx / zoom, y: t.y + dy / zoom };
      execute(new SetPropertyValueCommand(layerId, 'transform', newVal, t, setProject));
    },
    [project.layers, zoom, setProject, execute],
  );

  const bind = useGesture(
    {
      onDrag: ({ delta: [dx, dy], event, first }) => {
        const me = event as MouseEvent;
        if (activeTool === 'hand' || me.button === 1) {
          setPanX((p) => p + dx);
          setPanY((p) => p + dy);
          return;
        }
        if (activeTool === 'select') {
          if (selectedLayerIds.length > 0) {
            for (const id of selectedLayerIds) handleLayerDrag(id, dx, dy);
          } else {
            // Marquee drag
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const mx = me.clientX - rect.left;
            const my = me.clientY - rect.top;
            if (first) {
              marqueeStart.current = { x: mx, y: my };
            }
            const start = marqueeStart.current;
            if (start) {
              setMarquee({
                x: Math.min(mx, start.x),
                y: Math.min(my, start.y),
                w: Math.abs(mx - start.x),
                h: Math.abs(my - start.y),
              });
            }
          }
        }
      },
      onDragEnd: () => {
        marqueeStart.current = null;
        setMarquee(null);
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        const factor = dy > 0 ? 0.9 : 1.1;
        setZoom(zoom * factor);
      },
    },
    { drag: { filterTaps: true }, wheel: { eventOptions: { passive: false } } },
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (activeTool !== 'select') return;
      const target = e.target as Element;
      const layerEl = target.closest('[id^="layer-"]');
      if (layerEl) {
        const id = layerEl.id.replace('layer-', '');
        toggleSelectLayer(id, e.shiftKey || e.metaKey);
      } else {
        setSelectedLayerIds([]);
      }
    },
    [activeTool, toggleSelectLayer, setSelectedLayerIds],
  );

  const selectedLayers = project.layers.filter((l) => selectedLayerIds.includes(l.id));
  const bgColor = project.background ?? 'transparent';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-surface-0 select-none"
      style={{
        cursor:
          activeTool === 'hand' ? 'grab' :
          activeTool === 'select' ? 'default' : 'crosshair',
      }}
      {...bind()}
    >
      {/* Artboard */}
      <div
        style={{
          position: 'absolute',
          left: panX,
          top: panY,
          width: project.width * zoom,
          height: project.height * zoom,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          background: bgColor === 'transparent'
            ? 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 16px 16px'
            : bgColor,
        }}
      >
        <svg
          ref={svgRef}
          width={project.width * zoom}
          height={project.height * zoom}
          viewBox={`0 0 ${project.width} ${project.height}`}
          onClick={handleSvgClick}
          style={{ display: 'block' }}
        >
          {[...project.layers].reverse().map((layer) =>
            layer.visible ? (
              <LayerElement
                key={layer.id}
                layer={layer}
                frame={currentFrame}
                selected={selectedLayerIds.includes(layer.id)}
              />
            ) : null,
          )}
        </svg>
      </div>

      {/* Selection handles */}
      {selectedLayers.length > 0 && (
        <TransformHandles
          layers={selectedLayers}
          svgRef={svgRef}
          zoom={zoom}
          panX={panX}
          panY={panY}
        />
      )}

      {/* Marquee */}
      {marquee && marquee.w > 4 && (
        <div
          style={{
            position: 'absolute',
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            border: '1px solid #6366f1',
            background: 'rgba(99,102,241,0.08)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Zoom badge */}
      <div className="absolute bottom-3 right-3 text-xs text-zinc-500 font-mono bg-surface-1 px-2 py-1 rounded border border-border">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
