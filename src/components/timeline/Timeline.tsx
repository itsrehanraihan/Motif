import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { usePlayback } from '../../hooks/usePlayback';
import { useKeyframes } from '../../hooks/useKeyframes';
import { MoveKeyframeCommand } from '../../core/commands';
import type { Layer, LayerProperties } from '../../types';

const TRACK_H = 28;
const PROP_H = 22;
const RULER_H = 24;
const LABEL_W = 168;

const PROP_LABELS: Partial<Record<keyof LayerProperties, string>> = {
  transform: 'Transform',
  opacity: 'Opacity',
  fill: 'Fill',
  strokeColor: 'Stroke Color',
  strokeWidth: 'Stroke Width',
  trimStart: 'Trim Start',
  trimEnd: 'Trim End',
};

// ── Ruler ────────────────────────────────────────────────────────────────────

interface RulerProps {
  totalFrames: number;
  fps: number;
  frameZoom: number;
  scrollLeft: number;
  width: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
}

function Ruler({ totalFrames, fps, frameZoom, scrollLeft, width, currentFrame, onSeek }: RulerProps) {
  const seeking = useRef(false);

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(x / frameZoom)));
      onSeek(frame);
    },
    [scrollLeft, frameZoom, totalFrames, onSeek],
  );

  const ticks: React.ReactNode[] = [];
  const majorStep = fps;
  const minorStep = frameZoom >= 8 ? 1 : frameZoom >= 4 ? 5 : fps;

  for (let f = 0; f <= totalFrames; f += minorStep) {
    const x = f * frameZoom - scrollLeft;
    if (x < -20 || x > width + 20) continue;
    const isMajor = f % majorStep === 0;
    ticks.push(
      <React.Fragment key={f}>
        <line x1={x} y1={isMajor ? 6 : 14} x2={x} y2={RULER_H} stroke={isMajor ? '#52525b' : '#3f3f46'} strokeWidth={1} />
        {isMajor && (
          <text x={x + 2} y={11} fill="#52525b" fontSize={9} fontFamily="monospace">
            {`${Math.floor(f / fps)}s`}
          </text>
        )}
      </React.Fragment>,
    );
  }

  const phX = currentFrame * frameZoom - scrollLeft;

  return (
    <svg
      width={width}
      height={RULER_H}
      style={{ background: '#18181b', display: 'block', cursor: 'col-resize', userSelect: 'none' }}
      onPointerDown={(e) => { seeking.current = true; e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e); }}
      onPointerMove={(e) => { if (seeking.current) handlePointer(e); }}
      onPointerUp={() => { seeking.current = false; }}
    >
      {ticks}
      <polygon points={`${phX - 5},0 ${phX + 5},0 ${phX},${RULER_H - 2}`} fill="#6366f1" />
      <line x1={phX} y1={0} x2={phX} y2={RULER_H} stroke="#6366f1" strokeWidth={1.5} />
    </svg>
  );
}

// ── Keyframe diamond ─────────────────────────────────────────────────────────

interface DiamondProps {
  frame: number;
  frameZoom: number;
  scrollLeft: number;
  color: string;
  trackH: number;
  onMove: (toFrame: number) => void;
}

function Diamond({ frame, frameZoom, scrollLeft, color, trackH, onMove }: DiamondProps) {
  const startFrame = useRef(frame);
  const startX = useRef(0);
  const S = 5;
  const cx = frame * frameZoom - scrollLeft;
  const cy = trackH / 2;

  const bind = useGesture({
    onDragStart: ({ event }) => {
      startX.current = (event as PointerEvent).clientX;
      startFrame.current = frame;
      event.stopPropagation();
    },
    onDragEnd: ({ movement: [mx] }) => {
      const delta = Math.round(mx / frameZoom);
      onMove(Math.max(0, startFrame.current + delta));
    },
  });

  return (
    <g {...bind()} style={{ cursor: 'ew-resize' }}>
      <rect
        x={cx - S}
        y={cy - S}
        width={S * 2}
        height={S * 2}
        transform={`rotate(45, ${cx}, ${cy})`}
        fill={color}
        stroke="white"
        strokeWidth={1}
        opacity={0.9}
      />
    </g>
  );
}

// ── Property track ───────────────────────────────────────────────────────────

interface PropTrackProps {
  layer: Layer;
  propKey: keyof LayerProperties;
  frameZoom: number;
  scrollLeft: number;
  totalPx: number;
  currentFrame: number;
  onMove: (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => void;
}

function PropTrack({ layer, propKey, frameZoom, scrollLeft, totalPx, currentFrame, onMove }: PropTrackProps) {
  const prop = layer.properties[propKey];
  const phX = currentFrame * frameZoom - scrollLeft;

  return (
    <div className="flex" style={{ height: PROP_H }}>
      <div className="flex items-center px-2 text-[10px] text-zinc-700 flex-shrink-0 border-r border-zinc-800" style={{ width: LABEL_W, paddingLeft: 28 }}>
        {PROP_LABELS[propKey] ?? propKey}
      </div>
      <div className="relative flex-1 border-b border-zinc-800/60" style={{ height: PROP_H }}>
        <svg width={totalPx} height={PROP_H} style={{ overflow: 'visible', display: 'block' }}>
          <line x1={phX} y1={0} x2={phX} y2={PROP_H} stroke="#6366f1" strokeWidth={1} opacity={0.4} />
          {prop.keyframes.map((kf) => (
            <Diamond
              key={kf.frame}
              frame={kf.frame}
              frameZoom={frameZoom}
              scrollLeft={scrollLeft}
              color={layer.color}
              trackH={PROP_H}
              onMove={(to) => onMove(layer.id, propKey, kf.frame, to)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Layer track row ──────────────────────────────────────────────────────────

interface LayerTrackProps {
  layer: Layer;
  frameZoom: number;
  scrollLeft: number;
  totalPx: number;
  trackW: number;
  currentFrame: number;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onMove: (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => void;
  onAddKeyframe: (layerId: string, propKey: keyof LayerProperties) => void;
}

function LayerTrack({
  layer, frameZoom, scrollLeft, totalPx, trackW, currentFrame,
  expanded, selected, onToggleExpand, onSelect, onMove, onAddKeyframe,
}: LayerTrackProps) {
  const phX = currentFrame * frameZoom - scrollLeft;

  const allKeyframeFrames = new Set<number>();
  for (const p of Object.values(layer.properties)) {
    for (const kf of p.keyframes) {
      if (p.keyframes.length > 1) allKeyframeFrames.add(kf.frame);
    }
  }

  const expandedProps = (Object.keys(PROP_LABELS) as (keyof LayerProperties)[]).filter(
    (k) => layer.properties[k].keyframes.length > 1,
  );

  return (
    <div className={selected ? 'bg-accent/5' : ''}>
      {/* Layer row */}
      <div className="flex border-b border-zinc-800/60" style={{ height: TRACK_H }}>
        {/* Label */}
        <div
          className="flex items-center gap-1.5 px-2 flex-shrink-0 border-r border-border cursor-pointer select-none"
          style={{ width: LABEL_W, height: TRACK_H }}
          onClick={onSelect}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="text-zinc-700 hover:text-zinc-400 w-3 text-center text-[10px] flex-shrink-0"
          >
            {expandedProps.length > 0 ? (expanded ? '▾' : '▸') : '·'}
          </button>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: layer.color }} />
          <span className="text-xs text-zinc-400 truncate flex-1">{layer.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onAddKeyframe(layer.id, 'transform'); }}
            className="text-zinc-700 hover:text-accent text-[10px] ml-auto flex-shrink-0"
            title="Add keyframe at playhead (K)"
          >◆</button>
        </div>

        {/* Track */}
        <div className="relative flex-1 overflow-hidden" style={{ height: TRACK_H }}>
          <svg width={totalPx} height={TRACK_H} style={{ overflow: 'visible', display: 'block' }}>
            {/* In/out bar */}
            <rect
              x={Math.max(0, layer.inPoint * frameZoom - scrollLeft)}
              y={6}
              width={Math.max(0, (layer.outPoint - layer.inPoint) * frameZoom)}
              height={TRACK_H - 12}
              fill={layer.color}
              opacity={0.12}
              rx={2}
            />
            {/* Playhead */}
            <line x1={phX} y1={0} x2={phX} y2={TRACK_H} stroke="#6366f1" strokeWidth={1} opacity={0.6} />
            {/* Summary diamonds */}
            {[...allKeyframeFrames].map((f) => {
              const cx = f * frameZoom - scrollLeft;
              return (
                <rect
                  key={f}
                  x={cx - 4}
                  y={TRACK_H / 2 - 4}
                  width={8}
                  height={8}
                  transform={`rotate(45, ${cx}, ${TRACK_H / 2})`}
                  fill={layer.color}
                  opacity={0.7}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Property rows */}
      {expanded && expandedProps.map((pk) => (
        <PropTrack
          key={pk}
          layer={layer}
          propKey={pk}
          frameZoom={frameZoom}
          scrollLeft={scrollLeft}
          totalPx={totalPx}
          currentFrame={currentFrame}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export function Timeline() {
  const { project, setProject } = useProjectStore();
  const {
    currentFrame, isPlaying,
    timelineZoom, setTimelineZoom,
    selectedLayerIds, toggleSelectLayer,
    expandedTimelineLayers, toggleExpandedTimelineLayer,
    timelineHeight, setTimelineHeight,
  } = useUIStore();
  const { execute } = useHistoryStore();
  const { togglePlayback, seek } = usePlayback();
  const { addKeyframe } = useKeyframes();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [trackW, setTrackW] = useState(800);

  const frameZoom = timelineZoom * 4;
  const totalPx = Math.max(project.totalFrames * frameZoom, trackW);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setTrackW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleMove = useCallback(
    (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => {
      if (from === to) return;
      execute(new MoveKeyframeCommand(layerId, propKey, from, to, setProject));
    },
    [execute, setProject],
  );

  // Resize handle
  const resizeBind = useGesture({
    onDrag: ({ delta: [, dy] }) => setTimelineHeight(timelineHeight - dy),
  });

  return (
    <div
      className="flex flex-col bg-surface-1 border-t border-border flex-shrink-0"
      style={{ height: timelineHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-ns-resize bg-border hover:bg-accent transition-colors flex-shrink-0"
        {...resizeBind()}
      />

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border flex-shrink-0 flex-wrap">
        <button onClick={() => seek(0)} className="text-zinc-500 hover:text-white text-xs" title="Go to start">⏮</button>
        <button
          onClick={togglePlayback}
          className="w-6 h-6 flex items-center justify-center rounded bg-accent hover:bg-accent-hover text-white text-xs flex-shrink-0"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => seek(project.totalFrames - 1)} className="text-zinc-500 hover:text-white text-xs" title="Go to end">⏭</button>

        <span className="text-xs text-zinc-500 font-mono w-20 flex-shrink-0">
          {String(Math.floor(currentFrame)).padStart(4, '0')} / {project.totalFrames}
        </span>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1">
          <button onClick={() => setTimelineZoom(timelineZoom / 1.5)} className="text-zinc-500 hover:text-white w-4 text-center text-sm">−</button>
          <span className="text-[10px] text-zinc-600 w-8 text-center">{timelineZoom.toFixed(1)}×</span>
          <button onClick={() => setTimelineZoom(timelineZoom * 1.5)} className="text-zinc-500 hover:text-white w-4 text-center text-sm">+</button>
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1 text-xs text-zinc-600">
          <span>Dur:</span>
          <input
            type="number" min={1} max={3600}
            value={project.totalFrames}
            onChange={(e) => setProject((d) => { d.totalFrames = Math.max(1, +e.target.value); })}
            className="w-14 bg-surface-3 text-zinc-300 px-1 py-0.5 rounded border border-border outline-none text-xs"
          />
          <span className="text-zinc-700">fr</span>
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Labels column header (spacer) */}
        <div className="flex-shrink-0 border-r border-border" style={{ width: LABEL_W }}>
          <div style={{ height: RULER_H }} className="border-b border-border" />
        </div>

        {/* Scrollable track content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          onScroll={(e) => setScrollLeft((e.target as HTMLDivElement).scrollLeft)}
        >
          {/* Sticky ruler */}
          <div className="sticky top-0 z-10">
            <Ruler
              totalFrames={project.totalFrames}
              fps={project.fps}
              frameZoom={frameZoom}
              scrollLeft={scrollLeft}
              width={trackW}
              currentFrame={currentFrame}
              onSeek={seek}
            />
          </div>

          {/* Layer tracks */}
          <div style={{ width: totalPx, minHeight: '100%' }}>
            {project.layers.length === 0 && (
              <div className="text-xs text-zinc-700 text-center py-6">No layers</div>
            )}
            {project.layers.map((layer) => (
              <LayerTrack
                key={layer.id}
                layer={layer}
                frameZoom={frameZoom}
                scrollLeft={scrollLeft}
                totalPx={totalPx}
                trackW={trackW}
                currentFrame={currentFrame}
                expanded={expandedTimelineLayers.has(layer.id)}
                selected={selectedLayerIds.includes(layer.id)}
                onToggleExpand={() => toggleExpandedTimelineLayer(layer.id)}
                onSelect={() => toggleSelectLayer(layer.id, false)}
                onMove={handleMove}
                onAddKeyframe={addKeyframe}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
