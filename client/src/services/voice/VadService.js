import { MicVAD } from "@ricky0123/vad-web";

class VadService {
    constructor() {
        this.vad = null;
        this.onSpeechStartCallback = null;
        this.isActive = false;
        this.fallbackAnalyser = null;
        this.fallbackStream = null;
        this.fallbackCtx = null;
    }

    /**
     * Initializes the Silero VAD engine or sets up native audio volume falls
     * @param {Function} onSpeechStart - Callback when speech is detected
     */
    async init(onSpeechStart) {
        this.onSpeechStartCallback = onSpeechStart;
        if (this.vad) return;

        try {
            console.log("[VadService] Initializing Silero VAD via @ricky0123/vad-web...");
            this.vad = await MicVAD.new({
                onSpeechStart: () => {
                    console.log("[VadService] Speech start detected by Silero VAD.");
                    if (this.isActive && this.onSpeechStartCallback) {
                        this.onSpeechStartCallback();
                    }
                },
                onSpeechEnd: () => {
                    // SpeechRecognition handles text extraction, so we just track starts
                }
            });
            console.log("[VadService] Silero VAD initialized successfully.");
        } catch (err) {
            console.warn("[VadService] ONNX runtime or silero model download failed. Loading Web Audio volume gate fallback:", err.message);
            await this.setupAudioGateFallback();
        }
    }

    /**
     * Web Audio decibel energy tracker fallback
     */
    async setupAudioGateFallback() {
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
                    // Conversational threshold average
                    if (average > 38) {
                        console.log("[VadService Fallback] Volume spike detected:", average);
                        if (this.onSpeechStartCallback) {
                            this.onSpeechStartCallback();
                        }
                    }
                }
                // Keep checking in frame loop
                requestAnimationFrame(checkVolume);
            };

            checkVolume();
            console.log("[VadService Fallback] Web Audio decibel tracker initialized.");
        } catch (err) {
            console.error("[VadService Fallback] Failed to access microphone for volume gate:", err.message);
        }
    }

    start() {
        this.isActive = true;
        if (this.vad) {
            this.vad.start();
        } else if (this.fallbackCtx && this.fallbackCtx.state === "suspended") {
            this.fallbackCtx.resume().catch(() => {});
        }
    }

    stop() {
        this.isActive = false;
        if (this.vad) {
            this.vad.pause();
        }
    }
}

export default new VadService();
