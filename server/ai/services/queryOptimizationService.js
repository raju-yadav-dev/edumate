/**
 * Fast, deterministic query optimisation for EduMate.
 * Keeps expensive LLM calls out of preprocessing and improves multi-intent/RAG recall.
 */

const INTENT_PATTERNS = Object.freeze({
    fees: /\b(fee|fees|tuition|cost|charge|charges|payment|pay|fee structure)\b/i,
    faculty: /\b(faculty|faculties|teacher|teachers|professor|professors|lecturer|lecturers|staff|faculty members)\b/i,
    hod: /\b(hod|head of department|department head|chairperson|dean|director|coordinator)\b/i,
    eligibility: /\b(eligibility|eligible|criteria|requirement|requirements|qualification|qualifications)\b/i,
    admission: /\b(admission|admissions|apply|application|enrol|enroll|enrollment|documents required)\b/i,
    scholarship: /\b(scholarship|scholarships|financial aid)\b/i,
    hostel: /\b(hostel|accommodation|residence|mess)\b/i,
    placement: /\b(placement|placements|career|job|recruitment)\b/i,
    courses: /\b(course|courses|programme|program|degree|bca|btech|b\.tech|bba|bsc)\b/i,
    duration: /\b(duration|how long|years|semesters|length of course)\b/i,
    location: /\b(where is|where can i find|location of|room|building|office|floor|lab|directions|navigate)\b/i,
    travel_route: /\b(route|directions|how do i reach|how to reach|go to|travel|distance|eta|how long will it take)\b/i,
    course_recommendation: /\b(better for me|best for me|should i choose|suits me|what should i study|which course is best|which course is better|which course should i|choose a course|recommend a course)\b|(?:\b(?:score|marks|percent|%|stream|arts|science|commerce|12th|class 12)\b.*\b(?:which|what|better|best|choose|study|suits?)\b)/i,
    general_chat: /\b(hello|hi|hey|thanks|thank you)\b/i
});

const INTENT_EXPANSIONS = Object.freeze({
    fees: ["fee", "fees", "fee structure", "tuition", "course fee", "semester fee", "annual fee", "payment"],
    faculty: ["faculty", "faculty members", "professors", "teachers", "teaching staff"],
    hod: ["HOD", "head of department", "department head", "head of the department"],
    eligibility: ["eligibility", "admission criteria", "admission requirements", "qualification"],
    admission: ["admission process", "application", "required documents", "enrollment"],
    scholarship: ["scholarship", "financial aid"],
    hostel: ["hostel", "accommodation", "residence", "mess"],
    placement: ["placements", "career", "recruitment", "job opportunities"],
    courses: ["course details", "programme", "program", "degree"],
    duration: ["course duration", "course length", "years", "semesters"],
    course_recommendation: ["course eligibility", "admission criteria", "required subjects", "minimum marks", "stream requirements", "program details", "fees"]
});

const ALIASES = Object.freeze({
    "b.tech": ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"],
    "btech": ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"],
    "b tech": ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"],
    "cse": ["CSE", "Computer Science", "Computer Science and Engineering", "Computer Science & Engineering"],
    "computer science": ["CSE", "Computer Science and Engineering", "Computer Science & Engineering"],
    "computer science and engineering": ["CSE", "Computer Science", "Computer Science & Engineering"],
    "bca": ["BCA", "B.C.A", "Bachelor of Computer Applications"],
    "bba": ["BBA", "Bachelor of Business Administration"],
    "b.sc": ["B.Sc", "BSc", "Bachelor of Science"]
});

function canonicalTopic(question, context = {}) {
    const q = String(question || "");
    if (/\b(bca|b\.c\.a)\b/i.test(q)) return "BCA";
    if (/\b(b\.?\s*tech|btech|b\s+tech)\b/i.test(q)) return "B.Tech";
    if (/\b(bba|b\.b\.a)\b/i.test(q)) return "BBA";
    if (/\b(b\.?\s*sc|bsc|b\s+sc)\b/i.test(q)) return "B.Sc";
    if (/\b(cse|computer science(?: and| &) engineering)\b/i.test(q)) return "CSE";
    return context.currentTopic || "";
}

function expandAliases(query, context = {}) {
    let q = String(query || "").trim();
    const additions = new Set();
    const lower = q.toLowerCase();

    for (const [key, aliases] of Object.entries(ALIASES)) {
        if (lower.includes(key)) aliases.forEach(a => additions.add(a));
    }

    const topic = canonicalTopic(q, context);
    if (topic === "B.Tech") {
        ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"].forEach(a => additions.add(a));
    }
    if (topic === "CSE" || /\b(b\.?\s*tech)\b/i.test(q) && /\b(fee|fees|tuition|cost)\b/i.test(q)) {
        ["CSE", "Computer Science", "Computer Science and Engineering", "Computer Science & Engineering"].forEach(a => additions.add(a));
    }

    // Dynamic Institutional Knowledge mapping
    if (context && Array.isArray(context.academicEntities)) {
        context.academicEntities.forEach(ent => {
            const deg = ent.degree || "";
            const prog = ent.programme || "";
            const dept = ent.department || "";
            const aliases = Array.isArray(ent.aliases) ? ent.aliases : [];

            const matchesDeg = deg && new RegExp(`\\b${deg.toLowerCase().replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(lower);
            const matchesDept = dept && new RegExp(`\\b${dept.toLowerCase().replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(lower);
            const matchesProg = prog && lower.includes(prog.toLowerCase());
            const matchesAlias = aliases.some(a => lower.includes(a.toLowerCase()));

            if (matchesDeg || matchesDept || matchesProg || matchesAlias) {
                if (deg) {
                    additions.add(deg);
                    if (deg.toLowerCase() === "b.tech" || deg.toLowerCase() === "btech") {
                        ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"].forEach(a => additions.add(a));
                    }
                }
                if (prog) additions.add(prog);
                if (dept) additions.add(dept);
                aliases.forEach(a => additions.add(a));
            }
        });
    }

    return additions.size ? `${q} ${Array.from(additions).join(" ")}`.trim() : q;
}

function detectIntents(question) {
    const q = String(question || "");
    const intents = [];
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(q)) intents.push(intent);
    }
    // Avoid treating every course word as an independent intent when another intent is present.
    const filtered = intents.filter(i => i !== "courses" || intents.length === 1 || !["fees", "faculty", "hod", "eligibility", "admission", "scholarship", "duration", "course_recommendation"].some(x => intents.includes(x)));
    return filtered.length ? filtered : ["general_chat"];
}

function resolveReferences(question, context = {}) {
    let q = String(question || "").trim();
    const topic = canonicalTopic(q, context) || context.currentTopic || "";
    const department = context.mentionedDepartment || context.currentDepartment || "";

    if (topic) {
        q = q.replace(/\b(this course|the course|that course|its course)\b/gi, topic);
        if (/\b(what about|what is the|tell me about)\s+(the )?(fee|fees|fee structure|eligibility|admission|placements?|duration)\b/i.test(q) && !new RegExp(`\\b${topic.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
            q += ` for ${topic}`;
        }
        if (/\b(it|its|that)\b/i.test(q) && /\b(fee|fees|eligibility|admission|placement|duration)\b/i.test(q)) {
            q = q.replace(/\b(it|its|that)\b/gi, topic);
        }
    }

    if (department) {
        q = q.replace(/\b(this department|that department|the department)\b/gi, department);
        if (/\b(hod|head of department)\b/i.test(q) && !new RegExp(`\\b${department.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
            q += ` of ${department}`;
        }
    }

    return expandAliases(q, { ...context, currentTopic: topic });
}

function buildSubqueries(question, intents, context = {}) {
    const base = resolveReferences(question, context);
    const topic = canonicalTopic(base, context) || "";
    const subqueries = [];

    for (const intent of intents) {
        if (intent === "general_chat" || intent === "courses" || intent === "travel_route" || intent === "location") continue;
        const expansion = (INTENT_EXPANSIONS[intent] || []).slice(0, 4);
        const target = [topic, ...expansion].filter(Boolean).join(" ");
        const raw = `${base} ${target}`.trim();
        // Keep retrieval queries compact: deduplicate repeated alias terms.
        const words = raw.split(/\s+/);
        const seen = new Set();
        const compact = words.filter(word => {
            const key = word.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).join(" ");
        subqueries.push(compact);
    }

    return subqueries.length ? Array.from(new Set(subqueries)).slice(0, 4) : [base];
}

function shouldUseLLMForReferenceResolution(question, context = {}) {
    const q = String(question || "");
    if (!context || !context.currentTopic) return false;
    return /\b(it|its|they|them|there|that|those|same|what about|how about)\b/i.test(q);
}

module.exports = {
    ALIASES,
    INTENT_EXPANSIONS,
    detectIntents,
    expandAliases,
    resolveReferences,
    buildSubqueries,
    canonicalTopic,
    shouldUseLLMForReferenceResolution
};
