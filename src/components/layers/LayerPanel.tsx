import React, { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../store/project';
import { useUIStore } from '../../store/ui';
import { useHistoryStore } from '../../store/history';
import { RenameLayerCommand, DeleteLayerCommand } from '../../core/commands';
import type { Layer } from '../../types';

// ── Layer row ────────────────────────────────────────────────────────────────

interface LayerRowProps {
  layer: Layer;
  depth: number;
  selected: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string, multi: boolean) => void;
  onVisibilityToggle: (id: string) => void;
  onLockToggle: (id: string) => void;
  onRename: (id: string, name: string, oldName: string) => void;
  onDelete: (id: string) => void;
}

function LayerRow({
  layer, depth, selected, hasChildren, expanded,
  onToggleExpand, onSelect, onVisibilityToggle, onLockToggle, onRename, onDelete,
}: LayerRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);

  const commitRename = () => {
    onRename(layer.id, editValue, layer.name);
    setEditing(false);
  };

  const isGroup = layer.type === 'group';

  return (
    <div
      onClick={(e) => onSelect(layer.id, e.shiftKey || e.metaKey || e.ctrlKey)}
      className={`
        flex items-center gap-1 px-1 py-1 cursor-pointer text-xs group transition-colors
        ${selected ? 'bg-accent/25 text-white' : 'text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'}
        select-none
      `}
      style={{ paddingLeft: 4 + depth * 12 }}
    >
      {/* Expand chevron */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggleExpand(layer.id);
        }}
        className="w-3 h-3 flex items-center justify-center flex-shrink-0 text-zinc-600 hover:text-zinc-300"
        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
      >
        <span className="text-[8px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Type icon */}
      <span className="flex-shrink-0 w-3 text-center text-[11px]" style={{ color: layer.color }}>
        {isGroup ? (expanded ? '⌐' : '▣') :
         layer.type === 'rect' ? '▭' :
         layer.type === 'ellipse' || layer.type === 'path' && layer.name.includes('circle') ? '◯' :
         layer.type === 'text' ? 'T' :
         layer.type === 'frame' ? '⬚' :
         '◇'}
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
            className={`truncate block leading-snug ${isGroup ? 'font-medium' : ''}`}
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
          {layer.locked ? '🔒' : '○'}
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

// ── Tree builder ─────────────────────────────────────────────────────────────

interface TreeNode {
  layer: Layer;
  depth: number;
  hasChildren: boolean;
}

function buildTree(layers: Layer[], expandedIds: Set<string>, search: string): TreeNode[] {
  // Build parent → children map preserving order from layers array
  const childrenByParent = new Map<string | null, Layer[]>();
  for (const layer of layers) {
    const key = layer.parentId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(layer);
  }

  // If searching, return flat filtered list
  if (search) {
    const q = search.toLowerCase();
    return layers
      .filter((l) => l.name.toLowerCase().includes(q))
      .map((layer) => ({ layer, depth: 0, hasChildren: false }));
  }

  // DFS from roots (parentId === null)
  const out: TreeNode[] = [];
  const dfs = (parentId: string | null, depth: number) => {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const layer of kids) {
      const myKids = childrenByParent.get(layer.id) ?? [];
      out.push({ layer, depth, hasChildren: myKids.length > 0 });
      if (myKids.length > 0 && expandedIds.has(layer.id)) {
        dfs(layer.id, depth + 1);
      }
    }
  };
  dfs(null, 0);
  return out;
}

// Collect descendant ids for a given layer (for select/delete cascade)
function descendantsOf(layerId: string, layers: Layer[]): string[] {
  const out: string[] = [];
  const stack = [layerId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const l of layers) {
      if (l.parentId === id) {
        out.push(l.id);
        stack.push(l.id);
      }
    }
  }
  return out;
}

// ── Layer panel ──────────────────────────────────────────────────────────────

export function LayerPanel() {
  const { project, setProject } = useProjectStore();
  const { selectedLayerIds, toggleSelectLayer, setSelectedLayerIds } = useUIStore();
  const { execute } = useHistoryStore();

  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Default-expand top-level groups when layers change
  React.useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const l of project.layers) {
        if (l.type === 'group' && l.parentId === null && !next.has(l.id)) {
          next.add(l.id);
        }
      }
      return next;
    });
  }, [project.layers]);

  const tree = useMemo(
    () => buildTree(project.layers, expandedIds, search),
    [project.layers, expandedIds, search],
  );

  const handleRename = useCallback(
    (id: string, newName: string, oldName: string) => {
      if (newName === oldName || !newName.trim()) return;
      execute(new RenameLayerCommand(id, newName.trim(), oldName, setProject));
    },
    [setProject, execute],
  );

  const handleVisibilityToggle = useCallback(
    (id: string) => {
      const ids = [id, ...descendantsOf(id, project.layers)];
      setProject((d) => {
        const target = d.layers.find((x) => x.id === id);
        if (!target) return;
        const newVal = !target.visible;
        for (const l of d.layers) {
          if (ids.includes(l.id)) l.visible = newVal;
        }
      });
    },
    [setProject, project.layers],
  );

  const handleLockToggle = useCallback(
    (id: string) => {
      const ids = [id, ...descendantsOf(id, project.layers)];
      setProject((d) => {
        const target = d.layers.find((x) => x.id === id);
        if (!target) return;
        const newVal = !target.locked;
        for (const l of d.layers) {
          if (ids.includes(l.id)) l.locked = newVal;
        }
      });
    },
    [setProject, project.layers],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const ids = new Set([id, ...descendantsOf(id, project.layers)]);
      setProject((d) => {
        d.layers = d.layers.filter((l) => !ids.has(l.id));
      });
      setSelectedLayerIds(selectedLayerIds.filter((s) => !ids.has(s)));
    },
    [setProject, project.layers, selectedLayerIds, setSelectedLayerIds],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Click on group selects the group AND all descendants
  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      const layer = project.layers.find((l) => l.id === id);
      if (!layer) return;
      if (layer.type === 'group') {
        const all = [id, ...descendantsOf(id, project.layers)];
        if (multi) {
          const has = selectedLayerIds.includes(id);
          if (has) {
            setSelectedLayerIds(selectedLayerIds.filter((s) => !all.includes(s)));
          } else {
            setSelectedLayerIds([...new Set([...selectedLayerIds, ...all])]);
          }
        } else {
          setSelectedLayerIds(all);
        }
      } else {
        toggleSelectLayer(id, multi);
      }
    },
    [project.layers, selectedLayerIds, setSelectedLayerIds, toggleSelectLayer],
  );

  return (
    <aside className="flex flex-col w-56 bg-surface-1 border-r border-border flex-shrink-0 overflow-hidden">
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

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {tree.length === 0 && (
          <div className="text-xs text-zinc-700 text-center py-8 px-4 leading-relaxed">
            {project.layers.length === 0 ? 'Import an SVG to get started' : 'No matches'}
          </div>
        )}
        {tree.map(({ layer, depth, hasChildren }) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            depth={depth}
            hasChildren={hasChildren}
            expanded={expandedIds.has(layer.id)}
            selected={selectedLayerIds.includes(layer.id)}
            onToggleExpand={toggleExpand}
            onSelect={handleSelect}
            onVisibilityToggle={handleVisibilityToggle}
            onLockToggle={handleLockToggle}
            onRename={handleRename}
            onDelete={handleDelete}
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
        <span className="text-[10px] text-zinc-700">{selectedLayerIds.length} selected</span>
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
