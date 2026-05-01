import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { PRESETS, getPresetsByCategory, type PresetCategory } from '../../core/animation/presets';
import type { Layer } from '../../types';

const CATEGORIES: { key: PresetCategory; label: string }[] = [
  { key: 'in', label: 'Reveal In' },
  { key: 'out', label: 'Reveal Out' },
  { key: 'loop', label: 'Loop' },
];

interface PresetCardProps {
  emoji: string;
  name: string;
  active?: boolean;
  onClick: () => void;
}

function PresetCard({ emoji, name, active, onClick }: PresetCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-1
        rounded-md border p-2 transition-colors
        ${active
          ? 'border-accent bg-accent/15 text-white'
          : 'border-border bg-surface-3 text-zinc-400 hover:border-zinc-500 hover:bg-surface-4 hover:text-white'
        }
      `}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span className="text-[10px] leading-tight text-center">{name}</span>
    </button>
  );
}

export function PresetsPanel() {
  const { project, setProject } = useProjectStore();
  const { selectedLayerIds } = useUIStore();
  const [activeCat, setActiveCat] = useState<PresetCategory>('in');
  const [duration, setDuration] = useState(600);
  const [stagger, setStagger] = useState(80);

  const targetLayers: Layer[] =
    selectedLayerIds.length > 0
      ? project.layers.filter((l) => selectedLayerIds.includes(l.id))
      : project.layers;

  const apply = useCallback(
    (presetId: string) => {
      if (targetLayers.length === 0) return;
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      const fps = project.fps;
      const totalFrames = project.totalFrames;
      const durationFrames = Math.max(1, Math.round((duration * fps) / 1000));
      const staggerFrames = Math.round((stagger * fps) / 1000);

      const targetIds = new Set(targetLayers.map((l) => l.id));

      setProject((d) => {
        const ordered = d.layers.filter((l) => targetIds.has(l.id));
        ordered.forEach((layer, i) => {
          const startFrame = Math.min(i * staggerFrames, Math.max(0, totalFrames - durationFrames));
          const result = preset.apply(layer, { fps, totalFrames, startFrame, durationFrames });
          // Copy keyframes back into draft
          layer.properties.transform.keyframes = result.properties.transform.keyframes;
          layer.properties.opacity.keyframes = result.properties.opacity.keyframes;
          layer.properties.trimEnd.keyframes = result.properties.trimEnd.keyframes;
          layer.properties.trimStart.keyframes = result.properties.trimStart.keyframes;
        });
      });
    },
    [targetLayers, project.fps, project.totalFrames, duration, stagger, setProject],
  );

  const presets = getPresetsByCategory(activeCat);
  const targetLabel =
    selectedLayerIds.length > 0 ? `${selectedLayerIds.length} selected` : `all ${project.layers.length}`;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Animation Presets</span>
        <span className="text-[10px] text-zinc-600">{targetLabel}</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-border">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCat(key)}
            className={`
              flex-1 text-[10px] uppercase tracking-wider py-1 rounded transition-colors
              ${activeCat === key
                ? 'bg-accent text-white'
                : 'text-zinc-500 hover:bg-surface-3 hover:text-zinc-300'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {presets.map((p) => (
          <PresetCard
            key={p.id}
            emoji={p.emoji}
            name={p.name}
            onClick={() => apply(p.id)}
          />
        ))}
      </div>

      {/* Tuning */}
      <div className="px-3 py-2 border-t border-border flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 w-14 uppercase tracking-wide">Duration</span>
          <input
            type="range" min={150} max={2000} step={50}
            value={duration}
            onChange={(e) => setDuration(+e.target.value)}
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-zinc-400 font-mono w-12 text-right">{duration}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 w-14 uppercase tracking-wide">Stagger</span>
          <input
            type="range" min={0} max={300} step={10}
            value={stagger}
            onChange={(e) => setStagger(+e.target.value)}
            className="flex-1 accent-accent"
          />
          <span className="text-xs text-zinc-400 font-mono w-12 text-right">{stagger}ms</span>
        </div>
      </div>

      {/* Hint */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Click any preset to apply it to {selectedLayerIds.length > 0 ? 'selected layers' : 'all layers'}.
          Layers stagger by index. Hit Play ▶ to preview.
        </p>
      </div>
    </div>
  );
}
