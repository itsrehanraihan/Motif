import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { usePlayback } from '../../hooks/usePlayback';
import { useKeyframes } from '../../hooks/useKeyframes';
import { MoveKeyframeCommand, SetLayerRangeCommand } from '../../core/commands';
import type { Layer, LayerProperties } from '../../types';

const TRACK_H = 36;
const PROP_H = 22;
const RULER_H = 26;
const LABEL_W = 200;
const TRIM_W = 6; // trim handle width
const KF_SIZE = 11; // keyframe diamond half-size

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
      const frame = Math.max(0, Math.min(totalFrames, x / frameZoom));
      onSeek(Math.round(frame));
    },
    [scrollLeft, frameZoom, totalFrames, onSeek],
  );

  const ticks: React.ReactNode[] = [];
  const majorStep = fps;
  const minorStep = frameZoom >= 12 ? 1 : frameZoom >= 6 ? 5 : fps;

  for (let f = 0; f <= totalFrames; f += minorStep) {
    const x = f * frameZoom - scrollLeft;
    if (x < -30 || x > width + 30) continue;
    const isMajor = f % majorStep === 0;
    ticks.push(
      <React.Fragment key={f}>
        <line x1={x} y1={isMajor ? 6 : 16} x2={x} y2={RULER_H} stroke={isMajor ? '#52525b' : '#3f3f46'} strokeWidth={1} />
        {isMajor && (
          <text x={x + 3} y={12} fill="#71717a" fontSize={10} fontFamily="ui-monospace, monospace" fontWeight={500}>
            {`${Math.round(f / fps)}s`}
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
      style={{ background: '#0f0f12', display: 'block', cursor: 'ew-resize', userSelect: 'none' }}
      onPointerDown={(e) => { seeking.current = true; e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e); }}
      onPointerMove={(e) => { if (seeking.current) handlePointer(e); }}
      onPointerUp={(e) => { seeking.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
    >
      {ticks}
      <polygon points={`${phX - 6},0 ${phX + 6},0 ${phX},${RULER_H}`} fill="#6366f1" />
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
  filled?: boolean;
}

function Diamond({ frame, frameZoom, scrollLeft, color, trackH, onMove, filled = true }: DiamondProps) {
  const startFrame = useRef(frame);

  const bind = useGesture({
    onDragStart: ({ event }) => {
      startFrame.current = frame;
      event.stopPropagation();
    },
    onDrag: ({ event }) => {
      event.stopPropagation();
    },
    onDragEnd: ({ movement: [mx], event }) => {
      event.stopPropagation();
      const delta = Math.round(mx / frameZoom);
      const target = Math.max(0, startFrame.current + delta);
      if (target !== startFrame.current) onMove(target);
    },
  });

  const cx = frame * frameZoom - scrollLeft;
  const cy = trackH / 2;

  return (
    <g {...bind()} style={{ cursor: 'ew-resize' }}>
      {/* Larger hit target */}
      <rect
        x={cx - KF_SIZE - 2}
        y={cy - KF_SIZE - 2}
        width={(KF_SIZE + 2) * 2}
        height={(KF_SIZE + 2) * 2}
        fill="transparent"
      />
      <rect
        x={cx - KF_SIZE / 2}
        y={cy - KF_SIZE / 2}
        width={KF_SIZE}
        height={KF_SIZE}
        transform={`rotate(45, ${cx}, ${cy})`}
        fill={filled ? color : '#0f0f12'}
        stroke="white"
        strokeWidth={1.5}
      />
    </g>
  );
}

// ── Property sub-track ───────────────────────────────────────────────────────

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
      <div
        className="flex items-center px-2 text-[10px] text-zinc-500 flex-shrink-0 border-r border-border bg-surface-2"
        style={{ width: LABEL_W, paddingLeft: 32 }}
      >
        {PROP_LABELS[propKey] ?? propKey}
      </div>
      <div className="relative flex-1 border-b border-border/40" style={{ height: PROP_H, background: '#141417' }}>
        <svg width={totalPx} height={PROP_H} style={{ overflow: 'visible', display: 'block' }}>
          <line x1={phX} y1={0} x2={phX} y2={PROP_H} stroke="#6366f1" strokeWidth={1} opacity={0.5} />
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

// ── Layer clip bar ───────────────────────────────────────────────────────────

interface ClipBarProps {
  layer: Layer;
  frameZoom: number;
  scrollLeft: number;
  totalPx: number;
  totalFrames: number;
  currentFrame: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => void;
  onSetRange: (layerId: string, inPoint: number, outPoint: number) => void;
}

function ClipBar({
  layer, frameZoom, scrollLeft, totalPx, totalFrames, currentFrame,
  selected, onSelect, onMove, onSetRange,
}: ClipBarProps) {
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'trim-l' | 'trim-r'>('none');
  const dragStart = useRef({ inPoint: 0, outPoint: 0 });

  const phX = currentFrame * frameZoom - scrollLeft;

  // Aggregate keyframes across all animated properties
  const allKfs: { frame: number; propKey: keyof LayerProperties }[] = [];
  for (const k of Object.keys(layer.properties) as (keyof LayerProperties)[]) {
    const kfs = layer.properties[k].keyframes;
    if (kfs.length > 1) {
      for (const kf of kfs) allKfs.push({ frame: kf.frame, propKey: k });
    }
  }

  const startDrag = (mode: 'move' | 'trim-l' | 'trim-r') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);
    dragStart.current = { inPoint: layer.inPoint, outPoint: layer.outPoint };
    onSelect();

    const startX = e.clientX;
    const onMoveEvt = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / frameZoom);
      let { inPoint, outPoint } = dragStart.current;
      if (mode === 'move') {
        inPoint = Math.max(0, dragStart.current.inPoint + delta);
        outPoint = Math.min(totalFrames, dragStart.current.outPoint + delta);
        // preserve length if hitting bound
        if (inPoint === 0) outPoint = dragStart.current.outPoint - dragStart.current.inPoint;
        if (outPoint === totalFrames) inPoint = totalFrames - (dragStart.current.outPoint - dragStart.current.inPoint);
      } else if (mode === 'trim-l') {
        inPoint = Math.max(0, Math.min(dragStart.current.outPoint - 1, dragStart.current.inPoint + delta));
      } else {
        outPoint = Math.min(totalFrames, Math.max(dragStart.current.inPoint + 1, dragStart.current.outPoint + delta));
      }
      onSetRange(layer.id, inPoint, outPoint);
    };
    const onUp = () => {
      setDragMode('none');
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMoveEvt);
    window.addEventListener('pointerup', onUp);
  };

  const barX = layer.inPoint * frameZoom - scrollLeft;
  const barW = Math.max(0, (layer.outPoint - layer.inPoint) * frameZoom);
  const barY = 4;
  const barH = TRACK_H - 8;

  return (
    <div
      className="relative flex-1 select-none"
      style={{ height: TRACK_H, background: selected ? 'rgba(99,102,241,0.05)' : '#141417' }}
    >
      <svg width={totalPx} height={TRACK_H} style={{ overflow: 'visible', display: 'block' }}>
        {/* Playhead line */}
        <line x1={phX} y1={0} x2={phX} y2={TRACK_H} stroke="#6366f1" strokeWidth={1} opacity={0.5} />
      </svg>

      {/* Clip bar (positioned div for crisp interaction) */}
      <div
        style={{
          position: 'absolute',
          left: barX,
          top: barY,
          width: barW,
          height: barH,
          background: `linear-gradient(180deg, ${layer.color}40, ${layer.color}20)`,
          border: `1px solid ${selected ? layer.color : layer.color + '80'}`,
          borderRadius: 4,
          cursor: dragMode === 'move' ? 'grabbing' : 'grab',
          overflow: 'hidden',
        }}
        onPointerDown={startDrag('move')}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {/* Clip body label */}
        <div
          className="flex items-center h-full px-2 text-xs font-medium pointer-events-none"
          style={{ color: layer.color }}
        >
          <span className="truncate" style={{ filter: 'brightness(1.5)' }}>{layer.name}</span>
        </div>

        {/* Left trim handle */}
        <div
          onPointerDown={startDrag('trim-l')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: TRIM_W,
            height: '100%',
            cursor: 'ew-resize',
            background: dragMode === 'trim-l' ? layer.color : 'transparent',
            borderRight: `2px solid ${layer.color}`,
          }}
        />

        {/* Right trim handle */}
        <div
          onPointerDown={startDrag('trim-r')}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: TRIM_W,
            height: '100%',
            cursor: 'ew-resize',
            background: dragMode === 'trim-r' ? layer.color : 'transparent',
            borderLeft: `2px solid ${layer.color}`,
          }}
        />
      </div>

      {/* Keyframe diamonds layered on top */}
      <svg
        width={totalPx}
        height={TRACK_H}
        style={{ overflow: 'visible', display: 'block', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      >
        <g style={{ pointerEvents: 'auto' }}>
          {allKfs.map((kf, i) => (
            <Diamond
              key={`${kf.propKey}-${kf.frame}-${i}`}
              frame={kf.frame}
              frameZoom={frameZoom}
              scrollLeft={scrollLeft}
              color={layer.color}
              trackH={TRACK_H}
              onMove={(to) => onMove(layer.id, kf.propKey, kf.frame, to)}
              filled
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── Layer track row (label + bar) ────────────────────────────────────────────

interface LayerTrackProps {
  layer: Layer;
  frameZoom: number;
  scrollLeft: number;
  totalPx: number;
  totalFrames: number;
  currentFrame: number;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onMove: (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => void;
  onSetRange: (layerId: string, inPoint: number, outPoint: number) => void;
}

function LayerTrack(props: LayerTrackProps) {
  const { layer, expanded, selected, onToggleExpand, onSelect } = props;

  const expandedProps = (Object.keys(PROP_LABELS) as (keyof LayerProperties)[]).filter(
    (k) => layer.properties[k].keyframes.length > 1,
  );

  return (
    <div>
      <div className="flex border-b border-border/60" style={{ height: TRACK_H }}>
        {/* Label */}
        <div
          className={`flex items-center gap-1.5 px-2 flex-shrink-0 border-r border-border cursor-pointer select-none ${selected ? 'bg-accent/10' : 'bg-surface-2 hover:bg-surface-3'}`}
          style={{ width: LABEL_W, height: TRACK_H }}
          onClick={onSelect}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="text-zinc-600 hover:text-zinc-300 w-3 text-center text-[11px] flex-shrink-0"
            disabled={expandedProps.length === 0}
          >
            {expandedProps.length > 0 ? (expanded ? '▾' : '▸') : ''}
          </button>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color }} />
          <span className="text-xs text-zinc-300 truncate flex-1">{layer.name}</span>
          {expandedProps.length > 0 && (
            <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">
              {expandedProps.length}
            </span>
          )}
        </div>

        {/* Clip bar */}
        <ClipBar {...props} />
      </div>

      {/* Property sub-tracks */}
      {expanded && expandedProps.map((pk) => (
        <PropTrack
          key={pk}
          layer={layer}
          propKey={pk}
          frameZoom={props.frameZoom}
          scrollLeft={props.scrollLeft}
          totalPx={props.totalPx}
          currentFrame={props.currentFrame}
          onMove={props.onMove}
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [trackW, setTrackW] = useState(800);

  // Pixels per frame
  const frameZoom = Math.max(2, timelineZoom * 6);
  const totalPx = Math.max(project.totalFrames * frameZoom, trackW);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setTrackW(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Wheel zoom on timeline (ctrl/cmd+wheel = zoom, regular wheel = pan)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setTimelineZoom(timelineZoom * factor);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [timelineZoom, setTimelineZoom]);

  const handleMove = useCallback(
    (layerId: string, propKey: keyof LayerProperties, from: number, to: number) => {
      if (from === to) return;
      execute(new MoveKeyframeCommand(layerId, propKey, from, to, setProject));
    },
    [execute, setProject],
  );

  const handleSetRange = useCallback(
    (layerId: string, inPoint: number, outPoint: number) => {
      execute(new SetLayerRangeCommand(layerId, inPoint, outPoint, setProject));
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
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border flex-shrink-0">
        <button onClick={() => seek(0)} className="text-zinc-400 hover:text-white text-sm" title="Go to start">⏮</button>
        <button
          onClick={togglePlayback}
          className="w-7 h-7 flex items-center justify-center rounded bg-accent hover:bg-accent-hover text-white text-sm flex-shrink-0"
          title="Play / Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={() => seek(project.totalFrames)} className="text-zinc-400 hover:text-white text-sm" title="Go to end">⏭</button>

        <span className="text-xs text-zinc-400 font-mono w-24 flex-shrink-0">
          {String(Math.floor(currentFrame)).padStart(4, '0')} / {project.totalFrames}
        </span>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-1">
          <button onClick={() => setTimelineZoom(timelineZoom / 1.4)} className="text-zinc-400 hover:text-white w-5 text-center">−</button>
          <span className="text-[10px] text-zinc-500 w-9 text-center font-mono">{timelineZoom.toFixed(1)}×</span>
          <button onClick={() => setTimelineZoom(timelineZoom * 1.4)} className="text-zinc-400 hover:text-white w-5 text-center">+</button>
        </div>

        <span className="text-[10px] text-zinc-600 italic">Cmd/Ctrl + Wheel to zoom</span>

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>Duration:</span>
          <input
            type="number" min={1} max={3600}
            value={project.totalFrames}
            onChange={(e) => setProject((d) => { d.totalFrames = Math.max(1, +e.target.value); })}
            className="w-16 bg-surface-3 text-zinc-300 px-1.5 py-0.5 rounded border border-border outline-none text-xs"
          />
          <span className="text-zinc-600">fr</span>
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Labels column header (spacer) */}
        <div className="flex-shrink-0 border-r border-border bg-surface-2" style={{ width: LABEL_W }}>
          <div
            style={{ height: RULER_H }}
            className="flex items-center px-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium border-b border-border"
          >
            Layer
          </div>
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
              <div className="text-xs text-zinc-700 text-center py-12">Import an SVG to see tracks here</div>
            )}
            {project.layers.map((layer) => (
              <LayerTrack
                key={layer.id}
                layer={layer}
                frameZoom={frameZoom}
                scrollLeft={scrollLeft}
                totalPx={totalPx}
                totalFrames={project.totalFrames}
                currentFrame={currentFrame}
                expanded={expandedTimelineLayers.has(layer.id)}
                selected={selectedLayerIds.includes(layer.id)}
                onToggleExpand={() => toggleExpandedTimelineLayer(layer.id)}
                onSelect={() => toggleSelectLayer(layer.id, false)}
                onMove={handleMove}
                onSetRange={handleSetRange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
