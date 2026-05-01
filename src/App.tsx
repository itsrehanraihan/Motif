import React, { useState, useCallback, useEffect } from 'react';
import { Topbar, CanvasToolbar } from './components/toolbar/Toolbar';
import { Canvas } from './components/canvas/Canvas';
import { LayerPanel } from './components/layers/LayerPanel';
import { Timeline } from './components/timeline/Timeline';
import { Inspector } from './components/inspector/Inspector';
import { ImportModal } from './components/shared/ImportModal';
import { useProjectStore } from './store/project';
import { useUIStore } from './store/ui';
import { useHistoryStore } from './store/history';
import { useKeyframes } from './hooks/useKeyframes';
import { applyDrawOnAnimation } from './core/animation/defaultAnimations';
import type { LayerProperties } from './types';

// Parser worker import
const createParserWorker = () =>
  new Worker(new URL('./workers/parser.worker.ts', import.meta.url), { type: 'module' });

export default function App() {
  const { setProjectDirect, project, setProject } = useProjectStore();
  const { setSelectedLayerIds, selectedLayerIds, activeTool, setActiveTool, currentFrame } = useUIStore();
  const { undo, redo, canUndo, canRedo } = useHistoryStore();
  const { addKeyframeForSelectedLayers } = useKeyframes();

  const [importOpen, setImportOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const handleImportSvg = useCallback(
    (svgString: string) => {
      setParsing(true);
      setParseError(null);
      const worker = createParserWorker();

      worker.onmessage = (e: MessageEvent) => {
        setParsing(false);
        worker.terminate();

        if (e.data.type === 'error') {
          setParseError(e.data.message as string);
          return;
        }

        const { layers, width, height } = e.data.result as {
          layers: import('./types').Layer[];
          width: number;
          height: number;
          warnings: string[];
        };

        const animated = applyDrawOnAnimation(layers, {
          fps: project.fps,
          totalFrames: project.totalFrames,
          amplitudePx: 3,
          amplitudeDeg: 4,
          amplitudeScale: 0.04,
          steps: 8,
          staggerMs: 50,
        });

        setProject((draft) => {
          draft.layers = animated;
          draft.width = width;
          draft.height = height;
        });
        setSelectedLayerIds([]);
        setImportOpen(false);
      };

      worker.onerror = (err) => {
        setParsing(false);
        setParseError(String(err.message));
        worker.terminate();
      };

      worker.postMessage({ svgString, totalFrames: project.totalFrames });
    },
    [project.totalFrames, project.fps, setProject, setSelectedLayerIds],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element)?.tagName?.toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (!inInput) {
        // Tool shortcuts
        const toolMap: Record<string, import('./types').ToolType> = {
          v: 'select', f: 'frame', r: 'rect', o: 'ellipse',
          p: 'pen', t: 'text', i: 'image', s: 'svg', h: 'hand',
        };
        if (toolMap[e.key.toLowerCase()]) {
          setActiveTool(toolMap[e.key.toLowerCase()]);
          return;
        }

        // K — add keyframe
        if (e.key === 'k' || e.key === 'K') {
          addKeyframeForSelectedLayers('transform');
          return;
        }

        // Space — play/pause (handled in timeline)
        if (e.key === ' ') {
          e.preventDefault();
        }

        // Delete / Backspace — delete selected layers
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedLayerIds.length > 0) {
            setProject((d) => {
              d.layers = d.layers.filter((l) => !selectedLayerIds.includes(l.id));
            });
            setSelectedLayerIds([]);
          }
        }
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }

      // Cmd+A — select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedLayerIds(project.layers.map((l) => l.id));
      }

      // Escape — clear selection / close modal
      if (e.key === 'Escape') {
        if (importOpen) setImportOpen(false);
        else setSelectedLayerIds([]);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedLayerIds, project.layers, importOpen,
    setActiveTool, addKeyframeForSelectedLayers,
    setProject, setSelectedLayerIds, undo, redo,
  ]);

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-zinc-200 overflow-hidden font-sans">
      {/* Top bar */}
      <Topbar onImportSvg={() => setImportOpen(true)} />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tool bar + layer panel */}
        <div className="flex flex-shrink-0">
          <CanvasToolbar />
          <LayerPanel />
        </div>

        {/* Center: canvas */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Parse status */}
          {parsing && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-surface-2 border border-border rounded px-4 py-2 text-xs text-zinc-300 animate-pulse">
              Parsing SVG…
            </div>
          )}
          {parseError && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-red-900/80 border border-red-700 rounded px-4 py-2 text-xs text-red-200">
              {parseError}
            </div>
          )}

          <Canvas />

          {/* Timeline */}
          <Timeline />
        </div>

        {/* Right: inspector */}
        <Inspector />
      </div>

      {/* Import modal */}
      {importOpen && (
        <ImportModal
          onImport={handleImportSvg}
          onClose={() => setImportOpen(false)}
        />
      )}

      {/* Empty state overlay */}
      {project.layers.length === 0 && !importOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center pointer-events-auto">
            <div className="text-6xl mb-4 opacity-20">◈</div>
            <h2 className="text-lg font-semibold text-zinc-400 mb-2">No layers yet</h2>
            <p className="text-sm text-zinc-600 mb-6 max-w-xs">
              Import an SVG to get started. Motif will parse your paths and set up an animated timeline.
            </p>
            <button
              onClick={() => setImportOpen(true)}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Import SVG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
