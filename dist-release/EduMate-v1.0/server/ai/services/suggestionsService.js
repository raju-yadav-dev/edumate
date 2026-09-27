/**
 * Generate 3 contextual follow-up questions based on rules and heuristics
 * (Optimized to make 0 LLM calls to satisfy one LLM call per message restriction)
 * @param {Object} params
 * @param {string} params.question - The current user query
 * @param {string} params.answer - The generated answer
 * @returns {Promise<Array<string>>}
 */
const generateSuggestions = async ({ question, answer }) => {
    const lowerQuestion = String(question || "").toLowerCase();
    const lowerAnswer = String(answer || "").toLowerCase();

    if (lowerAnswer.includes("would you like directions to this location")) {
        return [
            "Show Directions",
            "No, thanks"
        ];
    }

    if (lowerQuestion.includes("navigation") || lowerQuestion.includes("location") || lowerQuestion.includes("where is") || lowerQuestion.includes("room") || lowerQuestion.includes("building") || lowerQuestion.includes("hod")) {
        return [
            "HOD Office",
            "Mathematics Department",
            "Physics Department",
            "Library",
            "Admission Office",
            "Examination Cell"
        ];
    }

    if (lowerQuestion.includes("fee") || lowerQuestion.includes("cost") || lowerQuestion.includes("pay")) {
        return [
            "Are there scholarship options for BCA?",
            "What is the deadline for fee payment?",
            "Is there a hostel fee separate from tuition?"
        ];
    }

    if (lowerQuestion.includes("admission") || lowerQuestion.includes("apply") || lowerQuestion.includes("eligib")) {
        return [
            "What documents are needed for BCA admission?",
            "Can I apply online or visit the campus?",
            "Is there an admission entrance exam?"
        ];
    }

    if (lowerQuestion.includes("hostel") || lowerQuestion.includes("room") || lowerQuestion.includes("stay")) {
        return [
            "What is the hostel fee structure?",
            "Are there single rooms available in hostels?",
            "What are the hostel mess timings?"
        ];
    }

    if (lowerQuestion.includes("course") || lowerQuestion.includes("program") || lowerQuestion.includes("syllabus") || lowerQuestion.includes("bca")) {
        return [
            "What is the syllabus for the BCA course?",
            "What is the duration of the BCA program?",
            "What placements are available after BCA?"
        ];
    }

    // Default suggestions
    return [
        "What other documents are uploaded?",
        "Can I get details on admission criteria?",
        "What are the fee details for this department?"
    ];
};

module.exports = {
    generateSuggestions
};
