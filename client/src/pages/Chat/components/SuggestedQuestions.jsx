import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import "../styles/SuggestedQuestions.css";

export default function SuggestedQuestions({ suggestions = [], onSelectQuestion }) {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="suggested-questions-container">
            <div className="suggested-title-row">
                <Sparkles className="sparkles-icon" size={14} />
                <span>Suggested Follow-ups</span>
            </div>
            
            <div className="suggestions-list">
                {suggestions.map((question, idx) => (
                    <button
                        key={idx}
                        className="suggestion-item-button"
                        onClick={() => onSelectQuestion(question)}
                    >
                        <span className="suggestion-text">{question}</span>
                        <ArrowRight className="arrow-icon" size={14} />
                    </button>
                ))}
            </div>
        </div>
    );
}
