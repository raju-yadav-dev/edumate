const courseRegistry = require("../constants/courseRegistry.json");

/**
 * Checks if the question is a request for listing the course catalogue.
 * @param {string} question - User question
 * @returns {boolean}
 */
const isCourseCatalogueQuery = (question) => {
    const q = String(question || "").toLowerCase().trim();
    
    const patterns = [
        /what\s+courses\s+are\s+offered/i,
        /list\s+all\s+courses/i,
        /show\s+all\s+programmes/i,
        /show\s+me\s+all\s+programmes/i,
        /what\s+programmes\s+does\s+brainware\s+offer/i,
        /which\s+courses\s+are\s+available/i,
        /what\s+programmes\s+are\s+available/i,
        /tell\s+me\s+all\s+courses/i,
        /show\s+all\s+courses/i,
        /list\s+all\s+programmes/i,
        /give\s+me\s+all\s+courses/i,
        /give\s+me\s+all\s+programmes/i,
        /what\s+(are\s+the\s+)?courses\s+available/i,
        /what\s+programmes\s+are\s+offered/i,
        /courses\s+offered\s+by\s+brainware/i,
        /programmes\s+offered\s+by\s+brainware/i,
        /show\s+all\s+ug\s+courses/i,
        /show\s+all\s+pg\s+courses/i,
        /show\s+all\s+diploma\s+courses/i,
        /show\s+all\s+phd\s+courses/i,
        /list\s+ug\s+courses/i,
        /list\s+pg\s+courses/i,
        /list\s+diploma\s+courses/i,
        /list\s+phd\s+courses/i,
        /give\s+me\s+all\s+ug/i,
        /give\s+me\s+all\s+pg/i,
        /give\s+me\s+all\s+diploma/i,
        /give\s+me\s+all\s+phd/i
    ];

    const isMatch = patterns.some(p => p.test(q));
    
    const simplePatterns = [
        /^(available\s+)?courses$/i,
        /^(available\s+)?programmes$/i,
        /^courses\s+offered$/i,
        /^programmes\s+offered$/i
    ];
    const isSimpleMatch = simplePatterns.some(p => p.test(q));

    return isMatch || isSimpleMatch;
};

/**
 * Checks if the user is making a level selection in response to the level prompt.
 * @param {string} question - Current question
 * @param {Array} rawHistory - Message history
 * @returns {string|null} - 'UG', 'PG', 'Diploma', 'PhD', 'All' or null
 */
const checkLevelSelection = (question, rawHistory) => {
    if (!rawHistory || rawHistory.length === 0) return null;
    
    // Find the last assistant message
    let lastAssistantMessage = null;
    for (let i = rawHistory.length - 1; i >= 0; i--) {
        if (rawHistory[i].role === "assistant") {
            lastAssistantMessage = rawHistory[i].content;
            break;
        }
    }
    
    if (!lastAssistantMessage) return null;
    
    // Check if the last assistant message was the level query
    const isLevelPrompt = lastAssistantMessage.includes("Brainware University offers programmes at multiple levels. Which would you like to see?");
    
    if (isLevelPrompt) {
        const q = String(question || "").toLowerCase().trim();
        if (q === "ug" || q === "1" || q.includes("undergraduate")) {
            return "UG";
        }
        if (q === "pg" || q === "2" || q.includes("postgraduate")) {
            return "PG";
        }
        if (q === "diploma" || q === "3") {
            return "Diploma";
        }
        if (q === "phd" || q === "ph.d" || q === "4" || q.includes("doctor")) {
            return "PhD";
        }
        if (q === "all" || q === "5" || q === "both" || q === "everything" || q.includes("all programmes")) {
            return "All";
        }
    }
    
    return null;
};

/**
 * Extracts level from question text.
 * @param {string} question - User question
 * @returns {string|null}
 */
const extractLevelFromQuestion = (question) => {
    const q = String(question || "").toLowerCase();
    if (/\bug\b|\bundergraduate\b/i.test(q)) {
        return "UG";
    }
    if (/\bpg\b|\bpostgraduate\b/i.test(q)) {
        return "PG";
    }
    if (/\bdiploma\b/i.test(q)) {
        return "Diploma";
    }
    if (/\bphd\b|\bph\.d\b/i.test(q)) {
        return "PhD";
    }
    if (/\ball\b|\bboth\b|\beverything\b/i.test(q)) {
        return "All";
    }
    return null;
};

/**
 * Group courses by school and format as markdown.
 * @param {Array} courses - Courses list
 * @returns {string}
 */
const formatCoursesBySchool = (courses) => {
    const schools = {};
    courses.forEach(c => {
        const schoolName = c.school || "Other Schools";
        if (!schools[schoolName]) {
            schools[schoolName] = [];
        }
        schools[schoolName].push(c);
    });

    let md = "";
    Object.keys(schools).forEach(schoolName => {
        md += `### ${schoolName}\n`;
        schools[schoolName].forEach((c, idx) => {
            md += `${idx + 1}. ${c.canonicalName}\n`;
        });
        md += `\n`;
    });
    return md.trim();
};

/**
 * Generates the response for the course catalogue request.
 * @param {string} level - 'UG', 'PG', 'Diploma', 'PhD', 'All' or null
 * @returns {Object} - { answer: string, sources: Array }
 */
const getCatalogueResponse = async (level, language = "English") => {
    const llmService = require("../ai/services/llmService");
    const docId = "6a843a05f0fc0895197837f0"; // Brainware University list of courses.pdf
    const sources = [
        {
            type: "document",
            title: "Brainware University list of courses.pdf",
            page: "1",
            section: "courses",
            similarity: 100,
            reference: "Uploaded Document",
            metadata: {
                documentId: docId,
                category: "courses",
                department: "",
                institution: "Brainware University",
                similarity: 100
            }
        }
    ];

    if (!level) {
        return {
            answer: `Brainware University offers programmes at multiple levels. Which would you like to see?

1. Undergraduate (UG)
2. Postgraduate (PG)
3. Diploma
4. PhD
5. All programmes`,
            sources: [] // clarification doesn't need source
        };
    }

    let targetText = "";
    let coursesMd = "";

    if (level === "UG") {
        const ugCourses = courseRegistry.filter(c => c.level === "UG");
        targetText = `Undergraduate (UG) level (${ugCourses.length} programmes)`;
        coursesMd = formatCoursesBySchool(ugCourses);
    } else if (level === "PG") {
        const pgCourses = courseRegistry.filter(c => c.level === "PG");
        targetText = `Postgraduate (PG) level (${pgCourses.length} programmes)`;
        coursesMd = formatCoursesBySchool(pgCourses);
    } else if (level === "Diploma") {
        const diplomaCourses = courseRegistry.filter(c => c.level === "Diploma");
        targetText = `Diploma level (${diplomaCourses.length} programmes)`;
        coursesMd = formatCoursesBySchool(diplomaCourses);
    } else if (level === "PhD") {
        const phdCourses = courseRegistry.filter(c => c.level === "PhD");
        targetText = `PhD level (${phdCourses.length} programmes)`;
        coursesMd = formatCoursesBySchool(phdCourses);
    } else {
        const ugCount = courseRegistry.filter(c => c.level === "UG").length;
        const pgCount = courseRegistry.filter(c => c.level === "PG").length;
        const diplomaCount = courseRegistry.filter(c => c.level === "Diploma").length;
        const phdCount = courseRegistry.filter(c => c.level === "PhD").length;
        const totalCount = courseRegistry.length;
        targetText = `all levels: Undergraduate (${ugCount}), Postgraduate (${pgCount}), Diploma (${diplomaCount}), and PhD (${phdCount}), totaling ${totalCount} programmes`;
        
        const levels = ["UG", "PG", "Diploma", "PhD"];
        const levelDisplay = {
            "UG": "Undergraduate (UG) Programmes",
            "PG": "Postgraduate (PG) Programmes",
            "Diploma": "Diploma Programmes",
            "PhD": "PhD Programmes"
        };

        let md = "";
        levels.forEach(lvl => {
            const levelCourses = courseRegistry.filter(c => c.level === lvl);
            md += `## ${levelDisplay[lvl]} (${levelCourses.length} programmes)\n\n`;
            md += formatCoursesBySchool(levelCourses);
            md += `\n\n`;
        });
        coursesMd = md.trim();
    }

    const systemPrompt = `You are a precise educational assistant for Brainware University.
Write a short, professional, and friendly 1-2 sentence introduction in the requested language stating that the university offers ${targetText}.
Do NOT list the programmes/courses. Keep it very brief.
Requested language: ${language || "English"}`;

    let intro = "";
    try {
        intro = await llmService.generateCompletion([
            { role: "system", content: systemPrompt },
            { role: "user", content: "Write the introduction." }
        ], { maxOutputTokens: 100 });
    } catch (e) {
        console.error("Failed to generate catalogue intro, using fallback:", e.message);
        intro = `Here are the programmes offered by Brainware University at the requested level:`;
    }

    const finalAnswer = `${intro.trim()}\n\n${coursesMd}\n\n*Note: This information is sourced from the official Brainware University course list document.*`;

    return {
        answer: finalAnswer,
        sources
    };
};

module.exports = {
    isCourseCatalogueQuery,
    checkLevelSelection,
    extractLevelFromQuestion,
    getCatalogueResponse
};
