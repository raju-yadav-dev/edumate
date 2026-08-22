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

import useAuth from "../../../hooks/useAuth";

export default function EmptyState({ onSelectPrompt }) {
    const { user } = useAuth();
    const name = user?.fullName ? user.fullName.split(" ")[0] : "Raju";

    return (
        <div className="chat-empty-state">
            <header className="empty-state-header">
                <div className="ai-platform-tag">
                    <GraduationCap className="tag-icon" size={14} />
                    <span>AI Educational Platform</span>
                </div>
                <h1 className="greeting-text">Hello, {name} 👋</h1>
                <p className="subtitle-text">How can I help you today?</p>
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
                                <Icon size={18} />
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
