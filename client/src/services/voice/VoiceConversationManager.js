/**
 * VoiceConversationManager.js
 * The core orchestrator managing the voice assistant state machine,
 * continuous conversations, commands, language detection, and interaction loops.
 */

import SpeechRecognitionService from "./SpeechRecognitionService";
import SpeechSynthesisService from "./SpeechSynthesisService";
import LanguageDetectionService from "./LanguageDetectionService";
import AudioAnalyserService from "./AudioAnalyserService";
import VoiceCommandService from "./VoiceCommandService";
import VadService from "./VadService";

class VoiceConversationManager {
    constructor() {
        this.state = "idle"; // 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'ended'
        this.isContinuousMode = false;
        this.activeLang = (typeof localStorage !== "undefined" && localStorage.getItem("edumate-language")) || "en"; // 'en' | 'hi' | 'bn'
        this.isMuted = false;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.lastQuestion = "";
        this.lastAnswer = "";
        
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

    handleSpeechStartDetected() {
        if (this.state === "listening") {
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

        if (newState === "listening" || newState === "user_speaking" || newState === "waiting_for_silence") {
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

    async ensureVadInitialized() {
        if (this.vadInitialized) return;
        try {
            await VadService.init(() => {
                this.handleSpeechStartDetected();
            });
            this.vadInitialized = true;
        } catch (err) {
            console.warn("[VoiceManager] Failed to init VadService:", err);
        }
    }

    /**
     * Start a Single Voice Query (one-off voice search).
     * @param {Function} sendMessageFn - Function in Chat.jsx to send query
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

        await this.ensureVadInitialized();

        // Reset speaking settings
        SpeechSynthesisService.cancel();

        this.setState("listening");
        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);

        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
                if (this.state === "listening") {
                    this.setState("user_speaking");
                }
            },
            onSilence: () => {
                this.setState("waiting_for_silence");
                setTimeout(() => {
                    if (this.state === "waiting_for_silence") {
                        this.handleFinalInput();
                    }
                }, 300);
            },
            onError: (err) => {
                console.error("Recognition error in single query:", err);
                this.setState("idle");
            },
            onEnd: () => {
                // If it ended naturally without silence (e.g. no speech spoken)
                if (this.state === "listening" || this.state === "user_speaking" || this.state === "waiting_for_silence") {
                    this.setState("idle");
                }
            }
        });
    }

    /**
     * Start a Continuous Conversation session (like ChatGPT voice).
     * @param {Function} sendMessageFn - Function in Chat.jsx to send query
     */
    async startContinuousConversation(sendMessageFn) {
        if (!sendMessageFn) {
            console.error("No sendMessage function provided to VoiceConversationManager.");
            return;
        }

        this.sendMessageCallback = sendMessageFn;
        this.isContinuousMode = true;
        this.elapsedSeconds = 0;
        this.notifyTimer(0);
        this.lastQuestion = "";
        this.lastAnswer = "";

        await this.ensureVadInitialized();

        // Start elapsed timer
        this.startTimer();

        // Speak Greeting
        this.setState("speaking");
        const greeting = this.getGreetingMessage(this.activeLang);

        SpeechSynthesisService.speak(greeting, this.activeLang, {
            onStart: this.handleSpeechStart,
            onEnd: this.handleSpeechEnd
        });
    }

    /**
     * Triggered when Synthesis starts speaking.
     */
    handleSpeechStart() {
        this.setState("speaking"); // AI_SPEAKING

        // Keep interruption monitor and Vad active while speaking to capture interrupts
        VadService.start();

        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);
        SpeechRecognitionService.startInterruptionMonitor({
            lang: recLang,
            onCandidate: (candidate) => this.handleSpeechInterruptionCandidate(candidate),
            onError: (err) => console.warn("[VoiceManager] Interruption monitor:", err)
        });
    }

    /**
     * Triggered when Synthesis finishes speaking.
     */
    handleSpeechInterruptionCandidate(candidate) {
        if (this.state !== "speaking" || !this.isContinuousMode) return;

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

        // 1. Ignore short noise (need at least 2 words if not an explicit phrase)
        if (!isExplicit && words.length < 2) return;

        // 2. Ignore whispers / very short noises
        if (!isExplicit && text.length < 5) return;

        // 3. Browser speech recognition can hear the assistant's own TTS. If the
        // transcript substantially overlaps the current answer, treat it as echo.
        const answerWords = String(this.lastAnswer || "")
            .toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
        const candidateWords = new Set(words);
        const overlap = answerWords.length
            ? answerWords.filter((word) => candidateWords.has(word)).length / Math.max(1, words.length)
            : 0;

        if (!isExplicit && words.length < 5 && overlap > 0.5) return;
        if (!isExplicit && words.length >= 5 && overlap > 0.7) return;

        console.log(`[VoiceManager] Meaningful interruption detected: "${text}"`);
        this.userInterruption();
    }

    handleSpeechEnd() {
        SpeechRecognitionService.stopInterruptionMonitor();
        VadService.stop();

        if (this.state === "ended" || !this.isContinuousMode) {
            if (!this.isContinuousMode && this.state !== "ended") {
                this.setState("idle");
            }
            return;
        }

        // Automatically start listening again after speaking finishes
        this.startListeningCycle();
    }

    /**
     * Starts listening within the continuous conversation loop.
     */
    startListeningCycle() {
        if (this.state === "ended" || !this.isContinuousMode) return;
        if (this.state === "thinking" || this.state === "speaking" || this.state === "waiting_for_silence" || this.state === "user_speaking") return;

        // Prevent duplicate starts if already listening
        if (SpeechRecognitionService.isListening) {
            return;
        }

        if (this.state !== "thinking" && this.state !== "speaking") {
            this.setState("listening");
        }

        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);

        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
                if (this.state === "listening") {
                    this.setState("user_speaking");
                }
            },
            onSilence: () => {
                this.setState("waiting_for_silence");
                setTimeout(() => {
                    if (this.state === "waiting_for_silence") {
                        this.handleFinalInput();
                    }
                }, 300);
            },
            onError: (err) => {
                console.error("Recognition error in continuous cycle:", err);
                if (err === "no-speech") {
                    if (this.isContinuousMode && (this.state === "listening" || this.state === "user_speaking" || this.state === "waiting_for_silence")) {
                        setTimeout(() => this.startListeningCycle(), 300);
                    }
                } else if (err !== "not-allowed" && this.isContinuousMode) {
                    console.log("[VoiceManager] Auto restarting voice recognition after failure:", err);
                    if (this.isContinuousMode && (this.state === "listening" || this.state === "user_speaking" || this.state === "waiting_for_silence")) {
                        setTimeout(() => this.startListeningCycle(), 1000);
                    }
                } else {
                    if (this.state !== "thinking" && this.state !== "speaking") {
                        this.setState("paused");
                    }
                }
            },
            onEnd: () => {
                // If browser ended the recognition session naturally but we are still in continuous mode, auto-restart it
                if (this.isContinuousMode && (this.state === "listening" || this.state === "user_speaking" || this.state === "waiting_for_silence")) {
                    console.log("[VoiceManager] SpeechRecognition ended naturally. Re-starting listening cycle.");
                    setTimeout(() => {
                        this.startListeningCycle();
                    }, 300);
                }
            }
        });
    }

    handleFinalInput() {
        const transcript = this.currentTranscript || "";
        this.currentTranscript = ""; // Reset
        this.submitUserInput(transcript);
    }

    /**
     * Process transcribed text (triggered by hooks or onSilence).
     * @param {string} text
     */
    async submitUserInput(text) {
        if (!text || !text.trim()) {
            if (this.isContinuousMode) {
                this.startListeningCycle();
            } else {
                this.setState("idle");
            }
            return;
        }

        const question = text.trim();
        this.lastQuestion = question;
        console.log(`[VoiceManager] User Spoke: "${question}"`);

        // 1. Auto Detect Spoken Language from Transcript script characters
        const detectedLang = LanguageDetectionService.detect(question);
        
        // Update active language if script matches a different language
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
            return; // Command was handled internally, halt Normal RAG logic
        }

        // 3. Normal LLM Query
        this.setState("thinking");
        // In continuous mode, wait until TTS finishes before reopening the microphone.
        this.activeAbortController = new AbortController();

        try {
            // Get Groq multilingual prompt injection prefix
            const systemPrefix = LanguageDetectionService.getSystemPrompt(this.activeLang);
            const questionPayload = systemPrefix ? `${systemPrefix}\n\n${question}` : question;

            // Call existing chat sendMessage function with clean display text as 6th parameter
            const responseText = await this.sendMessageCallback(questionPayload, null, null, null, null, question);
            
            if (this.state === "interrupted") {
                console.log("[VoiceManager] Response ignored because conversation was interrupted.");
                return;
            }
            
            this.lastAnswer = responseText || "I did not receive an answer.";
            this.setState("speaking");

            // Speak response
            SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
                onStart: this.handleSpeechStart,
                onEnd: this.handleSpeechEnd
            });
        } catch (error) {
            console.error("Error asking EduMate in Voice Mode:", error);
            const errorReply = this.activeLang === "hi" 
                ? "मुझे खेद है, लेकिन अभी नेटवर्क में कुछ समस्या आ रही है।" 
                : (this.activeLang === "bn" 
                    ? "আমি দুঃখিত, নেটওয়ার্কে কিছু সমস্যা হচ্ছে।" 
                    : "I am sorry, but I am facing network issues right now.");

            this.lastAnswer = errorReply;
            this.setState("speaking");
            SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
                onStart: this.handleSpeechStart,
                onEnd: this.handleSpeechEnd
            });
        } finally {
            this.activeAbortController = null;
        }
    }

    userInterruption() {
        if (this.state === "speaking" || this.state === "thinking") {
            console.log("[VoiceManager] User interrupted!");
            
            // Stop the interruption monitor first, then stop speech and cancel the active request.
            SpeechRecognitionService.stopInterruptionMonitor();
            SpeechSynthesisService.cancel();
            
            // Cancel AI response (AbortController)
            if (this.activeAbortController) {
                this.activeAbortController.abort();
            }

            this.setState("interrupted");

            setTimeout(() => {
                if (this.state === "interrupted") {
                    if (this.isContinuousMode) {
                        this.startListeningCycle(); // Starts Speech Recognition
                    } else {
                        this.setState("idle");
                    }
                }
            }, 600);
        }
    }

    /**
     * Manual replay of the last assistant reply.
     */
    replayResponse() {
        if (!this.lastAnswer) return;
        this.setState("speaking");
        SpeechSynthesisService.speak(this.lastAnswer, this.activeLang, {
            onStart: this.handleSpeechStart,
            onEnd: this.handleSpeechEnd
        });
    }

    /**
     * Stop and end the entire voice conversation session.
     */
    stopConversation() {
        this.isContinuousMode = false;
        SpeechRecognitionService.abort();
        SpeechSynthesisService.cancel();
        if (this.activeAbortController) {
            this.activeAbortController.abort();
        }
        this.stopTimer();
        this.setState("ended");
        
        // Reset to idle after a short moment
        setTimeout(() => {
            if (this.state === "ended") {
                this.setState("idle");
            }
        }, 500);
    }

    /**
     * Returns a language-specific greeting message.
     */
    getGreetingMessage(langCode) {
        switch (langCode) {
            case "hi":
                return "नमस्ते! मैं एडुमेट हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?";
            case "bn":
                return "হ্যালো! আমি এডুমেট। আজ আপনাকে কীভাবে সাহায্য করতে পারি?";
            case "en":
            default:
                return "Hello. I am EduMate. How may I help you today?";
        }
    }

    /**
     * Start Session Timer.
     */
    startTimer() {
        this.stopTimer();
        this.elapsedSeconds = 0;
        this.notifyTimer(0);
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds += 1;
            this.notifyTimer(this.elapsedSeconds);
        }, 1000);
    }

    /**
     * Stop Session Timer.
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

export default new VoiceConversationManager();
