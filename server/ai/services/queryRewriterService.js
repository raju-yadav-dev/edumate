const llmService = require("./llmService");
const queryOptimizer = require("./queryOptimizationService");

/**
 * Rewrite the user query based on conversational context to be standalone
 * @param {Object} params
 * @param {string} params.question - The current user question
 * @param {string} params.historyText - Recent conversational history text
 * @returns {Promise<string>} - The rewritten standalone query
 */
const rewriteQuery = async ({ question, historyText }) => {
    if (!historyText || historyText.trim() === "") {
        return question;
    }

    const systemPrompt = `You are an AI assistant specialized in search query rewriting.
Given a conversation history and a user's follow-up question, rewrite the question into a single, standalone search query that contains all necessary context (like subjects, names, locations, referents, etc.) to be searched in a database.
Do not answer the question; only output the rewritten question.

Rules:
1. Preserve core meaning.
2. Resolve pronouns (it, they, he, she, there, them, that, etc.) to their context from the history.
3. Keep it brief and optimize for semantic keyword search.
4. If the question is already standalone and does not require context, output the original question exactly.

Output ONLY the rewritten search query. Do not add quotes, preambles, or markdown.

Conversation History:
${historyText}

Follow-up Question: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise query rewriter." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 100 });

        const cleaned = String(response).trim().replace(/^"|"$/g, ""); // strip quotes if generated
        if (cleaned) {
            return cleaned;
        }
    } catch (e) {
        console.error("Query Rewriting failed, using original query:", e.message);
    }

    return question;
};

/**
 * Perform a unified analysis of the user query against conversation memory
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.historyText
 * @param {Object} params.conversationContext
 * @returns {Promise<Object>} - { rewrittenQuery, activeTopic, intent, entities, isRepeat, subqueries, conversationContext, clarificationPrompt }
 */
const resolveHeuristicReferences = (question, context) => {
    let rewritten = String(question || "").trim();
    if (!context) return rewritten;

    const topic = context.currentTopic || "";
    const department = context.mentionedDepartment || context.currentTopic || "";
    
    // 1. Course references
    if (topic) {
        // Replace "this course", "the course", "that course", "its course"
        const courseRegex = /\b(this course|the course|that course|its course)\b/gi;
        if (courseRegex.test(rewritten)) {
            rewritten = rewritten.replace(courseRegex, topic);
        }

        // Placements reference: e.g. "What about placements?", "What is the placement?"
        if (/\b(career opportunities|placements|placement)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            if (rewritten.toLowerCase().includes("what about")) {
                rewritten = rewritten.replace(/\bwhat about\s+(career opportunities|placements|placement)\b/gi, `What are the placements/career opportunities for ${topic}`);
            } else {
                rewritten = rewritten.replace(/\b(career opportunities|placements|placement)\b/gi, `$1 for ${topic}`);
            }
        }
        
        // Eligibility reference: e.g. "What is the eligibility?", "eligibility criteria"
        if (/\b(admission criteria|eligibility|requirements)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(admission criteria|eligibility|requirements)\b/gi, `$1 for ${topic}`);
        }

        // Fee reference: e.g. "What is the fee?", "fee structure"
        if (/\b(fee structure|fees|fee|cost|tuition)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(fee structure|fees|fee|cost|tuition)\b/gi, `$1 for ${topic}`);
        }

        // Admission process reference
        if (/\b(admission process|admission procedure)\b/i.test(rewritten) && !new RegExp(`\\b${topic}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(/\b(admission process|admission procedure)\b/gi, `$1 for ${topic}`);
        }
        
        // Pronoun resolutions if query contains "it" or "its" with punctuation-agnostic word boundaries
        if (/\b(it|its)\b/i.test(rewritten)) {
            rewritten = rewritten.replace(/\b(it|its)\b/gi, topic);
        }
    }

    // 2. Department / HOD / Room references
    if (department) {
        // e.g. "Who is the HOD?" -> "Who is the HOD of the CSS department?"
        const hodRegex = /\b(the HOD|HOD)\b/gi;
        if (hodRegex.test(rewritten) && !new RegExp(`\\b${department}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(hodRegex, `the HOD of the ${department}`);
        }
        
        // e.g. "What is the room number?" -> "What is the room number of the CSS department HOD?"
        const roomRegex = /\b(the room number|room number|room no|the room)\b/gi;
        if (roomRegex.test(rewritten) && !new RegExp(`\\b${department}\\b`, "i").test(rewritten)) {
            rewritten = rewritten.replace(roomRegex, `the room number of the ${department} HOD`);
        }

        const deptRegex = /\b(this department|that department|the department)\b/gi;
        if (deptRegex.test(rewritten)) {
            rewritten = rewritten.replace(deptRegex, department);
        }
    }

    // 3. Map route references
    if (context.routeStart && context.routeDestination) {
        const startName = context.routeStart.name || "start location";
        const destName = context.routeDestination.name || "destination";
        const routeText = `from ${startName} to ${destName}`;
        
        // "how long will it take" -> "What is the travel time for the route from Shyamnagar to Brainware University?"
        if (/\b(how long will it take|how long does it take|travel time|eta)\b/i.test(rewritten)) {
            rewritten = `What is the travel time for the route ${routeText}?`;
        }
        // "show me the second route" -> "Show route 2 from Shyamnagar to Brainware University"
        if (/\b(second route|2nd route|route 2)\b/i.test(rewritten)) {
            rewritten = `Show route 2 ${routeText}`;
        }
    }

    return rewritten;
};

const getAmbiguousClarification = (question, historyText) => {
    const q = String(question || "").toLowerCase();
    
    // Check if the query itself is ambiguous (e.g. doesn't mention BCA or B.Tech)
    const hasBca = /\b(bca|b\.c\.a)\b/i.test(q);
    const hasBtech = /\b(b\.?tech|btech|b\s*tech)\b/i.test(q);
    if (hasBca || hasBtech) {
        return null;
    }

    const isFeeQuery = /\b(fee|fees|cost|tuition|charge|charges)\b/i.test(q);
    const isEligibilityQuery = /\b(eligibility|criteria|requirement|requirements|eligible)\b/i.test(q);
    const isPlacementQuery = /\b(placements|placement|career)\b/i.test(q);
    
    if (!isFeeQuery && !isEligibilityQuery && !isPlacementQuery) {
        return null;
    }
    
    if (!historyText) return null;
    
    // Filter historyText to only include lines containing user queries
    const userLines = historyText.split("\n")
        .filter(line => line.toLowerCase().startsWith("user:"))
        .join("\n");
        
    const histLower = userLines.toLowerCase();
    const bcaCount = (histLower.match(/\bbca\b/g) || []).length;
    const btechCount = (histLower.match(/\b(b\.?tech|btech|b\s*tech)\b/g) || []).length;
    
    if (bcaCount > 0 && btechCount > 0) {
        if (isFeeQuery) {
            return "Do you mean the BCA fee or the B.Tech fee?";
        }
        if (isEligibilityQuery) {
            return "Do you mean the BCA eligibility or the B.Tech eligibility?";
        }
        if (isPlacementQuery) {
            return "Do you mean the BCA placements or the B.Tech placements?";
        }
    }
    
    return null;
};

/**
 * Perform a unified analysis of the user query against conversation memory
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.historyText
 * @param {Object} params.conversationContext
 * @param {Object} params.user
 * @returns {Promise<Object>} - { rewrittenQuery, activeTopic, intent, entities, isRepeat, subqueries, conversationContext, clarificationPrompt }
 */
const analyzeQuery = async ({ question, historyText, conversationContext, user }) => {
    let context = conversationContext || {
        currentTopic: null,
        currentEntity: null,
        currentIntent: null,
        mentionedDepartment: null,
        mentionedCollege: null,
        lastRelevantDocument: null,
        lastRetrievedSources: []
    };

    const originalQuestion = String(question || "").trim();
    const heuristicRewritten = queryOptimizer.resolveReferences(originalQuestion, context);
    const intents = queryOptimizer.detectIntents(originalQuestion);
    const topic = queryOptimizer.canonicalTopic(originalQuestion, context) || context.currentTopic || "";

    if (topic) {
        context.currentTopic = topic;
        context.currentEntity = topic;
    }

    // Keep department context stable for follow-up HOD/location questions.
    const departmentMatch = originalQuestion.match(/\b(?:department of|dept of|department)\s+([A-Za-z][A-Za-z &-]{2,50})/i);
    if (departmentMatch) context.mentionedDepartment = departmentMatch[1].trim();
    if (/\bcse\b/i.test(originalQuestion)) context.mentionedDepartment = "CSE";

    // 1. Fetch dynamic academic metadata from institutional documents database
    let academicEntities = [];
    try {
        const Document = require("../../models/Document");
        const queryFilter = {
            status: "active",
            embeddingStatus: "indexed"
        };
        if (user && user.institution) {
            queryFilter.institution = user.institution;
        }
        const docs = await Document.find(queryFilter).lean();
        docs.forEach(doc => {
            if (doc.metadata && Array.isArray(doc.metadata.academicEntities)) {
                doc.metadata.academicEntities.forEach(ent => {
                    academicEntities.push(ent);
                });
            }
        });
    } catch (dbErr) {
        console.error("[QueryRewriter] Failed to load academic entities:", dbErr.message);
    }

    // 2. Check for degree query ambiguity (e.g. asking "What is the B.Tech fee?" when multiple programmes exist)
    const queryLower = originalQuestion.toLowerCase();
    let matchedDegree = null;
    let matchedDegreeEntities = [];
    
    academicEntities.forEach(ent => {
        const deg = ent.degree ? ent.degree.trim() : "";
        if (!deg) return;
        
        const degLower = deg.toLowerCase();
        const degAliases = Array.isArray(ent.aliases) ? ent.aliases.map(a => a.toLowerCase()) : [];
        
        const matchesDegree = new RegExp(`\\b${degLower.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(queryLower) ||
                              degAliases.some(a => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(queryLower));
                              
        if (matchesDegree) {
            matchedDegree = deg;
            matchedDegreeEntities.push(ent);
        }
    });

    if (matchedDegreeEntities.length > 0) {
        let queryMentionsSpecificProgramme = false;
        const uniqueProgrammes = [];
        const seenProgrammes = new Set();
        
        matchedDegreeEntities.forEach(ent => {
            const prog = ent.programme || ent.department || ent.course;
            if (prog && !seenProgrammes.has(prog.toLowerCase())) {
                seenProgrammes.add(prog.toLowerCase());
                uniqueProgrammes.push(prog);
            }
        });

        // Check if query mentions any specific programme details or aliases
        for (const ent of matchedDegreeEntities) {
            const prog = ent.programme ? ent.programme.toLowerCase() : "";
            const dept = ent.department ? ent.department.toLowerCase() : "";
            const course = ent.course ? ent.course.toLowerCase() : "";
            const aliases = Array.isArray(ent.aliases) ? ent.aliases.map(a => a.toLowerCase()) : [];
            
            const matches = (prog && queryLower.includes(prog)) ||
                            (dept && queryLower.includes(dept)) ||
                            (course && queryLower.includes(course)) ||
                            aliases.some(a => queryLower.includes(a));
                            
            if (matches) {
                queryMentionsSpecificProgramme = true;
                break;
            }
        }

        // If there are multiple programmes under this degree and user didn't specify one, ask a clarification question
        if (uniqueProgrammes.length > 1 && !queryMentionsSpecificProgramme) {
            const displayNames = uniqueProgrammes.map(progName => {
                const ent = matchedDegreeEntities.find(e => e.programme === progName);
                return ent.department || ent.course || ent.programme;
            });
            const uniqueDisplayNames = Array.from(new Set(displayNames)).filter(Boolean);
            
            if (uniqueDisplayNames.length > 1) {
                const listStr = uniqueDisplayNames.slice(0, -1).join(", ") + " or " + uniqueDisplayNames.slice(-1);
                const dynamicClarification = `Which ${matchedDegree} programme do you mean — ${listStr}?`;
                
                return {
                    activeTopic: matchedDegree,
                    rewrittenQuery: heuristicRewritten,
                    intent: intents.length === 1 ? intents[0] : intents,
                    entities: {
                        course: matchedDegree,
                        department: null
                    },
                    isRepeat: false,
                    subqueries: [heuristicRewritten],
                    conversationContext: context,
                    clarificationPrompt: dynamicClarification
                };
            }
        }
    }

    // Resolve obvious ambiguity without an LLM.
    const clarificationPrompt = getAmbiguousClarification(originalQuestion, historyText);
    if (clarificationPrompt) {
        return {
            activeTopic: topic,
            rewrittenQuery: heuristicRewritten,
            intent: intents.length === 1 ? intents[0] : intents,
            entities: {
                course: topic || null,
                department: context.mentionedDepartment || null
            },
            isRepeat: false,
            subqueries: [heuristicRewritten],
            conversationContext: context,
            clarificationPrompt
        };
    }

    // Optional LLM reference resolution
    if (process.env.ENABLE_LLM_QUERY_ANALYSIS === "true" && queryOptimizer.shouldUseLLMForReferenceResolution(originalQuestion, context)) {
        try {
            const response = await llmService.generateCompletion([
                { role: "system", content: "Rewrite the user's follow-up into one short standalone search query. Output only the query." },
                { role: "user", content: `Context topic: ${context.currentTopic || "none"}\nDepartment: ${context.mentionedDepartment || "none"}\nQuestion: ${originalQuestion}` }
            ], { temperature: 0, maxOutputTokens: 60 });
            if (response && response.trim()) {
                const cleaned = response.trim().replace(/^"|"$/g, "");
                context.currentTopic = topic || context.currentTopic;
                return {
                    activeTopic: context.currentTopic || "",
                    rewrittenQuery: queryOptimizer.expandAliases(cleaned, { ...context, academicEntities }),
                    intent: intents.length === 1 ? intents[0] : intents,
                    entities: { course: topic || null, department: context.mentionedDepartment || null },
                    isRepeat: false,
                    subqueries: queryOptimizer.buildSubqueries(cleaned, intents, { ...context, academicEntities }),
                    conversationContext: context,
                    clarificationPrompt: null
                };
            }
        } catch (error) {
            console.warn("Optional LLM query analysis failed; using deterministic analysis:", error.message);
        }
    }

    const rewrittenQuery = queryOptimizer.expandAliases(heuristicRewritten, { ...context, academicEntities });
    const subqueries = queryOptimizer.buildSubqueries(rewrittenQuery, intents, { ...context, academicEntities });
    const intent = intents.length === 1 ? intents[0] : intents;
    const entities = {
        course: /\b(bca|b\.c\.a)\b/i.test(originalQuestion) ? "BCA" : /\b(b\.?\s*tech|btech|b\s+tech)\b/i.test(originalQuestion) ? "B.Tech" : null,
        department: context.mentionedDepartment || (/\b(cse|computer science)\b/i.test(originalQuestion) ? "CSE" : null),
        location: null,
        institution: null
    };

    context.currentIntent = intent;
    context.lastRelevantSources = context.lastRelevantSources || [];

    return {
        activeTopic: context.currentTopic || "",
        rewrittenQuery,
        intent,
        entities,
        isRepeat: false,
        subqueries,
        conversationContext: context,
        clarificationPrompt: null
    };
};

module.exports = {
    rewriteQuery,
    analyzeQuery
};
