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

module.exports = {
    extractEntities
};
