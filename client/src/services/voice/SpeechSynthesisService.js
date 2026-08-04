/**
 * SpeechSynthesisService.js
 * Service wrapper for browser-native SpeechSynthesis API.
 */

class SpeechSynthesisService {
    constructor() {
        this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
        this.voices = [];
        this.activeVoice = null;
        this.rate = 1.0; // Speed of speech
        this.pitch = 1.0;
        this.isMuted = false;
        this.isPlaying = false;
        this.onStartCallback = null;
        this.onEndCallback = null;
        this.currentUtterance = null;

        if (this.synth) {
            // Load voices
            this.loadVoices();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = () => this.loadVoices();
            }
        }
    }

    /**
     * Checks if Speech Synthesis is supported by the browser.
     * @returns {boolean}
     */
    isSupported() {
        return typeof window !== "undefined" && !!window.speechSynthesis;
    }

    /**
     * Load available voices and trigger cache.
     */
    loadVoices() {
        if (!this.synth) return;
        this.voices = this.synth.getVoices() || [];
    }

    /**
     * Set speed rate of speaking.
     * @param {number} rate - value between 0.5 and 2
     */
    setRate(rate) {
        this.rate = Math.max(0.5, Math.min(2.0, rate));
        console.log(`[SpeechSynthesisService] Speaking rate set to: ${this.rate}`);
    }

    /**
     * Toggle mute state.
     * @param {boolean} isMuted
     */
    setMute(isMuted) {
        this.isMuted = isMuted;
        if (isMuted && this.isPlaying) {
            this.cancel();
        }
    }

    /**
     * Finds the best voice for a given language code.
     * @param {string} langCode - 'en', 'hi', or 'bn'
     * @returns {SpeechSynthesisVoice|null}
     */
    getBestVoiceForLanguage(langCode) {
        if (this.voices.length === 0) {
            this.loadVoices();
        }

        const normalizedLang = langCode.toLowerCase().split("-")[0]; // "en", "hi", "bn"

        // Step 1: Look for exact matching language tag
        let matched = this.voices.filter(v => v.lang.toLowerCase().startsWith(normalizedLang));

        if (matched.length === 0) {
            // If no match found, check name strings
            matched = this.voices.filter(v => 
                v.name.toLowerCase().includes(normalizedLang) || 
                (normalizedLang === "hi" && v.name.toLowerCase().includes("india")) ||
                (normalizedLang === "bn" && (v.name.toLowerCase().includes("bengali") || v.name.toLowerCase().includes("bangla")))
            );
        }

        if (matched.length === 0) {
            return null;
        }

        // Step 2: Prefer local/native voices if available
        const localVoice = matched.find(v => v.localService);
        if (localVoice) return localVoice;

        // Step 3: Prefer specific default voices or first available
        return matched[0];
    }

    /**
     * Speak text.
     * @param {string} text - text content to speak
     * @param {string} lang - language key e.g. 'en', 'hi', 'bn'
     * @param {Object} options
     * @param {Function} options.onStart - callback when speaking starts
     * @param {Function} options.onEnd - callback when speaking ends
     */
    speak(text, lang = "en", { onStart, onEnd } = {}) {
        if (!this.synth) return;
        this.cancel(); // Stop any current speech

        if (this.isMuted) {
            if (onStart) onStart();
            if (onEnd) onEnd();
            return;
        }

        // Clean text of markdown format or special syntax
        const cleanedText = this.cleanText(text);
        if (!cleanedText.trim()) {
            if (onStart) onStart();
            if (onEnd) onEnd();
            return;
        }

        this.onStartCallback = onStart;
        this.onEndCallback = onEnd;

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;

        const voice = this.getBestVoiceForLanguage(lang);
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            // Fallback lang strings
            const langMap = { en: "en-US", hi: "hi-IN", bn: "bn-IN" };
            utterance.lang = langMap[lang] || "en-US";
        }

        utterance.onstart = () => {
            this.isPlaying = true;
            if (this.onStartCallback) {
                this.onStartCallback();
            }
        };

        utterance.onend = () => {
            this.isPlaying = false;
            this.currentUtterance = null;
            if (this.onEndCallback) {
                this.onEndCallback();
            }
        };

        utterance.onerror = (event) => {
            console.warn("SpeechSynthesis error:", event);
            this.isPlaying = false;
            this.currentUtterance = null;
            if (this.onEndCallback) {
                this.onEndCallback();
            }
        };

        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    }

    /**
     * Stop speaking.
     */
    cancel() {
        if (this.synth) {
            this.synth.cancel();
        }
        this.isPlaying = false;
        this.currentUtterance = null;
    }

    /**
     * Pause speaking.
     */
    pause() {
        if (this.synth && this.isPlaying) {
            this.synth.pause();
        }
    }

    /**
     * Resume speaking.
     */
    resume() {
        if (this.synth) {
            this.synth.resume();
        }
    }

    /**
     * Clean markdown and code blocks out of the text to make it speakable.
     * @param {string} text
     * @returns {string}
     */
    cleanText(text) {
        if (!text) return "";

        let clean = text;

        // Remove code blocks
        clean = clean.replace(/```[\s\S]*?```/g, "");

        // Remove inline code style `code`
        clean = clean.replace(/`([^`]+)`/g, "$1");

        // Remove markdown tables
        clean = clean.replace(/\|[\s\S]*?\|/g, "");

        // Remove image syntax e.g. ![caption](url)
        clean = clean.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "");

        // Remove URL links e.g. [text](url) -> text
        clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

        // Remove bold/italic markup
        clean = clean.replace(/[\*_]{1,3}([^\*_]+)[\*_]{1,3}/g, "$1");

        // Remove header marks (e.g. #, ##)
        clean = clean.replace(/^[#\-\*\+]{1,4}\s+/gm, "");

        // Replace custom notation like [Attached X files] or [Generation stopped]
        clean = clean.replace(/\[Attached.*?\]/g, "");
        clean = clean.replace(/\[Error:.*?\]/g, "");

        // Clean extra newlines and spaces
        clean = clean.replace(/\n+/g, " ");
        clean = clean.trim();

        return clean;
    }
}

export default new SpeechSynthesisService();
