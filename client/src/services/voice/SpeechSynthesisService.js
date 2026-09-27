/**
 * SpeechSynthesisService.js
 * Production-ready Text-to-Speech (TTS) Service for EduMate Voice Assistant.
 * 
 * EduMate Mission 8.3:
 * 1. Synchronized Streaming Text-to-Speech (streaming sentence queue).
 * 2. Voice Playback Controls (Play, Pause, Resume, Stop, Replay).
 * 3. Configurable Settings (Rate, Pitch, Volume, Voice Language) with local persistence.
 * 4. Auto-Speak Toggle with local persistence.
 * 5. Smart Sentence Chunking (protects numbers, abbreviations, human-friendly table narration, citation stripping).
 * 6. Instant Speech Interruption Handling (clears sentence queue and halts speech).
 * 7. Graceful Error Handling & Fallbacks.
 */

const SETTINGS_STORAGE_KEY = "edumate-tts-settings";
const AUTO_SPEAK_STORAGE_KEY = "edumate-auto-speak";
const UtteranceClass = typeof window !== "undefined" ? (window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance) : (typeof globalThis !== "undefined" ? globalThis.SpeechSynthesisUtterance : null);

class SpeechSynthesisService {
    constructor() {
        this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
        this.voices = [];
        this.activeVoice = null;

        // Default Voice Settings
        this.rate = 1.0;     // 0.5 to 2.0
        this.pitch = 1.0;    // 0.5 to 1.5
        this.volume = 1.0;   // 0.0 to 1.0
        this.activeLang = "en";
        this.isMuted = false;
        this.autoSpeak = true;

        // Playback state
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.lastSpokenText = "";
        this.lastSpokenLang = "en";

        // Sentence Queue & Stream Synchronization
        this.sentenceQueue = [];
        this.isProcessingQueue = false;
        this.streamBuffer = "";
        this.streamActive = false;
        this.streamCallbacks = null;
        this.spokenSentences = [];

        // Load stored settings & initialize
        this.loadSettings();
        if (this.synth) {
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
     * Load settings from localStorage.
     */
    loadSettings() {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                if (typeof parsed.rate === "number") this.rate = Math.max(0.5, Math.min(2.0, parsed.rate));
                if (typeof parsed.pitch === "number") this.pitch = Math.max(0.5, Math.min(1.5, parsed.pitch));
                if (typeof parsed.volume === "number") this.volume = Math.max(0.0, Math.min(1.0, parsed.volume));
                if (parsed.lang) this.activeLang = parsed.lang;
            }

            const savedAutoSpeak = localStorage.getItem(AUTO_SPEAK_STORAGE_KEY);
            if (savedAutoSpeak !== null) {
                this.autoSpeak = savedAutoSpeak === "true" || savedAutoSpeak === true;
            }
        } catch (err) {
            console.warn("[SpeechSynthesisService] Error loading settings:", err);
        }
    }

    /**
     * Save settings to localStorage.
     */
    saveSettings() {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
                rate: this.rate,
                pitch: this.pitch,
                volume: this.volume,
                lang: this.activeLang
            }));
            localStorage.setItem(AUTO_SPEAK_STORAGE_KEY, String(this.autoSpeak));
        } catch (err) {
            console.warn("[SpeechSynthesisService] Error saving settings:", err);
        }
    }

    /**
     * Configure Voice Settings.
     */
    setSettings({ rate, pitch, volume, lang }) {
        if (typeof rate === "number") this.rate = Math.max(0.5, Math.min(2.0, rate));
        if (typeof pitch === "number") this.pitch = Math.max(0.5, Math.min(1.5, pitch));
        if (typeof volume === "number") this.volume = Math.max(0.0, Math.min(1.0, volume));
        if (lang) this.activeLang = lang;
        this.saveSettings();
    }

    getSettings() {
        return {
            rate: this.rate,
            pitch: this.pitch,
            volume: this.volume,
            lang: this.activeLang,
            autoSpeak: this.autoSpeak
        };
    }

    setRate(rate) {
        this.rate = Math.max(0.5, Math.min(2.0, rate));
        this.saveSettings();
    }

    setPitch(pitch) {
        this.pitch = Math.max(0.5, Math.min(1.5, pitch));
        this.saveSettings();
    }

    setVolume(volume) {
        this.volume = Math.max(0.0, Math.min(1.0, volume));
        this.saveSettings();
    }

    setAutoSpeak(enabled) {
        this.autoSpeak = !!enabled;
        this.saveSettings();
    }

    isAutoSpeakEnabled() {
        return this.autoSpeak;
    }

    setMute(isMuted) {
        this.isMuted = !!isMuted;
        if (this.isMuted && this.isPlaying) {
            this.cancel();
        }
    }

    /**
     * Load available voices.
     */
    loadVoices() {
        if (!this.synth) return;
        try {
            this.voices = this.synth.getVoices() || [];
        } catch (err) {
            this.voices = [];
        }
    }

    /**
     * Finds the best voice for a given language code.
     * @param {string} langCode - 'en', 'hi', or 'bn'
     * @returns {SpeechSynthesisVoice|null}
     */
    getBestVoiceForLanguage(langCode = "en") {
        if (this.voices.length === 0) {
            this.loadVoices();
        }

        const normalized = String(langCode || "en").toLowerCase().split("-")[0];

        // 1. Exact or prefix match on lang
        let matched = this.voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(normalized));

        if (matched.length === 0) {
            // 2. Name search
            matched = this.voices.filter(v => {
                const name = (v.name || "").toLowerCase();
                if (name.includes(normalized)) return true;
                if (normalized === "hi" && (name.includes("india") || name.includes("hindi"))) return true;
                if (normalized === "bn" && (name.includes("bengali") || name.includes("bangla"))) return true;
                if (normalized === "en" && (name.includes("english") || name.includes("uk") || name.includes("us") || name.includes("india"))) return true;
                return false;
            });
        }

        if (matched.length === 0) {
            return this.voices[0] || null;
        }

        // Prefer local natural service voice
        const localVoice = matched.find(v => v.localService);
        return localVoice || matched[0];
    }

    /**
     * Smart Text Cleaner:
     * - Strips citations and footnote markers: [1], [2], [Doc: ...], [Sources...]
     * - Strips code blocks and inline code
     * - Converts Markdown tables into human-friendly spoken narration
     * - Strips raw Markdown formatting without cutting words
     * @param {string} text
     * @returns {string}
     */
    cleanText(text) {
        if (!text) return "";

        let clean = String(text);

        // 1. Remove code blocks
        clean = clean.replace(/```[\s\S]*?```/g, " ");

        // 2. Remove inline code
        clean = clean.replace(/`([^`]+)`/g, "$1");

        // 3. Human-friendly Markdown Table Narration
        clean = this.convertTablesToSpeech(clean);

        // 4. Strip citations like [1], [2], [Doc: ...], [Admission.pdf:4]
        clean = clean.replace(/\[\d+\]/g, "");
        clean = clean.replace(/\[(?:doc|document|source|sources|page|ref|reference).*?\]/gi, "");
        clean = clean.replace(/\[[^\]]+\.(?:pdf|docx?|txt|md)(?::\d+)?\]/gi, "");

        // 5. Remove image syntax e.g. ![caption](url)
        clean = clean.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1");

        // 6. Remove URL links e.g. [text](url) -> text
        clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

        // 7. Remove bold/italic formatting
        clean = clean.replace(/[\*_]{1,3}([^\*_]+)[\*_]{1,3}/g, "$1");

        // 8. Remove Markdown headers & list bullets
        clean = clean.replace(/^#{1,6}\s+/gm, "");
        clean = clean.replace(/^[\*\-\+]\s+/gm, "");
        clean = clean.replace(/^\d+\.\s+/gm, "");

        // 9. Remove custom UI status markers
        clean = clean.replace(/\[Attached.*?\]/gi, "");
        clean = clean.replace(/\[Error:.*?\]/gi, "");
        clean = clean.replace(/\[Generation stopped.*?\]/gi, "");

        // 10. Clean whitespace and duplicate punctuation
        clean = clean.replace(/\r\n/g, "\n");
        clean = clean.replace(/\n{2,}/g, ". ");
        clean = clean.replace(/\n/g, " ");
        clean = clean.replace(/\s+\./g, ".");
        clean = clean.replace(/\.{2,}/g, ".");
        clean = clean.replace(/\s{2,}/g, " ");

        return clean.trim();
    }

    /**
     * Converts Markdown tables into natural human-friendly spoken sentences.
     * @param {string} text
     * @returns {string}
     */
    convertTablesToSpeech(text) {
        if (!text.includes("|")) return text;

        const lines = text.split("\n");
        const processedLines = [];
        let inTable = false;
        let headers = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("|") && line.endsWith("|")) {
                const cells = line.split("|").map(c => c.trim()).filter(c => c.length > 0);
                
                // Check if this is separator line (e.g. |---|---|)
                const isSeparator = cells.every(c => /^[-:\s]+$/.test(c));
                if (isSeparator) {
                    continue;
                }

                if (!inTable) {
                    inTable = true;
                    headers = cells;
                    continue;
                }

                // Data row: convert to "Header1: Value1, Header2: Value2."
                const rowNarrations = [];
                for (let c = 0; c < cells.length; c++) {
                    const header = headers[c] || `Column ${c + 1}`;
                    const val = cells[c];
                    if (val && val !== "-") {
                        rowNarrations.push(`${header} is ${val}`);
                    }
                }
                if (rowNarrations.length) {
                    processedLines.push(rowNarrations.join(", ") + ".");
                }
            } else {
                if (inTable) {
                    inTable = false;
                    headers = [];
                }
                processedLines.push(lines[i]);
            }
        }

        return processedLines.join("\n");
    }

    /**
     * Smart Sentence Splitter:
     * - Splits by sentence boundaries (. ! ? । \n)
     * - Protects decimal numbers (e.g. 3.14, 1.5, ₹45.5k)
     * - Protects abbreviations and initials (Dr., Prof., Mr., Mrs., A. Sharma, i.e., e.g., etc.)
     * @param {string} text
     * @returns {string[]}
     */
    splitIntoSentences(text) {
        const cleaned = this.cleanText(text);
        if (!cleaned) return [];

        // Temporary placeholders for protected patterns
        const placeholders = [];
        let protectedText = cleaned;

        // 1. Protect single letter initials and common abbreviations
        const abbrevRegex = /\b([A-Za-z]|Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|Dept|Univ|e\.g|i\.e|etc|approx|no)\./gi;
        protectedText = protectedText.replace(abbrevRegex, (match) => {
            const token = `__ABBR_${placeholders.length}__`;
            placeholders.push({ token, original: match });
            return token;
        });

        // 2. Protect decimal numbers (e.g. 3.5, 45.00, 10.5k)
        protectedText = protectedText.replace(/(\d+)\.(\d+)/g, (match, p1, p2) => {
            const token = `__DEC_${placeholders.length}__`;
            placeholders.push({ token, original: `${p1}.${p2}` });
            return token;
        });

        // 3. Split on sentence delimiters: [.!?।\n] followed by whitespace or end
        const rawSegments = protectedText.split(/(?<=[.!?।\n])\s+/);

        // 4. Restore placeholders and filter
        const sentences = [];
        for (let seg of rawSegments) {
            let restored = seg.trim();
            for (const { token, original } of placeholders) {
                restored = restored.replace(new RegExp(token, "g"), original);
            }
            if (restored.length > 0) {
                sentences.push(restored);
            }
        }

        return sentences;
    }

    /**
     * Standard Full Text Playback.
     * @param {string} text
     * @param {string} lang
     * @param {Object} callbacks - { onStart, onEnd }
     */
    speak(text, lang = "en", { onStart, onEnd } = {}) {
        if (!this.synth) {
            if (onStart) onStart();
            if (onEnd) onEnd();
            return;
        }

        // Cancel previous active speech
        this.cancel();

        if (this.isMuted) {
            if (onStart) onStart();
            if (onEnd) onEnd();
            return;
        }

        const sentences = this.splitIntoSentences(text);
        if (sentences.length === 0) {
            if (onStart) onStart();
            if (onEnd) onEnd();
            return;
        }

        this.lastSpokenText = text;
        this.lastSpokenLang = lang;
        this.sentenceQueue = [...sentences];
        this.spokenSentences = [];
        this.isPlaying = true;
        this.isPaused = false;

        let hasStarted = false;
        this.processQueue(lang, {
            onStart: () => {
                if (!hasStarted) {
                    hasStarted = true;
                    if (onStart) onStart();
                }
            },
            onEnd: () => {
                this.isPlaying = false;
                this.isPaused = false;
                if (onEnd) onEnd();
            }
        });
    }

    /**
     * Start a Synchronized Streaming TTS Session.
     * @param {string} lang
     * @param {Object} callbacks - { onStart, onEnd }
     */
    startStreamSession(lang = "en", { onStart, onEnd } = {}) {
        this.cancel();
        this.streamActive = true;
        this.streamBuffer = "";
        this.sentenceQueue = [];
        this.spokenSentences = [];
        this.lastSpokenLang = lang;
        this.streamCallbacks = { onStart, onEnd };
        this.hasStreamStarted = false;
    }

    /**
     * Push incoming token / text chunks from SSE stream.
     * Synchronizes speech: starts speaking the first complete sentence immediately
     * and queues up subsequent sentences as they are completed.
     * @param {string} chunkText
     */
    pushStreamChunk(chunkText) {
        if (!this.streamActive || this.isMuted) return;

        this.streamBuffer += chunkText;

        // Extract complete sentences ending with delimiters (. ! ? । \n)
        const delimiterRegex = /([.!?।\n])\s+/;
        let match;
        
        while ((match = delimiterRegex.exec(this.streamBuffer)) !== null) {
            const splitIndex = match.index + 1;
            const fullSentence = this.streamBuffer.slice(0, splitIndex).trim();
            this.streamBuffer = this.streamBuffer.slice(splitIndex).trim();

            const cleanedSentence = this.cleanText(fullSentence);
            if (cleanedSentence) {
                this.sentenceQueue.push(cleanedSentence);
            }
        }

        // If buffer ends with sentence punctuation
        if (/[.!?।]$/.test(this.streamBuffer.trim())) {
            const candidate = this.cleanText(this.streamBuffer);
            if (candidate && candidate.length > 3) {
                this.sentenceQueue.push(candidate);
                this.streamBuffer = "";
            }
        }

        if (this.sentenceQueue.length > 0 && !this.isProcessingQueue) {
            this.processQueue(this.lastSpokenLang, {
                onStart: () => {
                    if (!this.hasStreamStarted) {
                        this.hasStreamStarted = true;
                        if (this.streamCallbacks?.onStart) this.streamCallbacks.onStart();
                    }
                },
                onEnd: () => {
                    if (!this.streamActive && this.sentenceQueue.length === 0) {
                        this.isPlaying = false;
                        this.isPaused = false;
                        if (this.streamCallbacks?.onEnd) this.streamCallbacks.onEnd();
                    }
                }
            });
        }
    }

    /**
     * Finish streaming session and flush any remaining text.
     */
    finishStreamSession() {
        if (!this.streamActive) return;
        this.streamActive = false;

        const remaining = this.cleanText(this.streamBuffer);
        this.streamBuffer = "";

        if (remaining) {
            this.sentenceQueue.push(remaining);
        }

        if (this.sentenceQueue.length === 0 && !this.isPlaying) {
            if (this.streamCallbacks?.onEnd) this.streamCallbacks.onEnd();
            return;
        }

        if (!this.isProcessingQueue && this.sentenceQueue.length > 0) {
            this.processQueue(this.lastSpokenLang, {
                onStart: () => {
                    if (!this.hasStreamStarted) {
                        this.hasStreamStarted = true;
                        if (this.streamCallbacks?.onStart) this.streamCallbacks.onStart();
                    }
                },
                onEnd: () => {
                    this.isPlaying = false;
                    this.isPaused = false;
                    if (this.streamCallbacks?.onEnd) this.streamCallbacks.onEnd();
                }
            });
        }
    }

    /**
     * Internal Sentence Queue Processor.
     * Speaks one sentence at a time to prevent browser buffer overflow.
     */
    processQueue(lang, { onStart, onEnd } = {}) {
        if (!this.synth || this.sentenceQueue.length === 0) {
            this.isProcessingQueue = false;
            if (onEnd) onEnd();
            return;
        }

        this.isProcessingQueue = true;
        this.isPlaying = true;
        const sentence = this.sentenceQueue.shift();
        this.spokenSentences.push(sentence);

        const utterance = UtteranceClass ? new UtteranceClass(sentence) : (typeof SpeechSynthesisUtterance !== "undefined" ? new SpeechSynthesisUtterance(sentence) : {});
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;

        const voice = this.getBestVoiceForLanguage(lang);
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            const langMap = { en: "en-IN", hi: "hi-IN", bn: "bn-IN" };
            utterance.lang = langMap[lang] || "en-IN";
        }

        utterance.onstart = () => {
            if (onStart) onStart();
        };

        utterance.onend = () => {
            this.currentUtterance = null;
            if (this.sentenceQueue.length > 0) {
                this.processQueue(lang, { onStart, onEnd });
            } else {
                this.isProcessingQueue = false;
                if (!this.streamActive) {
                    this.isPlaying = false;
                    this.isPaused = false;
                    if (onEnd) onEnd();
                }
            }
        };

        utterance.onerror = (event) => {
            console.warn("[SpeechSynthesisService] Utterance error:", event);
            this.currentUtterance = null;
            if (this.sentenceQueue.length > 0) {
                this.processQueue(lang, { onStart, onEnd });
            } else {
                this.isProcessingQueue = false;
                this.isPlaying = false;
                this.isPaused = false;
                if (onEnd) onEnd();
            }
        };

        this.currentUtterance = utterance;
        try {
            this.synth.speak(utterance);
        } catch (err) {
            console.warn("[SpeechSynthesisService] Error calling speak():", err);
            this.currentUtterance = null;
            this.isProcessingQueue = false;
            this.isPlaying = false;
            if (onEnd) onEnd();
        }
    }

    /**
     * Pause Playback.
     */
    pause() {
        if (this.synth && this.isPlaying && !this.isPaused) {
            try {
                this.synth.pause();
                this.isPaused = true;
            } catch (err) {
                console.warn("[SpeechSynthesisService] Pause error:", err);
            }
        }
    }

    /**
     * Resume Playback.
     */
    resume() {
        if (this.synth && this.isPaused) {
            try {
                this.synth.resume();
                this.isPaused = false;
            } catch (err) {
                console.warn("[SpeechSynthesisService] Resume error:", err);
            }
        }
    }

    /**
     * Stop and cancel all active and queued speech.
     */
    cancel() {
        if (this.synth) {
            try {
                this.synth.cancel();
            } catch (err) {}
        }
        this.sentenceQueue = [];
        this.spokenSentences = [];
        this.streamBuffer = "";
        this.streamActive = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.isProcessingQueue = false;
        this.currentUtterance = null;
    }

    /**
     * Replay last spoken response.
     */
    replay(lang = this.lastSpokenLang, callbacks = {}) {
        if (!this.lastSpokenText) return;
        this.speak(this.lastSpokenText, lang, callbacks);
    }
}

export default new SpeechSynthesisService();
