import React, { useCallback, useRef } from 'react';
import { useUIStore } from '../../store/ui';
import { useProjectStore } from '../../store/project';
import { useHistoryStore } from '../../store/history';
import { useExport } from '../../hooks/useExport';
import type { ToolType } from '../../types';

interface ToolButtonProps {
  tool: ToolType;
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ tool, label, shortcut, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`
        flex items-center justify-center w-8 h-8 rounded text-xs font-mono font-semibold
        transition-colors select-none
        ${active
          ? 'bg-accent text-white'
          : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'
        }
      `}
    >
      {shortcut}
    </button>
  );
}

const TOOLS: Array<{ tool: ToolType; label: string; shortcut: string }> = [
  { tool: 'select', label: 'Select / transform', shortcut: 'V' },
  { tool: 'frame', label: 'Frame (artboard container)', shortcut: 'F' },
  { tool: 'rect', label: 'Rectangle', shortcut: 'R' },
  { tool: 'ellipse', label: 'Ellipse / circle', shortcut: 'O' },
  { tool: 'pen', label: 'Pen / path draw', shortcut: 'P' },
  { tool: 'text', label: 'Text', shortcut: 'T' },
  { tool: 'image', label: 'Image (paste URL / upload)', shortcut: 'I' },
  { tool: 'svg', label: 'Import SVG', shortcut: 'S' },
];

interface TopbarProps {
  onImportSvg: () => void;
}

export function Topbar({ onImportSvg }: TopbarProps) {
  const { project, setProject } = useProjectStore();
  const { canUndo, canRedo, undo, redo } = useHistoryStore();
  const { downloadLottie, downloadCss, downloadMotifJson } = useExport();
  const [exportOpen, setExportOpen] = React.useState(false);
  const [nameEditing, setNameEditing] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(project.name);

  const commitName = () => {
    setProject((d) => { d.name = nameValue; });
    setNameEditing(false);
  };

  return (
    <header className="flex items-center justify-between h-11 px-3 bg-surface-1 border-b border-border flex-shrink-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-white font-semibold text-sm tracking-wide">Motif</span>
        <span className="text-zinc-600 text-xs">|</span>

        {/* Project name */}
        {nameEditing ? (
          <input
            autoFocus
            className="bg-surface-3 text-white text-sm px-2 py-0.5 rounded outline-none border border-accent w-36"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setNameEditing(false); }}
          />
        ) : (
          <button
            className="text-zinc-300 text-sm hover:text-white transition-colors"
            onDoubleClick={() => { setNameValue(project.name); setNameEditing(true); }}
          >
            {project.name}
          </button>
        )}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo (Cmd+Z)"
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Redo (Cmd+Shift+Z)"
        >
          ↪
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* FPS selector */}
        <select
          value={project.fps}
          onChange={(e) => setProject((d) => { d.fps = +e.target.value as 24 | 30 | 60; })}
          className="bg-surface-3 text-zinc-300 text-xs px-1 py-0.5 rounded border border-border outline-none"
        >
          <option value={24}>24fps</option>
          <option value={30}>30fps</option>
          <option value={60}>60fps</option>
        </select>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Import SVG */}
        <button
          onClick={onImportSvg}
          className="px-3 py-1 text-xs text-zinc-300 hover:text-white bg-surface-3 hover:bg-surface-4 border border-border rounded transition-colors"
        >
          Import SVG
        </button>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-hover rounded transition-colors"
          >
            Export ▾
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-2 border border-border rounded shadow-xl z-50">
              {[
                { label: 'Lottie JSON', action: downloadLottie },
                { label: 'CSS @keyframes', action: downloadCss },
                { label: '.motif.json', action: downloadMotifJson },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => { action(); setExportOpen(false); }}
                  className="w-full px-3 py-2 text-xs text-left text-zinc-300 hover:bg-surface-3 hover:text-white transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function CanvasToolbar() {
  const { activeTool, setActiveTool } = useUIStore();

  return (
    <div className="flex flex-col items-center gap-1 p-1.5 bg-surface-1 border-r border-border">
      {TOOLS.map(({ tool, label, shortcut }) => (
        <ToolButton
          key={tool}
          tool={tool}
          label={label}
          shortcut={shortcut}
          active={activeTool === tool}
          onClick={() => setActiveTool(tool)}
        />
      ))}
    </div>
  );
}
