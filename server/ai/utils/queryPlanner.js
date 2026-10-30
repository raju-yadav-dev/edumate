const { extractSearchMetadata } = require("./keywordEntityExtractor");
const { classifyQueryRoute, ROUTER_ROUTES } = require("../routing/queryRouter");

/**
 * PRODUCTION QUERY PLANNER PIPELINE:
 * User Question -> Route Classification -> Intent Detection -> Entity Extraction -> Metadata Filter Builder -> Qdrant Search Filters
 */

const INTENT_PATTERNS = [
    { intent: "HOD_QUERY", pattern: /\b(?:hod|head\s+of\s+department|department\s+head|head\s+of\s+the\s+department)\b/i },
    { intent: "FACULTY_QUERY", pattern: /\b(?:faculty|professor|professors|teacher|teachers|staff|dean|director|instructor|lecturer|who\s+teaches|who\s+is\s+(?:dr\.|prof\.?))\b/i },
    { intent: "ADMISSION_QUERY", pattern: /\b(?:admission|admissions|apply|eligibility|enroll|entrance|cut[\s-]?off|application\s+fee|admission\s+fee)\b/i },
    { intent: "FEE_QUERY", pattern: /\b(?:fee|fees|tuition|payment|semester\s+fee|total\s+fee|cost|refund|charges|hostel\s+fee)\b/i },
    { intent: "SYLLABUS_QUERY", pattern: /\b(?:syllabus|curriculum|course\s+structure|subjects|papers|topics|semester\s+[0-9ivx]+)\b/i },
    { intent: "HOSTEL_QUERY", pattern: /\b(?:hostel|mess|accommodation|dorm|room\s+allotment|hostel\s+rules|hostel\s+fees?)\b/i },
    { intent: "PLACEMENT_QUERY", pattern: /\b(?:placement|placements|recruiter|recruiters|package|highest\s+package|average\s+package|salary|internship)\b/i },
    { intent: "SCHOLARSHIP_QUERY", pattern: /\b(?:scholarship|scholarships|financial\s+aid|fee\s+waiver|freeship|stipend)\b/i },
    { intent: "NOTICE_QUERY", pattern: /\b(?:notice|notices|circular|circulars|announcement|announcements|official\s+update)\b/i },
    { intent: "COURSE_QUERY", pattern: /\b(?:course|courses|program|programs|programme|programmes|degree|degrees|btech|mtech|bca|mca|bba|mba)\b/i },
    { intent: "CAMPUS_NAVIGATION", pattern: /\b(?:where\s+is|where\s+can\s+i\s+find|location\s+of|how\s+to\s+reach|how\s+to\s+go|go\s+to|directions?|routes?|navigation|campus\s+navigation|academic\s+blocks?|blocks?|building|buildings|floor|floors|room|rooms|lab|labs|office|offices|bhavan|bhawan|canteen|auditorium|library)\b/i }
];

const QUERY_TYPE_RULES = [
    ["Table", /\b(?:table|tabular|row|rows|column|fee\s+breakdown|timetable|fee\s+structure)\b/i],
    ["Comparison", /\b(?:compare|comparison|versus|vs\.?|difference|differentiate)\b/i],
    ["List", /\b(?:list|all|every|directory|faculty|courses|subjects|items|names)\b/i],
    ["Summary", /\b(?:summar(?:y|ize|ise)|overview|brief|highlights?)\b/i]
];

const firstMatch = (source, rules) => {
    const match = rules.find(([, pattern]) => pattern.test(source));
    return match ? match[0] : undefined;
};

/**
 * Plans and extracts structured search parameters from a user question.
 * @param {string} query - The incoming user question
 * @param {Object} [options={}] - Optional context (conversationHistory, activeTopic, user, etc.)
 * @returns {Object} Structured query plan with intent, entities, and filters
 */
const planQuery = (query, options = {}) => {
    const source = String(query || "").trim();
    if (!source) {
        return {
            query: "",
            route: ROUTER_ROUTES.CONVERSATIONAL,
            skipRag: true,
            intent: "UNKNOWN",
            category: undefined,
            department: undefined,
            program: undefined,
            documentType: undefined,
            heading: undefined,
            facultyNames: [],
            keywords: [],
            filters: {},
            qdrantFilter: undefined
        };
    }

    // 1. Intent Detection
    const detectedIntents = INTENT_PATTERNS
        .filter((rule) => rule.pattern.test(source))
        .map((rule) => rule.intent);
    const primaryIntent = detectedIntents[0] || (options.intent ? (Array.isArray(options.intent) ? options.intent[0] : options.intent) : "GENERAL_QUERY");

    // 2. Entity Extraction
    const metadata = extractSearchMetadata(source);
    const hasHod = /\b(?:hod|head\s+of\s+department|department\s+head)\b/i.test(source);
    const hasFee = /\b(?:fee|fees|tuition|cost|charges)\b/i.test(source);
    const hasAdmission = /\b(?:admission|admissions|apply|eligibility|enroll)\b/i.test(source);
    const hasSyllabus = /\b(?:syllabus|curriculum|course\s+structure|subjects?)\b/i.test(source);
    const hasHostel = /\b(?:hostel|mess|accommodation|dorm)\b/i.test(source);
    const hasNotice = /\b(?:notice|notices|circular|circulars|announcement)\b/i.test(source);
    const hasPlacement = /\b(?:placement|placements|package|recruiter|recruiters)\b/i.test(source);
    const hasScholarship = /\b(?:scholarship|scholarships|financial\s+aid|fee\s+waiver)\b/i.test(source);

    let primaryProgram = metadata.programs && metadata.programs.length > 0 ? metadata.programs[0] : undefined;
    let primaryDept = metadata.departments && metadata.departments.length > 0 ? metadata.departments[0] : undefined;

    // Context Inheritance from conversation history / active topic if missing and query is an elliptical follow-up
    const { hasExplicitEntity } = require("../services/queryOptimizationService");
    const hasOwnEntity = hasExplicitEntity(source);
    if (!hasOwnEntity && !primaryProgram && (options.activeTopic || options.conversationHistory || options.historyText)) {
        const ctx = `${options.activeTopic || ""} ${options.conversationHistory || ""} ${options.historyText || ""}`;
        const ctxMeta = extractSearchMetadata(ctx);
        if (ctxMeta.programs && ctxMeta.programs.length > 0) {
            primaryProgram = ctxMeta.programs[0];
        }
        if (!primaryDept && ctxMeta.departments && ctxMeta.departments.length > 0) {
            primaryDept = ctxMeta.departments[0];
        }
    }

    // 3. Category & DocumentType Resolution
    let category = undefined;
    let documentType = undefined;
    let heading = undefined;

    const hasLocation = /\b(?:where\s+is|where\s+can\s+i\s+find|location\s+of|which\s+building|which\s+floor|room\s+number|room\s+no|room|office|cabin|floor|building|academic\s+blocks?|blocks?|bhavan|bhawan|routes?|directions?|navigation|campus\s+navigation|how\s+to\s+reach|how\s+to\s+go)\b/i.test(source);

    if (hasHod && hasLocation) {
        category = ["Campus", "Campus Navigation", "Faculty", "general"];
        // Do not set strict heading to exact "HOD" because campus navigation documents use section headings like "101 HOD-psychology..."
    } else if (hasHod) {
        category = "Faculty";
        heading = "HOD";
    } else if (hasLocation) {
        category = ["Campus", "Campus Navigation", "Faculty", "general"];
    } else if (primaryIntent === "FACULTY_QUERY" || (metadata.facultyNames && metadata.facultyNames.length > 0)) {
        category = "Faculty";
        if (hasHod) heading = "HOD";
    } else if (hasScholarship) {
        category = "Scholarships";
        documentType = "Scholarship";
    } else if (hasAdmission) {
        category = "Admissions";
        if (hasFee) {
            documentType = "Fee Structure";
        } else {
            documentType = "Admission Brochure";
        }
    } else if (hasFee) {
        // Production fee documents are stored under both "Academics" and "Admissions" categories
        // depending on how they were uploaded. Use a multi-value array so the should-clause
        // in buildPlannerQdrantFilter matches either, avoiding the zero-result strict filter.
        category = ["Academics", "Admissions"];
        documentType = "Fee Structure";
    } else if (hasHostel) {
        category = "Hostel";
        documentType = "Hostel Rules";
    } else if (hasSyllabus) {
        category = "Academics";
        documentType = "Syllabus";
    } else if (hasPlacement) {
        category = "Placements";
        documentType = "Placement Report";
    } else if (hasNotice) {
        category = "Notices";
        documentType = "Notice";
    } else if (primaryProgram || primaryDept) {
        category = "Academics";
    }

    if (!documentType && metadata.documentType) {
        documentType = metadata.documentType;
    }

    const queryType = firstMatch(source, QUERY_TYPE_RULES) || "Fact";

    // 4. Metadata Filter Builder
    const filters = {};
    if (category) filters.category = category;
    if (primaryDept) filters.department = primaryDept;
    if (primaryProgram) filters.program = primaryProgram;
    if (documentType) filters.documentType = documentType;
    if (heading) filters.heading = heading;

    // 5. Query Route Classification (Mission 13.4)
    const routingDetails = classifyQueryRoute(source, {
        intent: primaryIntent,
        metadataFilters: filters,
        conversationHistory: options.conversationHistory || options.historyText || "",
        activeTopic: options.activeTopic || ""
    });

    // Build Qdrant-compliant filter structure
    const qdrantMust = [];
    if (category) {
        const catArray = Array.isArray(category) ? category : [category];
        if (catArray.length === 1) {
            qdrantMust.push({ key: "category", match: { value: catArray[0] } });
        } else {
            qdrantMust.push({
                should: catArray.map(c => ({ key: "category", match: { value: c } }))
            });
        }
    }
    if (primaryDept) {
        qdrantMust.push({
            should: [
                { key: "department", match: { value: primaryDept } },
                { key: "departments", match: { value: primaryDept } }
            ]
        });
    }
    if (primaryProgram) {
        qdrantMust.push({
            should: [
                { key: "program", match: { value: primaryProgram } },
                { key: "programs", match: { value: primaryProgram } }
            ]
        });
    }
    if (documentType) {
        qdrantMust.push({ key: "documentType", match: { value: documentType } });
    }
    if (heading) {
        qdrantMust.push({ key: "heading", match: { value: heading } });
    }

    const qdrantFilter = qdrantMust.length > 0 ? { must: qdrantMust } : undefined;

    return {
        query: source,
        mode: routingDetails.mode || (routingDetails.skipRag ? "LLM_ONLY" : "RAG_LLM"),
        route: routingDetails.route,
        skipRag: routingDetails.skipRag,
        isMixed: Boolean(routingDetails.isMixed),
        intentCategory: routingDetails.intentCategory,
        routingDetails,
        intent: primaryIntent,
        detectedIntents,
        category,
        department: primaryDept,
        program: primaryProgram,
        documentType,
        heading,
        facultyNames: metadata.facultyNames || [],
        programs: metadata.programs || [],
        departments: metadata.departments || [],
        semesters: metadata.semesters || [],
        keywords: metadata.keywords || [],
        queryType,
        filters,
        qdrantFilter
    };
};

module.exports = {
    planQuery
};
