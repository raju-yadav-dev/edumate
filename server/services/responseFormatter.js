/**
 * EduMate Mission 7.1 — Production Intelligent Response Formatter
 * 
 * Upgrades response formatting with:
 * 1. Query Planner metadata driven template selection (intent, responseType, category, department, program).
 * 2. Dedicated University-Specific Templates:
 *    - Faculty Directory
 *    - Fee Structure
 *    - Admission Guide
 *    - Semester-wise Curriculum
 *    - Hostel Information
 *    - Notice/Circular
 *    - Department Overview
 *    - Scholarship Guide
 * 3. Exact preservation of original document tables without regenerating or reordering rows.
 * 4. Section-level source metadata attachment (title, pageNumber, sectionHeading).
 * 5. Retrieval confidence handling (high, medium, low notices).
 * 6. Pure-JavaScript Markdown sanitization for safe frontend rendering.
 */

const FORMAT_TYPES = {
    FACT: "fact",
    SHORT_FACT: "fact",
    STEP_BY_STEP_GUIDE: "step_by_step_guide",
    NUMBERED_STEPS: "step_by_step_guide",
    BULLET_LIST: "bullet_list",
    NUMBERED_LIST: "numbered_list",
    TABLE: "table",
    MARKDOWN_TABLE: "table",
    DEPARTMENT_DIRECTORY: "department_directory",
    FACULTY_DIRECTORY_TABLE: "department_directory",
    FACULTY_DIRECTORY: "faculty_directory",
    FEE_STRUCTURE: "fee_structure",
    FEE_STRUCTURE_TABLE: "fee_structure",
    SEMESTER_CURRICULUM: "semester_curriculum",
    SEMESTER_WISE_CURRICULUM: "semester_curriculum",
    COMPARISON_TABLE: "comparison_table",
    LONG_UNIVERSITY_GUIDE: "long_university_guide",
    UNIVERSITY_GUIDE: "long_university_guide",
    ADMISSION_GUIDE: "admission_guide",
    HOSTEL_INFO: "hostel_info",
    HOSTEL_INFORMATION: "hostel_info",
    NOTICE_CIRCULAR: "notice_circular",
    DEPARTMENT_OVERVIEW: "department_overview",
    SCHOLARSHIP_GUIDE: "scholarship_guide"
};

const SOURCE_LABELS = {
    UNIVERSITY: "📚 University Knowledge Base",
    WEB: "🌐 Trusted Internet Sources",
    COMBINED: "📚 + 🌐 Combined Sources"
};

/**
 * Splits text into sentences safely handling abbreviations (Dr., Prof., etc.)
 */
const splitIntoSentences = (text) => {
    if (!text || typeof text !== "string") return [];
    const protectedText = text
        .replace(/\b(Dr|Prof|Mr|Mrs|Ms|vs|Dept|approx|Sr|Jr|No)\./gi, "$1__DOT__")
        .replace(/\b([A-Z])\.\s*([A-Z])\./g, "$1__DOT__$2__DOT__");

    const rawSplits = protectedText.split(/(?<=[.?!])\s+(?=[A-Z0-9])/);
    return rawSplits
        .map(s => s.replace(/__DOT__/g, ".").trim())
        .filter(s => s.length > 0);
};

/**
 * Sanitizes markdown string for safe frontend HTML rendering while preserving valid markdown elements
 */
const sanitizeMarkdown = (text) => {
    if (!text || typeof text !== "string") return "";

    let sanitized = text;

    // Remove script tags and contents
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
    // Remove object / embed / applet tags
    sanitized = sanitized.replace(/<(object|embed|applet)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "");
    // Remove dangerous inline JS handlers (onclick, onerror, onload, etc.)
    sanitized = sanitized.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
    sanitized = sanitized.replace(/\son\w+\s*=\s*[^>\s]+/gi, "");
    // Neutralize javascript: pseudo-protocol in links
    sanitized = sanitized.replace(/\[([^\]]+)\]\(javascript:[^)]+\)/gi, "[$1](#)");
    sanitized = sanitized.replace(/href\s*=\s*(['"])javascript:.*?\1/gi, "href=$1#$1");

    return sanitized;
};

/**
 * Detects the most appropriate response format based on Query Planner metadata, intent, and question text
 */
const detectFormatType = ({ question = "", intent = "", queryPlan = null, rawAnswer = "" }) => {
    const q = String(question || "").toLowerCase();
    const int = String(intent || queryPlan?.intent || "").toLowerCase();
    const ans = String(rawAnswer || "").toLowerCase();
    const cat = queryPlan?.category ? String(queryPlan.category).toLowerCase() : "";
    const respType = queryPlan?.responseType ? String(queryPlan.responseType).toLowerCase() : "";
    const docType = queryPlan?.documentType ? String(queryPlan.documentType).toLowerCase() : "";

    // 1. Direct match from Query Planner responseType
    if (respType) {
        if (respType.includes("faculty") || respType.includes("directory")) return FORMAT_TYPES.FACULTY_DIRECTORY;
        if (respType.includes("fee")) return FORMAT_TYPES.FEE_STRUCTURE;
        if (respType.includes("admission")) return FORMAT_TYPES.ADMISSION_GUIDE;
        if (respType.includes("curriculum") || respType.includes("syllabus")) return FORMAT_TYPES.SEMESTER_CURRICULUM;
        if (respType.includes("hostel")) return FORMAT_TYPES.HOSTEL_INFO;
        if (respType.includes("notice") || respType.includes("circular")) return FORMAT_TYPES.NOTICE_CIRCULAR;
        if (respType.includes("dept") || respType.includes("department")) return FORMAT_TYPES.DEPARTMENT_OVERVIEW;
        if (respType.includes("scholarship")) return FORMAT_TYPES.SCHOLARSHIP_GUIDE;
        if (respType.includes("compare") || respType.includes("comparison")) return FORMAT_TYPES.COMPARISON_TABLE;
        if (respType.includes("table")) return FORMAT_TYPES.MARKDOWN_TABLE;
        if (respType.includes("bullet") || respType.includes("list")) return FORMAT_TYPES.BULLET_LIST;
        if (respType.includes("step") || respType.includes("guide")) return FORMAT_TYPES.NUMBERED_STEPS;
        if (respType.includes("fact")) return FORMAT_TYPES.FACT;
    }

    // 2. Query Planner Category & Intent matching
    if (cat === "faculty" || int === "faculty" || int === "hod" || int === "professors") {
        return FORMAT_TYPES.FACULTY_DIRECTORY;
    }
    if (cat === "fees" || cat === "fee" || int === "fees" || int === "fee" || docType.includes("fee")) {
        return FORMAT_TYPES.FEE_STRUCTURE;
    }
    if (cat === "admissions" || cat === "admission" || int === "admission") {
        return FORMAT_TYPES.ADMISSION_GUIDE;
    }
    if (cat === "hostel" || int === "hostel" || int === "mess" || docType.includes("hostel")) {
        return FORMAT_TYPES.HOSTEL_INFO;
    }
    if (cat === "notices" || cat === "notice" || int === "notice" || int === "circular") {
        return FORMAT_TYPES.NOTICE_CIRCULAR;
    }
    if (cat === "scholarships" || cat === "scholarship" || int === "scholarship") {
        return FORMAT_TYPES.SCHOLARSHIP_GUIDE;
    }
    if (cat === "academics" && (int === "syllabus" || int === "curriculum" || docType.includes("syllabus"))) {
        return FORMAT_TYPES.SEMESTER_CURRICULUM;
    }

    // 3. Question text heuristics
    // Comprehensive guides: "Tell me everything about...", "Complete overview"
    if (
        q.includes("tell me everything") ||
        q.includes("everything about") ||
        q.includes("complete guide") ||
        q.includes("complete overview") ||
        q.includes("all about") ||
        q.includes("in detail about") ||
        int === "comprehensive_guide" ||
        int === "university_guide"
    ) {
        return FORMAT_TYPES.LONG_UNIVERSITY_GUIDE;
    }

    // Comparison Table
    if (
        q.includes("compare") ||
        q.includes("difference between") ||
        q.includes(" vs ") ||
        q.includes(" versus ") ||
        int === "comparison" ||
        int === "compare"
    ) {
        return FORMAT_TYPES.COMPARISON_TABLE;
    }

    // Faculty Directory
    if (
        q.includes("faculty") ||
        q.includes("professors") ||
        q.includes("teachers") ||
        q.includes("directory") ||
        q.includes("staff list") ||
        q.includes("contact list")
    ) {
        return FORMAT_TYPES.DEPARTMENT_DIRECTORY;
    }

    // Fee Structure
    if (
        q.includes("fee") ||
        q.includes("fees") ||
        q.includes("cost") ||
        q.includes("tuition") ||
        q.includes("installment")
    ) {
        return FORMAT_TYPES.FEE_STRUCTURE;
    }

    // Semester-wise Curriculum / Syllabus
    if (
        q.includes("curriculum") ||
        q.includes("syllabus") ||
        q.includes("semester wise") ||
        q.includes("semester-wise") ||
        q.includes("course outline") ||
        q.includes("subjects in")
    ) {
        return FORMAT_TYPES.SEMESTER_CURRICULUM;
    }

    // Step-by-Step Guide / Numbered Steps
    if (
        q.startsWith("how to") ||
        q.startsWith("how do i") ||
        q.includes("step by step") ||
        q.includes("procedure") ||
        q.includes("process of") ||
        q.includes("steps to") ||
        q.includes("admission process") ||
        q.includes("application procedure") ||
        q.includes("explain admission") ||
        int.includes("procedure") ||
        int.includes("guide")
    ) {
        return FORMAT_TYPES.NUMBERED_STEPS;
    }

    // Bullet List
    if (
        q.includes("documents required") ||
        q.includes("required documents") ||
        q.includes("documents are required") ||
        q.includes("documents needed") ||
        (q.includes("document") && q.includes("require")) ||
        q.includes("eligibility") ||
        q.includes("criteria") ||
        q.includes("requirements") ||
        q.includes("prerequisites") ||
        q.includes("facilities") ||
        q.includes("rules") ||
        q.includes("features") ||
        q.includes("benefits")
    ) {
        return FORMAT_TYPES.BULLET_LIST;
    }

    // Notice / Circular
    if (q.includes("notice") || q.includes("circular") || q.includes("announcement") || q.includes("notification")) {
        return FORMAT_TYPES.NOTICE_CIRCULAR;
    }

    // Scholarship Guide
    if (q.includes("scholarship") || q.includes("financial aid") || q.includes("fee waiver")) {
        return FORMAT_TYPES.SCHOLARSHIP_GUIDE;
    }

    // Hostel Info
    if (q.includes("hostel") || q.includes("dormitory") || q.includes("boarding")) {
        return FORMAT_TYPES.HOSTEL_INFO;
    }

    // General Markdown Table
    if (q.includes("table") || q.includes("schedule") || q.includes("timetable") || ans.includes("|---")) {
        return FORMAT_TYPES.MARKDOWN_TABLE;
    }

    // Numbered List
    if (q.includes("top ") || q.includes("list of") || q.includes("ranking") || q.includes("order of")) {
        return FORMAT_TYPES.NUMBERED_LIST;
    }

    // Short Fact
    if (
        q.startsWith("who is") ||
        q.startsWith("who's") ||
        q.startsWith("where is") ||
        q.startsWith("when was") ||
        q.startsWith("which room") ||
        q.startsWith("what is the hod") ||
        q.startsWith("contact number") ||
        q.startsWith("email address") ||
        q.startsWith("phone number")
    ) {
        return FORMAT_TYPES.SHORT_FACT;
    }

    return FORMAT_TYPES.SHORT_FACT;
};

/**
 * Deduplicates repetitive sentences or paragraphs resulting from merged RAG chunks
 */
const deduplicateContent = (text) => {
    if (!text || typeof text !== "string") return "";

    const lines = text.split("\n");
    const seenSentences = new Set();
    const cleanedLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            cleanedLines.push("");
            continue;
        }

        // Check if the entire line is a heading, list item, or table row
        if (trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("```")) {
            cleanedLines.push(line);
            continue;
        }

        // Deduplicate individual sentences within regular paragraph lines
        const sentences = splitIntoSentences(trimmed);
        const uniqueSentences = [];

        for (const sentence of sentences) {
            const normalized = sentence.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (normalized.length > 20) {
                if (!seenSentences.has(normalized)) {
                    seenSentences.add(normalized);
                    uniqueSentences.push(sentence.trim());
                }
            } else {
                uniqueSentences.push(sentence.trim());
            }
        }

        if (uniqueSentences.length > 0) {
            cleanedLines.push(uniqueSentences.join(" "));
        }
    }

    return cleanedLines.join("\n");
};

/**
 * Validates and repairs Markdown table structures while strictly preserving row order and original table contents
 */
const repairMarkdownTable = (text) => {
    if (!text || typeof text !== "string") return "";

    const lines = text.split("\n");
    const repaired = [];
    let inTable = false;
    let tableHeadersCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("|") && line.endsWith("|")) {
            const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            
            if (!inTable) {
                inTable = true;
                tableHeadersCount = cells.length;
                repaired.push(line);
                
                // Check if next line is already a delimiter
                const nextLine = (lines[i + 1] || "").trim();
                if (!nextLine.includes("---")) {
                    const delimiter = "|" + Array(tableHeadersCount).fill("---").join("|") + "|";
                    repaired.push(delimiter);
                }
            } else {
                repaired.push(line);
            }
        } else {
            inTable = false;
            repaired.push(lines[i]);
        }
    }

    return repaired.join("\n");
};

/**
 * Preserves original document tables exactly whenever retrieved chunks contain markdown tables
 */
const preserveOriginalTables = (rawText, retrievedChunks = []) => {
    if (!Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
        return rawText;
    }

    // Check if any retrieved chunk contains a verified markdown table
    for (const chunk of retrievedChunks) {
        const content = chunk.content || chunk.text || "";
        if (content.includes("|---") || (content.includes("|") && content.includes("\n|"))) {
            const tableLines = content
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.startsWith("|") && l.endsWith("|"));

            if (tableLines.length >= 2) {
                const originalTable = repairMarkdownTable(tableLines.join("\n"));
                // If answer doesn't have the table or had a malformed version, ensure original is cleanly preserved
                if (!rawText.includes(tableLines[0])) {
                    return `${rawText}\n\n${originalTable}`;
                }
            }
        }
    }

    return rawText;
};

/**
 * Builds university-specific structured sections based on the active template
 */
const applyUniversityTemplate = (text, formatType, queryPlan = {}, question = "") => {
    if (!text || typeof text !== "string") return "";
    const trimmed = text.trim();

    // If text already has rich markdown formatting (headings, tables, lists), repair table delimiters and preserve
    const hasMarkdownStructure = 
        trimmed.includes("\n* ") || 
        trimmed.includes("\n- ") || 
        trimmed.includes("\n1. ") || 
        trimmed.includes("### ") || 
        trimmed.includes("## ") || 
        trimmed.includes("|---") || 
        trimmed.startsWith("```");

    if (hasMarkdownStructure) {
        return repairMarkdownTable(trimmed);
    }

    const sentences = splitIntoSentences(trimmed);
    if (sentences.length === 0) return trimmed;

    // Direct factual statements (e.g. 1-2 sentences answering who, what, when, where) should remain clean natural text!
    if (sentences.length <= 2 && !formatType.includes("table") && !formatType.includes("guide")) {
        return trimmed;
    }

    // 1. Faculty Directory Template (Only apply table when there are multiple faculty members and not a single fact sentence)
    if (
        (formatType === FORMAT_TYPES.FACULTY_DIRECTORY ||
        formatType === FORMAT_TYPES.FACULTY_DIRECTORY_TABLE ||
        formatType === FORMAT_TYPES.DEPARTMENT_DIRECTORY) &&
        sentences.length >= 3
    ) {
        const rows = ["| Faculty Name | Designation / Role | Department / Specialization |", "|---|---|---|"];
        const intro = (sentences[0].toLowerCase().includes("faculty") || sentences[0].toLowerCase().includes("department")) && !sentences[0].includes("is")
            ? sentences[0]
            : "Here is the department faculty directory:";
        const items = (sentences[0] === intro) ? sentences.slice(1) : sentences;

        let validRowCount = 0;
        items.forEach(item => {
            const isMatch = item.match(/^(.+?)\s+(?:is the|is|working as|serves as)\s+(.+?)(?:\s+(?:of|in|at|specializing in)\s+(.+))?$/i);
            if (isMatch && isMatch[1].length < 40) {
                const name = isMatch[1].trim();
                const role = isMatch[2].trim();
                const dept = (isMatch[3] || queryPlan?.department || "Computational Sciences").replace(/[.]+$/, "").trim();
                rows.push(`| ${name} | ${role} | ${dept} |`);
                validRowCount++;
            } else if (item.includes(" - ") || item.includes(": ")) {
                const parts = item.split(/[-:]/).map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    const name = parts[0] || item.trim();
                    const role = parts[1] || "Faculty Member";
                    const dept = parts[2] || queryPlan?.department || "Department Staff";
                    rows.push(`| ${name} | ${role} | ${dept} |`);
                    validRowCount++;
                }
            }
        });

        if (validRowCount >= 2) {
            return `${intro}\n\n${rows.join("\n")}`;
        }
        return trimmed;
    }

    // 2. Fee Structure Template
    if (formatType === FORMAT_TYPES.FEE_STRUCTURE) {
        const intro = sentences[0];
        const feeDetails = sentences.slice(1);
        if (feeDetails.length > 0) {
            return `### Fee Structure & Tuition Details\n${intro}\n\n${feeDetails.map(s => `* ${s.trim()}`).join("\n")}`;
        }
        return `### Fee Structure\n${intro}`;
    }

    // 3. Admission Guide Template
    if (formatType === FORMAT_TYPES.ADMISSION_GUIDE) {
        const intro = sentences[0];
        const steps = sentences.slice(1);
        if (steps.length > 0) {
            const formattedSteps = steps.map((s, idx) => `${idx + 1}. ${s.trim()}`).join("\n");
            return `### Admission Guide & Procedure\n${intro}\n\n${formattedSteps}`;
        }
        return `### Admission Guide\n${intro}`;
    }

    // 4. Semester-wise Curriculum Template
    if (formatType === FORMAT_TYPES.SEMESTER_CURRICULUM) {
        const intro = sentences[0];
        const subjects = sentences.slice(1);
        if (subjects.length > 0) {
            return `### Semester-Wise Curriculum & Course Outline\n${intro}\n\n${subjects.map(s => `* ${s.trim()}`).join("\n")}`;
        }
        return `### Curriculum Overview\n${intro}`;
    }

    // 5. Hostel Information Template
    if (formatType === FORMAT_TYPES.HOSTEL_INFO) {
        const intro = sentences[0];
        const details = sentences.slice(1);
        if (details.length > 0) {
            return `### Hostel Accommodation & Amenities\n${intro}\n\n${details.map(s => `* ${s.trim()}`).join("\n")}`;
        }
        return `### Hostel Information\n${intro}`;
    }

    // 6. Notice / Circular Template
    if (formatType === FORMAT_TYPES.NOTICE_CIRCULAR) {
        const intro = sentences[0];
        const points = sentences.slice(1);
        const refDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        return `### 📢 Official Notice / Circular\n* **Reference Date:** ${refDate}\n* **Summary:** ${intro}\n\n### Key Highlights\n${points.map(s => `* ${s.trim()}`).join("\n")}`;
    }

    // 7. Department Overview Template
    if (formatType === FORMAT_TYPES.DEPARTMENT_OVERVIEW) {
        const intro = sentences[0];
        const highlights = sentences.slice(1);
        return `### Department Overview\n${intro}\n\n### Academic & Laboratory Highlights\n${highlights.map(s => `* ${s.trim()}`).join("\n")}`;
    }

    // 8. Scholarship Guide Template
    if (formatType === FORMAT_TYPES.SCHOLARSHIP_GUIDE) {
        const intro = sentences[0];
        const schemes = sentences.slice(1);
        return `### Scholarship Schemes & Financial Aid\n${intro}\n\n### Eligibility & Benefits\n${schemes.map(s => `* ${s.trim()}`).join("\n")}`;
    }

    // 9. Long University Guide Template
    if (formatType === FORMAT_TYPES.LONG_UNIVERSITY_GUIDE) {
        if (sentences.length >= 4) {
            const sections = [];
            const intro = sentences[0];
            sections.push(`### Overview\n${intro}`);

            const midIndex = Math.ceil(sentences.length / 2);
            const keyPoints = sentences.slice(1, midIndex);
            const detailPoints = sentences.slice(midIndex);

            if (keyPoints.length > 0) {
                sections.push(`### Key Information & Highlights\n${keyPoints.map(s => `* ${s.trim()}`).join("\n")}`);
            }
            if (detailPoints.length > 0) {
                sections.push(`### Curriculum & Additional Details\n${detailPoints.map(s => `* ${s.trim()}`).join("\n")}`);
            }
            return sections.join("\n\n");
        }
    }

    // 10. Numbered Steps / Step by Step
    if (formatType === FORMAT_TYPES.NUMBERED_STEPS) {
        if (sentences.length >= 3) {
            const intro = sentences[0];
            const steps = sentences.slice(1);
            return `### Step-by-Step Guide\n${intro}\n\n${steps.map((s, idx) => `${idx + 1}. ${s.trim()}`).join("\n")}`;
        }
    }

    // 11. Bullet List
    if (formatType === FORMAT_TYPES.BULLET_LIST && sentences.length >= 3) {
        const intro = sentences[0];
        const items = sentences.slice(1);
        return `${intro}\n\n${items.map(s => `* ${s.trim()}`).join("\n")}`;
    }

    return repairMarkdownTable(trimmed);
};

/**
 * Attaches source metadata to each major response section
 */
const attachSectionMetadata = (structuredText, sources = []) => {
    if (!structuredText || !Array.isArray(sources) || sources.length === 0) {
        return {
            annotatedText: structuredText,
            sections: []
        };
    }

    const sections = [];
    const lines = structuredText.split("\n");
    let currentHeading = "Main Overview";
    let currentContent = [];

    for (const line of lines) {
        if (line.startsWith("### ") || line.startsWith("## ")) {
            if (currentContent.length > 0) {
                sections.push({
                    heading: currentHeading,
                    content: currentContent.join("\n").trim()
                });
                currentContent = [];
            }
            currentHeading = line.replace(/^#+\s*/, "").trim();
        } else {
            currentContent.push(line);
        }
    }

    if (currentContent.length > 0) {
        sections.push({
            heading: currentHeading,
            content: currentContent.join("\n").trim()
        });
    }

    // Map each section to a relevant source citation
    const mappedSections = sections.map((sec, idx) => {
        const matchedSource = sources[idx % sources.length] || sources[0];
        return {
            heading: sec.heading,
            content: sec.content,
            source: {
                title: matchedSource.documentTitle || matchedSource.title || "University Document",
                pageNumber: matchedSource.pageNumber || matchedSource.page || matchedSource.reference || "General",
                sectionHeading: matchedSource.sectionHeading || matchedSource.section || sec.heading
            }
        };
    });

    return {
        annotatedText: structuredText,
        sections: mappedSections
    };
};

/**
 * Handles retrieval confidence by prepending appropriate notices
 */
const applyConfidenceNotice = (text, confidence) => {
    const conf = String(confidence || "high").toLowerCase();

    if (conf === "low") {
        const lowNotice = "> ⚠️ **Notice**: The available university documents contain limited information for this query. The details below may be incomplete. Please consult the official university desk for full confirmation.";
        if (!text.includes("available university documents contain limited information") && !text.includes("Notice:")) {
            return `${lowNotice}\n\n${text}`;
        }
    }

    return text;
};

/**
 * Formats standard answers with detected format type, deduplication, preserved tables, sanitization, and section sources
 */
const formatAnswer = ({
    answer = "",
    confidence = "high",
    sources = [],
    sourceLabel,
    question = "",
    intent = "",
    queryPlan = null,
    retrievedChunks = []
}) => {
    // 1. Detect format type using Query Planner metadata and question text
    const formatType = detectFormatType({ question, intent, queryPlan, rawAnswer: answer });

    // 2. Deduplicate merged chunks
    const deduped = deduplicateContent(answer);

    // 3. Preserve original document tables exactly
    const tablePreserved = preserveOriginalTables(deduped, retrievedChunks);

    // 4. Apply university-specific template formatting
    let structuredAnswer = applyUniversityTemplate(tablePreserved, formatType, queryPlan, question);

    // 5. Sanitize markdown output
    structuredAnswer = sanitizeMarkdown(structuredAnswer);

    // 6. Handle retrieval confidence notice
    // Never display document warnings when query is general or no document was needed
    const isGeneral = queryPlan?.route === "GENERAL_KNOWLEDGE" || queryPlan?.mode === "LLM_ONLY" || queryPlan?.skipRag === true || queryPlan?.isMixed === true;
    if (!isGeneral) {
        structuredAnswer = applyConfidenceNotice(structuredAnswer, confidence);
    }

    // 7. Clean all citations, bracket references, and document names for pure direct output
    structuredAnswer = structuredAnswer
        .replace(/\[(?:Document|Doc|Source|Ref|Reference|Page)[^\]]*\]/gi, "")
        .replace(/\s*\[\d+\]\s*/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    // 8. Strip conversational intro filler (e.g. "Here is a detailed explanation of...:")
    structuredAnswer = structuredAnswer
        .replace(/^(?:Here\s+(?:is|are)\s+(?:a\s+detailed\s+explanation|the\s+complete|the\s+step-by-step|the\s+admission|an\s+overview|the\s+details|the\s+information|a\s+summary|the\s+steps)[^:\n]*:\s*\n*)/i, "")
        .trim();

    // 9. Clean dangling truncated fragment at the very end if response cut off mid-bullet
    const answerLines = structuredAnswer.split("\n");
    const lastLine = answerLines[answerLines.length - 1]?.trim() || "";
    if (/^[-*•]\s+/i.test(lastLine) && (/[-–—]$/.test(lastLine) || (!/[.!?:]$/.test(lastLine) && lastLine.length < 25))) {
        answerLines.pop();
        structuredAnswer = answerLines.join("\n").trim();
    }

    return {
        answer: structuredAnswer,
        confidence,
        formatType,
        sources: [],
        sourceLabel: "",
        sections: []
    };
};

/**
 * Formats unavailable / fallback response
 */
const formatUnavailable = ({ reason }) => ({
    answer: [
        "I couldn't find this information in the current university knowledge base.",
        reason ? `Reason: ${reason}` : "",
        "You can upload an official document or ask an administrator to add this information to the EduMate knowledge base."
    ].filter(Boolean).join("\n\n"),
    confidence: "low",
    formatType: FORMAT_TYPES.SHORT_FACT,
    sources: [],
    sections: []
});

module.exports = {
    FORMAT_TYPES,
    SOURCE_LABELS,
    splitIntoSentences,
    sanitizeMarkdown,
    detectFormatType,
    deduplicateContent,
    repairMarkdownTable,
    preserveOriginalTables,
    applyUniversityTemplate,
    breakGiantParagraph: applyUniversityTemplate,
    attachSectionMetadata,
    applyConfidenceNotice,
    formatAnswer,
    formatUnavailable
};
