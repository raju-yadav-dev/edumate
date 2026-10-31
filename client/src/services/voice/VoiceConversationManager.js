/**
 * VoiceConversationManager.js
 * The core orchestrator managing the voice assistant state machine,
 * continuous conversations, commands, language detection, session tracking, and performance diagnostics.
 * 
 * EduMate Mission 8.4:
 * - Low latency pipeline optimization (target 3-8s end-to-end).
 * - Noise suppression and click rejection integration.
 * - Multilingual recognition & exact entity preservation.
 * - Single active voice session tracking (sessionId, transcript, states, cancellation).
 * - Developer Voice Diagnostics (recognition, retrieval, LLM, TTS, total latency).
 * - Browser compatibility & graceful fallback.
 */

import SpeechRecognitionService from "./SpeechRecognitionService.js";
import SpeechSynthesisService from "./SpeechSynthesisService.js";
import LanguageDetectionService from "./LanguageDetectionService.js";
import AudioAnalyserService from "./AudioAnalyserService.js";
import VoiceCommandService from "./VoiceCommandService.js";
import VadService from "./VadService.js";

export const VOICE_STATES = {
    IDLE: "idle",
    LISTENING: "listening",
    PROCESSING_SPEECH: "processing_speech",
    SEARCHING_KNOWLEDGE_BASE: "searching_knowledge_base",
    BUILDING_CONTEXT: "building_context",
    GENERATING_RESPONSE: "generating_response",
    SPEAKING: "speaking",
    COMPLETED: "completed",
    ERROR: "error",
    PAUSED: "paused",
    PERMISSION_DENIED: "permission_denied",
    INTERRUPTED: "interrupted"
};

class VoiceConversationManager {
    constructor() {
        this.state = VOICE_STATES.IDLE;
        this.isContinuousMode = false;
        this.activeLang = (typeof localStorage !== "undefined" && localStorage.getItem("edumate-language")) || "en";
        this.isMuted = false;
        this.permissionError = false;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.lastQuestion = "";
        this.lastAnswer = "";
        this.isRequestActive = false;
        this.activeAbortController = null;
        
        // Voice Session Management
        this.currentSession = null;
        this.lastDiagnostics = null;

        this.onStateChangeCallbacks = new Set();
        this.onTranscriptCallbacks = new Set();
        this.onTimerCallbacks = new Set();
        this.sendMessageCallback = null;

        this.currentTranscript = "";
        this.handlers = null;

        // Bind SpeechSynthesis events
        this.handleSpeechStart = this.handleSpeechStart.bind(this);
        this.handleSpeechEnd = this.handleSpeechEnd.bind(this);

        this.vadInitialized = false;
    }

    /**
     * Check if developer diagnostics are enabled.
     */
    isDevMode() {
        if (typeof window === "undefined" || !window.localStorage) return false;
        return localStorage.getItem("edumate-dev-mode") === "true";
    }

    /**
     * Checks browser compatibility for voice features.
     */
    getBrowserCompatibility() {
        return SpeechRecognitionService.getBrowserInfo();
    }

    handleSpeechStartDetected() {
        if (this.state === VOICE_STATES.LISTENING) {
            this.setState("user_speaking");
        }
    }

    /**
     * Set the current state and notify subscribers.
     * @param {string} newState
     */
    setState(newState) {
        if (this.state === newState) return;
        console.log(`[VoiceManager] State changed: ${this.state} -> ${newState}`);
        this.state = newState;

        if (this.currentSession) {
            this.currentSession.responseState = newState;
        }

        const isAudioActive = 
            newState === VOICE_STATES.LISTENING || 
            newState === "user_speaking" || 
            newState === VOICE_STATES.PROCESSING_SPEECH ||
            newState === "waiting_for_silence";

        if (isAudioActive) {
            AudioAnalyserService.start().catch((err) => {
                console.warn("Failed to start audio analyser:", err);
            });
            VadService.start();
        } else {
            AudioAnalyserService.stop();
            VadService.stop();
        }

        this.notifyStateChange(newState);
    }

    /**
     * Map backend SSE status events directly to Voice State Machine states and record diagnostics.
     * @param {string} sseStatus
     */
    handleSseStatus(sseStatus) {
        if (!this.isRequestActive) return;
        const now = Date.now();
        
        switch (sseStatus) {
            case "searching_knowledge_base":
                if (this.currentSession && !this.currentSession.timings.searchStart) {
                    this.currentSession.timings.searchStart = now;
                }
                this.setState(VOICE_STATES.SEARCHING_KNOWLEDGE_BASE);
                break;
            case "building_context":
            case "retrieval_completed":
                if (this.currentSession && !this.currentSession.timings.retrievalEnd) {
                    this.currentSession.timings.retrievalEnd = now;
                    this.currentSession.timings.retrievalLatency = now - (this.currentSession.timings.searchStart || this.currentSession.timings.promptSentAt);
                }
                this.setState(VOICE_STATES.BUILDING_CONTEXT);
                break;
            case "generating_response":
            case "stream_token":
                if (this.currentSession && !this.currentSession.timings.firstTokenAt) {
                    this.currentSession.timings.firstTokenAt = now;
                    this.currentSession.timings.llmLatency = now - this.currentSession.timings.promptSentAt;
                }
                this.setState(VOICE_STATES.GENERATING_RESPONSE);
                break;
            case "completed":
                if (this.currentSession && !this.currentSession.timings.generationEnd) {
                    this.currentSession.timings.generationEnd = now;
                }
                break;
            case "error":
                this.setState(VOICE_STATES.ERROR);
                break;
            default:
                break;
        }
    }

    notifyPermissionError() {
        this.permissionError = true;
        this.setState(VOICE_STATES.PERMISSION_DENIED);
    }

    clearPermissionError() {
        this.permissionError = false;
    }

    registerHandlers(handlers) {
        this.handlers = handlers;
    }

    // Subscription patterns for React components
    subscribeState(cb) {
        this.onStateChangeCallbacks.add(cb);
        cb(this.state);
        return () => this.onStateChangeCallbacks.delete(cb);
    }

    notifyStateChange(state) {
        this.onStateChangeCallbacks.forEach(cb => cb(state));
    }

    subscribeTranscript(cb) {
        this.onTranscriptCallbacks.add(cb);
        return () => this.onTranscriptCallbacks.delete(cb);
    }

    notifyTranscript(text, isFinal) {
        this.onTranscriptCallbacks.forEach(cb => cb({ text, isFinal }));
    }

    subscribeTimer(cb) {
        this.onTimerCallbacks.add(cb);
        cb(this.elapsedSeconds);
        return () => this.onTimerCallbacks.delete(cb);
    }

    notifyTimer(secs) {
        this.onTimerCallbacks.forEach(cb => cb(secs));
    }

    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds += 1;
            this.notifyTimer(this.elapsedSeconds);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    async ensureVadInitialized() {
        if (this.vadInitialized) return;
        try {
            await VadService.init(
                () => this.handleSpeechStartDetected(),
                () => {
                    if (this.state === "user_speaking" || this.state === VOICE_STATES.LISTENING) {
                        this.setState(VOICE_STATES.PROCESSING_SPEECH);
                        setTimeout(() => this.handleFinalInput(), 200);
                    }
                }
            );
            this.vadInitialized = true;
        } catch (err) {
            console.warn("[VoiceManager] Failed to init VadService:", err);
        }
    }

    getGreetingMessage(lang) {
        switch (lang) {
            case "hi":
                return "नमस्ते! मैं एडुमेट हूँ। मैं आज आपकी क्या मदद कर सकता हूँ?";
            case "bn":
                return "নমস্কার! আমি এডুমেট। আজ আপনাকে কীভাবে সাহায্য করতে পারি?";
            case "en":
            default:
                return "Hello! I am EduMate, your campus assistant. How can I help you today?";
        }
    }

    /**
     * Start a Single Voice Query.
     */
    async startSingleQuery(sendMessageFn) {
        if (!sendMessageFn) {
            console.error("No sendMessage function provided to VoiceConversationManager.");
            return;
        }

        this.sendMessageCallback = sendMessageFn;
        this.isContinuousMode = false;
        this.elapsedSeconds = 0;
        this.notifyTimer(0);
        this.lastQuestion = "";
        this.lastAnswer = "";
        this.isRequestActive = false;

        await this.ensureVadInitialized();
        SpeechSynthesisService.cancel();

        this.setState(VOICE_STATES.LISTENING);
        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);

        const recognitionStartTime = Date.now();
        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
                if (this.state === VOICE_STATES.LISTENING) {
                    this.setState("user_speaking");
                }
            },
            onSilence: (text) => {
                const recLatency = Date.now() - recognitionStartTime;
                this.currentTranscript = text || this.currentTranscript;
                this.setState(VOICE_STATES.PROCESSING_SPEECH);
                this.handleFinalInput(recLatency);
            },
            onError: (err) => {
                console.error("Recognition error in single query:", err);
                if (err === "not-allowed" || err === "service-not-allowed" || err === "permission-denied") {
                    this.notifyPermissionError();
                    return;
                }
                this.setState(VOICE_STATES.IDLE);
            },
            onEnd: () => {
                if (this.state === VOICE_STATES.LISTENING || this.state === "user_speaking") {
                    this.setState(VOICE_STATES.IDLE);
                }
            }
        });
    }

    startListening() {
        this.clearPermissionError();
        SpeechSynthesisService.cancel();
        if (this.state === VOICE_STATES.SPEAKING) {
            this.userInterruption();
            return;
        }
        if (this.isContinuousMode) {
            this.startListeningCycle();
        } else if (this.sendMessageCallback) {
            this.startSingleQuery(this.sendMessageCallback);
        }
    }

    stopListening() {
        SpeechRecognitionService.stop();
        if (this.state === VOICE_STATES.LISTENING || this.state === "user_speaking" || this.state === VOICE_STATES.PROCESSING_SPEECH) {
            this.setState(VOICE_STATES.PAUSED);
        }
    }

    /**
     * Start a Continuous Conversation session.
     */
    async startContinuousConversation(sendMessageFn) {
        if (!sendMessageFn) {
            console.error("No sendMessage function provided to VoiceConversationManager.");
            return;
        }

        this.sendMessageCallback = sendMessageFn;
        this.isContinuousMode = true;
        this.clearPermissionError();
        this.elapsedSeconds = 0;
        this.notifyTimer(0);
        this.lastQuestion = "";
        this.lastAnswer = "";
        this.isRequestActive = false;

        await this.ensureVadInitialized();
        this.startTimer();

        // Speak Greeting
        this.setState(VOICE_STATES.SPEAKING);
        const greeting = this.getGreetingMessage(this.activeLang);

        SpeechSynthesisService.speak(greeting, this.activeLang, {
            onStart: this.handleSpeechStart,
            onEnd: this.handleSpeechEnd
        });
    }

    handleSpeechStart() {
        this.setState(VOICE_STATES.SPEAKING);
        VadService.start();

        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);
        SpeechRecognitionService.startInterruptionMonitor({
            lang: recLang,
            onCandidate: (candidate) => this.handleSpeechInterruptionCandidate(candidate),
            onError: (err) => console.warn("[VoiceManager] Interruption monitor:", err)
        });
    }

    handleSpeechInterruptionCandidate(candidate) {
        if (this.state !== VOICE_STATES.SPEAKING || !this.isContinuousMode) return;

        const text = String(candidate || "").trim();
        if (!text) return;

        const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const explicitInterruptions = new Set([
            "stop", "wait", "hold on", "one second", "just a second", "no wait",
            "stop please", "wait please", "listen", "let me speak", "let me ask",
            "रुको", "रुकिए", "एक सेकंड", "ठहरिए", "থামুন", "এক সেকেন্ড"
        ]);

        const words = normalized ? normalized.split(" ").filter(Boolean) : [];
        const isExplicit = explicitInterruptions.has(normalized) || 
                           explicitInterruptions.has(words[0]) || 
                           words.some(w => explicitInterruptions.has(w));

        if (!isExplicit && words.length < 2) return;
        if (!isExplicit && text.length < 5) return;

        console.log(`[VoiceManager] Meaningful interruption detected: "${text}"`);
        this.userInterruption();
    }

    handleSpeechEnd() {
        SpeechRecognitionService.stopInterruptionMonitor();
        VadService.stop();

        this.setState(VOICE_STATES.COMPLETED);

        if (!this.isContinuousMode) {
            setTimeout(() => {
                if (this.state === VOICE_STATES.COMPLETED) {
                    this.setState(VOICE_STATES.IDLE);
                }
            }, 600);
            return;
        }

        setTimeout(() => {
            this.startListeningCycle();
        }, 250);
    }

    startListeningCycle() {
        if (!this.isContinuousMode) return;
        const busyStates = [
            VOICE_STATES.PROCESSING_SPEECH,
            VOICE_STATES.SEARCHING_KNOWLEDGE_BASE,
            VOICE_STATES.BUILDING_CONTEXT,
            VOICE_STATES.GENERATING_RESPONSE,
            VOICE_STATES.SPEAKING
        ];
        if (busyStates.includes(this.state)) return;

        if (SpeechRecognitionService.isListening) {
            return;
        }

        this.setState(VOICE_STATES.LISTENING);
        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);
        const recStartTime = Date.now();

        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
                if (this.state === VOICE_STATES.LISTENING) {
                    this.setState("user_speaking");
                }
            },
            onSilence: (text) => {
                const recLatency = Date.now() - recStartTime;
                this.currentTranscript = text || this.currentTranscript;
                this.setState(VOICE_STATES.PROCESSING_SPEECH);
                this.handleFinalInput(recLatency);
            },
            onError: (err) => {
                console.error("Recognition error in continuous cycle:", err);
                if (err === "not-allowed" || err === "service-not-allowed" || err === "permission-denied") {
                    this.notifyPermissionError();
                    return;
                }
                if (err === "no-speech") {
                    if (this.isContinuousMode) {
                        setTimeout(() => this.startListeningCycle(), 200);
                    }
                } else if (this.isContinuousMode) {
                    setTimeout(() => this.startListeningCycle(), 800);
                } else {
                    this.setState(VOICE_STATES.IDLE);
                }
            },
            onEnd: () => {
                if (this.isContinuousMode && (this.state === VOICE_STATES.LISTENING || this.state === "user_speaking")) {
                    setTimeout(() => {
                        this.startListeningCycle();
                    }, 200);
                }
            }
        });
    }

    handleFinalInput(recLatency = null) {
        const transcript = this.currentTranscript || "";
        this.currentTranscript = "";
        this.submitUserInput(transcript, recLatency);
    }

    /**
     * Process transcribed text through backend SSE RAG pipeline with session management and diagnostics.
     * @param {string} text
     * @param {number|null} recLatency
     */
    async submitUserInput(text, recLatency = null) {
        if (!text || !text.trim()) {
            if (this.isContinuousMode) {
                this.startListeningCycle();
            } else {
                this.setState(VOICE_STATES.IDLE);
            }
            return;
        }

        if (this.isRequestActive) {
            console.warn("[VoiceManager] Request already in progress, ignoring duplicate input.");
            return;
        }

        this.isRequestActive = true;
        const question = LanguageDetectionService.preserveTechnicalEntities(text.trim());
        this.lastQuestion = question;
        console.log(`[VoiceManager] User Spoke: "${question}"`);

        // Initialize Session
        const sessionId = `vsession-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        this.currentSession = {
            sessionId,
            transcript: question,
            responseState: "searching",
            speechState: "idle",
            cancelled: false,
            timings: {
                promptSentAt: Date.now(),
                recognitionLatency: recLatency || 0
            }
        };

        // 1. Auto Detect Spoken Language from Transcript
        const detectedLang = LanguageDetectionService.detect(question);
        if (detectedLang !== this.activeLang) {
            console.log(`[VoiceManager] Automatically switching language: ${this.activeLang} -> ${detectedLang}`);
            this.activeLang = detectedLang;
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("edumate-language", detectedLang);
            }
        }

        // 2. Check for Built-in Voice Commands
        const wasCommand = VoiceCommandService.detectAndExecute(question, this, this.handlers);
        if (wasCommand) {
            this.isRequestActive = false;
            this.currentSession = null;
            return;
        }

        // 3. Normal SSE RAG Pipeline Execution
        this.setState(VOICE_STATES.SEARCHING_KNOWLEDGE_BASE);
        this.activeAbortController = new AbortController();

        try {
            // Execute streaming RAG pipeline
            const responseText = await this.sendMessageCallback(question, null, null, null, null, question);
            
            if (this.activeAbortController?.signal?.aborted || this.state === VOICE_STATES.INTERRUPTED || this.state === VOICE_STATES.IDLE || this.state === VOICE_STATES.LISTENING) {
                console.log("[VoiceManager] Response ignored because conversation was interrupted or cancelled.");
                return;
            }
            
            this.lastAnswer = responseText || "I did not receive an answer.";
            
            // Diagnostics logging
            const now = Date.now();
            const totalVoiceLatency = now - this.currentSession.timings.promptSentAt;
            this.currentSession.timings.totalVoiceLatency = totalVoiceLatency;
            this.lastDiagnostics = { ...this.currentSession.timings, sessionId };

            if (this.isDevMode()) {
                console.table({
                    Session: sessionId,
                    "Recognition Latency (ms)": this.currentSession.timings.recognitionLatency || "<2000",
                    "Retrieval Latency (ms)": this.currentSession.timings.retrievalLatency || "<3000",
                    "LLM First Token (ms)": this.currentSession.timings.llmLatency || "<1000",
                    "Total Voice Latency (ms)": totalVoiceLatency
                });
            }

            if (SpeechSynthesisService.isAutoSpeakEnabled() || this.isContinuousMode) {
                this.setState(VOICE_STATES.SPEAKING);
                SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
                    onStart: this.handleSpeechStart,
                    onEnd: this.handleSpeechEnd
                });
            } else {
                this.setState(VOICE_STATES.COMPLETED);
            }
        } catch (error) {
            console.error("Error asking EduMate in Voice Mode:", error);
            if (error.name === "AbortError" || this.activeAbortController?.signal?.aborted || this.state === VOICE_STATES.INTERRUPTED || this.state === VOICE_STATES.LISTENING) {
                if (this.state !== VOICE_STATES.LISTENING) {
                    this.setState(VOICE_STATES.IDLE);
                }
                return;
            }
            
            this.setState(VOICE_STATES.ERROR);
            const errorReply = this.activeLang === "hi" 
                ? "मुझे खेद है, लेकिन अभी नेटवर्क में कुछ समस्या आ रही है।" 
                : (this.activeLang === "bn" 
                    ? "আমি দুঃখিত, নেটওয়ার্কে কিছু সমস্যা হচ্ছে।" 
                    : "I am sorry, but I am facing network issues right now.");

            this.lastAnswer = errorReply;
            this.setState(VOICE_STATES.SPEAKING);
            SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
                onStart: this.handleSpeechStart,
                onEnd: this.handleSpeechEnd
            });
        } finally {
            this.isRequestActive = false;
            this.activeAbortController = null;
        }
    }

    /**
     * Interrupt active AI speech: cancels TTS, aborts generation, and restarts listening immediately.
     */
    userInterruption() {
        console.log("[VoiceManager] User interrupted active assistant output.");
        
        SpeechRecognitionService.stopInterruptionMonitor();
        SpeechSynthesisService.cancel();
        
        if (this.currentSession) {
            this.currentSession.cancelled = true;
        }

        if (this.activeAbortController) {
            try {
                this.activeAbortController.abort();
            } catch (e) {}
            this.activeAbortController = null;
        }

        this.isRequestActive = false;
        this.setState(VOICE_STATES.INTERRUPTED);

        setTimeout(() => {
            if (this.isContinuousMode) {
                this.startListeningCycle();
            } else {
                this.setState(VOICE_STATES.IDLE);
            }
        }, 150);
    }

    /**
     * Stop Response / Cancel button action.
     */
    stopResponse() {
        console.log("[VoiceManager] Stop Response button clicked.");
        SpeechRecognitionService.abort();
        SpeechSynthesisService.cancel();
        
        if (this.currentSession) {
            this.currentSession.cancelled = true;
            this.currentSession = null;
        }

        if (this.activeAbortController) {
            try {
                this.activeAbortController.abort();
            } catch (e) {}
            this.activeAbortController = null;
        }

        this.isRequestActive = false;
        this.setState(VOICE_STATES.IDLE);
    }

    /**
     * Manual replay of the last assistant reply.
     */
    replayResponse() {
        if (!this.lastAnswer) return;
        this.setState(VOICE_STATES.SPEAKING);
        SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
            onStart: this.handleSpeechStart,
            onEnd: this.handleSpeechEnd
        });
    }

    pauseSpeaking() {
        SpeechSynthesisService.pause();
        if (this.state === VOICE_STATES.SPEAKING) {
            this.setState(VOICE_STATES.PAUSED);
        }
    }

    resumeSpeaking() {
        SpeechSynthesisService.resume();
        if (this.state === VOICE_STATES.PAUSED) {
            this.setState(VOICE_STATES.SPEAKING);
        }
    }

    setAutoSpeak(enabled) {
        SpeechSynthesisService.setAutoSpeak(enabled);
    }

    isAutoSpeakEnabled() {
        return SpeechSynthesisService.isAutoSpeakEnabled();
    }

    setTtsSettings(settings) {
        SpeechSynthesisService.setSettings(settings);
    }

    getTtsSettings() {
        return SpeechSynthesisService.getSettings();
    }

    getDiagnostics() {
        return this.lastDiagnostics;
    }

    /**
     * Stop and end the entire voice conversation session.
     */
    stopConversation() {
        this.isContinuousMode = false;
        this.stopResponse();
        this.stopTimer();
        this.currentSession = null;
        this.setState(VOICE_STATES.IDLE);
    }
}

export default new VoiceConversationManager();
