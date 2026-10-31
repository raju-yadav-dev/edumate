/**
 * VoiceUIComponent.jsx
 * Premium AI Receptionist Voice Panel with Animated Avatar SVG
 * and Live Canvas-based Audio Waveform Visualizer.
 */

import { useEffect, useRef, useState } from "react";
import { 
    FiX, FiVolume2, FiVolumeX, FiRefreshCw, FiMic, FiMicOff, FiGlobe, 
    FiCheck, FiSmile, FiAlertCircle, FiSquare 
} from "react-icons/fi";
import AudioAnalyserService from "../../services/voice/AudioAnalyserService";
import "./Voice.css";

// Helper to format conversation timer
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function VoiceUIComponent({
    voiceState,
    transcript,
    elapsedSeconds,
    activeLang,
    isMuted,
    isContinuousMode,
    startListening,
    stopListening,
    stopResponse,
    stopConversation,
    toggleMute,
    setLanguage,
    replayResponse,
    userInterruption
}) {
    const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
    const canvasRef = useRef(null);

    const isMicActive = (voiceState === "listening" || voiceState === "user_speaking" || voiceState === "waiting_for_silence");

    // Auto-close dropdown when active language changes
    useEffect(() => {
        setIsLangDropdownOpen(false);
    }, [activeLang]);

    // Global keyboard listener for Spacebar to trigger interruption while speaking
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === "Space" && voiceState === "speaking") {
                const tag = event.target.tagName.toLowerCase();
                if (tag === "input" || tag === "textarea") {
                    return;
                }
                event.preventDefault(); // Prevent page scrolling
                console.log("[VoiceUI] Spacebar pressed, interrupting speaking...");
                userInterruption();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [voiceState, userInterruption]);

    // Live Canvas Waveform Draw Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        let animationFrameId;
        let phase = 0;

        const resizeCanvas = () => {
            canvas.width = canvas.parentElement.clientWidth || 320;
            canvas.height = canvas.parentElement.clientHeight || 100;
        };
        
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            const isRecording = (voiceState === "listening" || voiceState === "user_speaking" || voiceState === "waiting_for_silence");

            if (isRecording) {
                // Real-time Mic Waveform Analysis
                const data = AudioAnalyserService.getWaveformData();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#10b981"; // Green Wave
                ctx.shadowBlur = 10;
                ctx.shadowColor = "rgba(16, 185, 129, 0.4)";
                ctx.beginPath();

                if (data && AudioAnalyserService.isAnalysing) {
                    const sliceWidth = width / data.length;
                    let x = 0;

                    for (let i = 0; i < data.length; i++) {
                        const v = data[i] / 128.0; // 0..2
                        const y = (v * height) / 2;

                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                        x += sliceWidth;
                    }
                    ctx.lineTo(width, centerY);
                } else {
                    // Fallback animated sine wave for listening state
                    phase += 0.08;
                    for (let x = 0; x < width; x++) {
                        const edgeClamp = Math.sin(x * Math.PI / width);
                        const y = centerY + Math.sin(x * 0.04 + phase) * 14 * edgeClamp;
                        if (x === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

            } else if (voiceState === "speaking") {
                // Energetic Blue Speech Wave
                phase += 0.12;
                ctx.shadowBlur = 12;
                ctx.shadowColor = "rgba(59, 130, 246, 0.5)";
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#38bdf8";
                ctx.beginPath();

                for (let x = 0; x < width; x++) {
                    const edgeClamp = Math.sin(x * Math.PI / width);
                    const y = centerY + Math.sin(x * 0.03 + phase) * Math.cos(x * 0.015 + phase) * 22 * edgeClamp;
                    
                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

            } else if (voiceState === "thinking" || voiceState === "searching_knowledge_base" || voiceState === "building_context" || voiceState === "generating_response") {
                // Pulsating Yellow Amber loader line
                phase += 0.06;
                ctx.shadowBlur = 8;
                ctx.shadowColor = "rgba(245, 158, 11, 0.3)";
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = "#fbbf24";
                ctx.beginPath();

                for (let x = 0; x < width; x++) {
                    const edgeClamp = Math.sin(x * Math.PI / width);
                    const y = centerY + Math.sin(x * 0.015 + phase) * 8 * edgeClamp;
                    
                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();

            } else {
                // Neutral flat line
                ctx.shadowBlur = 0;
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.stroke();
            }

            // Restore canvas settings
            ctx.shadowBlur = 0;
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", resizeCanvas);
        };
    }, [voiceState]);

    if (voiceState === "idle" && !isContinuousMode) {
        return null;
    }

    const isGeneratingOrSpeaking = 
        voiceState === "searching_knowledge_base" || 
        voiceState === "building_context" || 
        voiceState === "generating_response" || 
        voiceState === "speaking" || 
        voiceState === "thinking" || 
        voiceState === "processing_speech";

    // Determine Avatar Emotion State based on Voice State & Transcript content
    let emotion = "happy"; // default
    if (voiceState === "thinking" || voiceState === "waiting_for_silence" || voiceState === "searching_knowledge_base" || voiceState === "building_context" || voiceState === "processing_speech") {
        emotion = "thinking";
    } else if (voiceState === "listening" || voiceState === "user_speaking") {
        emotion = "listening";
    } else if (voiceState === "speaking" || voiceState === "generating_response") {
        emotion = "speaking";
    } else if (voiceState === "paused") {
        emotion = "neutral";
    } else if (voiceState === "permission_denied" || voiceState === "error") {
        emotion = "error";
    }

    // Detect error signals inside transcript
    if (transcript.text && (transcript.text.toLowerCase().includes("error:") || transcript.text.toLowerCase().includes("unavailable"))) {
        emotion = "error";
    }

    const stateLabels = {
        idle: "Ready",
        listening: "Listening...",
        user_speaking: "Speaking...",
        processing_speech: "Processing Speech...",
        waiting_for_silence: "Processing Speech...",
        searching_knowledge_base: "Searching Knowledge Base...",
        building_context: "Building Context...",
        generating_response: "Generating Response...",
        thinking: "Generating Response...",
        speaking: "Speaking...",
        completed: "Completed",
        error: "Error",
        paused: "Paused",
        permission_denied: "Mic Permission Required",
        not_supported: "Browser Not Supported",
        interrupted: "Interrupted",
        ended: "Goodbye!"
    };

    const stateClasses = {
        idle: "state-idle",
        listening: "state-listening",
        user_speaking: "state-listening",
        processing_speech: "state-thinking",
        waiting_for_silence: "state-thinking",
        searching_knowledge_base: "state-thinking",
        building_context: "state-thinking",
        generating_response: "state-speaking",
        thinking: "state-thinking",
        speaking: "state-speaking",
        completed: "state-completed",
        error: "state-permission_denied",
        paused: "state-paused",
        permission_denied: "state-permission_denied",
        not_supported: "state-permission_denied",
        interrupted: "state-ended",
        ended: "state-ended"
    };

    // SVG Eyebrow and Mouth configurations based on Avatar Emotion
    const eyebrowD = {
        happy: { left: "M 34 38 L 44 38", right: "M 56 38 L 66 38" },
        neutral: { left: "M 34 38 L 44 38", right: "M 56 38 L 66 38" },
        listening: { left: "M 33 36 L 43 36", right: "M 57 36 L 67 36" },
        thinking: { left: "M 34 38 L 44 38", right: "M 56 34 L 66 30" }, // Raised right eyebrow
        error: { left: "M 34 35 L 43 39", right: "M 57 39 L 66 35" } // Angled down frown
    };

    const mouthD = {
        happy: "M 40 62 Q 50 72 60 62", // Smile curve
        neutral: "M 42 66 Q 50 66 58 66", // Flat line
        listening: "M 43 65 Q 50 74 57 65", // Oval circle smile
        thinking: "M 42 66 L 58 66", // Flat straight line
        speaking: "M 40 65 Q 50 65 60 65", // Animates via CSS speak scale keyframe
        error: "M 40 68 Q 50 58 60 68" // Downward frown curve
    };

    const activeMouthPath = mouthD[emotion] || mouthD.neutral;
    const activeLeftEyebrow = eyebrowD[emotion]?.left || eyebrowD.neutral.left;
    const activeRightEyebrow = eyebrowD[emotion]?.right || eyebrowD.neutral.right;

    return (
        <div className={`edu-voice-overlay ${stateClasses[voiceState] || "state-idle"}`} onClick={voiceState === "speaking" ? userInterruption : undefined}>
            <div className="edu-voice-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <header className="edu-voice-header">
                    <div className="edu-voice-timer-wrapper">
                        <span className="timer-dot"></span>
                        <span className="timer-text">{formatTime(elapsedSeconds)}</span>
                    </div>

                    <div className="edu-voice-lang-selector">
                        <button
                            type="button"
                            className="lang-select-btn"
                            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                            title="Select Language"
                        >
                            <FiGlobe className="icon" />
                            <span>
                                {activeLang === "en" ? "English" : activeLang === "hi" ? "हिंदी" : "বাংলা"}
                            </span>
                        </button>

                        {isLangDropdownOpen && (
                            <ul className="lang-dropdown-menu">
                                <li>
                                    <button type="button" onClick={() => setLanguage("en")}>
                                        English
                                    </button>
                                </li>
                                <li>
                                    <button type="button" onClick={() => setLanguage("hi")}>
                                        हिंदी (Hindi)
                                    </button>
                                </li>
                                <li>
                                    <button type="button" onClick={() => setLanguage("bn")}>
                                        বাংলা (Bengali)
                                    </button>
                                </li>
                            </ul>
                        )}
                    </div>

                    <button
                        type="button"
                        className="edu-voice-close-btn"
                        onClick={stopConversation}
                        title="Close Voice Assistant"
                    >
                        <FiX />
                    </button>
                </header>

                {/* Main Visualizer & Avatar Area */}
                <main className="edu-voice-body">
                    {/* SVG Avatar Element */}
                    <div className={`avatar-container emotion-${emotion} state-${voiceState}`}>
                        <svg className="avatar-svg" viewBox="0 0 100 100" width="120" height="120">
                            <defs>
                                <radialGradient id="headGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="var(--avatar-color-glow)" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="var(--avatar-color-glow)" stopOpacity="0" />
                                </radialGradient>
                                <linearGradient id="headPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#1e293b" />
                                    <stop offset="100%" stopColor="#0f172a" />
                                </linearGradient>
                                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>

                            {/* Outer Glow Halo Ring */}
                            <circle cx="50" cy="50" r="46" fill="url(#headGlow)" className="avatar-halo-glow" />
                            <circle 
                                cx="50" 
                                cy="50" 
                                r="40" 
                                fill="none" 
                                stroke="var(--avatar-color-stroke)" 
                                strokeWidth="1.5" 
                                className="avatar-shield-ring"
                                strokeDasharray={voiceState === "thinking" ? "5 5" : "none"}
                            />

                            {/* Head Plate */}
                            <circle cx="50" cy="50" r="34" fill="url(#headPlate)" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />

                            {/* Ears glowing pulses */}
                            <path d="M 12 45 Q 8 50 12 55" stroke="var(--avatar-color-stroke)" strokeWidth="2" fill="none" className="avatar-ear-signal left" />
                            <path d="M 88 45 Q 92 50 88 55" stroke="var(--avatar-color-stroke)" strokeWidth="2" fill="none" className="avatar-ear-signal right" />

                            {/* Facial Features Group */}
                            <g className="avatar-face-features">
                                {/* Eyebrows */}
                                <path d={activeLeftEyebrow} stroke="var(--avatar-color-face)" strokeWidth="2.5" strokeLinecap="round" fill="none" className="avatar-eyebrow eyebrow-left" />
                                <path d={activeRightEyebrow} stroke="var(--avatar-color-face)" strokeWidth="2.5" strokeLinecap="round" fill="none" className="avatar-eyebrow eyebrow-right" />

                                {/* Eyes (with blinking logic) */}
                                <ellipse cx="38" cy="46" rx="4.5" ry={emotion === "thinking" ? "2.5" : "4.5"} fill="var(--avatar-color-face)" className="avatar-eye eye-left" filter="url(#glowEffect)" />
                                <ellipse cx="62" cy="46" rx="4.5" ry={emotion === "thinking" ? "2.5" : "4.5"} fill="var(--avatar-color-face)" className="avatar-eye eye-right" filter="url(#glowEffect)" />

                                {/* Cheek Blush (Happy state detail) */}
                                {emotion === "happy" && (
                                    <>
                                        <circle cx="28" cy="54" r="2.5" fill="rgba(239, 68, 68, 0.25)" />
                                        <circle cx="72" cy="54" r="2.5" fill="rgba(239, 68, 68, 0.25)" />
                                    </>
                                )}

                                {/* Mouth (with lip sync speech scale filter) */}
                                <path 
                                    d={activeMouthPath} 
                                    stroke="var(--avatar-color-face)" 
                                    strokeWidth="3.5" 
                                    strokeLinecap="round" 
                                    fill="none" 
                                    className={`avatar-mouth ${voiceState === "speaking" ? "avatar-mouth-speaking" : ""}`}
                                    filter="url(#glowEffect)"
                                />
                            </g>
                        </svg>
                    </div>

                    <div className="status-label">{stateLabels[voiceState] || "Ready"}</div>

                    {/* Microphone Permission Warning Banner */}
                    {voiceState === "permission_denied" && (
                        <div className="voice-permission-banner">
                            <FiAlertCircle className="icon text-red-400 text-xl" />
                            <p>Microphone access was blocked. Please enable microphone permission in your browser address bar to talk with EduMate.</p>
                            {startListening && (
                                <button type="button" className="voice-permission-retry-btn" onClick={startListening}>
                                    Try Again
                                </button>
                            )}
                        </div>
                    )}

                    {voiceState === "not_supported" && (
                        <div className="voice-permission-banner">
                            <FiAlertCircle className="icon text-amber-400 text-xl" />
                            <p>Speech recognition is not supported in this browser (Zen / Firefox). Please open EduMate in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Brave</strong> to talk with EduMate.</p>
                        </div>
                    )}

                    {/* Canvas Live Waveform Visualizer */}
                    <div className="canvas-visualizer-wrapper">
                        <canvas ref={canvasRef} className="voice-canvas-line"></canvas>
                    </div>

                    {/* Live Transcript / Speech Bubble */}
                    <div className="edu-voice-transcript-wrapper">
                        {transcript.text ? (
                            <p className={`transcript-text ${transcript.isFinal ? "is-final" : "is-interim"}`}>
                                "{transcript.text}"
                            </p>
                        ) : (
                            <p className="transcript-placeholder">
                                 {isMicActive ? "Listening to your voice..." : "Waiting..."}
                            </p>
                        )}
                    </div>

                    {/* Device Status indicators */}
                    <div className="voice-device-status-row">
                        <span className={`status-badge ${isMicActive ? "is-active" : ""}`}>
                            {isMicActive ? <FiMic className="icon text-green-400" /> : <FiMicOff className="icon" />}
                            <small>{isMicActive ? "Mic Active" : "Mic Muted"}</small>
                        </span>
                        <span className={`status-badge ${!isMuted ? "is-active" : ""}`}>
                            {isMuted ? <FiVolumeX className="icon" /> : <FiVolume2 className="icon text-blue-400" />}
                            <small>{isMuted ? "Speaker Off" : "Speaker On"}</small>
                        </span>
                    </div>
                </main>

                {/* Footer Action Bar */}
                <footer className="edu-voice-footer">
                    <button
                        type="button"
                        className={`action-btn ${isMuted ? "is-active" : ""}`}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Speaker" : "Mute Speaker"}
                    >
                        {isMuted ? <FiVolumeX /> : <FiVolume2 />}
                    </button>

                    {/* Start / Stop Listening Controls */}
                    {isMicActive ? (
                        <button
                            type="button"
                            className="listening-toggle-btn is-listening"
                            onClick={stopListening}
                            title="Pause Listening"
                        >
                            <FiMicOff /> Stop
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="listening-toggle-btn is-stopped"
                            onClick={startListening}
                            title="Start Listening"
                        >
                            <FiMic /> Listen
                        </button>
                    )}

                    {isGeneratingOrSpeaking && (
                        <button
                            type="button"
                            className="action-btn stop-response-btn"
                            onClick={stopResponse}
                            title="Stop Response"
                            style={{
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.3)"
                            }}
                        >
                            <FiSquare style={{ fill: "currentColor" }} />
                        </button>
                    )}

                    <button
                        type="button"
                        className="action-btn"
                        onClick={replayResponse}
                        disabled={isGeneratingOrSpeaking || voiceState === "listening"}
                        title="Replay Response"
                    >
                        <FiRefreshCw />
                    </button>
                    
                    <button
                        type="button"
                        className="action-btn stop-session-btn"
                        onClick={stopConversation}
                        title="End Session"
                    >
                        End
                    </button>
                </footer>
            </div>
        </div>
    );
}
