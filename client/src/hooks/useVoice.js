/**
 * useVoice.js
 * React hook to expose Voice Assistant controls, playback methods, and settings.
 */

import { useEffect, useState } from "react";
import VoiceConversationManager from "../services/voice/VoiceConversationManager";
import SpeechRecognitionService from "../services/voice/SpeechRecognitionService";
import SpeechSynthesisService from "../services/voice/SpeechSynthesisService";

export default function useVoice() {
    const [voiceState, setVoiceState] = useState(VoiceConversationManager.state);
    const [transcript, setTranscript] = useState({ text: "", isFinal: false });
    const [elapsedSeconds, setElapsedSeconds] = useState(VoiceConversationManager.elapsedSeconds);
    const [activeLang, setActiveLang] = useState(VoiceConversationManager.activeLang);
    const [isMuted, setIsMuted] = useState(VoiceConversationManager.isMuted);
    const [isContinuousMode, setIsContinuousMode] = useState(VoiceConversationManager.isContinuousMode);
    const [autoSpeak, setAutoSpeakState] = useState(() => SpeechSynthesisService.isAutoSpeakEnabled());
    const [ttsSettings, setTtsSettingsState] = useState(() => SpeechSynthesisService.getSettings());

    const isSupported = SpeechRecognitionService.isSupported() && SpeechSynthesisService.isSupported();

    useEffect(() => {
        // Sync states from manager on mount
        setVoiceState(VoiceConversationManager.state);
        setElapsedSeconds(VoiceConversationManager.elapsedSeconds);
        setActiveLang(VoiceConversationManager.activeLang);
        setIsMuted(VoiceConversationManager.isMuted);
        setAutoSpeakState(SpeechSynthesisService.isAutoSpeakEnabled());
        setTtsSettingsState(SpeechSynthesisService.getSettings());

        // Subscribe to state modifications in Manager
        const unsubscribeState = VoiceConversationManager.subscribeState((state) => {
            setVoiceState(state);
            // Also sync active lang and continuous mode when state changes
            setActiveLang(VoiceConversationManager.activeLang);
            setIsContinuousMode(VoiceConversationManager.isContinuousMode);
        });

        // Subscribe to transcript updates
        const unsubscribeTranscript = VoiceConversationManager.subscribeTranscript((t) => {
            setTranscript(t);
        });

        // Subscribe to timer updates
        const unsubscribeTimer = VoiceConversationManager.subscribeTimer((secs) => {
            setElapsedSeconds(secs);
        });

        return () => {
            unsubscribeState();
            unsubscribeTranscript();
            unsubscribeTimer();
        };
    }, []);

    const startSingleQuery = (sendMessageFn) => {
        VoiceConversationManager.startSingleQuery(sendMessageFn);
    };

    const startContinuousConversation = (sendMessageFn) => {
        VoiceConversationManager.startContinuousConversation(sendMessageFn);
    };

    const stopConversation = () => {
        VoiceConversationManager.stopConversation();
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        VoiceConversationManager.isMuted = nextMuted;
        SpeechSynthesisService.setMute(nextMuted);
    };

    const setLanguage = (lang) => {
        VoiceConversationManager.activeLang = lang;
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("edumate-language", lang);
        }
        setActiveLang(lang);
    };

    const replayResponse = () => {
        VoiceConversationManager.replayResponse();
    };

    const pauseSpeaking = () => {
        VoiceConversationManager.pauseSpeaking();
    };

    const resumeSpeaking = () => {
        VoiceConversationManager.resumeSpeaking();
    };

    const setAutoSpeak = (enabled) => {
        VoiceConversationManager.setAutoSpeak(enabled);
        setAutoSpeakState(enabled);
    };

    const setTtsSettings = (settings) => {
        VoiceConversationManager.setTtsSettings(settings);
        setTtsSettingsState(SpeechSynthesisService.getSettings());
    };

    const startListening = () => {
        VoiceConversationManager.startListening();
    };

    const stopListening = () => {
        VoiceConversationManager.stopListening();
    };

    const stopResponse = () => {
        VoiceConversationManager.stopResponse();
    };

    const userInterruption = () => {
        VoiceConversationManager.userInterruption();
    };

    return {
        isSupported,
        voiceState,
        permissionError: VoiceConversationManager.permissionError,
        transcript,
        elapsedSeconds,
        activeLang,
        isMuted,
        autoSpeak,
        ttsSettings,
        isContinuousMode,
        startSingleQuery,
        startContinuousConversation,
        startListening,
        stopListening,
        stopResponse,
        stopConversation,
        toggleMute,
        setLanguage,
        replayResponse,
        pauseSpeaking,
        resumeSpeaking,
        setAutoSpeak,
        setTtsSettings,
        userInterruption
    };
}
