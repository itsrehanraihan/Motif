import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { RenameLayerCommand, ReorderLayersCommand, DeleteLayerCommand } from '../../core/commands';
import type { Layer } from '../../types';

// ── Layer row ────────────────────────────────────────────────────────────────

interface LayerRowProps {
  layer: Layer;
  index: number;
  selected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onVisibilityToggle: (id: string) => void;
  onLockToggle: (id: string) => void;
  onRename: (id: string, name: string, oldName: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  dragOverIndex: number | null;
}

function LayerRow({
  layer, index, selected,
  onSelect, onVisibilityToggle, onLockToggle, onRename, onDelete,
  onDragStart, onDragOver, onDrop, dragOverIndex,
}: LayerRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);

  const commitRename = () => {
    onRename(layer.id, editValue, layer.name);
    setEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
      onClick={(e) => onSelect(layer.id, e.shiftKey || e.metaKey)}
      className={`
        flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs group transition-colors
        ${selected ? 'bg-accent/20 text-white' : 'text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'}
        ${dragOverIndex === index ? 'border-t-2 border-accent' : ''}
        select-none
      `}
    >
      {/* Color dot */}
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: layer.color }} />

      {/* Type icon */}
      <span className="text-zinc-600 flex-shrink-0 w-3 text-center text-[10px]">
        {layer.type === 'rect' ? '▭' :
         layer.type === 'ellipse' ? '◯' :
         layer.type === 'path' ? '⌒' :
         layer.type === 'text' ? 'T' :
         layer.type === 'frame' ? '⬚' :
         layer.type === 'group' ? '⊞' : '·'}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            className="bg-surface-3 text-white text-xs px-1 rounded outline-none border border-accent w-full"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="truncate block leading-snug"
            onDoubleClick={(e) => { e.stopPropagation(); setEditValue(layer.name); setEditing(true); }}
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onLockToggle(layer.id); }}
          className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-200 text-[10px]"
          title={layer.locked ? 'Unlock' : 'Lock'}
        >
          {layer.locked ? '⊠' : '○'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onVisibilityToggle(layer.id); }}
          className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-200 text-[10px]"
          title={layer.visible ? 'Hide' : 'Show'}
        >
          {layer.visible ? '●' : '○'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
          className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-red-400 text-[10px]"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Layer panel ──────────────────────────────────────────────────────────────

export function LayerPanel() {
  const { project, setProject } = useProjectStore();
  const { selectedLayerIds, toggleSelectLayer, setSelectedLayerIds } = useUIStore();
  const { execute } = useHistoryStore();

  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const visibleLayers = search
    ? project.layers.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : project.layers;

  const handleRename = useCallback(
    (id: string, newName: string, oldName: string) => {
      if (newName === oldName || !newName.trim()) return;
      execute(new RenameLayerCommand(id, newName.trim(), oldName, setProject));
    },
    [setProject, execute],
  );

  const handleVisibilityToggle = useCallback(
    (id: string) => {
      setProject((d) => {
        const l = d.layers.find((x) => x.id === id);
        if (l) l.visible = !l.visible;
      });
    },
    [setProject],
  );

  const handleLockToggle = useCallback(
    (id: string) => {
      setProject((d) => {
        const l = d.layers.find((x) => x.id === id);
        if (l) l.locked = !l.locked;
      });
    },
    [setProject],
  );

  const handleDelete = useCallback(
    (id: string) => {
      execute(new DeleteLayerCommand(id, setProject));
      setSelectedLayerIds(selectedLayerIds.filter((s) => s !== id));
    },
    [setProject, execute, selectedLayerIds, setSelectedLayerIds],
  );

  const handleDrop = useCallback(() => {
    if (dragFromIndex === null || dragOverIndex === null || dragFromIndex === dragOverIndex) {
      setDragFromIndex(null);
      setDragOverIndex(null);
      return;
    }
    execute(new ReorderLayersCommand(dragFromIndex, dragOverIndex, setProject));
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, [dragFromIndex, dragOverIndex, setProject, execute]);

  return (
    <aside className="flex flex-col w-48 bg-surface-1 border-r border-border flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border flex-shrink-0">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Layers</span>
        <span className="text-xs text-zinc-700">{project.layers.length}</span>
      </div>

      {/* Search */}
      <div className="px-2 py-1 border-b border-border flex-shrink-0">
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-3 text-xs text-zinc-300 placeholder-zinc-600 px-2 py-1 rounded outline-none border border-border focus:border-accent"
        />
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {visibleLayers.length === 0 && (
          <div className="text-xs text-zinc-700 text-center py-8 px-4 leading-relaxed">
            {project.layers.length === 0 ? 'Import an SVG to get started' : 'No matching layers'}
          </div>
        )}
        {visibleLayers.map((layer, i) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            index={i}
            selected={selectedLayerIds.includes(layer.id)}
            onSelect={toggleSelectLayer}
            onVisibilityToggle={handleVisibilityToggle}
            onLockToggle={handleLockToggle}
            onRename={handleRename}
            onDelete={handleDelete}
            onDragStart={setDragFromIndex}
            onDragOver={setDragOverIndex}
            onDrop={handleDrop}
            dragOverIndex={dragOverIndex}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border flex-shrink-0">
        <button
          onClick={() => setSelectedLayerIds(project.layers.map((l) => l.id))}
          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          All
        </button>
        <button
          onClick={() => setSelectedLayerIds([])}
          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          None
        </button>
      </div>
    </aside>
  );
}
