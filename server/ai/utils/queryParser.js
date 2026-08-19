/**
 * Lightweight local query analyzer to identify documentType and optional department.
 * Uses optimized rules-based regular expressions to prevent expensive LLM API calls.
 */
const detectTypeAndDepartment = (query) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) {
        return { documentType: undefined, department: undefined };
    }

    let documentType = undefined;
    let department = undefined;

    // 1. Detect Document Type
    if (/\b(fee|fees|tuition|payment|refund|cost)\b/i.test(q)) {
        documentType = "fees";
    } else if (/\b(admission|apply|eligibility|enroll|application\s+form|admission\s+form)\b/i.test(q)) {
        documentType = "admission";
    } else if (/\b(faculty|professor|teacher|hod|dean|email|qualification|Dr\.|Dr|Prof\.|Prof|Patel|Sharma|teach)\b/i.test(q)) {
        documentType = "faculty";
    } else if (/\b(scholarship|financial\s+aid|stipend|waiver)\b/i.test(q)) {
        documentType = "scholarship";
    } else if (/\b(attendance|rule|attendance\s+rule|present|absent)\b/i.test(q)) {
        documentType = "attendance";
    } else if (/\b(hostel|mess|accommodation|room\s+allotment)\b/i.test(q)) {
        documentType = "hostel";
    } else if (/\b(campus|map|directions|building|floor|room)\b/i.test(q)) {
        documentType = "campus";
    } else if (/\b(course|syllabus|curriculum|program|degree|duration)\b/i.test(q)) {
        documentType = "courses";
    } else if (/\b(exam|examination|exam\s+date|holiday|timetable|schedule)\b/i.test(q)) {
        documentType = "examination";
    } else if (/\b(notice|circular|announcement|notification|circulars|notices|update)\b/i.test(q)) {
        documentType = "notices";
    } else if (/\b(regulation|regulations|rule|rules|policy|policies)\b/i.test(q)) {
        documentType = "regulations";
    }

    // 2. Detect Department (do not guess: only match if clearly present)
    if (/\b(cse|computer\s+science|computer|it|information\s+technology|software|bca|mca)\b/i.test(q)) {
        department = "computer-science";
    } else if (/\b(css|computational\s+sciences?)\b/i.test(q)) {
        department = "computational-sciences";
    } else if (/\b(biotech|biotechnology)\b/i.test(q)) {
        department = "biotechnology";
    } else if (/\b(mba|management|bba|business)\b/i.test(q)) {
        department = "management";
    }

    return { documentType, department };
};

const detectQueryMode = (query) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) {
        return "TARGETED";
    }

    // 1. COMPLETE_DATASET (complete info, complete database, complete directory, full database)
    if (/\b(complete|entire|full|whole)\b.*\b(information|info|details?|directory|list|data|dataset|database)\b/i.test(q)) {
        return "COMPLETE_DATASET";
    }

    // 2. COMPREHENSIVE_LIST (list all, show all, give me all, every, all courses, all faculty)
    if (/\b(list|show|give|display|get)\b.*\b(all|every)\b/i.test(q) || /\ball\b.*\b(courses|faculty|departments|scholarships|professors|teachers|notices)\b/i.test(q) || /\b(every|complete\s+list|full\s+list)\b/i.test(q)) {
        return "COMPREHENSIVE_LIST";
    }

    // 3. MULTI_PART (containing and/plus/as well as/fee and eligibility)
    const hasAnd = /\b(and|plus|as\s+well\s+as)\b/i.test(q);
    if (hasAnd) {
        const keywordsCount = (q.match(/\b(fee|fees|admission|eligibility|scholarship|courses|syllabus|faculty|hod|campus|hostel)\b/gi) || []).length;
        if (keywordsCount >= 2) {
            return "MULTI_PART";
        }
    }

    // 4. EXPLANATION (explain, how, why, steps, process, procedure, guide)
    if (/\b(explain|how|why|steps|process|procedure|guide|walkthrough|describe|details\s+on\s+how)\b/i.test(q)) {
        return "EXPLANATION";
    }

    // 5. TARGETED (default fallback for simple fact checks)
    return "TARGETED";
};

module.exports = {
    detectTypeAndDepartment,
    detectQueryMode
};
