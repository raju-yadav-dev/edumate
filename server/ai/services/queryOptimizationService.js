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

            const generalDegrees = new Set([
                "bba", "b.tech", "btech", "b tech", "bca", "mca", "mba", "bsc", "b.sc", "cse", "computer science",
                "bachelor of business administration",
                "bachelor of business administration (honours)",
                "bba (honours)",
                "bba (h)",
                "bachelor of technology",
                "bachelor of computer applications",
                "master of computer applications",
                "master of business administration",
                "bachelor of science",
                "master of science",
                "bachelor of science (honours)",
                "bachelor of laws",
                "bachelor of law",
                "llb",
                "business administration"
            ]);
            const matchesAlias = aliases.some(a => {
                const cleanA = a.toLowerCase().trim();
                if (generalDegrees.has(cleanA)) return false;
                return lower.includes(cleanA);
            });

            const matchesSpecific = !!(matchesDept || matchesProg || matchesAlias);
            if (matchesDeg || matchesSpecific) {
                if (deg) {
                    additions.add(deg);
                    if (deg.toLowerCase() === "b.tech" || deg.toLowerCase() === "btech") {
                        ["B.Tech", "BTech", "B Tech", "Bachelor of Technology"].forEach(a => additions.add(a));
                    }
                }
                if (matchesSpecific) {
                    if (prog) additions.add(prog);
                    if (dept) additions.add(dept);
                    aliases.forEach(a => additions.add(a));
                }
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

function hasExplicitEntity(query) {
    if (!query) return false;
    const q = String(query).toLowerCase().trim();
    const clean = q.replace(/[?.!,:;()'"\-_[\]{}]/g, " ");

    const nonEntityWords = new Set([
        "what", "which", "where", "who", "when", "why", "how", "whose",
        "is", "are", "am", "was", "were", "be", "been", "being",
        "do", "does", "did", "have", "has", "had",
        "can", "could", "will", "would", "should", "may", "might",
        "tell", "give", "show", "find", "locate", "located", "get", "know",
        "me", "us", "you", "about", "please", "exact", "actually",
        "the", "a", "an", "of", "for", "in", "on", "at", "to", "with", "by", "from",
        "room", "number", "num", "no", "floor", "level", "building", "block", "bhavan",
        "office", "cabin", "fee", "fees", "cost", "tuition", "charge", "charges",
        "head", "hod", "person", "name", "details", "detail", "info", "information",
        "it", "its", "they", "their", "them", "this", "that", "these", "those",
        "there", "here", "same"
    ]);

    const tokens = clean.split(/\s+/).filter(Boolean);
    const entityTokens = tokens.filter(t => !nonEntityWords.has(t));
    return entityTokens.length > 0;
}

function resolveReferences(question, context = {}) {
    let q = String(question || "").trim();
    const topic = canonicalTopic(q, context) || context.currentTopic || "";
    const department = context.mentionedDepartment || context.currentDepartment || "";
    const hasOwnEntity = hasExplicitEntity(q);

    if (topic && !hasOwnEntity) {
        q = q.replace(/\b(this course|the course|that course|its course)\b/gi, topic);

        // Follow-up: "What about semester X?"
        const semMatch = q.match(/\b(?:what about|how about|tell me about)?\s*(?:semester|sem)\s*([0-9ivx]+)\b/i);
        if (semMatch && !new RegExp(`\\b${topic.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
            q = `Semester ${semMatch[1]} syllabus curriculum subjects for ${topic}`;
        }

        // Follow-up: "Tell me more" / "Tell me more about it"
        if (/^(tell me more|more details?|explain more|elaborate)( about it| about this)?[\.\?!]*$/i.test(q)) {
            q = `Detailed overview, subjects, and curriculum information for ${topic}`;
        }

        // Follow-up: "Compare it" / "Compare them"
        if (/^(compare it|compare them|compare this|how does it compare)[\.\?!]*$/i.test(q)) {
            q = `Comparison and career scope for ${topic}`;
        }

        if (/\b(what about|what is the|tell me about)\s+(the )?(fee|fees|fee structure|eligibility|admission|placements?|duration)\b/i.test(q) && !new RegExp(`\\b${topic.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
            q += ` for ${topic}`;
        }
        if (/\b(it|its|that)\b/i.test(q) && /\b(fee|fees|eligibility|admission|placement|duration|compare|comparison)\b/i.test(q)) {
            q = q.replace(/\b(it|its|that)\b/gi, topic);
        }
    }

    if (department && !hasOwnEntity) {
        q = q.replace(/\b(this department|that department|the department)\b/gi, department);
        if (/\b(hod|head of department)\b/i.test(q) && !new RegExp(`\\b${department.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(q)) {
            if (!/\b(?:of|for|in)\s+[a-z]/i.test(q)) {
                q += ` of ${department}`;
            }
        }
    }

    // Follow-up: "What about MCA?" when previous query was about BCA fees/admission/etc.
    const whatAboutDegreeMatch = q.match(/^(?:what about|how about)\s+([a-zA-Z.]{2,8})\??$/i);
    if (whatAboutDegreeMatch) {
        const nextDegree = whatAboutDegreeMatch[1].toUpperCase();
        const prevIntent = context.currentIntent || "";
        if (prevIntent === "fees" || /\b(fee|fees|cost|tuition)\b/i.test(context.previousQuery || "")) {
            q = `${nextDegree} fees and fee structure`;
        } else if (prevIntent === "eligibility" || /\b(eligibility|criteria)\b/i.test(context.previousQuery || "")) {
            q = `${nextDegree} eligibility and admission criteria`;
        } else {
            q = `${nextDegree} course details`;
        }
    }

    if (context.lastVerifiedEntity) {
        const ent = context.lastVerifiedEntity;
        const entName = ent.entity || (ent.department ? `HOD of ${ent.department}` : "");
        const entLower = entName.toLowerCase();

        if (entName) {
            // Pronoun resolution only for genuine follow-ups where current question does not have its own explicit entity
            if (!hasOwnEntity && /\b(it|its|that|this|their|they)\b/i.test(q)) {
                q = q.replace(/\b(it|its|that|this|their|they)\b/gi, entName);
            }

            // ONLY apply elliptical follow-up resolution if the question DOES NOT HAVE its own explicit entity
            if (!hasOwnEntity && !q.toLowerCase().includes(entLower)) {
                if (/\b(?:which\s+building|what\s+building|what\s+is\s+the\s+building)\b/i.test(q)) {
                    q = `Which building is ${entName} in`;
                } else if (/\b(?:which\s+floor|what\s+floor|what\s+is\s+the\s+floor)\b/i.test(q)) {
                    q = `Which floor is ${entName} on`;
                } else if (/\b(?:which\s+room|what\s+room|what\s+is\s+the\s+room(?:\s+number)?)\b/i.test(q)) {
                    q = `What is the room number of ${entName}`;
                } else if (/\b(?:where\s+is\s+(?:their|the)?\s*(?:office|cabin|room|lab))\b/i.test(q)) {
                    q = `Where is the office of ${entName}`;
                } else if (/\b(?:who\s+is\s+(?:the\s+)?hod)\b/i.test(q)) {
                    q = `Who is the HOD of ${entName}`;
                }
            }
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
    hasExplicitEntity,
    buildSubqueries,
    canonicalTopic,
    shouldUseLLMForReferenceResolution
};
