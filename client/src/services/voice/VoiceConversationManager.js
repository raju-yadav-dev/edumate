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

class VoiceConversationManager {
    constructor() {
        this.state = "idle"; // 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'ended'
        this.isContinuousMode = false;
        this.activeLang = "en"; // 'en' | 'hi' | 'bn'
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
    }

    /**
     * Set the current state and notify subscribers.
     * @param {string} newState
     */
    setState(newState) {
        if (this.state === newState) return;
        console.log(`[VoiceManager] State changed: ${this.state} -> ${newState}`);
        this.state = newState;

        if (newState === "listening") {
            AudioAnalyserService.start().catch((err) => {
                console.warn("Failed to start audio analyser:", err);
            });
        } else {
            AudioAnalyserService.stop();
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

    /**
     * Start a Single Voice Query (one-off voice search).
     * @param {Function} sendMessageFn - Function in Chat.jsx to send query
     */
    startSingleQuery(sendMessageFn) {
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

        // Reset speaking settings
        SpeechSynthesisService.cancel();

        this.setState("listening");
        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);

        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
            },
            onSilence: () => {
                this.handleFinalInput();
            },
            onError: (err) => {
                console.error("Recognition error in single query:", err);
                this.setState("idle");
            },
            onEnd: () => {
                // If it ended naturally without silence (e.g. no speech spoken)
                if (this.state === "listening") {
                    this.setState("idle");
                }
            }
        });
    }

    /**
     * Start a Continuous Conversation session (like ChatGPT voice).
     * @param {Function} sendMessageFn - Function in Chat.jsx to send query
     */
    startContinuousConversation(sendMessageFn) {
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
        this.setState("speaking");
        // Disable microphone while speaking to prevent feedback loops
        SpeechRecognitionService.stop();
    }

    /**
     * Triggered when Synthesis finishes speaking.
     */
    handleSpeechEnd() {
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

        this.setState("listening");
        const recLang = LanguageDetectionService.getSpeechRecognitionLang(this.activeLang);

        SpeechRecognitionService.start({
            lang: recLang,
            onResult: (text, isFinal) => {
                this.notifyTranscript(text, isFinal);
                this.currentTranscript = text;
            },
            onSilence: () => {
                this.handleFinalInput();
            },
            onError: (err) => {
                console.error("Recognition error in continuous cycle:", err);
                if (err === "no-speech") {
                    // Recover by restarting loop
                    this.startListeningCycle();
                } else {
                    this.setState("paused");
                }
            },
            onEnd: () => {
                // If stopped by user or state changed, do not restart
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
        }

        // 2. Check for Built-in Voice Commands
        const wasCommand = VoiceCommandService.detectAndExecute(question, this, this.handlers);
        if (wasCommand) {
            return; // Command was handled internally, halt Normal RAG logic
        }

        // 3. Normal LLM Query
        this.setState("thinking");

        try {
            // Get Groq multilingual prompt injection prefix
            const systemPrefix = LanguageDetectionService.getSystemPrompt(this.activeLang);
            const questionPayload = systemPrefix ? `${systemPrefix}\n\n${question}` : question;

            // Call existing chat sendMessage function
            const responseText = await this.sendMessageCallback(questionPayload);
            
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
        }
    }



    /**
     * User interruption: immediately stops speaking and restarts listening.
     */
    userInterruption() {
        if (this.state === "speaking") {
            console.log("[VoiceManager] User interrupted synthesis!");
            SpeechSynthesisService.cancel();
            
            if (this.isContinuousMode) {
                this.startListeningCycle();
            } else {
                this.setState("idle");
            }
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
        this.stopTimer();
        this.setState("ended");
        
        // Reset to idle after a short moment
        setTimeout(() => {
            if (this.state === "ended") {
                this.setState("idle");
            }
        }, 1500);
    }

    /**
     * Get welcome greetings for supported languages.
     */
    getGreetingMessage(lang) {
        switch (lang) {
            case "hi":
                return "नमस्ते! मैं एडुमेट हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?";
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
