const llmService = require("./llmService");

/**
 * Extract key entities from a user's question
 * @param {string} question
 * @returns {Promise<Object>} - Extracted entities (course, department, location, routeOrigin, routeDestination, institution)
 */
const extractEntities = async (question) => {
    const systemPrompt = `You are an information extraction assistant.
Analyze the user's question and extract these specific entities if present:
- course (e.g., B.Tech CSE, BCA, MBA, M.Tech)
- department (e.g., Computer Science, Information Technology, Physics)
- location (e.g., Library, Gym, Auditorium, Boys Hostel)
- routeOrigin (starting point for routing/directions, e.g., Howrah Station, Airport)
- routeDestination (destination point for routing/directions, e.g., Campus Gates, hostel)
- institution (specific college names, e.g., Heritage, HIT)

Return ONLY a valid JSON object matching the schema below. Do not output markdown, preambles, backticks, or other text.
{
  "course": "string or null",
  "department": "string or null",
  "location": "string or null",
  "routeOrigin": "string or null",
  "routeDestination": "string or null",
  "institution": "string or null"
}

Question: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON extractor." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 200 });

        // Strip backticks or json tags if the LLM returned them
        const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        return {
            course: parsed.course || null,
            department: parsed.department || null,
            location: parsed.location || null,
            routeOrigin: parsed.routeOrigin || null,
            routeDestination: parsed.routeDestination || null,
            institution: parsed.institution || null
        };
    } catch (e) {
        console.error("Entity Extraction failed, using empty fallbacks:", e.message);
        return {
            course: null,
            department: null,
            location: null,
            routeOrigin: null,
            routeDestination: null,
            institution: null
        };
    }
};

/**
 * Extract academic metadata entities and relationships from document text
 * @param {string} text
 * @returns {Promise<Array<Object>>}
 */
const extractAcademicMetadata = async (text) => {
    const textSnippet = String(text || "").slice(0, 8000);
    if (!textSnippet.trim()) {
        return [];
    }

    const systemPrompt = `You are an expert academic metadata extractor.
Analyze the following text snippet from an institutional document and extract all academic programmes, departments, degrees, courses, and their aliases.
Identify how they map to each other (e.g. abbreviations, full names, degree-programme relationships).

For example, if you see "B.Tech in Computer Science and Engineering (CSE)", extract:
- degree: "B.Tech"
- programme: "Computer Science and Engineering"
- department: "Computer Science and Engineering"
- aliases: ["CSE", "Computer Science", "Computer Science Engineering", "Computer Science and Engineering", "B.Tech CSE", "BTech CSE"]

Extract ALL programmes, departments, and degrees mentioned in the text.
For each extracted entity, define:
1. degree (e.g. "B.Tech", "BCA", "MBA", "BBA", "M.Tech", "B.Sc")
2. programme (e.g. "Computer Science and Engineering", "Finance", "Human Resource Management")
3. department (e.g. "CSE", "Finance", "HR", "Management")
4. aliases (List of all abbreviations, short forms, and full names that represent this programme/degree combination in this institution)
5. institution (If mentioned, e.g. "Brainware University", or null)
6. specialisation (e.g. "Cyber Security", "Finance", or null)
7. academic_level (e.g. "UG", "PG", "Diploma", or null)
8. category (e.g. "Engineering", "Management", "Science", or null)

Return ONLY a valid JSON object matching the schema below. Do not output markdown, preambles, backticks, or other text.
{
  "academicEntities": [
    {
      "degree": "string or null",
      "programme": "string or null",
      "department": "string or null",
      "aliases": ["string"],
      "institution": "string or null",
      "specialisation": "string or null",
      "academic_level": "string or null",
      "category": "string or null"
    }
  ]
}

Text Snippet:
"""
${textSnippet}
"""`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON extractor." },
            { role: "user", content: systemPrompt }
        ], { temperature: 0.1, maxOutputTokens: 1000 });

        const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return parsed.academicEntities || [];
    } catch (e) {
        console.error("[Entity Extraction] Failed to extract academic metadata from document text:", e.message);
        return [];
    }
};

const extractStudentProfile = async (question, historyText = "") => {
    let context = "";
    if (historyText && historyText.trim()) {
        context = `Conversation History:\n${historyText}\n\n`;
    }
    const prompt = `You are a student academic profile extractor. Extract structured academic information from the user's message and the conversation history if relevant.
Return a JSON object containing ONLY the extracted fields, with NO other text or markdown block formatting.
Allowed fields (include only if provided):
- class (string, e.g. "12", "10", "diploma")
- stream (string, e.g. "Arts", "Science", "Commerce")
- overall_percentage (number, 0-100)
- subject (string, name of specific subject)
- subject_percentage (number, 0-100)
- interests (string)
- preferred_subjects (string)
- career_interests (string)
- skills (string)

Rules:
1. Do not invent or infer any field not explicitly provided.
2. If information is ambiguous, preserve the ambiguity or leave the field out.
3. Return ONLY valid raw JSON, no markdown formatting like \`\`\`json.

${context}Current User message: "${question}"`;

    try {
        const response = await llmService.generateCompletion([
            { role: "system", content: "You are a precise JSON extractor." },
            { role: "user", content: prompt }
        ], { temperature: 0 });

        let cleaned = String(response || "").trim();
        // Clean markdown code blocks if any
        cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("Student profile extraction failed:", err);
        return {};
    }
};

module.exports = {
    extractEntities,
    extractAcademicMetadata,
    extractStudentProfile
};
