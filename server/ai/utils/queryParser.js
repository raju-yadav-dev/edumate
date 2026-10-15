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

const normalizeQueryText = (query) => {
    if (!query) return "";
    let q = String(query).toLowerCase();
    
    // Punctuation cleanup: replace punctuation with space, but keep letters, numbers, and spaces
    q = q.replace(/[?.!,:;()'"\-_[\]{}]/g, " ");
    
    // Normalize whitespace
    q = q.replace(/\s+/g, " ").trim();
    
    // Acronym and abbreviation expansion (retains acronym for exact-match chunks e.g. "HoD", "CSS")
    q = q.replace(/\bdept\b/g, "department dept");
    q = q.replace(/\bh\.?o\.?d\b/g, "head of department hod");
    q = q.replace(/\bug\b/g, "undergraduate ug");
    q = q.replace(/\bpg\b/g, "postgraduate pg");
    q = q.replace(/\bcss\b/g, "computational sciences css");
    q = q.replace(/\bcse\b/g, "computer science and engineering cse");
    q = q.replace(/\bb\.?tech\b/g, "bachelor of technology btech");
    q = q.replace(/\bbca\b/g, "bachelor of computer applications bca");
    q = q.replace(/\bmca\b/g, "master of computer applications mca");
    q = q.replace(/\bbba\b/g, "bachelor of business administration bba");
    q = q.replace(/\bmba\b/g, "master of business administration mba");
    q = q.replace(/\brm\b/g, "room");
    q = q.replace(/\broom\s+(?:no|num|number)\b/g, "room");
    q = q.replace(/\bmaths?\b/g, "mathematics");
    q = q.replace(/\bphysics\b/g, "physics");
    q = q.replace(/\bplacement\s+cell\b/g, "training & placement cell placement cell");
    q = q.replace(/\bdocuments?\b/g, "document");
    
    return q.replace(/\s+/g, " ").trim();
};

const detectIntent = (normalizedQuery) => {
    const q = String(normalizedQuery || "").toLowerCase();
    
    if (/\b(admission|admissions|enroll|enrollment|apply|application|eligibility|admission criteria|eligibilty)\b/.test(q)) {
        return "Admissions";
    }
    if (/\b(fee|fees|tuition|cost|payment|charges|refund|cost)\b/.test(q)) {
        return "Fees";
    }
    if (/\b(placement|placements|career|job|jobs|internship|internships|recruitment|recruiter|recruiters|packages|package)\b/.test(q)) {
        return "Placements";
    }
    if (/\b(hostel|mess|accommodation|residence|lodging)\b/.test(q)) {
        return "Hostel";
    }
    if (/\b(library|book|books|journal|journals|reading room)\b/.test(q)) {
        return "Library";
    }
    if (/\b(scholarship|scholarships|financial aid|stipend|waiver)\b/.test(q)) {
        return "Scholarships";
    }
    if (/\b(timetable|routine|schedule|class timings?|timing|timings)\b/.test(q)) {
        return "Timetable";
    }
    if (/\b(exam|exams|examination|examinations|test|tests|result|results|marksheet|grading)\b/.test(q)) {
        return "Examination";
    }
    if (/\b(club|clubs|society|societies)\b/.test(q)) {
        return "Clubs";
    }
    if (/\b(notice|notices|circular|circulars|announcement|announcements|update|updates|notification|notifications)\b/.test(q)) {
        return "Notices";
    }
    if (/\b(hod|head of department|head of the department|head of dept|head of computational sciences|head of css)\b/.test(q)) {
        return "HOD / Department";
    }
    if (/\b(department|departments|branch|branches|discipline|disciplines|school of)\b/.test(q)) {
        return "HOD / Department";
    }
    if (/\b(where is|where can i find|location of|how to reach|go to|directions|route|navigation|building|floor|room|lab|labs|office|offices|placement cell|admin office|canteen|gym|gymnasium|auditorium|sick room|board room|cash counter|moot court|skills hub)\b/.test(q)) {
        return "Campus Navigation";
    }
    if (/\b(faculty|professor|professors|teacher|teachers|lecturer|lecturers|dean|principal|registrar|staff)\b/.test(q)) {
        return "Faculty";
    }
    if (/\b(course|courses|program|programs|programme|programmes|degree|degrees|syllabus|curriculum|subject|subjects)\b/.test(q)) {
        return "Courses";
    }
    return "General Knowledge Base";
};

module.exports = {
    detectTypeAndDepartment,
    detectQueryMode,
    normalizeQueryText,
    detectIntent
};
