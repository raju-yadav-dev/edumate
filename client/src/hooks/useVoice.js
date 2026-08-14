/**
 * useVoice.js
 * React hook to expose Voice Assistant controls and states.
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

    const isSupported = SpeechRecognitionService.isSupported() && SpeechSynthesisService.isSupported();

    useEffect(() => {
        // Sync states from manager on mount
        setVoiceState(VoiceConversationManager.state);
        setElapsedSeconds(VoiceConversationManager.elapsedSeconds);
        setActiveLang(VoiceConversationManager.activeLang);
        setIsMuted(VoiceConversationManager.isMuted);

        // Subscribe to state modifications in Manager
        const unsubscribeState = VoiceConversationManager.subscribeState((state) => {
            setVoiceState(state);
            // Also sync active lang when state changes (e.g. auto switch)
            setActiveLang(VoiceConversationManager.activeLang);
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

    const userInterruption = () => {
        VoiceConversationManager.userInterruption();
    };

    return {
        isSupported,
        voiceState,
        transcript,
        elapsedSeconds,
        activeLang,
        isMuted,
        isContinuousMode: VoiceConversationManager.isContinuousMode,
        startSingleQuery,
        startContinuousConversation,
        stopConversation,
        toggleMute,
        setLanguage,
        replayResponse,
        userInterruption
    };
}
