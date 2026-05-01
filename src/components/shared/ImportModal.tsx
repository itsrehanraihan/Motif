import React, { useState, useRef, useCallback } from 'react';

interface ImportModalProps {
  onImport: (svgString: string) => void;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePasteImport = () => {
    const trimmed = pasteValue.trim();
    if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
      setError('Not a valid SVG string.');
      return;
    }
    onImport(trimmed);
  };

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
        setError('Please upload an SVG file.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const text = await file.text();
        onImport(text);
      } catch {
        setError('Failed to read file.');
      } finally {
        setLoading(false);
      }
    },
    [onImport],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface-2 rounded-xl border border-border shadow-2xl w-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-white">Import SVG</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Drop zone */}
        <div className="p-5">
          <div
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer
              ${dragging ? 'border-accent bg-accent/10' : 'border-border hover:border-zinc-500'}
            `}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl">📥</div>
            <p className="text-sm text-zinc-400 text-center">
              Drop an SVG file here, or <span className="text-accent">click to browse</span>
            </p>
            <p className="text-xs text-zinc-600">Supports SVG files with paths, shapes, and gradients</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {loading && (
            <p className="text-xs text-zinc-400 mt-3 text-center animate-pulse">Parsing SVG…</p>
          )}
          {error && (
            <p className="text-xs text-red-400 mt-3 text-center">{error}</p>
          )}

          {/* Paste SVG text */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-zinc-500 mb-2">Or paste SVG code:</p>
            <textarea
              className="w-full h-20 bg-surface-3 text-xs text-zinc-300 placeholder-zinc-600 px-2 py-1.5 rounded border border-border focus:border-accent outline-none resize-none font-mono"
              placeholder={'<svg viewBox="0 0 100 100">…</svg>'}
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <button
              onClick={handlePasteImport}
              disabled={!pasteValue.trim()}
              className="mt-1.5 w-full py-1.5 text-xs text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
            >
              Import from code
            </button>
          </div>

          {/* Demo SVGs */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-zinc-600 mb-2">Or try a demo:</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_SVGS.map(({ name, svg }) => (
                <button
                  key={name}
                  onClick={() => onImport(svg)}
                  className="text-xs text-zinc-400 hover:text-white bg-surface-3 hover:bg-surface-4 border border-border px-2 py-1 rounded transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_SVGS = [
  {
    name: 'Checkmark',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M15 50 L40 75 L85 25" stroke="#6366f1" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    name: 'Arrow',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M20 50 L70 50 M55 30 L75 50 L55 70" stroke="#10b981" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    name: 'Star',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 61,35 90,35 68,57 79,85 50,67 21,85 32,57 10,35 39,35" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"/></svg>`,
  },
  {
    name: 'Circle',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" stroke="#ec4899" stroke-width="6" fill="none"/></svg>`,
  },
  {
    name: 'Shapes',
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="70" height="70" rx="8" fill="#6366f1" opacity="0.8"/>
      <circle cx="150" cy="55" r="35" fill="#ec4899" opacity="0.8"/>
      <path d="M20 150 L90 150 L55 90 Z" fill="#10b981" opacity="0.8"/>
      <ellipse cx="150" cy="150" rx="40" ry="25" fill="#f59e0b" opacity="0.8"/>
    </svg>`,
  },
];
