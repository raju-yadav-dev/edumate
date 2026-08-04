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
        this.silenceTimeoutMs = 1500; // Time of silence before triggering submission
        this.onResultCallback = null;
        this.onSilenceCallback = null;
        this.onErrorCallback = null;
        this.onEndCallback = null;
        this.activeLang = "en-US";
        this.hasSpeechDetected = false;
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

            const currentTranscript = finalTranscript || interimTranscript;

            if (this.onResultCallback) {
                this.onResultCallback(currentTranscript, !!finalTranscript);
            }

            // Reset silence detection timer upon receiving speech input
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

            // If final transcript wasn't submitted yet and we detected speech
            if (this.hasSpeechDetected && this.onSilenceCallback) {
                this.onSilenceCallback();
                this.hasSpeechDetected = false;
            }

            if (this.onEndCallback) {
                this.onEndCallback();
            }
        };

        this.recognition = recognition;
        return true;
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

        if (this.isListening) {
            this.stop();
        }

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
        } catch (err) {
            console.error("Failed to start SpeechRecognition:", err);
            if (onError) onError(err.message || "start_error");
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
