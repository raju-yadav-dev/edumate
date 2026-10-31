/**
 * VoiceCommandService.js
 * Dedicated service for detecting client-side voice commands in English, Hindi, and Bengali,
 * executing them locally, and generating simulated campus navigation maps and routing geometries.
 */

import SpeechSynthesisService from "./SpeechSynthesisService.js";

// Map routing mock coordinates and geometries
const CAMPUS_START = [22.7203, 88.4851]; // Main Gate

const libraryMapData = {
    type: "routing",
    startLocation: { name: "Main Gate", lat: CAMPUS_START[0], lng: CAMPUS_START[1] },
    destination: { name: "Library", lat: 22.7211, lng: 88.4855 },
    routes: [
        {
            geometry: [CAMPUS_START, [22.7208, 88.4853], [22.7211, 88.4855]],
            mode: "walking",
            label: "Main Walkway",
            time: "4 mins",
            distance: "300 meters",
            cost: "Free",
            instructions: [
                "Start at Main Gate, head north-east.",
                "Turn right at the Admission Block.",
                "Continue straight, Library building will be on your right."
            ]
        }
    ]
};

const admissionMapData = {
    type: "routing",
    startLocation: { name: "Main Gate", lat: CAMPUS_START[0], lng: CAMPUS_START[1] },
    destination: { name: "Admission Office", lat: 22.7208, lng: 88.4853 },
    routes: [
        {
            geometry: [CAMPUS_START, [22.7208, 88.4853]],
            mode: "walking",
            label: "Direct Path",
            time: "1.5 mins",
            distance: "120 meters",
            cost: "Free",
            instructions: [
                "Start at Main Gate, walk straight ahead for 100 meters.",
                "The Admission Office block is directly in front of you."
            ]
        }
    ]
};

const cafeteriaMapData = {
    type: "routing",
    startLocation: { name: "Main Gate", lat: CAMPUS_START[0], lng: CAMPUS_START[1] },
    destination: { name: "Canteen (Cafeteria)", lat: 22.7214, lng: 88.4856 },
    routes: [
        {
            geometry: [CAMPUS_START, [22.7208, 88.4853], [22.7211, 88.4855], [22.7214, 88.4856]],
            mode: "walking",
            label: "Canteen Access Path",
            time: "5.5 mins",
            distance: "450 meters",
            cost: "Free",
            instructions: [
                "Start at Main Gate, walk past the Admission Office.",
                "Walk past the Library block on your right.",
                "The central cafeteria building will be straight ahead."
            ]
        }
    ]
};

class VoiceCommandService {
    constructor() {
        this.commands = [
            // 1. UI: Open Chat History
            {
                id: "open_history",
                patterns: [
                    /^(?:(?:please\s+)?(?:open|show)\s+(?:chat\s+)?history|(?:open\s+)?chat\s+history)$/i,
                    /^(?:(?:चैट\s+)?इतिहास\s+(?:खोलो|दिखाओ)|इतिहास\s+खोलो)$/i,
                    /^(?:(?:চ্যাট\s+)?ইতিহাস\s+(?:খুলুন|খোলো|দেখান|দেখাও)|ইতিহাস\s+খোলো)$/i
                ],
                action: (manager, handlers) => {
                    if (handlers && handlers.openSidebar) {
                        handlers.openSidebar();
                    }
                    const feedback = {
                        en: "Opening chat history.",
                        hi: "चैट इतिहास खोल रही हूँ।",
                        bn: "চ্যাট ইতিহাস খুলছি।"
                    };
                    return feedback[manager.activeLang] || feedback.en;
                }
            },
            // 2. UI: Open Dashboard
            {
                id: "open_dashboard",
                patterns: [
                    /^(?:(?:please\s+)?(?:open|show|go\s+to)\s+dashboard|dashboard)$/i,
                    /^(?:डैशबोर्ड\s+(?:खोलो|दिखाओ|जाओ)|डैशबोर्ड)$/i,
                    /^(?:ড্যাশবোর্ড\s+(?:খুলুন|খোলো|দেখান|দেখাও|যাও)|ড্যাশবোর্ড)$/i
                ],
                action: (manager, handlers) => {
                    if (handlers && handlers.navigate) {
                        handlers.navigate("/");
                    }
                    const feedback = {
                        en: "Opening dashboard.",
                        hi: "डैशबोर्ड खोल रही हूँ।",
                        bn: "ড্যাশবোর্ড খুলছি।"
                    };
                    return feedback[manager.activeLang] || feedback.en;
                }
            },
            // 3. UI: Open Profile
            {
                id: "open_profile",
                patterns: [
                    /^(?:(?:please\s+)?(?:open|show|go\s+to)\s+(?:my\s+)?profile|my\s+profile)$/i,
                    /^(?:(?:मेरी\s+)?प्रोफ़ाइल\s+(?:खोलो|दिखाओ)|मेरी\s+प्रोफाइल)$/i,
                    /^(?:(?:আমার\s+)?প্রোফাইল\s+(?:খুলুন|খোলো|দেখান|দেখাও)|আমার\s+প্রোফাইল)$/i
                ],
                action: (manager, handlers) => {
                    if (handlers && handlers.navigate) {
                        handlers.navigate("/profile");
                    }
                    const feedback = {
                        en: "Opening your profile page.",
                        hi: "आपकी प्रोफ़ाइल खोल रही हूँ।",
                        bn: "আপনার প্রোফাইল খুলছি।"
                    };
                    return feedback[manager.activeLang] || feedback.en;
                }
            },
            // 4. MAP: Navigate to Library
            {
                id: "nav_library",
                patterns: [
                    /^(?:(?:please\s+)?(?:navigate|go|take\s+me)\s+to\s+(?:the\s+)?library|library\s+(?:directions?|map|route)|where\s+is\s+the\s+library)$/i,
                    /^(?:(?:लाइब्रेरी|पुस्तकालय)\s+(?:का\s+रास्ता|ले\s+चलो|कहाँ\s+है)|(?:लाइब्रेरी|पुस्तकालय)\s+दिखाओ)$/i,
                    /^(?:(?:লাইব্রেরি|গ্রন্থাগার)(?:র)?\s+(?:পথ|দেখাও|কোথায়)|লাইব্রেরি\s+নিয়ে\s+চলো)$/i
                ],
                action: (manager, handlers) => {
                    const speechText = {
                        en: "The library is 300 meters away. Walking time is approximately 4 minutes. Three routes have been displayed.",
                        hi: "पुस्तकालय 300 मीटर की दूरी पर है। चलने में लगभग 4 मिनट लगेंगे। मार्ग मानचित्र पर दिखा दिया गया है।",
                        bn: "লাইব্রেরি ৩০০ মিটার দূরে অবস্থিত। হেঁটে যেতে প্রায় ৪ মিনিট সময় লাগবে। পথটি মানচিত্রে প্রদর্শিত হয়েছে।"
                    };
                    const spoken = speechText[manager.activeLang] || speechText.en;
                    
                    if (handlers && handlers.insertLocalMessage) {
                        const questionText = {
                            en: "Take me to Library",
                            hi: "मुझे लाइब्रेरी का रास्ता दिखाओ",
                            bn: "আমাকে লাইব্রেরি নিয়ে চলো"
                        };
                        handlers.insertLocalMessage(
                            questionText[manager.activeLang] || questionText.en,
                            spoken,
                            libraryMapData
                        );
                    }
                    return spoken;
                }
            },
            // 5. MAP: Navigate to Admission Office
            {
                id: "nav_admission",
                patterns: [
                    /^(?:(?:please\s+)?(?:navigate|go|take\s+me)\s+to\s+(?:the\s+)?admission(?:\s+office)?|admission\s+(?:office\s+)?(?:directions?|map|route)|where\s+is\s+(?:the\s+)?admission\s+office)$/i,
                    /^(?:प्रवेश\s+कार्यालय|एडमिशन\s+ऑफिस)\s+(?:का\s+रास्ता|ले\s+चलो|कहाँ\s+है|दिखाओ)$/i,
                    /^(?:ভর্তি\s+অফিস(?:ের)?\s+(?:পথ|দেখাও|কোথায়|নিয়ে\s+চলো))$/i
                ],
                action: (manager, handlers) => {
                    const speechText = {
                        en: "The admission office is 120 meters away. Walking time is approximately 1.5 minutes. Direct route has been displayed.",
                        hi: "प्रवेश कार्यालय 120 मीटर की दूरी पर है। चलने में लगभग डेढ़ मिनट का समय लगेगा। रास्ता दिखा दिया गया है।",
                        bn: "ভর্তি অফিস ১২০ মিটার দূরে অবস্থিত। হেঁটে যেতে প্রায় দেড় মিনিট সময় লাগবে। পথটি প্রদর্শিত হয়েছে।"
                    };
                    const spoken = speechText[manager.activeLang] || speechText.en;
                    
                    if (handlers && handlers.insertLocalMessage) {
                        const questionText = {
                            en: "Navigate to Admission Office",
                            hi: "एडमिशन ऑफिस का रास्ता दिखाओ",
                            bn: "ভর্তি অফিসের দিকনির্দেশ দিন"
                        };
                        handlers.insertLocalMessage(
                            questionText[manager.activeLang] || questionText.en,
                            spoken,
                            admissionMapData
                        );
                    }
                    return spoken;
                }
            },
            // 6. MAP: Find Nearest Cafeteria (Canteen)
            {
                id: "nav_cafeteria",
                patterns: [
                    /^(?:(?:please\s+)?(?:find(?:\s+nearest)?|go\s+to|navigate\s+to|take\s+me\s+to)\s+(?:the\s+)?(?:cafeteria|canteen)|(?:cafeteria|canteen)\s+(?:directions?|map|route)|where\s+is\s+(?:the\s+)?(?:canteen|cafeteria))$/i,
                    /^(?:(?:कैफेटेरिया|कैंटीन)\s+(?:का\s+रास्ता|कहाँ\s+है|ले\s+चलो|दिखाओ))$/i,
                    /^(?:(?:ক্যাফেটেরিয়া|ক্যান্টিন)(?:র)?\s+(?:কোথায়|পথ|দেখাও|নিয়ে\s+চলো))$/i
                ],
                action: (manager, handlers) => {
                    const speechText = {
                        en: "The canteen is 450 meters away. Walking time is approximately 5 minutes. The route has been displayed on the map.",
                        hi: "कैंटीन 450 मीटर की दूरी पर है। चलने में लगभग 5 मिनट लगेंगे। रास्ता मानचित्र पर दिखाया गया है।",
                        bn: "ক্যান্টিন ৪৫০ মিটার দূরে অবস্থিত। হেঁটে যেতে প্রায় ৫ মিনিট সময় লাগবে। পথটি মানচিত্রে প্রদর্শিত হয়েছে।"
                    };
                    const spoken = speechText[manager.activeLang] || speechText.en;
                    
                    if (handlers && handlers.insertLocalMessage) {
                        const questionText = {
                            en: "Find nearest Cafeteria",
                            hi: "कैफेटेरिया का रास्ता बताओ",
                            bn: "নিকটবর্তী ক্যাফেটেরিয়া কোথায়"
                        };
                        handlers.insertLocalMessage(
                            questionText[manager.activeLang] || questionText.en,
                            spoken,
                            cafeteriaMapData
                        );
                    }
                    return spoken;
                }
            },
            // 7. CONTROLLER: Repeat Last Answer
            {
                id: "repeat_answer",
                patterns: [
                    /^(?:(?:please\s+)?repeat(?:\s+last)?(?:\s+answer)?|say\s+again|can\s+you\s+repeat)$/i,
                    /^(?:उत्तर\s+दोहराएं|पिछला\s+उत्तर\s+दोहराओ|फिर\s+से\s+बोलो|दोहराओ)$/i,
                    /^(?:আবার\s+বলো|পুনরাবৃত্তি\s+করুন)$/i
                ],
                action: (manager) => {
                    setTimeout(() => {
                        manager.replayResponse();
                    }, 50);
                    return null; // Return null so the main loop speaks the repeated text instead of this command
                }
            },
            // 8. CONTROLLER: Speak Slower
            {
                id: "speak_slower",
                patterns: [
                    /^(?:(?:please\s+)?(?:speak|talk)\s+slower|slower\s+please)$/i,
                    /^(?:धीरे\s+बोलो|धीरे\s+बात\s+करो)$/i,
                    /^(?:আস্তে\s+বলো|ধীর\s+গতিতে\s+বলো)$/i
                ],
                action: (manager) => {
                    const currentRate = SpeechSynthesisService.rate;
                    SpeechSynthesisService.setRate(currentRate - 0.2);
                    const feedback = {
                        en: "Okay, I will speak slower.",
                        hi: "ठीक है, मैं अब और धीरे बोलूँगी।",
                        bn: "ঠিক আছে, আমি এবার থেকে আর আস্তে কথা বলব।"
                    };
                    return feedback[manager.activeLang] || feedback.en;
                }
            },
            // 9. CONTROLLER: Speak Faster
            {
                id: "speak_faster",
                patterns: [
                    /^(?:(?:please\s+)?(?:speak|talk)\s+faster|faster\s+please)$/i,
                    /^(?:तेज़\s+बोलो|जल्दी\s+बोलो)$/i,
                    /^(?:দ্রুত\s+বলো|তাড়াতাড়ি\s+বলো)$/i
                ],
                action: (manager) => {
                    const currentRate = SpeechSynthesisService.rate;
                    SpeechSynthesisService.setRate(currentRate + 0.2);
                    const feedback = {
                        en: "Okay, I will speak faster.",
                        hi: "ठीक है, मैं अब और तेज़ी से बोलूँगी।",
                        bn: "ঠিক আছে, আমি এবার থেকে আরেকটু দ্রুত কথা বলব।"
                    };
                    return feedback[manager.activeLang] || feedback.en;
                }
            },
            // 10. CONTROLLER: Mute Voice
            {
                id: "mute_voice",
                patterns: [
                    /^(?:(?:please\s+)?mute(?:\s+(?:voice|speaker|audio))?|stop\s+talking|be\s+quiet)$/i,
                    /^(?:म्यूट\s+करें|आवाज़\s+बंद(?: करो)?)$/i,
                    /^(?:নিঃশব্দ\s+করুন|মিউট\s+করো)$/i
                ],
                action: (manager) => {
                    setTimeout(() => {
                        manager.toggleMute();
                    }, 50);
                    return null;
                }
            },
            // 11. CONTROLLER: Unmute Voice
            {
                id: "unmute_voice",
                patterns: [
                    /^(?:(?:please\s+)?unmute(?:\s+(?:voice|speaker|audio))?)$/i,
                    /^(?:अनम्यूट\s+करें|आवाज़\s+चालू(?: करो)?)$/i,
                    /^(?:সশব্দ\s+করুন|আনমিউট\s+করো)$/i
                ],
                action: (manager) => {
                    setTimeout(() => {
                        manager.toggleMute();
                    }, 50);
                    return null;
                }
            },
            // 12. CONTROLLER: Switch to Hindi
            {
                id: "switch_hindi",
                patterns: [
                    /^(?:(?:please\s+)?(?:switch\s+to|speak\s+in|use)\s+hindi)$/i,
                    /^(?:हिंदी\s+में\s+बात\s+करो|हिंदी\s+करो)$/i,
                    /^(?:হিন্দি\s+করো|হিন্দিতে\s+বলো)$/i
                ],
                action: (manager) => {
                    manager.activeLang = "hi";
                    return "अब मैं हिंदी में बात करूँगा। बताइए क्या सहायता करूँ?";
                }
            },
            // 13. CONTROLLER: Switch to English
            {
                id: "switch_english",
                patterns: [
                    /^(?:(?:please\s+)?(?:switch\s+to|speak\s+in|use)\s+english)$/i,
                    /^(?:अंग्रेजी\s+में\s+बात\s+करो|अंग्रेजी\s+करो|इंग्लिश\s+करो)$/i,
                    /^(?:ইংরেজি\s+করো|ইংরেজিতে\s+বলো)$/i
                ],
                action: (manager) => {
                    manager.activeLang = "en";
                    return "Switched to English. How can I help you?";
                }
            },
            // 14. CONTROLLER: Switch to Bengali
            {
                id: "switch_bengali",
                patterns: [
                    /^(?:(?:please\s+)?(?:switch\s+to|speak\s+in|use)\s+(?:bengali|bangla))$/i,
                    /^(?:बंगाली\s+में\s+बात\s+करो|बंगाली\s+करो|बांग्ला\s+करो)$/i,
                    /^(?:বাংলা\s+করো|বাংলায়\s+বলো)$/i
                ],
                action: (manager) => {
                    manager.activeLang = "bn";
                    return "আমি এখন বাংলায় কথা বলব। বলুন কি সাহায্য করতে পারি?";
                }
            },
            // 15. SESSION: Goodbye / Exit
            {
                id: "goodbye",
                patterns: [
                    /^(?:stop\s+listening|goodbye|exit|cancel|bye\s+bye|bye)$/i,
                    /^(?:सुनना\s+बंद\s+करो|बाय|अलविदा)$/i,
                    /^(?:শোনা\s+বন্ধ\s+করো|বিদায়)$/i
                ],
                action: (manager) => {
                    const farewell = {
                        en: "Thank you. Have a great day.",
                        hi: "धन्यवाद। आपका दिन शुभ हो।",
                        bn: "ধন্যবাদ। আপনার দিনটি শুভ হোক।"
                    };
                    const speechFarewell = farewell[manager.activeLang] || farewell.en;
                    
                    manager.setState("speaking");
                    SpeechSynthesisService.speak(speechFarewell, manager.activeLang, {
                        onStart: () => manager.handleSpeechStart(),
                        onEnd: () => manager.stopConversation()
                    });
                    return null; // Handled internally
                }
            }
        ];
    }

    /**
     * Checks if the transcribed text matches any voice command patterns, and executes it.
     * @param {string} text - Spoken text transcript.
     * @param {Object} manager - VoiceConversationManager instance.
     * @param {Object} handlers - UI handlers registered from Chat component.
     * @returns {boolean} - true if command was matched and executed, false otherwise.
     */
    detectAndExecute(text, manager, handlers) {
        if (!text) return false;

        const normalized = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");

        for (const cmd of this.commands) {
            const isMatch = cmd.patterns.some(pattern => {
                if (pattern instanceof RegExp) {
                    return pattern.test(normalized) || pattern.test(text);
                }
                return normalized === pattern.toString().toLowerCase().trim();
            });

            if (isMatch) {
                console.log(`[VoiceCommandService] Command detected: ${cmd.id} for "${text}"`);
                
                // Execute command action
                const response = cmd.action(manager, handlers);

                // If action returns verbal feedback, speak it
                if (response) {
                    manager.setState("speaking");
                    SpeechSynthesisService.speak(response, manager.activeLang, {
                        onStart: () => manager.handleSpeechStart(),
                        onEnd: () => manager.handleSpeechEnd()
                    });
                }
                return true;
            }
        }

        return false;
    }
}

export default new VoiceCommandService();
