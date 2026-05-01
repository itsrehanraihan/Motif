import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { SetPropertyValueCommand } from '../../core/commands';
import { interpolateTransform, interpolateNumber, interpolateColor, interpolateFill } from '../../core/interpolator';
import type { Layer, LayerProperties, Transform, Color, FillValue } from '../../types';

// ── Shared inputs ────────────────────────────────────────────────────────────

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
      <span className="text-[10px] text-zinc-600 w-10 flex-shrink-0 uppercase tracking-wide">{label}</span>
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-border mt-1">
      {title}
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
      <span className="text-[10px] text-zinc-600 w-10 flex-shrink-0 uppercase tracking-wide">{label}</span>
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

// ── Transform panel ──────────────────────────────────────────────────────────

interface TransformPanelProps {
  layer: Layer;
  frame: number;
  onCommit: (key: keyof Transform, val: number) => void;
}

function TransformPanel({ layer, frame, onCommit }: TransformPanelProps) {
  const t = interpolateTransform(layer.properties.transform, frame);
  return (
    <div className="px-3 py-2 flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput label="X" value={t.x} onChange={(v) => onCommit('x', v)} step={0.5} />
        <NumberInput label="Y" value={t.y} onChange={(v) => onCommit('y', v)} step={0.5} />
        <NumberInput label="SX" value={t.scaleX * 100} onChange={(v) => onCommit('scaleX', v / 100)} step={1} unit="%" />
        <NumberInput label="SY" value={t.scaleY * 100} onChange={(v) => onCommit('scaleY', v / 100)} step={1} unit="%" />
      </div>
      <NumberInput label="Rot" value={t.rotation} onChange={(v) => onCommit('rotation', v)} step={1} unit="°" />
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

  const makeCmd = useCallback(
    <T,>(propKey: keyof import('../../types').LayerProperties, newVal: T, oldVal: T) =>
      new SetPropertyValueCommand(propKey as string extends keyof import('../../types').LayerProperties ? typeof propKey : never, propKey, newVal, oldVal, setProject),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.id, setProject],
  );

  const commitTransform = (key: keyof Transform, val: number) => {
    const cur = layer.properties.transform.keyframes[0]?.value ?? {
      x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0, anchorY: 0,
    };
    execute(new SetPropertyValueCommand(layer.id, 'transform', { ...cur, [key]: val }, cur, setProject));
  };

  const commitNumber = (propKey: keyof import('../../types').LayerProperties, val: number) => {
    const cur = layer.properties[propKey].keyframes[0]?.value as number ?? 0;
    execute(new SetPropertyValueCommand(layer.id, propKey, val, cur, setProject));
  };

  const commitFill = (fill: FillValue) => {
    const cur = layer.properties.fill.keyframes[0]?.value ?? ({ type: 'none' } as FillValue);
    execute(new SetPropertyValueCommand(layer.id, 'fill', fill, cur, setProject));
  };

  const commitStrokeColor = (color: Color) => {
    const cur = layer.properties.strokeColor.keyframes[0]?.value ?? { r: 0, g: 0, b: 0, a: 1 };
    execute(new SetPropertyValueCommand(layer.id, 'strokeColor', color, cur, setProject));
  };

  const opacity = interpolateNumber(layer.properties.opacity, frame, 100);
  const sw = interpolateNumber(layer.properties.strokeWidth, frame, 1);
  const sc = layer.properties.strokeColor.keyframes[0]?.value ?? { r: 0, g: 0, b: 0, a: 1 };
  const fill = layer.properties.fill.keyframes[0]?.value ?? ({ type: 'none' } as FillValue);
  const fillColor = fill.type === 'solid' ? fill.color : { r: 180, g: 180, b: 180, a: 1 };
  const trimStart = interpolateNumber(layer.properties.trimStart, frame, 0);
  const trimEnd = interpolateNumber(layer.properties.trimEnd, frame, 100);

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
      <TransformPanel layer={layer} frame={frame} onCommit={commitTransform} />

      {/* Opacity */}
      <div className="px-3 py-2 border-t border-border">
        <NumberInput label="Opac" value={opacity} onChange={(v) => commitNumber('opacity', v)} step={1} min={0} max={100} unit="%" />
      </div>

      {/* Fill */}
      <SectionHeader title="Fill" />
      <div className="px-3 py-2">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[10px] text-zinc-600 w-10 uppercase tracking-wide">Type</span>
          <select
            value={fill.type}
            onChange={(e) => {
              const type = e.target.value as 'none' | 'solid';
              commitFill(
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
        {fill.type === 'solid' && (
          <ColorInput label="Color" color={fillColor} onChange={(c) => commitFill({ type: 'solid', color: c, opacity: 100 })} />
        )}
      </div>

      {/* Stroke */}
      <SectionHeader title="Stroke" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <ColorInput label="Color" color={sc} onChange={commitStrokeColor} />
        <NumberInput label="Width" value={sw} onChange={(v) => commitNumber('strokeWidth', v)} step={0.5} min={0} unit="px" />
      </div>

      {/* Path trim */}
      <SectionHeader title="Trim" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <NumberInput label="Start" value={trimStart} onChange={(v) => commitNumber('trimStart', v)} step={1} min={0} max={100} unit="%" />
        <NumberInput label="End" value={trimEnd} onChange={(v) => commitNumber('trimEnd', v)} step={1} min={0} max={100} unit="%" />
      </div>
    </div>
  );
}

// ── Multi-layer inspector ────────────────────────────────────────────────────

interface MultiLayerInspectorProps {
  layers: Layer[];
  frame: number;
}

function MultiLayerInspector({ layers, frame }: MultiLayerInspectorProps) {
  const { setProject } = useProjectStore();

  const applyToAll = useCallback(
    <T,>(propKey: keyof LayerProperties, val: T) => {
      setProject((d) => {
        for (const target of d.layers) {
          if (!layers.find((l) => l.id === target.id)) continue;
          const prop = target.properties[propKey] as unknown as { keyframes: { frame: number; value: T }[] };
          const kf = prop.keyframes.find((k) => k.frame === frame);
          if (kf) {
            kf.value = val;
          } else {
            prop.keyframes[0].value = val;
          }
        }
      });
    },
    [layers, frame, setProject],
  );

  const rep = layers[0];
  const opacity = interpolateNumber(rep.properties.opacity, frame, 100);
  const sw = interpolateNumber(rep.properties.strokeWidth, frame, 1);
  const sc = interpolateColor(rep.properties.strokeColor, frame);
  const fill = interpolateFill(rep.properties.fill, frame);
  const fillColor = fill.type === 'solid' ? fill.color : { r: 180, g: 180, b: 180, a: 1 };

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs text-zinc-400 font-medium">{layers.length} layers selected</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">Edits apply to all selected layers</p>
      </div>

      <SectionHeader title="Opacity" />
      <div className="px-3 py-2">
        <NumberInput label="Opac" value={opacity} onChange={(v) => applyToAll<number>('opacity', v)} step={1} min={0} max={100} unit="%" />
      </div>

      <SectionHeader title="Fill" />
      <div className="px-3 py-2">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[10px] text-zinc-600 w-10 uppercase tracking-wide">Type</span>
          <select
            value={fill.type}
            onChange={(e) => {
              const type = e.target.value as 'none' | 'solid';
              applyToAll<FillValue>('fill', type === 'none' ? { type: 'none' } : { type: 'solid', color: fillColor, opacity: 100 });
            }}
            className="flex-1 bg-surface-3 text-xs text-zinc-300 px-2 py-0.5 rounded border border-border outline-none"
          >
            <option value="none">None</option>
            <option value="solid">Solid</option>
          </select>
        </div>
        {fill.type === 'solid' && (
          <ColorInput label="Color" color={fillColor} onChange={(c) => applyToAll<FillValue>('fill', { type: 'solid', color: c, opacity: 100 })} />
        )}
      </div>

      <SectionHeader title="Stroke" />
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <ColorInput label="Color" color={sc} onChange={(c) => applyToAll<Color>('strokeColor', c)} />
        <NumberInput label="Width" value={sw} onChange={(v) => applyToAll<number>('strokeWidth', v)} step={0.5} min={0} unit="px" />
      </div>
    </div>
  );
}

// ── Inspector panel ──────────────────────────────────────────────────────────

export function Inspector() {
  const { project } = useProjectStore();
  const { selectedLayerIds, currentFrame } = useUIStore();

  const selectedLayers = project.layers.filter((l) => selectedLayerIds.includes(l.id));

  return (
    <aside className="w-52 bg-surface-1 border-l border-border flex-shrink-0 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Inspector</span>
        {selectedLayers.length > 0 && (
          <span className="text-xs text-zinc-700">{selectedLayers.length}</span>
        )}
      </div>

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
        <MultiLayerInspector layers={selectedLayers} frame={currentFrame} />
      )}
    </aside>
  );
}
