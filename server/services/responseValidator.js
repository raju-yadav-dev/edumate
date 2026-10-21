const confidenceGuard = require("../ai/services/confidenceGuard");

/**
 * EduMate Mission 12.2 — Response Validator & Citation Guard
 * 
 * Responsibilities:
 * - Validate grounding against retrieved university chunks
 * - Prevent hallucinations on missing or out-of-domain context
 * - Verify citations (document title, page number, department)
 * - Multi-factor confidence evaluation (HIGH / MEDIUM / LOW)
 * - Clean duplicate statements and format structured responses
 */

const validateResponse = ({
    question = "",
    intent = "general",
    retrievedContext = null,
    generatedAnswer = "",
    providerSuccess = true,
    questionType = "university_specific",
    sources = []
}) => {
    const chunks = retrievedContext?.chunks || [];
    const hasTrustedSources = Boolean(chunks.length > 0 || sources.length > 0);

    const qTypeLower = String(questionType || "").toLowerCase();
    if (qTypeLower === "general_knowledge" || qTypeLower === "conversational" || qTypeLower === "general") {
        return {
            valid: true,
            confidence: "HIGH",
            score: 0.95,
            groundedAnswer: generatedAnswer,
            reason: "General knowledge or conversational query answered directly by local model."
        };
    }

    if (qTypeLower === "mixed" || qTypeLower === "hybrid") {
        return {
            valid: true,
            confidence: hasTrustedSources ? "HIGH" : "MEDIUM",
            score: hasTrustedSources ? 0.9 : 0.7,
            groundedAnswer: generatedAnswer,
            reason: "Mixed query combining general knowledge and institutional context."
        };
    }

    // 1. Un-grounded Institutional Query Check
    if (qTypeLower === "university_specific" && !hasTrustedSources) {
        return {
            valid: false,
            confidence: "LOW",
            score: 0.1,
            groundedAnswer: "I couldn't find matching information in the university knowledge base.",
            reason: "No university-specific document context was retrieved."
        };
    }

    if (!generatedAnswer?.trim() && !providerSuccess) {
        return {
            valid: false,
            confidence: "LOW",
            score: 0.1,
            groundedAnswer: "I couldn't find matching information in the university knowledge base.",
            reason: "No AI provider response was available."
        };
    }

    // 2. Citation Integrity & Hallucination Check
    const citationRegex = /\[([^\]]+)\]/g;
    let match;
    const citedDocs = new Set();
    while ((match = citationRegex.exec(generatedAnswer)) !== null) {
        const citationContent = match[1];
        let docName = citationContent.split(",")[0].trim().toLowerCase();
        docName = docName.replace(/^(university\s+)?source\s*(#\d+)?\s*[:-]\s*/, "");
        if (!docName.includes("http") && !docName.includes("www") && docName.endsWith(".pdf")) {
            citedDocs.add(docName);
        }
    }

    if (citedDocs.size > 0 && chunks.length > 0) {
        const retrievedDocNames = new Set(
            chunks.map(chunk => (chunk.metadata?.originalName || chunk.metadata?.filename || "").toLowerCase())
        );

        for (const citedDoc of citedDocs) {
            // Fuzzy match cited document
            const isMatch = Array.from(retrievedDocNames).some(rName => rName.includes(citedDoc) || citedDoc.includes(rName));
            if (!isMatch) {
                return {
                    valid: false,
                    confidence: "LOW",
                    score: 0.2,
                    reason: `Hallucination detected: Response cited "${citedDoc}" which was not in the retrieved documents.`
                };
            }
        }
    }

    // Strip any thinking tags from model output
    try {
        const { stripQwenThinking } = require("../config/llm");
        generatedAnswer = stripQwenThinking(generatedAnswer);
    } catch (_) {}

    // 2b. Entity-Fact Consistency Check via EvidenceContract
    if (chunks.length > 0 && generatedAnswer) {
        try {
            const { buildEvidenceContract } = require("../ai/services/entityGroundingService");
            const contract = buildEvidenceContract({ question, chunks });
            const bestRecord = contract.matchedRecord;
            const requestedAttrs = contract.requestedAttributes || {};

            if (bestRecord) {
                let hasContradiction = false;
                let contradictionReason = "";

                // Check 1: Room Number Consistency
                if (bestRecord.room) {
                    const genRoomMatch = generatedAnswer.match(/\b(?:room\s*(?:no\.?|number)?\s*|#\s*)?([0-9]{3,4}[a-z]?)\b/i);
                    if (genRoomMatch) {
                        const claimedRoom = genRoomMatch[1];
                        if (claimedRoom !== bestRecord.room) {
                            const otherRec = contract.records.find(r => r.room === claimedRoom && r.entity !== bestRecord.entity);
                            hasContradiction = true;
                            contradictionReason = `Claimed Room ${claimedRoom} ${otherRec ? `belongs to ${otherRec.entity}` : "is unsupported"}, expected Room ${bestRecord.room} for ${bestRecord.entity}.`;
                        }
                    }
                }

                // Check 2: Building Consistency (Detect invented or conflicting buildings)
                if (requestedAttrs.asksBuilding) {
                    const bldPattern = /\b(Building\s+[IVX0-9]+|[A-Za-z]+(?:\s+[A-Za-z]+)?\s+bhavan)\b/i;
                    const claimedBldMatch = generatedAnswer.match(bldPattern);
                    const verifiedBuilding = bestRecord.building || bestRecord.documentBuilding;
                    if (claimedBldMatch) {
                        const claimedBld = claimedBldMatch[1].trim();
                        if (!verifiedBuilding) {
                            hasContradiction = true;
                            contradictionReason = `Claimed building "${claimedBld}" is not established in official documents for ${bestRecord.entity}.`;
                        } else if (claimedBld.toLowerCase() !== verifiedBuilding.toLowerCase()) {
                            hasContradiction = true;
                            contradictionReason = `Claimed building "${claimedBld}" conflicts with established building "${verifiedBuilding}" for ${bestRecord.entity}.`;
                        }
                    }
                }

                // Check 3: Floor Consistency (Detect invented or borrowed floors)
                if (requestedAttrs.asksFloor) {
                    const floorPattern = /\b([0-9]+(?:st|nd|rd|th)\s+floor|ground\s+floor)\b/i;
                    const claimedFloorMatch = generatedAnswer.match(floorPattern);
                    if (claimedFloorMatch) {
                        const claimedFlr = claimedFloorMatch[1].trim();
                        if (!bestRecord.floor) {
                            hasContradiction = true;
                            contradictionReason = `Claimed floor "${claimedFlr}" is not established in official documents for ${bestRecord.entity}.`;
                        } else if (claimedFlr.toLowerCase() !== bestRecord.floor.toLowerCase()) {
                            hasContradiction = true;
                            contradictionReason = `Claimed floor "${claimedFlr}" conflicts with established floor "${bestRecord.floor}" for ${bestRecord.entity}.`;
                        }
                    }
                }

                if (hasContradiction) {
                    const correctedAnswer = contract.formatGroundedAnswer();
                    return {
                        valid: false,
                        confidence: "MEDIUM",
                        score: 0.5,
                        groundedAnswer: correctedAnswer || generatedAnswer,
                        reason: `Evidence contradiction: ${contradictionReason} Grounded correction applied.`
                    };
                }
            }
        } catch (_) {}
    }

    // 3. Multi-Factor Confidence Scoring
    const confidenceReport = confidenceGuard.calculateConfidence({
        question,
        retrievedChunks: chunks,
        sources,
        generatedAnswer
    });

    // 4. Duplicate Fact Removal
    const deduplicatedAnswer = confidenceGuard.stripDuplicateFacts(generatedAnswer);

    // 5. Apply Partial Information Warning if confidence is MEDIUM
    const finalAnswer = confidenceGuard.applyPartialInfoWarning(deduplicatedAnswer, confidenceReport.confidence);

    return {
        valid: confidenceReport.isGrounded,
        confidence: confidenceReport.confidence,
        score: confidenceReport.score,
        breakdown: confidenceReport.breakdown,
        groundedAnswer: finalAnswer,
        reason: confidenceReport.isGrounded ? "Response passed grounding and citation validation." : "Confidence too low for factual grounding."
    };
};

module.exports = {
    validateResponse
};
