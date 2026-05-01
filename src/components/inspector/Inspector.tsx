import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { useKeyframes } from '../../hooks/useKeyframes';
import { SetPropertyValueCommand } from '../../core/commands';
import { interpolateTransform, interpolateNumber, interpolateColor, interpolateFill } from '../../core/interpolator';
import { PresetsPanel } from './PresetsPanel';
import type { Layer, LayerProperties, Transform, Color, FillValue } from '../../types';

// ── Keyframe diamond toggle ──────────────────────────────────────────────────

interface KFDiamondProps {
  layerId: string;
  propKey: keyof LayerProperties;
}

function KFDiamond({ layerId, propKey }: KFDiamondProps) {
  const { hasKeyframeAt, toggleKeyframe } = useKeyframes();
  const { currentFrame } = useUIStore();
  const { project } = useProjectStore();
  const layer = project.layers.find((l) => l.id === layerId);
  const animated = (layer?.properties[propKey].keyframes.length ?? 0) > 1;
  const onCurFrame = hasKeyframeAt(layerId, propKey, currentFrame);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleKeyframe(layerId, propKey); }}
      title={onCurFrame ? 'Remove keyframe at current frame' : 'Add keyframe at current frame'}
      className="flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform hover:scale-125"
    >
      <svg width="9" height="9" viewBox="0 0 9 9">
        <rect
          x="0.5" y="0.5" width="8" height="8"
          transform="rotate(45, 4.5, 4.5)"
          fill={onCurFrame ? '#6366f1' : 'none'}
          stroke={onCurFrame ? '#6366f1' : animated ? '#a78bfa' : '#52525b'}
          strokeWidth="1.5"
        />
      </svg>
    </button>
  );
}

// ── Number input ─────────────────────────────────────────────────────────────

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}

function NumberInput({ label, value, onChange, step = 1, min, max, unit }: NumberInputProps) {
  const [local, setLocal] = useState('');
  const [active, setActive] = useState(false);
  const display = active ? local : String(Math.round(value * 100) / 100);

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-600 w-9 flex-shrink-0 uppercase tracking-wide">{label}</span>
      <div className="flex items-center flex-1 bg-surface-3 rounded border border-border focus-within:border-accent overflow-hidden">
        <input
          type="number"
          value={display}
          step={step}
          min={min}
          max={max}
          className="flex-1 bg-transparent text-xs text-zinc-200 px-1.5 py-0.5 outline-none min-w-0"
          onFocus={() => { setLocal(display); setActive(true); }}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={(e) => {
            setActive(false);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setActive(false);
              const v = parseFloat(local);
              if (!isNaN(v)) onChange(v);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {unit && <span className="text-[10px] text-zinc-600 pr-1.5 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-border mt-1">
      <span>{title}</span>
      {right}
    </div>
  );
}

// ── Color input ──────────────────────────────────────────────────────────────

function colorToHex(c: Color): string {
  return '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function hexToColor(hex: string, a = 1): Color {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b, a };
}

interface ColorInputProps {
  label: string;
  color: Color;
  onChange: (c: Color) => void;
}

function ColorInput({ label, color, onChange }: ColorInputProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-600 w-9 flex-shrink-0 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 bg-surface-3 rounded border border-border px-1.5 py-0.5 focus-within:border-accent">
        <input
          type="color"
          value={colorToHex(color)}
          onChange={(e) => onChange(hexToColor(e.target.value, color.a))}
          className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0 flex-shrink-0"
        />
        <span className="text-xs text-zinc-400 font-mono flex-1">{colorToHex(color).toUpperCase()}</span>
        <input
          type="number"
          min={0} max={100} step={1}
          value={Math.round(color.a * 100)}
          onChange={(e) => onChange({ ...color, a: Math.max(0, Math.min(1, +e.target.value / 100)) })}
          className="w-10 bg-transparent text-xs text-zinc-500 outline-none text-right"
        />
        <span className="text-[10px] text-zinc-600">%</span>
      </div>
    </div>
  );
}

// ── Property row with keyframe diamond ───────────────────────────────────────

interface PropRowProps {
  layerId: string;
  propKey: keyof LayerProperties;
  children: React.ReactNode;
}

function PropRow({ layerId, propKey, children }: PropRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <KFDiamond layerId={layerId} propKey={propKey} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Layer inspector ──────────────────────────────────────────────────────────

interface LayerInspectorProps {
  layer: Layer;
  frame: number;
}

function LayerInspector({ layer, frame }: LayerInspectorProps) {
  const { setProject } = useProjectStore();
  const { execute } = useHistoryStore();
  const { addKeyframe } = useKeyframes();

  // Commit helper: also update the keyframe value at currentFrame if one exists,
  // otherwise update the static (single) keyframe.
  const commitProp = useCallback(
    <T,>(propKey: keyof LayerProperties, val: T) => {
      const prop = layer.properties[propKey];
      const existing = prop.keyframes.find((k) => k.frame === frame);
      if (existing) {
        // Update existing kf value via direct setProject (in-place is fine here; undo via SetProperty would replace static)
        setProject((d) => {
          const l = d.layers.find((x) => x.id === layer.id);
          if (!l) return;
          const p = l.properties[propKey] as unknown as { keyframes: { frame: number; value: T }[] };
          const k = p.keyframes.find((kf) => kf.frame === frame);
          if (k) k.value = val;
        });
      } else if (prop.keyframes.length <= 1) {
        const cur = prop.keyframes[0]?.value as T;
        execute(new SetPropertyValueCommand(layer.id, propKey, val, cur, setProject));
      } else {
        // Animated but no kf at current frame — add one with the new value
        addKeyframe(layer.id, propKey, val);
      }
    },
    [layer, frame, setProject, execute, addKeyframe],
  );

  const t = interpolateTransform(layer.properties.transform, frame);
  const opacity = interpolateNumber(layer.properties.opacity, frame, 100);
  const sw = interpolateNumber(layer.properties.strokeWidth, frame, 1);
  const sc = interpolateColor(layer.properties.strokeColor, frame);
  const fill = interpolateFill(layer.properties.fill, frame);
  const fillColor = fill.type === 'solid' ? fill.color : { r: 180, g: 180, b: 180, a: 1 };
  const trimStart = interpolateNumber(layer.properties.trimStart, frame, 0);
  const trimEnd = interpolateNumber(layer.properties.trimEnd, frame, 100);

  const updateTransformField = (key: keyof Transform, val: number) => {
    commitProp<Transform>('transform', { ...t, [key]: val });
  };

  return (
    <div className="flex flex-col">
      {/* Layer badge */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color }} />
          <span className="text-xs text-zinc-300 truncate font-medium flex-1">{layer.name}</span>
          <span className="text-[10px] text-zinc-600 bg-surface-3 px-1.5 py-0.5 rounded">{layer.type}</span>
        </div>
      </div>

      {/* Transform */}
      <SectionHeader title="Transform" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <PropRow layerId={layer.id} propKey="transform">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput label="X" value={t.x} onChange={(v) => updateTransformField('x', v)} step={0.5} />
            <NumberInput label="Y" value={t.y} onChange={(v) => updateTransformField('y', v)} step={0.5} />
            <NumberInput label="SX" value={t.scaleX * 100} onChange={(v) => updateTransformField('scaleX', v / 100)} step={1} unit="%" />
            <NumberInput label="SY" value={t.scaleY * 100} onChange={(v) => updateTransformField('scaleY', v / 100)} step={1} unit="%" />
          </div>
        </PropRow>
        <PropRow layerId={layer.id} propKey="transform">
          <NumberInput label="Rot" value={t.rotation} onChange={(v) => updateTransformField('rotation', v)} step={1} unit="°" />
        </PropRow>
      </div>

      {/* Opacity */}
      <SectionHeader title="Opacity" />
      <div className="px-3 py-2">
        <PropRow layerId={layer.id} propKey="opacity">
          <NumberInput label="Opac" value={opacity} onChange={(v) => commitProp<number>('opacity', v)} step={1} min={0} max={100} unit="%" />
        </PropRow>
      </div>

      {/* Fill */}
      <SectionHeader title="Fill" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <PropRow layerId={layer.id} propKey="fill">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600 w-9 uppercase tracking-wide">Type</span>
            <select
              value={fill.type}
              onChange={(e) => {
                const type = e.target.value as 'none' | 'solid';
                commitProp<FillValue>(
                  'fill',
                  type === 'none'
                    ? { type: 'none' }
                    : { type: 'solid', color: fillColor, opacity: 100 },
                );
              }}
              className="flex-1 bg-surface-3 text-xs text-zinc-300 px-2 py-0.5 rounded border border-border outline-none"
            >
              <option value="none">None</option>
              <option value="solid">Solid</option>
            </select>
          </div>
        </PropRow>
        {fill.type === 'solid' && (
          <PropRow layerId={layer.id} propKey="fill">
            <ColorInput label="Color" color={fillColor} onChange={(c) => commitProp<FillValue>('fill', { type: 'solid', color: c, opacity: 100 })} />
          </PropRow>
        )}
      </div>

      {/* Stroke */}
      <SectionHeader title="Stroke" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <PropRow layerId={layer.id} propKey="strokeColor">
          <ColorInput label="Color" color={sc} onChange={(c) => commitProp<Color>('strokeColor', c)} />
        </PropRow>
        <PropRow layerId={layer.id} propKey="strokeWidth">
          <NumberInput label="Width" value={sw} onChange={(v) => commitProp<number>('strokeWidth', v)} step={0.5} min={0} unit="px" />
        </PropRow>
      </div>

      {/* Path trim */}
      <SectionHeader title="Path Trim" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <PropRow layerId={layer.id} propKey="trimStart">
          <NumberInput label="Start" value={trimStart} onChange={(v) => commitProp<number>('trimStart', v)} step={1} min={0} max={100} unit="%" />
        </PropRow>
        <PropRow layerId={layer.id} propKey="trimEnd">
          <NumberInput label="End" value={trimEnd} onChange={(v) => commitProp<number>('trimEnd', v)} step={1} min={0} max={100} unit="%" />
        </PropRow>
      </div>

      {/* Hint */}
      <div className="px-3 py-3 border-t border-border mt-2">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          ◆ Click a diamond to add/remove a keyframe at the playhead. Filled = keyframe at current frame. Outlined purple = animated.
        </p>
      </div>
    </div>
  );
}

// ── Inspector panel ──────────────────────────────────────────────────────────

type InspectorTab = 'props' | 'presets';

export function Inspector() {
  const { project } = useProjectStore();
  const { selectedLayerIds, currentFrame } = useUIStore();
  const [tab, setTab] = useState<InspectorTab>('presets');

  const selectedLayers = project.layers.filter((l) => selectedLayerIds.includes(l.id));

  return (
    <aside className="w-64 bg-surface-1 border-l border-border flex-shrink-0 overflow-y-auto flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border flex-shrink-0">
        {[
          { key: 'presets' as const, label: 'Presets' },
          { key: 'props' as const, label: 'Properties' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`
              flex-1 text-[11px] uppercase tracking-wider py-2 transition-colors
              ${tab === key
                ? 'text-white border-b-2 border-accent bg-surface-2'
                : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'presets' && <PresetsPanel />}

      {tab === 'props' && (
        <>
          {selectedLayers.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-zinc-700 text-center leading-relaxed">
                Select a layer to inspect its properties
              </p>
            </div>
          )}
          {selectedLayers.length === 1 && (
            <LayerInspector layer={selectedLayers[0]} frame={currentFrame} />
          )}
          {selectedLayers.length > 1 && (
            <div className="px-3 py-4 text-xs text-zinc-600">
              {selectedLayers.length} layers selected.
            </div>
          )}
        </>
      )}
    </aside>
  );
}
