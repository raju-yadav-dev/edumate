import React from "react";
import { MessageSquare, FileText, Compass, GraduationCap } from "lucide-react";
import "../styles/EmptyState.css";

const STARTER_PROMPTS = [
    {
        icon: GraduationCap,
        label: "Check Admissions",
        text: "What are the admission requirements for the BCA program?"
    },
    {
        icon: FileText,
        label: "Fee Details",
        text: "Can you provide the fee structure for B.Tech Computer Science?"
    },
    {
        icon: Compass,
        label: "Campus Rules",
        text: "What are the rules regarding hostel accommodation and timing?"
    },
    {
        icon: MessageSquare,
        label: "Placements Guide",
        text: "What is the placement record for the MBA department?"
    }
];

export default function EmptyState({ onSelectPrompt }) {
    return (
        <div className="chat-empty-state">
            <header className="empty-state-header">
                <div className="brand-logo-container">
                    <GraduationCap className="brand-icon" size={48} />
                </div>
                <h1>Welcome to EduMate</h1>
                <p>Your institutional assistant. I answer academic, placement, hostel, and general campus queries based on official university documents.</p>
            </header>

            <div className="prompts-grid">
                {STARTER_PROMPTS.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                        <button
                            key={idx}
                            className="prompt-card"
                            onClick={() => onSelectPrompt(prompt.text)}
                        >
                            <span className="prompt-icon-wrapper">
                                <Icon size={20} />
                            </span>
                            <h3>{prompt.label}</h3>
                            <p>"{prompt.text}"</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
