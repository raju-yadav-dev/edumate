const courseRegistry = require("../constants/courseRegistry.json");

/**
 * Resolves course aliases in a question to their canonical names.
 * Handles ambiguity by returning clarification prompts if multiple courses match.
 * @param {string} question - The user's question
 * @returns {Object} - { resolvedQuestion, canonicalName, courseId, clarificationPrompt }
 */
const resolveCourseInQuestion = (question) => {
    const q = String(question || "").toLowerCase().trim();
    if (!q) {
        return { resolvedQuestion: question };
    }
    
    // 1. Check for nursing ambiguity
    // "nursing" is in both "Bachelor of Science in Nursing" and "General Nursing & Midwifery"
    const hasNursingWord = /\bnursing\b/i.test(q);
    const hasBscNursing = /\b(bsc|b\.sc|b\.\s*sc)\s+nursing\b/i.test(q) || /\bbachelor\s+of\s+science\s+in\s+nursing\b/i.test(q);
    
    if (hasNursingWord && !hasBscNursing) {
        return {
            clarificationPrompt: "Which nursing programme do you mean — Bachelor of Science in Nursing or General Nursing & Midwifery?",
            choices: ["Bachelor of Science in Nursing", "General Nursing & Midwifery"]
        };
    }

    // 2. Build alias mapping
    const aliasMap = {};
    courseRegistry.forEach(course => {
        const names = [course.canonicalName, course.shortName, ...course.aliases];
        names.forEach(name => {
            const normalized = name.toLowerCase().trim();
            if (!aliasMap[normalized]) {
                aliasMap[normalized] = [];
            }
            if (!aliasMap[normalized].some(c => c.courseId === course.courseId)) {
                aliasMap[normalized].push(course);
            }
        });
    });

    // Sort aliases by length descending
    const sortedAliases = Object.keys(aliasMap).sort((a, b) => b.length - a.length);

    let matchedAlias = null;
    let matchedCourses = [];

    for (const alias of sortedAliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(q)) {
            // Guard: Do not resolve alias into a degree program when it qualifies an HOD, department, office, or location query
            // e.g. "HOD-psychology", "HOD of psychology", "psychology HOD", "room number of HOD-psychology"
            const isEntityOrLocationContext = 
                new RegExp(`(?:\\b(?:hod|head\\s+of\\s+(?:the\\s+)?department|department\\s+head|office|dean|principal|director|professor|teacher|counselor|faculty)\\s*[-:/]?\\s*(?:of\\s+)?${escaped}\\b)`, 'i').test(q) ||
                new RegExp(`(?:\\b${escaped}\\s*[-:/]?\\s*(?:hod|head\\s+of\\s+(?:the\\s+)?department|department\\s+head|office|dept|department)\\b)`, 'i').test(q) ||
                (new RegExp(`\\b(?:room|building|floor|where\\s+is|location|cabin)\\b`, 'i').test(q) && new RegExp(`\\b(?:hod|head|office|department|dept|staff)\\b`, 'i').test(q));
            
            if (isEntityOrLocationContext) {
                continue;
            }

            matchedAlias = alias;
            matchedCourses = aliasMap[alias];
            break;
        }
    }

    if (matchedAlias) {
        // If there is only one match, it's resolved!
        if (matchedCourses.length === 1) {
            const course = matchedCourses[0];
            const escaped = matchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
            return {
                resolvedQuestion: question.replace(regex, course.canonicalName),
                canonicalName: course.canonicalName,
                courseId: course.courseId,
                shortName: course.shortName
            };
        }

        // If there are multiple matches:
        // Check if one course has this alias as its exact shortName
        const exactShort = matchedCourses.find(c => c.shortName.toLowerCase() === matchedAlias);
        if (exactShort) {
            const escaped = matchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
            return {
                resolvedQuestion: question.replace(regex, exactShort.canonicalName),
                canonicalName: exactShort.canonicalName,
                courseId: exactShort.courseId,
                shortName: exactShort.shortName
            };
        }

        // Otherwise, ask for clarification!
        const choices = matchedCourses.map(c => c.canonicalName);
        const listStr = choices.slice(0, -1).join(", ") + " or " + choices.slice(-1);
        return {
            clarificationPrompt: `Which programme do you mean — ${listStr}?`,
            choices
        };
    }

    return {
        resolvedQuestion: question
    };
};

module.exports = {
    resolveCourseInQuestion
};
