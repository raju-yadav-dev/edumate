const { INTENTS } = require("../constants/intents");

const intentRules = [
    { intent: INTENTS.GREETING, score: 0.98, pattern: /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i },
    { intent: INTENTS.ADMISSION, score: 0.9, pattern: /\b(admission|apply|eligibility|enroll|application form)\b/i },
    { intent: INTENTS.FEES, score: 0.9, pattern: /\b(fee|fees|tuition|payment|refund|cost)\b/i },
    { intent: INTENTS.SCHOLARSHIP, score: 0.9, pattern: /\b(scholarship|financial aid|stipend|waiver)\b/i },
    { intent: INTENTS.HOSTEL, score: 0.88, pattern: /\b(hostel|mess|accommodation|room allotment)\b/i },
    { intent: INTENTS.LIBRARY, score: 0.86, pattern: /\b(library|book|journal|issue|return)\b/i },
    { intent: INTENTS.FACULTY, score: 0.86, pattern: /\b(faculty|professor|teacher|hod|dean)\b/i },
    { intent: INTENTS.PLACEMENT, score: 0.88, pattern: /\b(placement|recruiter|internship|package|career)\b/i },
    { intent: INTENTS.DEPARTMENTS, score: 0.84, pattern: /\b(department|branch|school of|discipline)\b/i },
    { intent: INTENTS.COURSES, score: 0.84, pattern: /\b(course|syllabus|curriculum|program|degree)\b/i },
    { intent: INTENTS.EVENTS, score: 0.84, pattern: /\b(event|seminar|workshop|fest|webinar)\b/i },
    { intent: INTENTS.ACADEMIC_CALENDAR, score: 0.9, pattern: /\b(academic calendar|exam date|holiday|semester|timetable)\b/i },
    { intent: INTENTS.DOCUMENT_QUESTION, score: 0.88, pattern: /\b(document|pdf|notice|circular|uploaded file|according to)\b/i },
    { intent: INTENTS.ANNOUNCEMENT, score: 0.86, pattern: /\b(announcement|notice|notification|update)\b/i },
    { intent: INTENTS.NEARBY_PLACES, score: 0.9, pattern: /\b(nearby|near me|around|closest|nearest)\b/i },
    { intent: INTENTS.TRAVEL_ROUTE, score: 0.92, pattern: /\b(route|directions|how to reach|navigate|travel from)\b/i },
    { intent: INTENTS.TRANSPORT, score: 0.86, pattern: /\b(bus|transport|shuttle|metro|train|cab)\b/i },
    { intent: INTENTS.DISTANCE, score: 0.86, pattern: /\b(distance|how far|kilometer|km)\b/i },
    { intent: INTENTS.TRAVEL_COST, score: 0.84, pattern: /\b(fare|travel cost|taxi cost|cab cost)\b/i },
    { intent: INTENTS.ETA, score: 0.84, pattern: /\b(eta|arrival|time to reach|how long)\b/i },
    { intent: INTENTS.EMERGENCY, score: 0.95, pattern: /\b(emergency|police|ambulance|hospital|urgent|help now)\b/i },
    { intent: INTENTS.COURSE_RECOMMENDATION, score: 0.96, pattern: /\b(better for me|best for me|should i choose|suits me|what should i study|which course is best|which course is better|which course should i|choose a course|recommend a course)\b|(?:\b(?:score|marks|percent|%|stream|arts|science|commerce|12th|class 12)\b.*\b(?:which|what|better|best|choose|study|suits?)\b)/i }
];

const classifyIntent = (question) => {
    const normalizedQuestion = String(question || "").trim();

    if (!normalizedQuestion) {
        return {
            intent: INTENTS.UNKNOWN,
            confidence: 0,
            matchedSignals: []
        };
    }

    const matches = intentRules
        .filter((rule) => rule.pattern.test(normalizedQuestion))
        .sort((left, right) => right.score - left.score);

    if (matches.length === 0) {
        return {
            intent: INTENTS.GENERAL_CHAT,
            confidence: 0.55,
            matchedSignals: []
        };
    }

    return {
        intent: matches[0].intent,
        confidence: matches[0].score,
        matchedSignals: matches.map((match) => match.intent)
    };
};

const QUESTION_TYPES = {
    UNIVERSITY_SPECIFIC: "university_specific",
    GENERAL_KNOWLEDGE: "general_knowledge",
    HYBRID: "hybrid"
};

const classifyQuestionType = (question, intent) => {
    const normalized = String(question || "").toLowerCase();

    const universityKeywords = [
        "fee", "fees", "tuition", "admission", "admissions", "enroll", "apply", "routine", 
        "timetable", "exam", "exams", "schedule", "calendar", "marks", "result", "results", 
        "faculty", "department", "departments", "syllabus", "notice", "notices", "announcement", 
        "hostel", "mess", "library", "scholarship", "scholarships", "placement", "placements", 
        "course", "courses", "rules", "regulation", "attendance", "assignment", "assignments", 
        "project", "lab", "labs"
    ];

    const generalKeywords = [
        "programming", "java", "python", "react", "javascript", "html", "css", "c\\+\\+", 
        "artificial intelligence", "ai", "machine learning", "ml", "dsa", "data structure", 
        "algorithm", "algorithms", "networking", "cyber security", "security", "mathematics", 
        "physics", "current affairs", "latest news", "tutorial", "explain", "what is", 
        "how does", "binary search", "database management", "dbms"
    ];

    const hasUniversity = universityKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        return regex.test(normalized);
    });

    const hasGeneral = generalKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        return regex.test(normalized);
    });

    if (hasUniversity && hasGeneral) {
        return QUESTION_TYPES.HYBRID;
    }
    
    if (hasUniversity) {
        return QUESTION_TYPES.UNIVERSITY_SPECIFIC;
    }

    if (hasGeneral) {
        return QUESTION_TYPES.GENERAL_KNOWLEDGE;
    }

    const { INSTITUTIONAL_INTENTS } = require("../constants/intents");
    if (INSTITUTIONAL_INTENTS.includes(intent)) {
        return QUESTION_TYPES.UNIVERSITY_SPECIFIC;
    }

    return QUESTION_TYPES.HYBRID;
};

module.exports = {
    classifyIntent,
    classifyQuestionType,
    QUESTION_TYPES
};
