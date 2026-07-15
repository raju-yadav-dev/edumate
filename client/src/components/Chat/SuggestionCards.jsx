import { FiAward, FiBookOpen, FiBriefcase, FiBus, FiCalendar, FiCheckCircle, FiClock, FiCompass, FiFileText, FiHome, FiMap, FiMonitor, FiPieChart, FiShield, FiUsers, FiVideo } from "react-icons/fi";

const iconMap = {
    admission: FiBookOpen,
    hostel: FiHome,
    fees: FiPieChart,
    placement: FiBriefcase,
    scholarship: FiAward,
    transport: FiBus,
    faculty: FiUsers,
    departments: FiMonitor,
    library: FiFileText,
    calendar: FiCalendar,
    examination: FiCheckCircle,
    notice: FiShield,
    events: FiVideo,
    campus: FiMap,
    nearby: FiCompass,
    schedule: FiClock
};

const defaultCards = [
    { key: "admission", label: "Admission", prompt: "Explain the admission process, documents, and important deadlines.", icon: "admission" },
    { key: "hostel", label: "Hostel", prompt: "Show hostel options, rules, and facilities for students.", icon: "hostel" },
    { key: "fees", label: "Fees", prompt: "Break down the fee structure and payment timeline.", icon: "fees" },
    { key: "placement", label: "Placement", prompt: "Tell me about placement support, companies, and outcomes.", icon: "placement" },
    { key: "scholarship", label: "Scholarship", prompt: "List available scholarships and eligibility criteria.", icon: "scholarship" },
    { key: "transport", label: "Transport", prompt: "Share transport routes, timings, and pass information.", icon: "transport" },
    { key: "faculty", label: "Faculty", prompt: "Introduce the faculty strength and academic expertise.", icon: "faculty" },
    { key: "departments", label: "Departments", prompt: "Explain the departments and the programs offered.", icon: "departments" },
    { key: "library", label: "Library", prompt: "Describe the library access, timings, and resources.", icon: "library" },
    { key: "calendar", label: "Academic Calendar", prompt: "Summarize the academic calendar, holidays, and terms.", icon: "calendar" },
    { key: "examination", label: "Examination", prompt: "Outline the examination schedule and key rules.", icon: "examination" },
    { key: "notice", label: "Notice", prompt: "Show the latest important notices for students.", icon: "notice" },
    { key: "events", label: "Events", prompt: "What campus events are coming up this month?", icon: "events" },
    { key: "campus", label: "Campus Map", prompt: "Help me understand the campus layout and major locations.", icon: "campus" },
    { key: "nearby", label: "Nearby Hostels", prompt: "Suggest nearby hostel options and commute convenience.", icon: "nearby" },
    { key: "schedule", label: "Daily Schedule", prompt: "Create a practical daily academic schedule for me.", icon: "schedule" }
];

function SuggestionCards({ onSelectPrompt, cards = defaultCards }) {
    return (
        <div className="edu-chat-suggestion-grid">
            {cards.map((card) => {
                const Icon = iconMap[card.icon] || FiCompass;

                return (
                    <button key={card.key} type="button" className="edu-chat-suggestion-card" onClick={() => onSelectPrompt(card.prompt)}>
                        <span className="edu-chat-suggestion-icon">
                            <Icon />
                        </span>
                        <strong>{card.label}</strong>
                        <p>{card.prompt}</p>
                    </button>
                );
            })}
        </div>
    );
}

export default SuggestionCards;