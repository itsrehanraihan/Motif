import { useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '../store/ui';
import { useProjectStore } from '../store/project';
import { interpolateTransform, interpolateNumber, interpolateFill, interpolateColor } from '../core/interpolator';
import type { Layer } from '../types';

function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function applyLayerToDOM(layer: Layer, frame: number): void {
  const el = document.getElementById(`layer-${layer.id}`) as SVGElement | null;
  if (!el) return;

  const t = interpolateTransform(layer.properties.transform, frame);
  const opacity = interpolateNumber(layer.properties.opacity, frame, 100) / 100;
  const fill = interpolateFill(layer.properties.fill, frame);
  const strokeColor = interpolateColor(layer.properties.strokeColor, frame);
  const strokeWidth = interpolateNumber(layer.properties.strokeWidth, frame, 1);
  const strokeOpacity = interpolateNumber(layer.properties.strokeOpacity, frame, 100) / 100;
  const trimStart = interpolateNumber(layer.properties.trimStart, frame, 0);
  const trimEnd = interpolateNumber(layer.properties.trimEnd, frame, 100);

  el.setAttribute(
    'transform',
    `translate(${t.x + t.anchorX}, ${t.y + t.anchorY}) rotate(${t.rotation}) scale(${t.scaleX}, ${t.scaleY}) translate(${-t.anchorX}, ${-t.anchorY})`,
  );
  el.style.opacity = String(opacity);

  if (fill.type === 'solid') {
    el.setAttribute('fill', colorToCss(fill.color));
    el.style.fillOpacity = String(fill.opacity / 100);
  } else if (fill.type === 'none') {
    el.setAttribute('fill', 'none');
  }

  el.setAttribute('stroke', colorToCss(strokeColor));
  el.setAttribute('stroke-width', String(strokeWidth));
  el.style.strokeOpacity = String(strokeOpacity);

  // Apply trim via stroke-dasharray
  const pathEl = el.querySelector('path') ?? (el.tagName === 'path' ? el : null);
  if (pathEl instanceof SVGPathElement) {
    const totalLen = pathEl.getTotalLength?.() ?? 0;
    if (totalLen > 0 && (trimStart > 0 || trimEnd < 100)) {
      const start = (trimStart / 100) * totalLen;
      const end = (trimEnd / 100) * totalLen;
      const len = end - start;
      pathEl.style.strokeDasharray = `${len} ${totalLen}`;
      pathEl.style.strokeDashoffset = String(-start);
    } else {
      pathEl.style.strokeDasharray = '';
      pathEl.style.strokeDashoffset = '';
    }
  }
}

export function usePlayback() {
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  const { isPlaying, setIsPlaying, setCurrentFrame, currentFrame } = useUIStore();
  const { project } = useProjectStore();

  const fpsRef = useRef(project.fps);
  const totalFramesRef = useRef(project.totalFrames);
  const layersRef = useRef(project.layers);

  useEffect(() => {
    fpsRef.current = project.fps;
    totalFramesRef.current = project.totalFrames;
    layersRef.current = project.layers;
  }, [project]);

  const renderFrame = useCallback((frame: number) => {
    for (const layer of layersRef.current) {
      if (layer.visible) {
        applyLayerToDOM(layer, frame);
      }
    }
  }, []);

  const tick = useCallback(
    (time: number) => {
      if (!isPlayingRef.current) return;
      const delta = time - (lastTimeRef.current || time);
      lastTimeRef.current = time;
      frameRef.current += (delta / 1000) * fpsRef.current;

      if (frameRef.current >= totalFramesRef.current) {
        frameRef.current = 0; // loop
      }

      renderFrame(frameRef.current);

      // Sync UI at ~30fps to avoid excessive re-renders
      if (Math.floor(frameRef.current) % 2 === 0) {
        setCurrentFrame(Math.floor(frameRef.current));
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [renderFrame, setCurrentFrame],
  );

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    lastTimeRef.current = 0;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, setIsPlaying]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [setIsPlaying]);

  const seek = useCallback(
    (frame: number) => {
      frameRef.current = frame;
      setCurrentFrame(frame);
      renderFrame(frame);
    },
    [renderFrame, setCurrentFrame],
  );

  const togglePlayback = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
  }, [play, pause]);

  // Render on seek (when not playing)
  useEffect(() => {
    if (!isPlaying) {
      frameRef.current = currentFrame;
      renderFrame(currentFrame);
    }
  }, [currentFrame, isPlaying, renderFrame]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { play, pause, seek, togglePlayback, isPlaying };
}
