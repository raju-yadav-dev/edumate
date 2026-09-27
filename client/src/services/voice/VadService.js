/**
 * VadService.js
 * Voice Activity Detection with Noise Suppression, Echo Cancellation,
 * Background Noise Filtering, and Short Click/Spike Rejection.
 * 
 * EduMate Mission 8.4:
 * - Web Audio constraints: echoCancellation, noiseSuppression, autoGainControl.
 * - Noise Gate: Ignores low-volume background noise (< threshold).
 * - Click Rejection: Ignores keyboard clicks & momentary spikes (< 250ms).
 * - Automatic Silence Detection.
 */

class VadService {
    constructor() {
        this.vad = null;
        this.onSpeechStartCallback = null;
        this.onSpeechEndCallback = null;
        this.isActive = false;
        this.fallbackAnalyser = null;
        this.fallbackStream = null;
        this.fallbackCtx = null;

        // Noise gate & spike filter parameters
        this.noiseThreshold = 35; // Minimum conversational energy
        this.minSpeechDurationMs = 250; // Minimum duration to filter keyboard clicks
        this.speechStartTime = null;
        this.silenceStartTime = null;
        this.isSpeaking = false;
    }

    /**
     * Initializes the Silero VAD engine or sets up native audio volume fallback.
     * @param {Function} onSpeechStart - Callback when speech is detected
     * @param {Function} onSpeechEnd - Callback when speech ends / silence detected
     */
    async init(onSpeechStart, onSpeechEnd) {
        this.onSpeechStartCallback = onSpeechStart;
        this.onSpeechEndCallback = onSpeechEnd;
        if (this.vad) return;

        try {
            if (typeof window !== "undefined") {
                const vadMod = await import("@ricky0123/vad-web");
                if (vadMod && vadMod.MicVAD) {
                    console.log("[VadService] Initializing Silero VAD via @ricky0123/vad-web...");
                    this.vad = await vadMod.MicVAD.new({
                        onSpeechStart: () => {
                            console.log("[VadService] Speech start detected by Silero VAD.");
                            if (this.isActive && this.onSpeechStartCallback) {
                                this.onSpeechStartCallback();
                            }
                        },
                        onSpeechEnd: () => {
                            console.log("[VadService] Speech end detected by Silero VAD.");
                            if (this.isActive && this.onSpeechEndCallback) {
                                this.onSpeechEndCallback();
                            }
                        }
                    });
                    console.log("[VadService] Silero VAD initialized successfully.");
                    return;
                }
            }
        } catch (err) {
            console.warn("[VadService] Silero model unavailable. Initializing Web Audio noise-gate fallback:", err.message);
        }

        await this.setupAudioGateFallback();
    }

    /**
     * Web Audio decibel energy tracker with noise suppression and click filtering.
     */
    async setupAudioGateFallback() {
        if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

        try {
            this.fallbackStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.fallbackCtx = new AudioContextClass();
            const source = this.fallbackCtx.createMediaStreamSource(this.fallbackStream);
            this.fallbackAnalyser = this.fallbackCtx.createAnalyser();
            this.fallbackAnalyser.fftSize = 256;
            this.fallbackAnalyser.smoothingTimeConstant = 0.8; // Smooth out short noise spikes
            source.connect(this.fallbackAnalyser);

            const bufferLength = this.fallbackAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkVolume = () => {
                if (this.isActive && this.fallbackAnalyser) {
                    this.fallbackAnalyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    const now = Date.now();

                    // Check if volume exceeds conversation threshold (ignore background noise)
                    if (average > this.noiseThreshold) {
                        this.silenceStartTime = null;
                        if (!this.speechStartTime) {
                            this.speechStartTime = now;
                        } else if (now - this.speechStartTime >= this.minSpeechDurationMs && !this.isSpeaking) {
                            // Sustained speech detected (not a keyboard click or pop)
                            this.isSpeaking = true;
                            console.log("[VadService] Sustained human speech detected:", average.toFixed(1));
                            if (this.onSpeechStartCallback) {
                                this.onSpeechStartCallback();
                            }
                        }
                    } else {
                        // Below noise threshold
                        this.speechStartTime = null;
                        if (this.isSpeaking) {
                            if (!this.silenceStartTime) {
                                this.silenceStartTime = now;
                            } else if (now - this.silenceStartTime >= 1800) {
                                // 1.8s of silence detected
                                this.isSpeaking = false;
                                this.silenceStartTime = null;
                                console.log("[VadService] Silence threshold reached.");
                                if (this.onSpeechEndCallback) {
                                    this.onSpeechEndCallback();
                                }
                            }
                        }
                    }
                }

                if (this.isActive) {
                    requestAnimationFrame(checkVolume);
                }
            };

            checkVolume();
            console.log("[VadService Fallback] Web Audio decibel tracker initialized with noise suppression.");
        } catch (err) {
            console.error("[VadService Fallback] Failed to access microphone for volume gate:", err.message);
        }
    }

    start() {
        this.isActive = true;
        this.isSpeaking = false;
        this.speechStartTime = null;
        this.silenceStartTime = null;

        if (this.vad) {
            this.vad.start();
        } else if (this.fallbackCtx && this.fallbackCtx.state === "suspended") {
            this.fallbackCtx.resume().catch(() => {});
        }
    }

    stop() {
        this.isActive = false;
        this.isSpeaking = false;
        this.speechStartTime = null;
        this.silenceStartTime = null;

        if (this.vad) {
            this.vad.pause();
        }
    }
}

export default new VadService();
