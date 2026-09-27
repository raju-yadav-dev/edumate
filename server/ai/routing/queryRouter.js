/**
 * EduMate Mission 13.4 — Intelligent LLM + RAG Query Router
 * 
 * Classifies queries into:
 * 1. GENERAL_KNOWLEDGE: Pre-trained LLM answers immediately, skipping RAG (0 ms retrieval latency).
 * 2. UNIVERSITY_SPECIFIC: RAG vector search with metadata filters; fallback if 0 chunks.
 * 3. MIXED: Retrieve university chunks and let LLM combine them with pre-trained knowledge.
 * 4. CONVERSATIONAL: Fast conversational / greeting / pleasantry handler skipping RAG.
 */

const { INTENTS, INSTITUTIONAL_INTENTS } = require("../../constants/intents");

const ROUTER_ROUTES = Object.freeze({
    GENERAL_KNOWLEDGE: "GENERAL_KNOWLEDGE",
    UNIVERSITY_SPECIFIC: "UNIVERSITY_SPECIFIC",
    MIXED: "MIXED",
    CONVERSATIONAL: "CONVERSATIONAL"
});

// -------------------------------------------------------------
// Pattern Definitions
// -------------------------------------------------------------

const CONVERSATIONAL_PATTERNS = [
    // Greetings
    /^(?:hi|hello|hey|heyy|howdy|sup|greetings|good\s+(?:morning|afternoon|evening|day|night))\b/i,
    // Bot identity / capabilities
    /\b(?:who\s+are\s+you|what\s+is\s+your\s+name|what\s+are\s+you|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself|introduce\s+yourself|how\s+are\s+you|how\s+are\s+you\s+doing)\b/i,
    // Gratitude
    /\b(?:thank\s+you|thanks|thanks\s+a\s+lot|thank\s+you\s+so\s+much|much\s+appreciated|thx)\b/i,
    // Farewells
    /\b(?:bye|goodbye|see\s+you|see\s+ya|have\s+a\s+nice\s+day|take\s+care)\b/i,
    // Casual acknowledgments & continuation
    /^(?:ok|okay|cool|nice|got\s+it|understood|awesome|great|sure|fine|continue|explain\s+again|tell\s+me\s+more)\b/i
];

const ACRONYM_DEFINITION_PATTERNS = [
    /\b(?:full\s+form\s+of|stands?\s+for|what\s+does\s+[a-z0-9.]+\s+mean|definition\s+of\s+the\s+acronym|what\s+is\s+the\s+abbreviation|abbreviation\s+for)\b/i
];

const UNIVERSITY_KEYWORDS = [
    // Institution identifiers
    "brainware", "brainware university", "bwu", "edumate", "college", "campus", "our college", "this college",
    "our university", "this university", "the university", "institute", "institution", "on campus",

    // Institutional hierarchy & officials
    "hod", "head of department", "head of the department", "department head", "dean", "chancellor",
    "vice chancellor", "registrar", "warden", "chief warden", "proctor", "placement officer", "faculty", "professor",
    "professors", "teacher", "teachers", "staff", "dr.", "prof.", "who teaches", "who is the faculty",
    "faculty advisor", "faculty members", "department", "departments", "dept",

    // Admissions & fees
    "admission", "admissions", "apply", "application form", "eligibility", "eligibility criteria",
    "enroll", "enrollment", "cut off", "cutoff", "seat matrix", "intake", "tuition fee", "tuition fees",
    "semester fee", "semester fees", "hostel fee", "hostel fees", "bus fee", "bus transport fees", "transport fee",
    "fee structure", "admission fee", "fees", "fee breakdown", "payment", "refund", "total fee", "course cost",
    "college fees", "installment payment", "entrance exam", "computer application fee", "computer application fees",
    "bachelor of computer applications fees", "bca fees", "btech fees", "mca fees", "mba fees",

    // Academics & programs
    "syllabus", "curriculum", "course structure", "academic calendar", "exam routine", "exam schedule",
    "semester exam", "semester exams", "timetable", "admit card", "grade card", "marksheet", "cgpa criteria",
    "attendance rule", "attendance rules", "btech", "b.tech", "mtech", "m.tech", "bca", "mca", "bba", "mba",
    "b.sc", "m.sc", "bba llb", "llb", "diploma in", "courses offered", "programs offered", "programmes offered",
    "degrees offered", "courses and degrees", "exam cell", "in css", "in cse", "css department", "cse department",
    "computational sciences", "elective", "electives", "taught in", "taught at", "covered in",

    // Facilities & services
    "hostel", "mess", "canteen", "cafeteria", "library", "central library", "library card", "book issue",
    "book return", "scholarship", "scholarships", "swami vivekananda", "freeship", "financial aid", "placement", "placements",
    "highest package", "average package", "salary package", "top recruiters", "recruitment drive", "internship",
    "campus placement", "training & placement", "placement drives", "engineering placement", "mca placement",
    "curfew", "curfew timings", "student portal", "labs", "lab", "scheduled", "workshops",

    // Campus navigation
    "building 1", "building 2", "building 3", "building 4", "building 5", "building 6", "building 7",
    "building 8", "building 9", "room no", "room number", "cash counter", "accounts section", "sick room",
    "medical center", "board room", "seminar hall", "gymnasium", "auditorium", "counseling room", "language lab",
    "moot court", "moot court room", "where is room", "where is building", "where is hod", "how to reach building",
    "which floor is", "where is the",

    // Circulars & notices
    "notice", "notices", "circular", "circulars", "official announcement", "university notification"
];

const GENERAL_KNOWLEDGE_INDICATORS = [
    // Programming Languages & Paradigms
    "python", "javascript", "typescript", "java", "c++", "c#", "golang", "rust", "html", "css", "php", "ruby",
    "swift", "kotlin", "object oriented programming", "oop", "polymorphism", "inheritance", "encapsulation",
    "abstraction", "functional programming", "lambda", "closure", "promises", "async/await", "event loop",
    "pointers in c", "memory management", "garbage collection", "syntax",

    // Data Structures & Algorithms
    "binary search", "linked list", "doubly linked list", "stack", "queue", "priority queue", "hash table",
    "hash map", "binary tree", "binary search tree", "avl tree", "red-black tree", "trie", "graph algorithm",
    "dijkstra", "breadth first search", "depth first search", "dynamic programming", "big o", "recursion",
    "quicksort", "merge sort", "bubble sort", "insertion sort", "heap sort", "time complexity", "space complexity",

    // Web & Systems & Networking
    "react", "vue", "angular", "node.js", "docker", "kubernetes", "sql query", "nosql", "mongodb", "postgresql",
    "rest api", "graphql", "microservices", "tcp/ip", "udp", "http", "https", "dns", "osi model", "subnetting",
    "ip address", "three-way handshake", "socket programming", "operating system", "process vs thread",
    "rest api", "graphql", "microservices", "microservices architecture", "tcp/ip", "udp", "http", "https", "dns", "osi model", "subnetting",
    "ip address", "three-way handshake", "socket programming", "operating system", "operating systems", "process vs thread",
    "deadlock", "race condition", "semaphore", "mutex", "virtual memory", "paging", "cpu scheduling", "networking",
    "computer networking",

    // AI & Machine Learning & Data Science
    "machine learning", "deep learning", "neural network", "transformer model", "gradient descent",
    "convolutional neural network", "recurrent neural network", "lstm", "large language model", "llm",
    "supervised learning", "unsupervised learning", "reinforcement learning", "decision tree", "random forest",
    "support vector machine", "overfitting", "underfitting", "precision and recall", "f1 score", "data science",
    "cyber security", "cybersecurity", "cloud computing", "database management system", "dbms", "acid properties",
    "normalization in dbms", "internet of things", "iot", "robotics", "robotics engineering", "encryption", "rsa algorithm",
    "natural language processing", "nlp", "computer vision", "computer graphics", "blockchain", "blockchain technology",

    // Science, Math, Business, Law, Healthcare
    "photosynthesis", "dna", "rna", "crispr", "mitochondria", "cellular respiration", "newton's",
    "laws of motion", "quantum", "quantum mechanics", "relativity", "speed of light", "black hole",
    "thermodynamics", "entropy", "periodic table", "atomic structure", "chemical bonding", "covalent bond",
    "ionic bond", "electromagnetism", "doppler effect", "solar cell", "solar panels", "photovoltaic",
    "aerodynamics", "biotechnology", "bio-informatics", "pharmaceutical chemistry", "pythagorean theorem",
    "euler's formula", "eigenvalue", "eigenvalues", "eigenvector", "fourier transform", "calculus", "derivative",
    "integral", "differential equation", "linear algebra", "matrix multiplication", "standard deviation",
    "normal distribution", "probability", "bayes theorem", "bayes' theorem", "prime number", "fibonacci",
    "quadratic equation", "corporate law", "constitutional law", "financial accounting", "financial management",
    "digital marketing", "hospital management",

    // General Humanities / History / World / Language
    "capital of", "who was", "who wrote", "who painted", "world war", "industrial revolution", "french revolution",
    "macroeconomics", "microeconomics", "inflation", "gdp", "gnp", "supply and demand", "grammar",
    "synonym", "antonym", "metaphor", "simile", "water cycle", "translate to", "solve the equation", "write a poem", "essay on"
];

/**
 * Normalizes query string for robust regex and token matching.
 */
function normalizeQuery(text) {
    return String(text || "").toLowerCase().trim();
}

/**
 * Checks if a string contains any of the provided keywords.
 */
function matchPatterns(text, keywords) {
    const matched = [];
    for (const kw of keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i");
        if (regex.test(text)) {
            matched.push(kw);
        }
    }
    return matched;
}

/**
 * Detects if a question is strictly a conversational query (greeting, thanks, identity, continuation).
 */
function isConversational(text) {
    const trimmed = text.trim();
    if (!trimmed) return true;
    return CONVERSATIONAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Checks if query is specifically asking for the full form or definition of an acronym.
 */
function isAcronymDefinitionQuery(text) {
    return ACRONYM_DEFINITION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Classifies a question into one of four routing categories.
 * 
 * @param {string} question - Raw or normalized question from the user
 * @param {Object} options - Optional metadata (conversationHistory, activeTopic, intent, etc.)
 * @returns {Object} - { route, skipRag, confidence, matchedSignals, metadataFilters, reason }
 */
function classifyQueryRoute(question, options = {}) {
    const q = normalizeQuery(question);

    if (!q) {
        return {
            route: ROUTER_ROUTES.CONVERSATIONAL,
            skipRag: true,
            confidence: 1.0,
            matchedSignals: ["empty_query"],
            metadataFilters: {},
            reason: "Empty or whitespace query"
        };
    }

    // 1. Check for pure CONVERSATIONAL queries
    if (isConversational(q)) {
        const uniMatches = matchPatterns(q, UNIVERSITY_KEYWORDS);
        if (uniMatches.length === 0) {
            return {
                route: ROUTER_ROUTES.CONVERSATIONAL,
                skipRag: true,
                confidence: 0.98,
                matchedSignals: ["greeting_or_pleasantry"],
                metadataFilters: {},
                reason: "User query is a conversational greeting, pleasantry, bot identity request, or continuation."
            };
        }
    }

    // 2. Acronym / Full Form Inquiries (e.g. "What is the full form of BCA?")
    // If the query specifically asks for full form/meaning and does NOT ask for fees, admissions, syllabus, or faculty:
    const isFullForm = isAcronymDefinitionQuery(q);
    const hasExplicitInstitutionalAsk = /\b(?:fee|fees|tuition|admission|admissions|apply|eligibility|hod|faculty|hostel|scholarship|syllabus|exam|routine|notice|placement|curfew)\b/i.test(q);
    
    if (isFullForm && !hasExplicitInstitutionalAsk) {
        return {
            route: ROUTER_ROUTES.GENERAL_KNOWLEDGE,
            skipRag: true,
            confidence: 0.96,
            matchedSignals: ["acronym_full_form_definition"],
            metadataFilters: {},
            reason: "Query is asking for definition or full form of an acronym. Handled directly by LLM."
        };
    }

    // 3. Identify University Signals & General Knowledge Signals
    const universityMatches = matchPatterns(q, UNIVERSITY_KEYWORDS);
    const generalMatches = matchPatterns(q, GENERAL_KNOWLEDGE_INDICATORS);

    // Context / Conversation Memory hints
    const historyText = options.conversationHistory || options.historyText || "";
    const activeTopic = options.activeTopic || "";
    const detectedIntent = options.intent || "";
    const isInstitutionalIntent = INSTITUTIONAL_INTENTS.includes(detectedIntent);

    // Context-Aware Routing: If follow-up lacks explicit topic but prior turn established university context
    let inheritedUniversityContext = false;
    if (activeTopic || historyText) {
        const contextString = `${activeTopic} ${historyText}`.toLowerCase();
        const hasPriorUniContext = UNIVERSITY_KEYWORDS.some(k => contextString.includes(k)) || 
            /\b(?:bca|mca|btech|mtech|bba|mba|fees?|admission|hostel|syllabus|faculty|hod|campus|brainware|library|scholarship|nursing|pharmacy|building)\b/i.test(contextString);
        
        // Short follow-up queries (<= 7 words) that inquire about attributes of the previously established university topic
        const isFollowUpQuery = (q.split(/\s+/).length <= 7 && !generalMatches.length && (
            /\b(?:fees?\??|eligibility|rules|charges|timings|curfew|cost|how\s+to\s+apply|criteria|syllabus|hod|faculty|where|when|routine|semesters|placement|package|admission|cutoff)\b/i.test(q) ||
            /^(?:fees?\??|what\s+about\s+fees?\??|eligibility\??|what\s+are\s+the\s+rules\??|timings\??|total\s+cost\??|when\s+is\s+the\s+routine\s+published\??|how\s+many\s+semesters\??|criteria\??)$/i.test(q)
        ));

        if (hasPriorUniContext && (isFollowUpQuery || isInstitutionalIntent)) {
            inheritedUniversityContext = true;
        }
    }

    const hasUniversitySignals = universityMatches.length > 0 || isInstitutionalIntent || inheritedUniversityContext;
    const hasGeneralSignals = generalMatches.length > 0;

    // Check dual-clause structure specifically for MIXED queries
    // E.g. "Explain [Concept] and (tell me / what is / who is / how are / which semester) [University inquiry]"
    const isDualClauseMixed = /\b(?:explain|what\s+is|what\s+are|how\s+does|describe)\s+[\w\s\-]+?\s+(?:and|plus|as\s+well\s+as)\s+(?:tell\s+me|what\s+is|what\s+are|who\s+is|where\s+is|how\s+are|how\s+is|how\s+[\w\s]+(?:are|is)|which\s+semester|which\s+faculty|does\s+our|is\s+there|if\s+[\w\s]+is\s+an\s+elective|the\s+fee|the\s+curriculum|the\s+lab|the\s+placement|the\s+admission)\b/i.test(q);

    // 4. Evaluate MIXED Queries (Both general concept explanation AND university facts)
    if (hasUniversitySignals && (isDualClauseMixed || hasGeneralSignals)) {
        // Exclude pure university administrative & staff queries like "Who is the HOD of Biotechnology?" or "Who teaches DSA?"
        const isPureStaffOrAdminQuery = /^(?:who\s+is\s+(?:the\s+)?(?:hod|head\s+of|dean|registrar|vice\s+chancellor|chancellor|warden|director|proctor)|who\s+teaches|who\s+is\s+the\s+faculty|list\s+all\s+professors|which\s+professor)\b/i.test(q);
        if (!isPureStaffOrAdminQuery) {
            return {
                route: ROUTER_ROUTES.MIXED,
                skipRag: false,
                confidence: 0.95,
                matchedSignals: {
                    university: universityMatches,
                    general: generalMatches,
                    inheritedContext: inheritedUniversityContext,
                    isDualClause: isDualClauseMixed
                },
                metadataFilters: options.metadataFilters || {},
                reason: "Query contains both a general technical/academic topic and university-specific inquiries."
            };
        }
    }

    // 5. Evaluate UNIVERSITY_SPECIFIC Queries
    if (hasUniversitySignals) {
        return {
            route: ROUTER_ROUTES.UNIVERSITY_SPECIFIC,
            skipRag: false,
            confidence: 0.95,
            matchedSignals: universityMatches.length > 0 ? universityMatches : ["inherited_university_context"],
            metadataFilters: options.metadataFilters || {},
            reason: "Query targets university administration, fees, admissions, faculty, hostel, syllabus, or campus facilities."
        };
    }

    // 6. Evaluate GENERAL_KNOWLEDGE Queries
    // If no university signals are detected, classify as GENERAL_KNOWLEDGE to let LLM respond directly.
    return {
        route: ROUTER_ROUTES.GENERAL_KNOWLEDGE,
        skipRag: true,
        confidence: 0.92,
        matchedSignals: generalMatches.length > 0 ? generalMatches : ["general_academic_or_open_query"],
        metadataFilters: {},
        reason: "General knowledge or open query with no university institutional markers. RAG bypassed with 0ms retrieval latency."
    };
}

module.exports = {
    ROUTER_ROUTES,
    classifyQueryRoute,
    routeQuery: classifyQueryRoute,
    isConversational,
    isAcronymDefinitionQuery
};
