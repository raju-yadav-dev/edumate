/**
 * Standardizes categories into valid documentType names
 */
const mapCategoryToDocumentType = (category) => {
    if (!category) return "general";
    const cat = String(category).trim().toLowerCase();
    const mapping = {
        "admissions": "admission",
        "admission": "admission",
        "fees": "fees",
        "fee": "fees",
        "scholarships": "scholarship",
        "scholarship": "scholarship",
        "faculty": "faculty",
        "courses": "courses",
        "course": "courses",
        "examination": "examination",
        "examinations": "examination",
        "exams": "examination",
        "exam": "examination",
        "attendance": "attendance",
        "hostel": "hostel",
        "campus": "campus",
        "notices": "notices",
        "notice": "notices",
        "regulations": "regulations",
        "regulation": "regulations"
    };
    return mapping[cat] || cat || "general";
};

/**
 * Standardizes department strings into normalized identifiers
 */
const normalizeDepartment = (dept) => {
    if (!dept) return "unknown";
    const d = String(dept).trim().toLowerCase();
    if (d === "all" || d === "general") return "all";
    if (d === "unknown" || d === "none" || d === "") return "unknown";

    // Regex patterns for standard departments
    if (/\b(cse|computer\s+science|computer|it|information\s+technology|software|bca|mca)\b/i.test(d)) {
        return "computer-science";
    }
    if (/\b(css|computational\s+sciences?)\b/i.test(d)) {
        return "computational-sciences";
    }
    if (/\b(biotech|biotechnology)\b/i.test(d)) {
        return "biotechnology";
    }
    if (/\b(mba|management|bba|business)\b/i.test(d)) {
        return "management";
    }

    return d; // keep original if no specific rule matches
};

module.exports = {
    mapCategoryToDocumentType,
    normalizeDepartment
};
