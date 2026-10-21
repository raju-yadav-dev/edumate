/**
 * EduMate Mission 16 — Intelligent LLM-First Hybrid Router (Production Grade)
 * 
 * Pipeline:
 * User Message -> Query Normalizer -> Intent Classifier -> Hybrid Router
 * ├── Mode A: LLM_ONLY     (Zero Qdrant/Mongo retrieval. Pure local Qwen model)
 * ├── Mode B: RAG_LLM      (Institutional knowledge retrieval + Qwen generation with citations)
 * ├── Mode C: RAG_ONLY     (Document lookup / notice cards / syllabus downloads)
 * └── Mode D: LLM_TOOLS    (Document summarization, comparison, quiz generation, timetable analysis)
 * 
 * Target: Router Latency < 20ms | LLM-only < 3s | RAG < 8s
 */

const { INTENTS, INSTITUTIONAL_INTENTS } = require("../../constants/intents");

// ==========================================
// 1. Four Explicit Routing Modes (Mission 16)
// ==========================================
const ROUTER_MODES = Object.freeze({
    LLM_ONLY: "LLM_ONLY",       // Mode A: LLM Only (General Knowledge, Coding, Math, Definitions)
    RAG_LLM: "RAG_LLM",         // Mode B: RAG + LLM (University facts, admissions, fees, syllabus, HOD)
    RAG_ONLY: "RAG_ONLY",       // Mode C: RAG Only (Document & Notice lookup, download syllabus)
    LLM_TOOLS: "LLM_TOOLS"      // Mode D: LLM + Tools (PDF summarize, document comparison, quiz generator)
});

// Backward-compatibility aliases with prior versions
const ROUTER_ROUTES = Object.freeze({
    GENERAL_KNOWLEDGE: "LLM_ONLY",
    UNIVERSITY_SPECIFIC: "RAG_LLM",
    MIXED: "RAG_LLM",
    CONVERSATIONAL: "LLM_ONLY",
    LLM_ONLY: "LLM_ONLY",
    RAG_LLM: "RAG_LLM",
    RAG_ONLY: "RAG_ONLY",
    LLM_TOOLS: "LLM_TOOLS"
});

// ==========================================
// 2. Intent Categories (Mission 16)
// ==========================================
const INTENT_CATEGORIES = Object.freeze({
    GENERAL_KNOWLEDGE: "GENERAL_KNOWLEDGE",
    PROGRAMMING: "PROGRAMMING",
    UNIVERSITY_KNOWLEDGE: "UNIVERSITY_KNOWLEDGE",
    ADMINISTRATIVE: "ADMINISTRATIVE",
    DOCUMENT_LOOKUP: "DOCUMENT_LOOKUP",
    CONVERSATION: "CONVERSATION",
    TOOL_INVOCATION: "TOOL_INVOCATION",
    MIXED_INTENT: "MIXED_INTENT"
});

// ==========================================
// 3. Metadata Trigger Definitions (Mission 16)
// ==========================================

// University Programs & Degrees
const UNIVERSITY_PROGRAMS = [
    "bca", "mca", "btech", "b.tech", "mtech", "m.tech", "bsc", "b.sc", "msc", "m.sc",
    "bba", "mba", "bba llb", "llb", "diploma", "d.pharm", "b.pharm", "m.pharm",
    "gnm", "b.sc nursing", "nursing", "bpt", "bhm", "optometry", "cmlt", "dmlt",
    "bachelor of computer applications", "master of computer applications",
    "bachelor of technology", "master of technology", "bachelor of business administration"
];

// University Departments & Schools
const UNIVERSITY_DEPARTMENTS = [
    "css", "cse", "it", "ece", "me", "ce", "ee", "eee", "civil", "mechanical", "electrical",
    "computational sciences", "computer science", "information technology",
    "electronics & communication", "electronics and communication",
    "allied health", "allied health sciences", "management", "commerce", "law", "school of law",
    "pharmacy", "school of pharmacy", "multimedia", "animation", "biotechnology",
    "humanities", "agriculture", "nursing"
];

// Institutional Hierarchy & Officials
const UNIVERSITY_OFFICIALS = [
    "hod", "head of department", "head of the department", "department head",
    "dean", "chancellor", "vice chancellor", "registrar", "warden", "chief warden",
    "proctor", "placement officer", "faculty", "professor", "professors", "teacher",
    "teachers", "staff", "dr.", "prof.", "who teaches", "who is the faculty",
    "faculty advisor", "faculty members", "exam cell officer"
];

// University Core Entities & Services
const UNIVERSITY_ENTITIES = [
    // Institution Identifiers
    "brainware", "brainware university", "bwu", "edumate", "our college", "this college",
    "our university", "this university", "the university", "on campus",
    
    // Admissions & Fees
    "admission", "admissions", "apply", "application form", "eligibility", "eligibility criteria",
    "enroll", "enrollment", "cut off", "cutoff", "seat matrix", "intake", "tuition fee", "tuition fees",
    "semester fee", "semester fees", "hostel fee", "hostel fees", "bus fee", "transport fee",
    "fee structure", "admission fee", "fees", "fee breakdown", "payment", "refund", "total fee",
    "course cost", "college fees", "installment payment", "entrance exam",
    
    // Academics & Routine
    "syllabus", "curriculum", "course structure", "academic calendar", "exam routine", "exam schedule",
    "semester exam", "semester exams", "timetable", "admit card", "grade card", "marksheet", "cgpa criteria",
    "attendance rule", "attendance rules", "routine", "exam cell",
    
    // Facilities & Campus Services
    "hostel", "mess", "canteen", "cafeteria", "library", "central library", "library card", "book issue",
    "book return", "scholarship", "scholarships", "swami vivekananda", "freeship", "financial aid",
    "placement", "placements", "highest package", "average package", "salary package", "top recruiters",
    "recruitment drive", "internship", "campus placement", "training & placement", "curfew", "curfew timings",
    "student portal", "lab", "labs",
    
    // Campus Buildings & Locations
    "building 1", "building 2", "building 3", "building 4", "building 5", "building 6", "building 7",
    "building 8", "building 9", "room no", "room number", "cash counter", "accounts section", "sick room",
    "medical center", "board room", "seminar hall", "gymnasium", "auditorium", "counseling room", "language lab",
    "moot court", "where is room", "where is building", "where is hod", "how to reach building"
];

// Document Lookup Triggers (Mode C)
const DOCUMENT_LOOKUP_PATTERNS = [
    /\b(?:show|list|find|search|display|get|download|view)\s+(?:the\s+)?(?:notice|notices|circular|circulars|announcement|announcements|official\s+notification)\b/i,
    /\b(?:show|find|view|download)\s+(?:notice|circular)\s+(?:dated|of|from|about|regarding)\b/i,
    /\b(?:download|get|view|show|give\s+me)\s+(?:the\s+)?(?:syllabus|syllabus\s+copy|syllabus\s+pdf|curriculum\s+pdf|question\s+paper|sample\s+paper)\b/i,
    /\b(?:list|show|browse)\s+(?:all\s+)?(?:uploaded\s+documents|hostel\s+documents|admission\s+forms|forms\s+and\s+documents)\b/i
];

// Tool Invocation Triggers (Mode D)
const TOOL_INVOCATION_PATTERNS = [
    /\b(?:summarize|summarise|summary\s+of)\b.*?\b(?:pdf|doc|document|file|notes|syllabus|text)\b/i,
    /\b(?:compare|comparison\s+between|difference\s+between)\b.*?\b(?:documents|files|syllabi|syllabuses|pdfs|courses)\b/i,
    /\b(?:generate|create|make)\s+(?:a\s+)?(?:quiz|test|mcq|flashcards|questions)\b/i,
    /\b(?:analyze|analyse|extract\s+schedule|optimize)\s+(?:the\s+)?(?:timetable|class\s+routine|schedule|calendar)\b/i
];

// Programming & Technical Keywords
const PROGRAMMING_KEYWORDS = [
    "python", "javascript", "typescript", "java", "c++", "c#", "golang", "rust", "html", "php", "ruby",
    "swift", "kotlin", "object oriented programming", "oop", "polymorphism", "inheritance", "encapsulation",
    "abstraction", "functional programming", "lambda", "closure", "promises", "async/await", "event loop",
    "pointers in c", "memory management", "garbage collection", "syntax", "write a java program", "write a python script",
    "binary search", "linked list", "doubly linked list", "stack", "queue", "priority queue", "hash table",
    "hash map", "binary tree", "binary search tree", "avl tree", "red-black tree", "trie", "graph algorithm",
    "dijkstra", "breadth first search", "depth first search", "dynamic programming", "big o", "recursion",
    "quicksort", "merge sort", "bubble sort", "insertion sort", "heap sort", "time complexity", "space complexity",
    "react", "vue", "angular", "node.js", "docker", "kubernetes", "sql query", "nosql", "mongodb", "postgresql",
    "rest api", "graphql", "microservices", "tcp/ip", "udp", "http", "https", "dns", "osi model", "subnetting",
    "ip address", "three-way handshake", "socket programming", "operating system", "process vs thread",
    "deadlock", "race condition", "semaphore", "mutex", "virtual memory", "paging", "cpu scheduling",
    "css styling", "css stylesheet", "cascading style sheets"
];

// General Knowledge Indicators
const GENERAL_KNOWLEDGE_INDICATORS = [
    "machine learning", "deep learning", "neural network", "transformer model", "gradient descent",
    "convolutional neural network", "recurrent neural network", "lstm", "large language model", "llm",
    "supervised learning", "unsupervised learning", "reinforcement learning", "decision tree", "random forest",
    "support vector machine", "overfitting", "underfitting", "precision and recall", "f1 score", "data science",
    "cyber security", "cybersecurity", "cloud computing", "database management system", "dbms", "acid properties",
    "normalization in dbms", "internet of things", "iot", "robotics", "encryption", "rsa algorithm",
    "natural language processing", "nlp", "computer vision", "computer graphics", "blockchain",
    "photosynthesis", "dna", "rna", "crispr", "mitochondria", "cellular respiration", "newton's",
    "laws of motion", "quantum", "quantum mechanics", "relativity", "speed of light", "black hole",
    "thermodynamics", "entropy", "periodic table", "atomic structure", "chemical bonding", "covalent bond",
    "ionic bond", "electromagnetism", "doppler effect", "solar cell", "solar panels", "photovoltaic",
    "aerodynamics", "biotechnology", "bio-informatics", "pharmaceutical chemistry", "pythagorean theorem",
    "euler's formula", "eigenvalue", "eigenvalues", "eigenvector", "fourier transform", "calculus", "derivative",
    "integral", "differential equation", "linear algebra", "matrix multiplication", "standard deviation",
    "normal distribution", "probability", "bayes theorem", "prime number", "fibonacci",
    "capital of", "who was", "who wrote", "who painted", "world war", "industrial revolution",
    "macroeconomics", "microeconomics", "inflation", "gdp", "supply and demand", "grammar",
    "synonym", "antonym", "metaphor", "simile", "water cycle", "translate to", "solve the equation", "write a poem", "essay on"
];

// Conversational / Greeting Patterns
const CONVERSATIONAL_PATTERNS = [
    /^(?:hi|hello|hey|heyy|howdy|sup|greetings|good\s+(?:morning|afternoon|evening|day|night))\b/i,
    /\b(?:who\s+are\s+you|what\s+is\s+your\s+name|what\s+are\s+you|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself|introduce\s+yourself|how\s+are\s+you|how\s+are\s+you\s+doing)\b/i,
    /\b(?:thank\s+you|thanks|thanks\s+a\s+lot|thank\s+you\s+so\s+much|much\s+appreciated|thx)\b/i,
    /\b(?:bye|goodbye|see\s+you|see\s+ya|have\s+a\s+nice\s+day|take\s+care)\b/i,
    /^(?:ok|okay|cool|nice|got\s+it|understood|awesome|great|sure|fine|continue|explain\s+again|tell\s+me\s+more)\b/i
];

const ACRONYM_DEFINITION_PATTERNS = [
    /\b(?:full\s+form\s+of|stands?\s+for|what\s+does\s+[a-z0-9.]+\s+mean|definition\s+of\s+the\s+acronym|what\s+is\s+the\s+abbreviation|abbreviation\s+for)\b/i
];

// ==========================================
// 4. In-Memory LRU Cache & Telemetry Analytics
// ==========================================
const ROUTER_CACHE = new Map();
const MAX_CACHE_SIZE = 1000;

const routerAnalytics = {
    totalRequests: 0,
    llmOnlyRequests: 0,
    ragRequests: 0,
    mixedRequests: 0,
    ragOnlyRequests: 0,
    toolRequests: 0,
    retrievalSkippedCount: 0,
    totalRoutingLatencyMs: 0,
    avgRoutingLatencyMs: 0,
    retrievalLatencySavedMs: 0, // Estimated at ~120ms per skipped retrieval
    recentDecisions: []         // Ring buffer of last 50 decisions
};

function recordRouterDecision(decision) {
    routerAnalytics.totalRequests++;
    routerAnalytics.totalRoutingLatencyMs += decision.routingLatencyMs || 0;
    routerAnalytics.avgRoutingLatencyMs = Number((routerAnalytics.totalRoutingLatencyMs / routerAnalytics.totalRequests).toFixed(2));

    if (decision.mode === ROUTER_MODES.LLM_ONLY) {
        routerAnalytics.llmOnlyRequests++;
    } else if (decision.mode === ROUTER_MODES.RAG_LLM) {
        routerAnalytics.ragRequests++;
        if (decision.isMixed) routerAnalytics.mixedRequests++;
    } else if (decision.mode === ROUTER_MODES.RAG_ONLY) {
        routerAnalytics.ragOnlyRequests++;
    } else if (decision.mode === ROUTER_MODES.LLM_TOOLS) {
        routerAnalytics.toolRequests++;
    }

    if (decision.skipRag) {
        routerAnalytics.retrievalSkippedCount++;
        routerAnalytics.retrievalLatencySavedMs += 120; // 120ms average vector search latency saved
    }

    routerAnalytics.recentDecisions.push({
        timestamp: new Date().toISOString(),
        query: decision.normalizedQuery?.slice(0, 60),
        mode: decision.mode,
        intent: decision.intentCategory,
        confidence: decision.confidence,
        skipRag: decision.skipRag,
        latencyMs: decision.routingLatencyMs
    });

    if (routerAnalytics.recentDecisions.length > 50) {
        routerAnalytics.recentDecisions.shift();
    }
}

function getRouterAnalytics() {
    return { ...routerAnalytics };
}

function resetRouterAnalytics() {
    routerAnalytics.totalRequests = 0;
    routerAnalytics.llmOnlyRequests = 0;
    routerAnalytics.ragRequests = 0;
    routerAnalytics.mixedRequests = 0;
    routerAnalytics.ragOnlyRequests = 0;
    routerAnalytics.toolRequests = 0;
    routerAnalytics.retrievalSkippedCount = 0;
    routerAnalytics.totalRoutingLatencyMs = 0;
    routerAnalytics.avgRoutingLatencyMs = 0;
    routerAnalytics.retrievalLatencySavedMs = 0;
    routerAnalytics.recentDecisions.length = 0;
    return { success: true };
}

// ==========================================
// 5. Query Normalizer & Pattern Matching
// ==========================================
function normalizeQuery(text) {
    return String(text || "").toLowerCase().trim();
}

function matchKeywords(text, list) {
    const matches = [];
    for (const item of list) {
        const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i");
        if (regex.test(text)) {
            matches.push(item);
        }
    }
    return matches;
}

function isConversational(text) {
    const trimmed = text.trim();
    if (!trimmed) return true;
    return CONVERSATIONAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isAcronymDefinition(text) {
    return ACRONYM_DEFINITION_PATTERNS.some((pattern) => pattern.test(text));
}

// ==========================================
// 6. Intent Classifier Engine (Mission 16)
// ==========================================
/**
 * Classifies query into one of 8 distinct intent categories with confidence score.
 * @param {string} rawQuery
 * @param {Object} options
 * @returns {Object} { intentCategory, confidence, matchedEntities, isMixed }
 */
function classifyIntent(rawQuery, options = {}) {
    const q = normalizeQuery(rawQuery);

    // 1. Tool Invocation (Mode D)
    const isTool = TOOL_INVOCATION_PATTERNS.some((p) => p.test(q));
    if (isTool) {
        return {
            intentCategory: INTENT_CATEGORIES.TOOL_INVOCATION,
            confidence: 0.98,
            mode: ROUTER_MODES.LLM_TOOLS,
            skipRag: false
        };
    }

    // 2. Document Lookup (Mode C)
    const isDocLookup = DOCUMENT_LOOKUP_PATTERNS.some((p) => p.test(q));
    if (isDocLookup) {
        return {
            intentCategory: INTENT_CATEGORIES.DOCUMENT_LOOKUP,
            confidence: 0.96,
            mode: ROUTER_MODES.RAG_ONLY,
            skipRag: false
        };
    }

    // 3. Conversational / Pleasantry
    if (isConversational(q)) {
        const uniMatches = matchKeywords(q, UNIVERSITY_ENTITIES);
        if (uniMatches.length === 0) {
            return {
                intentCategory: INTENT_CATEGORIES.CONVERSATION,
                confidence: 0.99,
                mode: ROUTER_MODES.LLM_ONLY,
                skipRag: true
            };
        }
    }

    // 4. Entity Extraction
    const matchedPrograms = matchKeywords(q, UNIVERSITY_PROGRAMS);
    const matchedDepartments = matchKeywords(q, UNIVERSITY_DEPARTMENTS);
    const matchedOfficials = matchKeywords(q, UNIVERSITY_OFFICIALS);
    const matchedEntities = matchKeywords(q, UNIVERSITY_ENTITIES);
    const matchedProgramming = matchKeywords(q, PROGRAMMING_KEYWORDS);
    const matchedGeneral = matchKeywords(q, GENERAL_KNOWLEDGE_INDICATORS);

    // Helper: Detect academic degree / program definition questions (e.g. "What is BCA?", "What is MCA?")
    const isProgramDefinition = (text) => {
        const isDef = /\b(?:what\s+is|what\s+are|define|definition\s+of|explain|overview\s+of|meaning\s+of|tell\s+me\s+about|describe|full\s+form\s+of|stands?\s+for|what\s+does\s+[a-z0-9.]+\s+mean)\b/i.test(text);
        if (!isDef) return false;
        const progPattern = /\b(?:bca|mca|b\.?tech|m\.?tech|bba|mba|b\.?sc|m\.?sc|b\.?pharm|d\.?pharm|llb|bba\s+llb|diploma|bachelor\s+of\s+computer\s+applications|master\s+of\s+computer\s+applications|bachelor\s+of\s+technology|master\s+of\s+technology|bachelor\s+of\s+business\s+administration|master\s+of\s+business\s+administration|computer\s+applications|degree)\b/i;
        return progPattern.test(text);
    };

    // Helper: Detect explicit institutional or university triggers (faculty, HOD, fees, campus, rooms, policies)
    const hasExplicitInstitutionalAsk = (text) => {
        // 1. Explicit university names or self-referential terms
        if (/\b(?:brainware|bwu|my\s+(?:university|college|campus|institution)|our\s+(?:university|college|campus|institution)|this\s+(?:university|college|campus|institution)|the\s+(?:university|college|campus|institution)|on\s+campus|in\s+campus|our\s+campus|my\s+campus|at\s+campus)\b/i.test(text)) {
            return true;
        }
        // 2. University hierarchy & officials (HOD, Dean, Registrar, Professor, Faculty, etc.)
        if (/\b(?:hod|head\s+of\s+(?:the\s+)?department|department\s+head|dean|registrar|vice\s+chancellor|chancellor|warden|proctor|placement\s+officer|faculty|professor|professors|teacher|teachers|who\s+teaches|who\s+is\s+(?:the\s+)?(?:faculty|dr|prof))\b/i.test(text)) {
            return true;
        }
        // 3. Campus locations & room numbers
        if (/\b(?:where\s+is|room\s+(?:no\.?|number|\d+)|building\s+(?:\d+|[ivx]+|\b[a-z]+\b)|which\s+floor|which\s+building|which\s+room|how\s+to\s+reach|cafeteria|canteen|seminar\s+hall|auditorium|gymnasium|language\s+lab|accounts\s+section|cash\s+counter)\b/i.test(text)) {
            return true;
        }
        // 4. Institutional administrative processes, fees, admissions, rules
        if (/\b(?:fees?|tuition|payment|refund|admission|admissions|apply|eligibility|enroll|cut[\s-]?off|hostel|mess|curfew|scholarship|scholarships|financial\s+aid|academic\s+calendar|exam\s+(?:routine|date|schedule)|timetable|class\s+routine|attendance\s+rules?|marksheet|grade\s+card|placement\s+records?|highest\s+package|average\s+package|top\s+recruiters)\b/i.test(text)) {
            return true;
        }
        // 5. University documents & circulars
        if (/\b(?:notice|notices|circular|circulars|official\s+announcement|admission\s+brochure|download\s+syllabus)\b/i.test(text)) {
            return true;
        }
        return false;
    };

    const hasUniAsk = hasExplicitInstitutionalAsk(q);
    const isProgDef = isProgramDefinition(q);
    const isAcronym = isAcronymDefinition(q);
    const hasGeneralConcept = isProgDef || isAcronym || matchedProgramming.length > 0 || matchedGeneral.length > 0 || /\b(?:what\s+is|what\s+are|define|explain|how\s+does|how\s+do|describe|write\s+a\s+program)\s+(?:java|python|c\+\+|coding|programming|algorithm|binary\s+search|data\s+structure|recursion|ai|machine\s+learning|cyber\s+security|calculus|math|physics)\b/i.test(q);

    // Helper: Detect pure faculty / administrative queries (e.g. "Who is the HOD of Cyber Security?", "Where is room 204?")
    const isPureAdminOrFaculty = /^(?:who\s+is\s+(?:the\s+)?(?:hod|head\s+of|dean|registrar|vice\s+chancellor|warden|director|principal)|who\s+teaches|who\s+is\s+(?:the\s+)?(?:faculty|dr|prof)|where\s+is|what\s+is\s+the\s+room|what\s+is\s+the\s+fee|what\s+are\s+the\s+fees|what\s+is\s+the\s+admission|when\s+is\s+the\s+exam)\b/i.test(q) ||
        /^(?:fees?|admissions?|hostel|scholarships?|syllabus|routine|timetable)\s+(?:for|of)\b/i.test(q);

    // 5. MIXED Intent: Query requires BOTH general concept knowledge AND university context
    // e.g. "What is BCA, and what are its fees at my university?"
    // Must NOT be a pure admin/faculty query like "Who is the HOD of Cyber Security?"
    const hasGeneralDefinitionOrConcept = isProgDef || /\b(?:what\s+is|what\s+are|define|explain|how\s+does|how\s+do|overview\s+of|tell\s+me\s+about)\s+(?:[a-z0-9\-+ ]+)\b/i.test(q);
    const hasDualRequirement = (
        /[,\s]+(?:and|plus|also|as\s+well\s+as|along\s+with|\&)\s+/i.test(q) ||
        (hasGeneralDefinitionOrConcept && /\b(?:brainware|bwu|my\s+university|our\s+university|this\s+university|our\s+college|on\s+campus|at\s+our|at\s+my)\b/i.test(q))
    );

    if (!isPureAdminOrFaculty && hasGeneralConcept && hasUniAsk && hasDualRequirement) {
        return {
            intentCategory: INTENT_CATEGORIES.MIXED_INTENT,
            confidence: 0.96,
            mode: ROUTER_MODES.RAG_LLM,
            isMixed: true,
            skipRag: false,
            entities: { programs: matchedPrograms, departments: matchedDepartments, officials: matchedOfficials, entities: matchedEntities }
        };
    }

    // 6. GENERAL Intent: Academic Program / Degree Definitions (e.g. "What is BCA?", "What is MCA?")
    // Do not classify a question as university-specific merely because it mentions a degree or education topic
    if ((isProgDef || isAcronym) && !hasUniAsk) {
        return {
            intentCategory: INTENT_CATEGORIES.GENERAL_KNOWLEDGE,
            confidence: 0.98,
            mode: ROUTER_MODES.LLM_ONLY,
            isMixed: false,
            skipRag: true,
            entities: { programs: matchedPrograms, departments: matchedDepartments, officials: matchedOfficials, entities: matchedEntities }
        };
    }

    // 7. GENERAL Intent: Programming, Mathematics, AI, Science Concepts (e.g. "What is Java?", "What is Cyber Security?")
    if ((matchedProgramming.length > 0 || matchedGeneral.length > 0 || /\b(?:write\s+a\s+program|code|function|debug|algorithm|syntax|recursion|loop|pointer)\b/i.test(q)) && !hasUniAsk) {
        return {
            intentCategory: matchedProgramming.length > 0 ? INTENT_CATEGORIES.PROGRAMMING : INTENT_CATEGORIES.GENERAL_KNOWLEDGE,
            confidence: 0.95,
            mode: ROUTER_MODES.LLM_ONLY,
            isMixed: false,
            skipRag: true,
            entities: { programs: matchedPrograms, departments: matchedDepartments, officials: matchedOfficials, entities: matchedEntities }
        };
    }

    // 8. Context / Memory Inheritance for follow-up questions
    let inheritedUniContext = false;
    const historyText = options.conversationHistory || options.historyText || "";
    const activeTopic = options.activeTopic || "";
    if (activeTopic || historyText) {
        const ctx = `${activeTopic} ${historyText}`.toLowerCase();
        const hasPriorUni = UNIVERSITY_ENTITIES.some((k) => ctx.includes(k)) ||
            /\b(?:bca|mca|btech|mtech|bba|mba|fees?|admission|hostel|syllabus|faculty|hod|campus|brainware)\b/i.test(ctx);
        
        const isShortFollowUp = (q.split(/\s+/).length <= 7 && !matchedGeneral.length && !matchedProgramming.length && !isProgDef && (
            /\b(?:fees?\??|eligibility|rules|charges|timings|curfew|cost|how\s+to\s+apply|criteria|syllabus|hod|faculty|where|when|routine|placement|package|admission|building|floor|room|which\s+building|which\s+floor|which\s+room)\b/i.test(q) ||
            /^(?:fees?\??|what\s+about\s+fees?\??|eligibility\??|what\s+about\s+eligibility\??|what\s+about\s+second\s+semester\??|what\s+is\s+its\s+eligibility\??|which\s+building\??|which\s+floor\??|which\s+room\??)$/i.test(q)
        ));

        if (hasPriorUni && isShortFollowUp) {
            inheritedUniContext = true;
        }
    }

    // 9. UNIVERSITY_SPECIFIC Intent: University faculty, rooms, fees, schedules, policies
    if (hasUniAsk || matchedOfficials.length > 0 || matchedDepartments.length > 0 || matchedEntities.length > 0 || inheritedUniContext) {
        const isAdmin = /\b(?:fee|fees|admission|admissions|hostel|scholarship|curfew|rules|accounts|refund|hod|head\s+of\s+department|dean|registrar|vice\s+chancellor|chancellor|warden|proctor)\b/i.test(q);
        return {
            intentCategory: isAdmin ? INTENT_CATEGORIES.ADMINISTRATIVE : INTENT_CATEGORIES.UNIVERSITY_KNOWLEDGE,
            confidence: 0.95,
            mode: ROUTER_MODES.RAG_LLM,
            isMixed: false,
            skipRag: false,
            entities: { programs: matchedPrograms, departments: matchedDepartments, officials: matchedOfficials, entities: matchedEntities }
        };
    }

    // 10. Default: General Knowledge (Mode A - LLM Only)
    return {
        intentCategory: INTENT_CATEGORIES.GENERAL_KNOWLEDGE,
        confidence: 0.92,
        mode: ROUTER_MODES.LLM_ONLY,
        isMixed: false,
        skipRag: true
    };
}

// ==========================================
// 7. Hybrid Router Engine (Mission 16)
// ==========================================
/**
 * Single entry point router deciding whether to route directly to Qwen, run RAG, lookup docs, or trigger tools.
 * 
 * @param {string} question - Raw user question
 * @param {Object} options - Optional context parameters
 * @returns {Object} Complete routing plan with latency telemetry
 */
function routeHybridQuery(question, options = {}) {
    const startTime = Date.now();
    const q = normalizeQuery(question);

    if (!q) {
        const decision = {
            mode: ROUTER_MODES.LLM_ONLY,
            route: "CONVERSATIONAL",
            intentCategory: INTENT_CATEGORIES.CONVERSATION,
            confidence: 1.0,
            skipRag: true,
            isMixed: false,
            entities: { programs: [], departments: [], officials: [], entities: [] },
            metadataFilters: {},
            reason: "Empty query handled as conversational",
            routingLatencyMs: Date.now() - startTime,
            cached: false
        };
        recordRouterDecision(decision);
        return decision;
    }

    // Check Router Cache for sub-millisecond execution (< 20ms requirement)
    const cacheKey = `${q}::${options.activeTopic || ""}::${Boolean(options.conversationHistory)}`;
    if (ROUTER_CACHE.has(cacheKey)) {
        const cached = { ...ROUTER_CACHE.get(cacheKey) };
        cached.routingLatencyMs = Date.now() - startTime;
        cached.cached = true;
        recordRouterDecision(cached);
        return cached;
    }

    // Prompt Injection Defense Guard (Mission 19)
    const { inspectPromptSecurity } = require("../security/promptInjectionGuard");
    const securityCheck = inspectPromptSecurity(question, options);
    if (securityCheck.isBlocked) {
        const blockedDecision = {
            mode: ROUTER_MODES.LLM_ONLY,
            route: "SECURITY_GUARD",
            intentCategory: INTENT_CATEGORIES.CONVERSATION,
            confidence: 1.0,
            skipRag: true,
            isMixed: false,
            isSecurityBlocked: true,
            fallbackMessage: securityCheck.fallbackMessage,
            entities: { programs: [], departments: [], officials: [], entities: [] },
            metadataFilters: {},
            reason: `Blocked by prompt injection guard (${securityCheck.reason})`,
            routingLatencyMs: Date.now() - startTime,
            cached: false
        };
        recordRouterDecision(blockedDecision);
        return blockedDecision;
    }

    // Classify Intent and determine Mode
    const classification = classifyIntent(q, options);
    const mode = classification.mode;
    const intentCategory = classification.intentCategory;
    const confidence = classification.confidence;
    const skipRag = Boolean(classification.skipRag);
    const isMixed = Boolean(classification.isMixed);

    // Build Metadata Filters for RAG modes
    const metadataFilters = options.metadataFilters || {};
    if (classification.entities) {
        if (classification.entities.programs?.length > 0) {
            metadataFilters.program = classification.entities.programs[0];
        }
        if (classification.entities.departments?.length > 0) {
            metadataFilters.department = classification.entities.departments[0];
        }
    }

    const decision = {
        mode,
        route: mode === ROUTER_MODES.LLM_ONLY ? (intentCategory === INTENT_CATEGORIES.CONVERSATION ? "CONVERSATIONAL" : "GENERAL_KNOWLEDGE") : (isMixed ? "MIXED" : "UNIVERSITY_SPECIFIC"),
        intentCategory,
        confidence,
        skipRag,
        isMixed,
        entities: classification.entities || { programs: [], departments: [], officials: [], entities: [] },
        metadataFilters,
        normalizedQuery: q,
        reason: getRoutingReason(mode, intentCategory, skipRag),
        routingLatencyMs: Date.now() - startTime,
        cached: false
    };

    // Cache Decision
    if (ROUTER_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = ROUTER_CACHE.keys().next().value;
        ROUTER_CACHE.delete(firstKey);
    }
    ROUTER_CACHE.set(cacheKey, decision);

    recordRouterDecision(decision);
    return decision;
}

function getRoutingReason(mode, intent, skipRag) {
    if (mode === ROUTER_MODES.LLM_ONLY) {
        return `Mode A (LLM Only): General query or coding problem. RAG bypassed with 0ms retrieval latency.`;
    }
    if (mode === ROUTER_MODES.RAG_ONLY) {
        return `Mode C (RAG Only): Document or circular lookup. Structured information returned.`;
    }
    if (mode === ROUTER_MODES.LLM_TOOLS) {
        return `Mode D (LLM + Tools): Backend tools and document analysis requested.`;
    }
    return `Mode B (RAG + LLM): Institutional facts requested. Verified context and citations retrieved.`;
}

// ==========================================
// 8. Backward Compatible Exports & Helpers
// ==========================================
function classifyQueryRoute(question, options = {}) {
    const plan = routeHybridQuery(question, options);
    return {
        ...plan,
        matchedSignals: plan.entities
    };
}

module.exports = {
    ROUTER_MODES,
    ROUTER_ROUTES,
    INTENT_CATEGORIES,
    routeHybridQuery,
    routeQuery: routeHybridQuery,
    classifyQueryRoute,
    classifyIntent,
    getRouterAnalytics,
    resetRouterAnalytics,
    isConversational,
    isAcronymDefinitionQuery: isAcronymDefinition,
    UNIVERSITY_PROGRAMS,
    UNIVERSITY_DEPARTMENTS,
    UNIVERSITY_OFFICIALS,
    UNIVERSITY_ENTITIES
};
