const { INTENTS } = require("../constants/intents");

/**
 * Analyzes the query and intent to categorize it into a query type:
 * SIMPLE_FACT, DETAILED, COURSE_CATALOGUE, FEE_STRUCTURE, RECOMMENDATION
 * @param {string} question - The user's question
 * @param {string} intent - The classified intent
 * @returns {string} - Query complexity type
 */
const analyzeQueryComplexity = (question, intent) => {
    const q = String(question || "").toLowerCase().trim();
    
    // 1. RECOMMENDATION
    if (intent === INTENTS.COURSE_RECOMMENDATION || 
        /\b(recommend|better for me|best for me|should i choose|suits me|what should i study|which course is best|which course is better|choose a course)\b/i.test(q) ||
        (/\b(class\s+12|12th|marks|percent|%|stream|arts|science|commerce)\b/i.test(q) && /\b(choose|study|suits|best|better|course)\b/i.test(q))) {
        return "RECOMMENDATION";
    }

    // 2. COURSE_CATALOGUE
    const courseCatalogueService = require("./courseCatalogueService");
    if (intent === "course_catalogue_query" || courseCatalogueService.isCourseCatalogueQuery(q)) {
        return "COURSE_CATALOGUE";
    }

    // 3. FEE_STRUCTURE
    if (/\b(fee|fees|cost|tuition|charge|charges|payment)\b/i.test(q) && 
        /\b(structure|semester|semester-wise|complete|full|all)\b/i.test(q)) {
        return "FEE_STRUCTURE";
    }

    // 4. DETAILED
    const detailedKeywords = [
        "explain", "explain the", "process", "detailed", "details", "everything", 
        "step-by-step", "step by step", "describe", "elaborate", "procedure", "walkthrough"
    ];
    const isDetailed = detailedKeywords.some(kw => q.includes(kw)) || q.split(/\s+/).length > 12;
    if (isDetailed) {
        return "DETAILED";
    }

    // 5. Default to SIMPLE_FACT
    return "SIMPLE_FACT";
};

module.exports = {
    analyzeQueryComplexity
};
