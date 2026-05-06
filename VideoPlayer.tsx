import * as React from "react"
import { useRef, useState, useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

// ─── Icon System ──────────────────────────────────────────────────────────────
// Each entry is an array of path `d` strings — supports multi-path icons.
// To swap an icon, just replace the path here. Nothing else changes.

const ICONS: Record<string, string[]> = {
    play: [
        "M19.2645 13.516C19.4959 13.3368 19.6833 13.1071 19.8122 12.8443C19.9411 12.5815 20.0082 12.2927 20.0082 12C20.0082 11.7073 19.9411 11.4185 19.8122 11.1557C19.6833 10.8929 19.4959 10.6631 19.2645 10.484C16.2667 8.16515 12.9196 6.33706 9.34847 5.06798L8.69547 4.83599C7.44747 4.39299 6.12847 5.23699 5.95947 6.52599C5.48747 10.1601 5.48747 13.8399 5.95947 17.474C6.12947 18.763 7.44747 19.607 8.69547 19.164L9.34847 18.932C12.9196 17.6629 16.2667 15.8348 19.2645 13.516Z",
    ],
    pause: [
        "M6 5H10V19H6V5Z",
        "M14 5H18V19H14V5Z",
    ],
    volume: [
        "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
    ],
    mute: [
        "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z",
    ],
}

function Icon({ name, size = 22, color = "black" }: { name: string; size?: number; color?: string }) {
    const paths = ICONS[name] || []
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
            {paths.map((d, i) => <path key={i} d={d} fill={color} />)}
        </svg>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoPlayer(props) {
    const {
        videoSrc, poster, accent,
        buttonPadding, buttonRadius, borderRadius, ControlborderRadius,
        autoplay, loop, muted,
    } = props

    const videoRef       = useRef<HTMLVideoElement>(null)
    const containerRef   = useRef<HTMLDivElement>(null)
    const volumeTrackRef = useRef<HTMLDivElement>(null)
    const hideTimeout    = useRef<ReturnType<typeof setTimeout>>()
    const isDraggingVol  = useRef(false)

    const [isPlaying,        setIsPlaying]        = useState(false)
    const [progress,         setProgress]         = useState(0)
    const [duration,         setDuration]         = useState(0)
    const [currentTime,      setCurrentTime]      = useState(0)
    const [isSeeking,        setIsSeeking]        = useState(false)
    const [showControls,     setShowControls]     = useState(true)
    const [isMuted,          setIsMuted]          = useState(muted)
    const [volume,           setVolume]           = useState(1)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [containerWidth,   setContainerWidth]   = useState(580)

    // ── Responsive sizing — derived from the component's own rendered width.
    //    Same layout at every size, just proportionally smaller.
    //    Hide the time display only at very small sizes (<= 290px).
    const scale      = Math.min(1, Math.max(0.6, containerWidth / 560))
    const iconSize   = Math.round(scale * 22)
    const fontSize   = Math.round(scale * 15)
    const ctrlGap    = Math.round(scale * 16)
    const showTime   = containerWidth > 290

    // ── Watch container width
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // ================================
    // VIDEO EVENTS
    // ================================
    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const updateDuration = () => {
            if (!isNaN(video.duration) && video.duration !== Infinity)
                setDuration(video.duration)
        }
        const onTimeUpdate = () => {
            if (!video.duration || isNaN(video.duration) || isSeeking) return
            setCurrentTime(video.currentTime)
            setProgress((video.currentTime / video.duration) * 100)
        }
        const onEnded = () => setIsPlaying(false)

        video.addEventListener("loadedmetadata", updateDuration)
        video.addEventListener("durationchange",  updateDuration)
        video.addEventListener("timeupdate",      onTimeUpdate)
        video.addEventListener("ended",           onEnded)
        return () => {
            video.removeEventListener("loadedmetadata", updateDuration)
            video.removeEventListener("durationchange",  updateDuration)
            video.removeEventListener("timeupdate",      onTimeUpdate)
            video.removeEventListener("ended",           onEnded)
        }
    }, [isSeeking])

    // ================================
    // AUTOPLAY / LOOP / MUTED
    // ================================
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        video.loop  = loop
        video.muted = muted
        setIsMuted(muted)
        if (autoplay) {
            video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        }
    }, [autoplay, loop, muted])

    // ================================
    // RESUME PLAYBACK
    // ================================
    useEffect(() => {
        const video = videoRef.current
        if (!video || !videoSrc) return
        const saved = localStorage.getItem(videoSrc)
        if (saved) video.currentTime = Number(saved)
        const save = () => localStorage.setItem(videoSrc, String(video.currentTime))
        video.addEventListener("timeupdate", save)
        return () => video.removeEventListener("timeupdate", save)
    }, [videoSrc])

    // ================================
    // AUTO-HIDE CONTROLS
    // ================================
    const handleActivity = () => {
        setShowControls(true)
        clearTimeout(hideTimeout.current)
        hideTimeout.current = setTimeout(() => setShowControls(false), 2500)
    }

    // ================================
    // PLAY / PAUSE
    // ================================
    const toggle = () => {
        const video = videoRef.current
        if (!video) return
        if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        } else {
            video.pause()
            setIsPlaying(false)
        }
    }

    // ================================
    // SEEK
    // ================================
    const handleSeek = (clientX: number, rect: DOMRect) => {
        const video = videoRef.current
        if (!video || !duration) return
        const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        const time = pct * duration
        video.currentTime = time
        setCurrentTime(time)
        setProgress(pct * 100)
    }

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setIsSeeking(true)
        handleSeek(e.clientX, rect)
        const move = (ev: MouseEvent)  => handleSeek(ev.clientX, rect)
        const up   = ()                => { setIsSeeking(false); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up) }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup",   up)
    }

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setIsSeeking(true)
        handleSeek(e.touches[0].clientX, rect)
        const move = (ev: TouchEvent) => handleSeek(ev.touches[0].clientX, rect)
        const up   = ()               => { setIsSeeking(false); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up) }
        window.addEventListener("touchmove", move)
        window.addEventListener("touchend",  up)
    }

    // ================================
    // VOLUME
    // ================================
    const setVolumeLevel = (pct: number) => {
        const clamped = Math.max(0, Math.min(1, pct))
        const video   = videoRef.current
        if (video) { video.volume = clamped; video.muted = clamped === 0 }
        setVolume(clamped)
        setIsMuted(clamped === 0)
    }

    const volumeFromPointer = (clientY: number): number => {
        const track = volumeTrackRef.current
        if (!track) return volume
        const rect = track.getBoundingClientRect()
        return 1 - (clientY - rect.top) / rect.height
    }

    const toggleMute = () => {
        const video = videoRef.current
        if (!video) return
        video.muted = !video.muted
        setIsMuted(video.muted)
    }

    const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        isDraggingVol.current = true
        setVolumeLevel(volumeFromPointer(e.clientY))
    }
    const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingVol.current) return
        setVolumeLevel(volumeFromPointer(e.clientY))
    }
    const handleVolumePointerUp = () => { isDraggingVol.current = false }

    // ================================
    // KEYBOARD SHORTCUTS
    // ================================
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const video = videoRef.current
            if (!video) return
            if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return

            if (e.code === "Space")       { e.preventDefault(); toggle() }
            if (e.code === "ArrowRight")  video.currentTime = Math.min(video.currentTime + 5, duration)
            if (e.code === "ArrowLeft")   video.currentTime = Math.max(video.currentTime - 5, 0)
            if (e.code === "ArrowUp")     { e.preventDefault(); setVolumeLevel(video.volume + 0.1) }
            if (e.code === "ArrowDown")   { e.preventDefault(); setVolumeLevel(video.volume - 0.1) }
            if (e.key.toLowerCase() === "m") toggleMute()
            if (e.key.toLowerCase() === "f") {
                if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.()
                else document.exitFullscreen?.()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [duration])

    // ================================
    // AUTO-PAUSE OFFSCREEN
    // ================================
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) { video.pause(); setIsPlaying(false) }
        })
        observer.observe(video)
        return () => observer.disconnect()
    }, [])

    // ================================
    // FORMAT TIME
    // ================================
    const format = (t: number) => {
        if (!t || isNaN(t)) return "00:00"
        const m = Math.floor(t / 60)
        const s = Math.floor(t % 60)
        return `${m}:${s < 10 ? "0" : ""}${s}`
    }

    const effectiveVolPct = isMuted ? 0 : volume * 100

    // ── Pill button base style (shared by play + volume buttons)
    const pillBtn: React.CSSProperties = {
        display: "flex",
        padding: buttonPadding,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: buttonRadius,
        background: "rgba(245, 245, 245, 0.90)",
        cursor: "pointer",
        flexShrink: 0,
    }

    return (
        <div
            ref={containerRef}
            onMouseMove={handleActivity}
            onTouchStart={handleActivity}
            style={{ width: "100%", height: "100%", position: "relative", borderRadius, overflow: "hidden" }}
        >
            {/* VIDEO */}
            <video
                ref={videoRef}
                src={videoSrc}
                playsInline
                muted={muted}
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover", border: "none", outline: "none" }}
            />

            {/* POSTER */}
            {!isPlaying && poster && (
                <img
                    src={poster}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
            )}

            {/* CONTROLS */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    padding: 10,
                    alignItems: "center",
                    gap: ctrlGap,
                    borderRadius: ControlborderRadius,
                    background: "#FFF",
                    // Always fill available width, constrained to 600px max.
                    // Items inside scale via iconSize / fontSize / gap.
                    width: "calc(100% - 40px)",
                    maxWidth: 600,
                    boxSizing: "border-box",
                    opacity: showControls ? 1 : 0,
                    transition: "opacity 0.3s ease",
                }}
            >
                {/* PLAY */}
                <div onClick={toggle} style={pillBtn}>
                    <Icon name={isPlaying ? "pause" : "play"} size={iconSize} />
                </div>

                {/* PROGRESS */}
                <div
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                    style={{ flex: 1, height: 8, borderRadius: 999, background: "#F5F5F5", overflow: "hidden", cursor: "pointer" }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: accent,
                            transition: isSeeking ? "none" : "width 0.05s linear",
                        }}
                    />
                </div>

                {/* VOLUME — outer div owns the entire hover zone (pill + button)
                    so mousing between them never triggers a leave.
                    Transparent 8px bridge closes the gap at the bottom of the pill. */}
                <div
                    style={{ position: "relative", flexShrink: 0 }}
                    onMouseEnter={() => setShowVolumeSlider(true)}
                    onMouseLeave={() => setShowVolumeSlider(false)}
                >
                    {showVolumeSlider && (
                        <div
                            style={{
                                position: "absolute",
                                bottom: "calc(100% + 8px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: 32,
                                height: 100,
                                borderRadius: 999,
                                background: "#FFF",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "10px 0",
                                boxSizing: "border-box",
                                zIndex: 20,
                            }}
                        >
                            {/* Transparent bridge — fills the 8px gap so mouse-leave never fires mid-travel */}
                            <div style={{ position: "absolute", bottom: -8, left: 0, right: 0, height: 8 }} />

                            {/* Vertical track */}
                            <div
                                ref={volumeTrackRef}
                                onPointerDown={handleVolumePointerDown}
                                onPointerMove={handleVolumePointerMove}
                                onPointerUp={handleVolumePointerUp}
                                style={{
                                    width: 6,
                                    height: "100%",
                                    borderRadius: 999,
                                    background: "#F5F5F5",
                                    position: "relative",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    touchAction: "none",
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        width: "100%",
                                        height: `${effectiveVolPct}%`,
                                        borderRadius: 999,
                                        background: accent,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Speaker button — click mutes/unmutes, hover shows slider */}
                    <div onClick={toggleMute} style={pillBtn}>
                        <Icon name={isMuted || volume === 0 ? "mute" : "volume"} size={iconSize} />
                    </div>
                </div>

                {/* TIME — hidden below 290px container width */}
                {showTime && (
                    <div
                        style={{
                            alignSelf: "stretch",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 4,
                            padding: "0 10px",
                            borderRadius: buttonRadius,
                            border: "1px solid #FFF",
                            background: "rgba(245, 245, 245, 0.90)",
                            fontFamily: "General Sans, sans-serif",
                            fontSize,
                            fontWeight: 500,
                            letterSpacing: "-0.02em",
                            lineHeight: "120%",
                            boxSizing: "border-box",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ color: "#979797" }}>{format(currentTime)}</span>
                        <span style={{ color: "#979797" }}>/</span>
                        <span style={{ color: "#000" }}>{format(duration)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Framer Property Controls ─────────────────────────────────────────────────

addPropertyControls(VideoPlayer, {
    videoSrc: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "webm", "mov"],
    },
    poster: {
        type: ControlType.Image,
        title: "Poster",
    },
    accent: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#FF4806",
    },
    autoplay: {
        type: ControlType.Boolean,
        defaultValue: false,
    },
    loop: {
        type: ControlType.Boolean,
        defaultValue: false,
    },
    muted: {
        type: ControlType.Boolean,
        defaultValue: true,
    },
    buttonPadding: {
        type: ControlType.Number,
        defaultValue: 16,
        min: 8,
        max: 40,
    },
    buttonRadius: {
        type: ControlType.Number,
        defaultValue: 20,
        min: 0,
        max: 40,
    },
    borderRadius: {
        type: ControlType.Number,
        defaultValue: 24,
        min: 0,
        max: 40,
    },
    ControlborderRadius: {
        type: ControlType.Number,
        defaultValue: 32,
        min: 0,
        max: 40,
    },
})
