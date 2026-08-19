/**
 * SpeechRecognitionService.js
 * Service wrapper for browser-native SpeechRecognition / webkitSpeechRecognition API.
 */

const SpeechRecognition = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

class SpeechRecognitionService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.silenceTimer = null;
        this.silenceTimeoutMs = 1200; // Time of silence before triggering submission
        this.onResultCallback = null;
        this.onSilenceCallback = null;
        this.onErrorCallback = null;
        this.onEndCallback = null;
        this.activeLang = "en-US";
        this.hasSpeechDetected = false;
        this.hasFinalResult = false;
        this.sessionTranscript = "";
        this.mode = "normal";
        this.interruptionRestartTimer = null;
        this.onInterruptionCandidateCallback = null;
    }

    /**
     * Checks if Speech Recognition is supported in the browser.
     * @returns {boolean}
     */
    isSupported() {
        return !!SpeechRecognition;
    }

    /**
     * Initialize Speech Recognition instance.
     */
    init() {
        if (!this.isSupported()) {
            console.error("Speech Recognition is not supported by this browser.");
            return false;
        }

        if (this.recognition) {
            return true;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // We use false and control restart loop manually for stability
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = this.activeLang;

        recognition.onstart = () => {
            this.isListening = true;
            this.hasSpeechDetected = false;
            this.hasFinalResult = false;
            this.sessionTranscript = "";
        };

        recognition.onresult = (event) => {
            this.hasSpeechDetected = true;
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            if (finalTranscript) {
                this.hasFinalResult = true;
                this.sessionTranscript = `${this.sessionTranscript} ${finalTranscript}`.trim();
            }

            const currentTranscript = `${this.sessionTranscript}${interimTranscript ? ` ${interimTranscript}` : ""}`.trim();

            if (this.mode === "interruption") {
                this.clearSilenceTimer();
                this.silenceTimer = setTimeout(() => {
                    if (this.mode !== "interruption" || !this.isListening) return;
                    const candidate = currentTranscript.trim();
                    if (candidate && this.onInterruptionCandidateCallback) {
                        this.onInterruptionCandidateCallback(candidate);
                    }
                    // Reset the recognition session after evaluating the candidate.
                    this.stop();
                }, 700);
                return;
            }

            if (this.onResultCallback) {
                this.onResultCallback(currentTranscript, !!finalTranscript);
            }

            // Only arm end-of-speech after actual speech is detected.
            this.resetSilenceTimer();
        };

        recognition.onerror = (event) => {
            console.warn("Speech Recognition Error:", event.error);
            if (this.onErrorCallback) {
                this.onErrorCallback(event.error);
            }
        };

        recognition.onend = () => {
            this.isListening = false;
            this.clearSilenceTimer();

            const transcript = String(this.sessionTranscript || "").trim();
            if (this.hasSpeechDetected && transcript.length >= 1 && this.onSilenceCallback) {
                this.onSilenceCallback(transcript);
            }
            this.hasSpeechDetected = false;
            this.hasFinalResult = false;
            this.sessionTranscript = "";

            if (this.onEndCallback) {
                this.onEndCallback();
            }
        };

        this.recognition = recognition;
        return true;
    }

    /**
     * Listen during TTS only for meaningful user interruptions.
     * Short/background speech is ignored by design.
     */
    startInterruptionMonitor({ lang, onCandidate, onError } = {}) {
        if (!this.recognition) {
            const ok = this.init();
            if (!ok) {
                if (onError) onError("not_supported");
                return;
            }
        }

        const proceedInterruption = () => {
            if (lang) {
                this.activeLang = lang;
                this.recognition.lang = lang;
            }

            this.mode = "interruption";
            this.onInterruptionCandidateCallback = onCandidate;
            this.onErrorCallback = onError;
            this.onResultCallback = null;
            this.onSilenceCallback = null;
            this.onEndCallback = () => {
                this.isListening = false;
                if (this.mode === "interruption") {
                    clearTimeout(this.interruptionRestartTimer);
                    this.interruptionRestartTimer = setTimeout(() => {
                        if (this.mode === "interruption") {
                            this.startInterruptionMonitor({ lang: this.activeLang, onCandidate: this.onInterruptionCandidateCallback, onError: this.onErrorCallback });
                        }
                    }, 120);
                }
            };

            try {
                this.recognition.start();
                this.isListening = true;
            } catch (err) {
                console.warn("[SpeechRecognitionService] Interruption start error:", err.message);
                if (err.name === "InvalidStateError" || err.message?.includes("already started")) {
                    try { this.recognition.abort(); } catch(e){}
                    this.isListening = false;
                    setTimeout(() => {
                        try {
                            this.recognition.start();
                            this.isListening = true;
                        } catch (retryErr) {
                            if (onError) onError(retryErr.message || "start_error");
                        }
                    }, 200);
                } else {
                    if (onError) onError(err.message || "start_error");
                }
            }
        };

        if (this.isListening) {
            const originalOnEnd = this.recognition.onend;
            this.recognition.onend = () => {
                this.isListening = false;
                this.recognition.onend = originalOnEnd;
                if (originalOnEnd) {
                    try { originalOnEnd(); } catch(e){}
                }
                proceedInterruption();
            };
            this.abort();
        } else {
            proceedInterruption();
        }
    }

    stopInterruptionMonitor() {
        this.mode = "normal";
        this.onInterruptionCandidateCallback = null;
        clearTimeout(this.interruptionRestartTimer);
        this.interruptionRestartTimer = null;
        this.abort();
    }

    /**
     * Start listening.
     * @param {Object} options
     * @param {string} options.lang - BCP 47 language code (e.g. en-US, hi-IN, bn-IN)
     * @param {Function} options.onResult - callback for results (text, isFinal)
     * @param {Function} options.onSilence - callback when user stops speaking
     * @param {Function} options.onError - callback on recognition errors
     * @param {Function} options.onEnd - callback when session ends
     */
    start({ lang, onResult, onSilence, onError, onEnd }) {
        if (!this.recognition) {
            const ok = this.init();
            if (!ok) {
                if (onError) onError("not_supported");
                return;
            }
        }

        const proceedStart = () => {
            if (lang) {
                this.activeLang = lang;
                this.recognition.lang = lang;
            }

            this.onResultCallback = onResult;
            this.onSilenceCallback = onSilence;
            this.onErrorCallback = onError;
            this.onEndCallback = onEnd;

            try {
                this.recognition.start();
                this.isListening = true;
            } catch (err) {
                console.error("[SpeechRecognitionService] Failed to start SpeechRecognition:", err);
                if (err.name === "InvalidStateError" || err.message?.includes("already started")) {
                    try { this.recognition.abort(); } catch(e){}
                    this.isListening = false;
                    setTimeout(() => {
                        try {
                            this.recognition.start();
                            this.isListening = true;
                        } catch (retryErr) {
                            console.error("[SpeechRecognitionService] Retry start failed:", retryErr);
                            if (onError) onError(retryErr.message || "start_error");
                        }
                    }, 200);
                } else {
                    if (onError) onError(err.message || "start_error");
                }
            }
        };

        if (this.isListening) {
            const originalOnEnd = this.recognition.onend;
            this.recognition.onend = () => {
                this.isListening = false;
                this.recognition.onend = originalOnEnd;
                if (originalOnEnd) {
                    try { originalOnEnd(); } catch(e){}
                }
                proceedStart();
            };
            this.abort();
        } else {
            proceedStart();
        }
    }

    /**
     * Stop listening.
     */
    stop() {
        this.clearSilenceTimer();
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (err) {
                console.warn("Error stopping SpeechRecognition:", err);
            }
        }
        this.isListening = false;
    }

    /**
     * Abort listening immediately.
     */
    abort() {
        this.clearSilenceTimer();
        if (this.recognition && this.isListening) {
            try {
                this.recognition.abort();
            } catch (err) {
                console.warn("Error aborting SpeechRecognition:", err);
            }
        }
        this.isListening = false;
    }

    /**
     * Reset the custom silence timer.
     */
    resetSilenceTimer() {
        this.clearSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.hasSpeechDetected) {
                console.log("[SpeechRecognitionService] Silence detected, finishing...");
                this.stop();
            }
        }, this.silenceTimeoutMs);
    }

    /**
     * Clear silence timer.
     */
    clearSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}

export default new SpeechRecognitionService();
