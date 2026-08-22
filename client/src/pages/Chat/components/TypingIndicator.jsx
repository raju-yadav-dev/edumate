import { GraduationCap } from "lucide-react";
import "../styles/TypingIndicator.css";

export default function TypingIndicator() {
    return (
        <div className="typing-indicator-wrapper">
            <div className="typing-avatar">
                <GraduationCap size={16} />
            </div>
            
            <div className="typing-bubble">
                <div className="typing-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                </div>
            </div>
        </div>
    );
}
