const PROGRAMS = [
    ["B.Tech", /\b(?:b\.?\s*tech(?:nology)?|bachelor(?:'s)?\s+of\s+technology)\b/gi],
    ["M.Tech", /\b(?:m\.?\s*tech(?:nology)?|master(?:'s)?\s+of\s+technology)\b/gi],
    ["BCA", /\b(?:b\.?\s*c\.?\s*a\.?|bachelor(?:'s)?\s+of\s+computer\s+applications?|computer\s+applications?)\b/gi],
    ["MCA", /\b(?:m\.?\s*c\.?\s*a\.?|master(?:'s)?\s+of\s+computer\s+applications?)\b/gi],
    ["BBA", /\b(?:b\.?\s*b\.?\s*a\.?|bachelor(?:'s)?\s+of\s+business\s+administration|business\s+administration)\b/gi],
    ["MBA", /\b(?:m\.?\s*b\.?\s*a\.?|master(?:'s)?\s+of\s+business\s+administration)\b/gi],
    ["LLB", /\b(?:l\.?\s*l\.?\s*b\.?|bachelor(?:'s)?\s+of\s+laws?|bba\s+llb)\b/gi],
    ["LLM", /\b(?:l\.?\s*l\.?\s*m\.?|master(?:'s)?\s+of\s+laws?)\b/gi],
    ["B.Sc", /\b(?:b\.?\s*sc(?:ience)?\.?|bachelor(?:'s)?\s+of\s+science)\b/gi],
    ["M.Sc", /\b(?:m\.?\s*sc(?:ience)?\.?|master(?:'s)?\s+of\s+science)\b/gi],
    ["B.Com", /\b(?:b\.?\s*com(?:merce)?\.?|bachelor(?:'s)?\s+of\s+commerce)\b/gi],
    ["M.Com", /\b(?:m\.?\s*com(?:merce)?\.?|master(?:'s)?\s+of\s+commerce)\b/gi],
    ["BA", /\b(?:b\.?\s*a\.?|bachelor(?:'s)?\s+of\s+arts)\b/gi],
    ["MA", /\b(?:m\.?\s*a\.?|master(?:'s)?\s+of\s+arts)\b/gi],
    ["B.Pharm", /\b(?:b\.?\s*pharm(?:acy)?|bachelor(?:'s)?\s+of\s+pharmacy)\b/gi],
    ["D.Pharm", /\b(?:d\.?\s*pharm(?:acy)?|diploma\s+in\s+pharmacy)\b/gi],
    ["Nursing", /\b(?:b\.?\s*sc\s+nursing|gnm|nursing)\b/gi],
    ["Diploma", /\bdiploma\b/gi]
];

const DEPARTMENTS = [
    ["CSS", /\bcss\b|computational\s+sciences?/gi],
    ["CSE", /\bcse\b|computer\s+science(?:\s+and\s+engineering)?/gi],
    ["Commerce", /\bcommerce\b/gi],
    ["Law", /\blaw\b|legal\s+studies/gi],
    ["Management", /\bmanagement\b/gi],
    ["Biotechnology", /\bbiotechnology\b|\bbiotech\b/gi],
    ["Computer Science", /\bcomputer\s+science\b/gi],
    ["Information Technology", /\binformation\s+technology\b|\bit\s+department\b/gi],
    ["Pharmacy", /\bpharmacy\b|\bpharmaceutical\b/gi],
    ["Allied Health", /\ballied\s+health\b/gi],
    ["Physics", /\bphysics\b/gi],
    ["Chemistry", /\bchemistry\b/gi],
    ["Mathematics", /\bmathematics\b|\bmaths\b/gi],
    ["Statistics", /\bstatistics?\b|\bdata\s+statistics\b/gi],
    ["English", /\benglish\b/gi],
    ["Psychology", /\bpsychology\b|\bpsychological\b/gi],
    ["Cyber Science", /\bcyber(?:\s*sc\.?|\s+science|\s+security)?\b/gi],
    ["Media", /\bmedia(?:\s+science|\s+and\s+journalism)?\b/gi],
    ["Nursing", /\bnursing\b/gi]
];

const DOCUMENT_TYPES = [
    ["Fee Structure", /\b(?:fee\s+structure|fee\s+details?|tuition\s+fees?|fee\s+schedule|fee\s+breakdown)\b/gi],
    ["Admission Brochure", /\b(?:admission\s+brochure|admission\s+prospectus|admissions?\s+guide|application\s+brochure)\b/gi],
    ["Faculty Directory", /\b(?:faculty\s+directory|faculty\s+list|staff\s+directory|professor\s+directory)\b/gi],
    ["Notice", /\b(?:official\s+)?notices?\b|\bnotice\s+board\b|\bnotice\s+regarding\b|\bnotice\s+for\b/gi],
    ["Syllabus", /\bsyllab(?:us|i)\b/gi],
    ["Curriculum", /\bcurricul(?:um|a)\b/gi],
    ["Timetable", /\b(?:time\s*table|timetable|class\s+schedule|exam\s+schedule)\b/gi],
    ["Hostel Rules", /\b(?:hostel\s+rules?|hostel\s+regulations?|hostel\s+guidelines?)\b/gi],
    ["Scholarship", /\b(?:scholarship|financial\s+aid|fee\s+waiver)\b/gi],
    ["Placement Report", /\b(?:placement\s+report|placement\s+statistics|campus\s+placement\s+report)\b/gi],
    ["Circular", /\bcircular(?:s)?\b/gi]
];

const classifyDocumentType = (text) => {
    const source = String(text || "");
    const match = DOCUMENT_TYPES.find(([, pattern]) => {
        pattern.lastIndex = 0;
        return pattern.test(source);
    });
    return match ? match[0] : "";
};
const unique = (values) => [...new Set(values.filter(Boolean))];

const matches = (text, dictionary) => unique(dictionary
    .filter(([, pattern]) => { pattern.lastIndex = 0; return pattern.test(text); })
    .map(([name]) => name));

const extractLabeledValues = (text, label) => {
    const values = [];
    const pattern = new RegExp(`(?:${label})\\s*[:\\-]\\s*([^\\n;|]+)`, "gi");
    let match;
    while ((match = pattern.exec(text)) !== null) {
        match[1].split(/,|\band\b/i).map((value) => value.replace(/\s+(?:Faculty|Department|Semester|Fee)\s*:.*$/i, "").replace(/[.]+$/, "").trim()).filter(Boolean).forEach((value) => values.push(value));
    }
    return values;
};

const extractSearchMetadata = (text, context = {}) => {
    const source = [String(text || ""), String(context.originalName || "")].filter(Boolean).join("\n");
    const lower = source.toLocaleLowerCase();
    const semesters = [];
    const semesterPattern = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s*semester|semester\s*(\d{1,2})|sem\s*[-.]?\s*([ivx]+|\d{1,2}))\b/gi;
    let semesterMatch;
    while ((semesterMatch = semesterPattern.exec(source)) !== null) {
        semesters.push(`Semester ${semesterMatch[1] || semesterMatch[2] || semesterMatch[3]}`);
    }

    const feeKeywords = unique((lower.match(/\b(?:fee|fees|tuition|admission fee|application fee|hostel fee|examination fee|semester fee|total fee|cost|scholarship)\b/g) || []));
    const hostelKeywords = unique((lower.match(/\b(?:hostel|accommodation|mess|boarding|residence|boys hostel|girls hostel|ladies hostel)\b/g) || []));
    const subjects = [
        ...extractLabeledValues(source, "subjects?"),
        ...extractLabeledValues(source, "papers?"),
        ...extractLabeledValues(source, "course(?:s)?")
    ];
    const facultyNames = [
        ...extractLabeledValues(source, "faculty|faculties|professors?"),
        ...(source.match(/\b(?:Dr\.?|Prof\.?|Professor)\s+[A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*){0,3}/g) || [])
    ];

    return {
        documentType: classifyDocumentType(source),
        programs: matches(source, PROGRAMS),
        departments: matches(source, DEPARTMENTS),
        semesters: unique(semesters),
        subjects: unique(subjects),
        feeKeywords,
        facultyNames: unique(facultyNames.map((name) => name.replace(/\s+/g, " ").replace(/[,:;.!?]+$/, "").trim())),
        hostelKeywords,
        keywords: unique([...feeKeywords, ...hostelKeywords])
    };
};

module.exports = { extractSearchMetadata };