/**
 * Framer Video Player Component
 * Premium custom video player — drop into any Framer project.
 *
 * Features: play/pause, seek, volume (vertical slider), mute,
 * auto-hide controls, resume (localStorage), IntersectionObserver
 * auto-pause, keyboard shortcuts, mobile center-play button.
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { addPropertyControls, ControlType } from "framer";

// ─── Icon System ──────────────────────────────────────────────────────────────

interface IconDef {
  viewBox: string;
  paths: Array<{ d: string; fill?: string; fillRule?: string }>;
}

const ICONS: Record<string, IconDef> = {
  play: {
    viewBox: "0 0 24 24",
    paths: [{ d: "M8 5v14l11-7z", fill: "currentColor" }],
  },
  pause: {
    viewBox: "0 0 24 24",
    paths: [{ d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z", fill: "currentColor" }],
  },
  volume: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
        fill: "currentColor",
      },
    ],
  },
  mute: {
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z",
        fill: "currentColor",
      },
    ],
  },
};

interface IconProps {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

function SvgIcon({ name, size = 20, color = "currentColor", style }: IconProps) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {icon.paths.map((p, i) => (
        <path key={i} d={p.d} fill={color} />
      ))}
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const STORAGE_PREFIX = "framer_vp_";

function saveResume(src: string, t: number) {
  try {
    localStorage.setItem(STORAGE_PREFIX + btoa(encodeURIComponent(src)), String(t));
  } catch { /* storage unavailable */ }
}

function loadResume(src: string): number {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + btoa(encodeURIComponent(src)));
    return v ? parseFloat(v) : 0;
  } catch {
    return 0;
  }
}

// ─── Component Props ──────────────────────────────────────────────────────────

interface VideoPlayerProps {
  videoSrc?: string;
  poster?: string;
  accentColor?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  hideDelay?: number;
  borderRadius?: number;
  controlRadius?: number;
  buttonRadius?: number;
  buttonPadding?: number;
  showVolumeControl?: boolean;
  showMobileCenterButton?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoPlayer({
  videoSrc = "",
  poster = "",
  accentColor = "#FF5733",
  autoplay = false,
  loop = false,
  muted: initialMuted = false,
  hideDelay = 3000,
  borderRadius = 16,
  controlRadius = 999,
  buttonRadius = 999,
  buttonPadding = 12,
  showVolumeControl = true,
  showMobileCenterButton = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const seekingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // ── Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Restore saved position
  useEffect(() => {
    if (!videoSrc) return;
    const saved = loadResume(videoSrc);
    if (saved > 0 && videoRef.current) videoRef.current.currentTime = saved;
  }, [videoSrc]);

  // ── Autoplay
  useEffect(() => {
    if (autoplay && videoRef.current) videoRef.current.play().catch(() => {});
  }, [autoplay, videoSrc]);

  // ── Auto-pause when scrolled offscreen
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) video.pause(); },
      { threshold: 0.2 }
    );
    obs.observe(video);
    return () => obs.disconnect();
  }, []);

  // ── Controls auto-hide
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, hideDelay);
  }, [hideDelay]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  // Always show controls when paused
  useEffect(() => {
    if (!playing) setShowControls(true);
  }, [playing]);

  // ── Video event callbacks
  const handleTimeUpdate = useCallback(() => {
    if (seekingRef.current || !videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    if (videoSrc) saveResume(videoSrc, t);
  }, [videoSrc]);

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    const saved = loadResume(videoSrc);
    if (saved > 0) videoRef.current.currentTime = saved;
  }, [videoSrc]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    if (!loop && videoSrc) saveResume(videoSrc, 0);
  }, [loop, videoSrc]);

  // ── Play / Pause
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    resetHideTimer();
  }, [resetHideTimer]);

  // ── Mute
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  // ── Volume level setter
  const applyVolume = useCallback((pct: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, pct));
    v.volume = clamped;
    setVolume(clamped);
    v.muted = clamped === 0;
    setMuted(clamped === 0);
  }, []);

  // ── Progress bar drag
  const pctFromProgressEvent = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      return (clientX - rect.left) / rect.width;
    },
    []
  );

  const seekToPct = useCallback(
    (pct: number) => {
      const v = videoRef.current;
      if (!v || !duration) return;
      const t = Math.max(0, Math.min(1, pct)) * duration;
      v.currentTime = t;
      setCurrentTime(t);
    },
    [duration]
  );

  const handleProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      seekingRef.current = true;
      setIsDraggingProgress(true);
      seekToPct(pctFromProgressEvent(e.clientX));
    },
    [seekToPct, pctFromProgressEvent]
  );

  const handleProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingProgress) return;
      seekToPct(pctFromProgressEvent(e.clientX));
    },
    [isDraggingProgress, seekToPct, pctFromProgressEvent]
  );

  const handleProgressPointerUp = useCallback(() => {
    seekingRef.current = false;
    setIsDraggingProgress(false);
  }, []);

  // ── Volume slider drag (vertical)
  const pctFromVolumeEvent = useCallback((clientY: number) => {
    const bar = volumeTrackRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    // Top = 100%, bottom = 0%
    return 1 - (clientY - rect.top) / rect.height;
  }, []);

  const handleVolumePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingVolume(true);
      applyVolume(pctFromVolumeEvent(e.clientY));
    },
    [applyVolume, pctFromVolumeEvent]
  );

  const handleVolumePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingVolume) return;
      applyVolume(pctFromVolumeEvent(e.clientY));
    },
    [isDraggingVolume, applyVolume, pctFromVolumeEvent]
  );

  const handleVolumePointerUp = useCallback(() => {
    setIsDraggingVolume(false);
  }, []);

  // ── Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const v = videoRef.current;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (v) { v.currentTime = Math.max(0, v.currentTime - 5); setCurrentTime(v.currentTime); }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (v) { v.currentTime = Math.min(duration, v.currentTime + 5); setCurrentTime(v.currentTime); }
          break;
        case "ArrowUp":
          e.preventDefault();
          applyVolume(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          applyVolume(volume - 0.1);
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "f":
        case "F":
          if (containerRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else containerRef.current.requestFullscreen?.();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, applyVolume, volume, duration]);

  // ── Derived values
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolumePct = muted ? 0 : volume * 100;
  const controlsVisible = showControls || !playing;

  // ── Styles (memoised to avoid object churn)
  const styles = useMemo(() => ({
    container: {
      position: "relative",
      width: "100%",
      height: "100%",
      borderRadius,
      overflow: "hidden",
      background: "#000",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
      userSelect: "none",
    } as React.CSSProperties,

    video: {
      width: "100%",
      height: "100%",
      display: "block",
      objectFit: "cover",
      cursor: "pointer",
    } as React.CSSProperties,

    // Invisible full-area layer to catch mouse-move for hide-timer without blocking video click
    interactionLayer: {
      position: "absolute",
      inset: 0,
      zIndex: 1,
    } as React.CSSProperties,

    // Bottom controls overlay
    overlay: {
      position: "absolute",
      inset: 0,
      zIndex: 2,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 20,
      transition: "opacity 0.3s ease",
      opacity: controlsVisible ? 1 : 0,
      pointerEvents: controlsVisible ? "auto" : "none",
    } as React.CSSProperties,

    controlBar: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderRadius: controlRadius,
      padding: "8px 16px 8px 8px",
      boxShadow: "0 4px 28px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.08)",
      width: "calc(100% - 48px)",
      maxWidth: 880,
      boxSizing: "border-box",
    } as React.CSSProperties,

    playBtn: {
      width: 44,
      height: 44,
      borderRadius: buttonRadius,
      border: "none",
      background: "rgba(220,220,220,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
      padding: buttonPadding,
      transition: "background 0.15s",
      outline: "none",
    } as React.CSSProperties,

    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      background: "rgba(0,0,0,0.1)",
      cursor: "pointer",
      position: "relative",
      touchAction: "none",
    } as React.CSSProperties,

    volumeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: "none",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
      padding: 0,
      color: "#555",
      outline: "none",
      position: "relative",
    } as React.CSSProperties,

    timeDisplay: {
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: "-0.2px",
      whiteSpace: "nowrap",
      flexShrink: 0,
      color: "#333",
    } as React.CSSProperties,

    // Vertical volume slider pill
    volumePill: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      width: 36,
      height: 110,
      borderRadius: 999,
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 0",
      boxSizing: "border-box",
      zIndex: 30,
    } as React.CSSProperties,

    volumeTrack: {
      width: 6,
      height: "100%",
      borderRadius: 999,
      background: "rgba(0,0,0,0.08)",
      position: "relative",
      cursor: "pointer",
      touchAction: "none",
      overflow: "hidden",
    } as React.CSSProperties,

    centerPlayBtn: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 72,
      height: 72,
      borderRadius: "50%",
      border: "none",
      background: "rgba(255,255,255,0.9)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      zIndex: 5,
      boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
      outline: "none",
    } as React.CSSProperties,
  }), [
    borderRadius, controlRadius, buttonRadius, buttonPadding,
    controlsVisible,
  ]);

  return (
    <div
      ref={containerRef}
      style={styles.container}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={videoSrc || undefined}
        poster={poster || undefined}
        loop={loop}
        muted={muted}
        playsInline
        style={styles.video}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        onClick={togglePlay}
      />

      {/* Mobile center play button */}
      {isMobile && showMobileCenterButton && !playing && (
        <button style={styles.centerPlayBtn} onClick={togglePlay} aria-label="Play">
          <SvgIcon name="play" size={30} color="#1a1a1a" />
        </button>
      )}

      {/* Controls overlay */}
      <div style={styles.overlay}>
        <div style={styles.controlBar}>

          {/* Play / Pause — hide on mobile (center button handles it) */}
          {!isMobile && (
            <button
              style={styles.playBtn}
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
            >
              <SvgIcon name={playing ? "pause" : "play"} size={18} color="#1a1a1a" />
            </button>
          )}

          {/* Progress bar */}
          <div
            ref={progressBarRef}
            style={styles.progressTrack}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            aria-label="Seek"
            role="slider"
            aria-valuenow={Math.round(progressPct)}
          >
            {/* Fill */}
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})`,
                transition: isDraggingProgress ? "none" : "width 0.08s linear",
                pointerEvents: "none",
              }}
            />
            {/* Thumb */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${progressPct}%`,
                transform: "translate(-50%, -50%)",
                width: isDraggingProgress ? 14 : 10,
                height: isDraggingProgress ? 14 : 10,
                borderRadius: "50%",
                background: accentColor,
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                transition: isDraggingProgress
                  ? "none"
                  : "left 0.08s linear, width 0.12s, height 0.12s",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Volume control */}
          {showVolumeControl && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              {/* Floating vertical slider — desktop hover, mobile tap */}
              {showVolumeSlider && (
                <div
                  style={styles.volumePill}
                  onMouseEnter={() => !isMobile && setShowVolumeSlider(true)}
                  onMouseLeave={() => !isMobile && setShowVolumeSlider(false)}
                >
                  <div
                    ref={volumeTrackRef}
                    style={styles.volumeTrack}
                    onPointerDown={handleVolumePointerDown}
                    onPointerMove={handleVolumePointerMove}
                    onPointerUp={handleVolumePointerUp}
                  >
                    {/* Fill (bottom-up) */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "100%",
                        height: `${effectiveVolumePct}%`,
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${accentColor}, ${accentColor}bb)`,
                        transition: isDraggingVolume ? "none" : "height 0.12s",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Speaker button */}
              <button
                style={styles.volumeBtn}
                onClick={isMobile ? () => setShowVolumeSlider((v) => !v) : toggleMute}
                onMouseEnter={() => { if (!isMobile) setShowVolumeSlider(true); }}
                onMouseLeave={() => { if (!isMobile) setShowVolumeSlider(false); }}
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
              >
                <SvgIcon
                  name={muted || volume === 0 ? "mute" : "volume"}
                  size={20}
                  color="#555"
                />
              </button>
            </div>
          )}

          {/* Time */}
          <div style={styles.timeDisplay}>
            <span style={{ fontWeight: 600 }}>{formatTime(currentTime)}</span>
            <span style={{ color: "#999", fontWeight: 400 }}> / {formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Framer Property Controls ─────────────────────────────────────────────────

addPropertyControls(VideoPlayer, {
  videoSrc: {
    type: ControlType.File,
    title: "Video",
    allowedFileTypes: ["mp4", "webm", "ogg", "mov"],
  },
  poster: {
    type: ControlType.Image,
    title: "Poster",
  },
  accentColor: {
    type: ControlType.Color,
    title: "Accent Color",
    defaultValue: "#FF5733",
  },
  autoplay: {
    type: ControlType.Boolean,
    title: "Autoplay",
    defaultValue: false,
    enabledTitle: "On",
    disabledTitle: "Off",
  },
  loop: {
    type: ControlType.Boolean,
    title: "Loop",
    defaultValue: false,
    enabledTitle: "On",
    disabledTitle: "Off",
  },
  muted: {
    type: ControlType.Boolean,
    title: "Start Muted",
    defaultValue: false,
    enabledTitle: "Yes",
    disabledTitle: "No",
  },
  hideDelay: {
    type: ControlType.Number,
    title: "Hide Delay (ms)",
    defaultValue: 3000,
    min: 500,
    max: 10000,
    step: 100,
    displayStepper: true,
  },
  borderRadius: {
    type: ControlType.Number,
    title: "Border Radius",
    defaultValue: 16,
    min: 0,
    max: 64,
  },
  controlRadius: {
    type: ControlType.Number,
    title: "Bar Radius",
    defaultValue: 999,
    min: 0,
    max: 999,
  },
  buttonRadius: {
    type: ControlType.Number,
    title: "Button Radius",
    defaultValue: 999,
    min: 0,
    max: 999,
  },
  buttonPadding: {
    type: ControlType.Number,
    title: "Button Padding",
    defaultValue: 12,
    min: 4,
    max: 24,
  },
  showVolumeControl: {
    type: ControlType.Boolean,
    title: "Volume Control",
    defaultValue: true,
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
  showMobileCenterButton: {
    type: ControlType.Boolean,
    title: "Mobile Play Button",
    defaultValue: true,
    enabledTitle: "Show",
    disabledTitle: "Hide",
  },
});
