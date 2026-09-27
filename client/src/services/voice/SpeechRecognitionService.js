/**
 * SpeechRecognitionService.js
 * High-performance browser-native SpeechRecognition service with
 * low latency silence detection, multilingual support, entity preservation, and browser compatibility.
 * 
 * EduMate Mission 8.4:
 * - Low-latency speech recognition (< 2s silence timeout).
 * - Multilingual support (en-IN, hi-IN, bn-IN).
 * - Automatic technical entity preservation.
 * - Browser compatibility checks (Chrome, Edge, Brave).
 */

import LanguageDetectionService from "./LanguageDetectionService.js";

const SpeechRecognition = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

class SpeechRecognitionService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.silenceTimer = null;
        this.silenceTimeoutMs = 1800; // Target < 2s for fast voice response
        this.onResultCallback = null;
        this.onSilenceCallback = null;
        this.onErrorCallback = null;
        this.onEndCallback = null;
        this.activeLang = "en-IN";
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
        return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition || (typeof globalThis !== "undefined" && globalThis.SpeechRecognition));
    }

    /**
     * Returns browser support details.
     */
    getBrowserInfo() {
        if (typeof window === "undefined" || !navigator?.userAgent) {
            return { isSupported: false, browser: "unknown" };
        }

        const ua = navigator.userAgent;
        const isBrave = typeof navigator.brave !== "undefined" || (navigator.brave && typeof navigator.brave.isBrave === "function");
        const isEdge = ua.includes("Edg/");
        const isChrome = ua.includes("Chrome") && !isEdge;
        const isFirefox = ua.includes("Firefox");
        const isSafari = ua.includes("Safari") && !isChrome && !isEdge;

        let browserName = "Other";
        if (isBrave) browserName = "Brave";
        else if (isEdge) browserName = "Edge";
        else if (isChrome) browserName = "Chrome";
        else if (isFirefox) browserName = "Firefox";
        else if (isSafari) browserName = "Safari";

        return {
            isSupported: this.isSupported(),
            browser: browserName,
            recommendedBrowsers: ["Chrome", "Edge", "Brave"]
        };
    }

    /**
     * Initialize Speech Recognition instance.
     */
    init() {
        if (!this.isSupported()) {
            console.warn("[SpeechRecognitionService] Speech Recognition is not supported by this browser.");
            return false;
        }

        if (this.recognition) {
            return true;
        }

        const SpeechRecClass = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition || globalThis.SpeechRecognition) : (typeof globalThis !== "undefined" ? globalThis.SpeechRecognition : null);
        if (!SpeechRecClass) {
            return false;
        }

        const recognition = new SpeechRecClass();
        recognition.continuous = false; // We control restart loops for maximum stability
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

            let currentTranscript = `${this.sessionTranscript}${interimTranscript ? ` ${interimTranscript}` : ""}`.trim();

            // Preserve technical terms (e.g. CSS dept, BCA fees)
            currentTranscript = LanguageDetectionService.preserveTechnicalEntities(currentTranscript);

            if (this.mode === "interruption") {
                this.clearSilenceTimer();
                this.silenceTimer = setTimeout(() => {
                    if (this.mode !== "interruption" || !this.isListening) return;
                    const candidate = currentTranscript.trim();
                    if (candidate && this.onInterruptionCandidateCallback) {
                        this.onInterruptionCandidateCallback(candidate);
                    }
                    this.stop();
                }, 500);
                return;
            }

            if (this.onResultCallback) {
                this.onResultCallback(currentTranscript, !!finalTranscript);
            }

            // Arm silence timer after speech is detected
            this.resetSilenceTimer();
        };

        recognition.onerror = (event) => {
            console.warn("[SpeechRecognitionService] Error:", event.error);
            if (this.onErrorCallback) {
                this.onErrorCallback(event.error);
            }
        };

        recognition.onend = () => {
            this.isListening = false;
            this.clearSilenceTimer();

            const transcript = String(this.sessionTranscript || "").trim();
            if (this.hasSpeechDetected && transcript.length >= 1 && this.onSilenceCallback) {
                const preserved = LanguageDetectionService.preserveTechnicalEntities(transcript);
                this.onSilenceCallback(preserved);
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
                    }, 150);
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
                    }, 150);
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

    stop() {
        this.clearSilenceTimer();
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (err) {}
        }
        this.isListening = false;
    }

    abort() {
        this.clearSilenceTimer();
        if (this.recognition && this.isListening) {
            try {
                this.recognition.abort();
            } catch (err) {}
        }
        this.isListening = false;
    }

    resetSilenceTimer() {
        this.clearSilenceTimer();
        this.silenceTimer = setTimeout(() => {
            if (this.isListening && this.hasSpeechDetected) {
                console.log("[SpeechRecognitionService] Silence detected, submitting speech.");
                this.stop();
            }
        }, this.silenceTimeoutMs);
    }

    clearSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}

export default new SpeechRecognitionService();
