const SearchManager = require("../knowledge/SearchManager");
const Chunk = require("../models/Chunk");
const Document = require("../models/Document");
const courseRegistry = require("../constants/courseRegistry.json");
const { countTokens } = require("../ai/utils/tokenizer");

const CONFIG = {
    SIMPLE_FACT: {
        topK: 5,
        maxContextTokens: 6000,
        maxOutputTokens: 800
    },
    DETAILED: {
        topK: 10,
        maxContextTokens: 12000,
        maxOutputTokens: 2000
    },
    FEE_STRUCTURE: {
        maxOutputTokens: 2500
    },
    COURSE_CATALOGUE: {
        maxOutputTokens: 3000
    },
    RECOMMENDATION: {
        topK: 6,
        maxContextTokens: 8000,
        maxOutputTokens: 2000
    }
};

/**
 * Filter course registry to find candidate courses matching the student profile.
 * @param {Object} profile - Student profile
 * @returns {Array} - List of filtered candidate courses
 */
const getCandidateCourses = (profile) => {
    let candidates = courseRegistry;

    // Filter by level based on class 12
    const isClass12 = profile.class && (profile.class.includes("12") || profile.class === "12th" || profile.class.includes("senior secondary"));
    if (isClass12) {
        // Class 12 students should only be recommended UG or Diploma courses
        candidates = candidates.filter(c => c.level === "UG" || c.level === "Diploma");
    }

    // Filter by stream (Arts, Science, Commerce)
    if (profile.stream) {
        const stream = profile.stream.toLowerCase();
        if (stream === "arts") {
            // Filter out Engineering, Biotech, Agri, Nursing, Pharmacy, Allied Health Sciences
            candidates = candidates.filter(c => {
                const school = c.school.toLowerCase();
                const name = c.canonicalName.toLowerCase();
                
                const isTech = name.includes("technology") || name.includes("b.tech") || name.includes("btech") || school.includes("engineering");
                const isBiotech = school.includes("biotechnology") || name.includes("biotech");
                const isAgri = school.includes("agriculture") || name.includes("agri");
                const isNursing = school.includes("nursing") || name.includes("nursing");
                const isPharm = school.includes("pharmacy") || name.includes("pharm");
                const isAlliedHealth = school.includes("allied health") || name.includes("physiotherapy") || name.includes("optometry") || name.includes("critical care") || name.includes("medical lab") || name.includes("radiology");

                return !isTech && !isBiotech && !isAgri && !isNursing && !isPharm && !isAlliedHealth;
            });
        } else if (stream === "commerce") {
            candidates = candidates.filter(c => {
                const school = c.school.toLowerCase();
                const isTech = school.includes("engineering");
                const isBiotech = school.includes("biotechnology");
                const isAgri = school.includes("agriculture");
                return !isTech && !isBiotech && !isAgri;
            });
        }
    }

    return candidates.slice(0, 10);
};

/**
 * Orchestrates RAG search with query-type specific adaptive parameters.
 * @param {string} query - The rewritten question
 * @param {Object} user - Current user metadata
 * @param {string} queryType - SIMPLE_FACT, DETAILED, FEE_STRUCTURE, RECOMMENDATION
 * @param {Object} [profile=null] - Student profile for recommendation
 * @returns {Promise<Object>} - { chunks, budget, telemetry }
 */
const retrieveAdaptiveChunks = async (query, user, queryType, profile = null) => {
    const startedAt = Date.now();
    let chunks = [];

    if (queryType === "FEE_STRUCTURE") {
        // Targeted fee retrieval + continuation chunks
        const baseLimit = CONFIG.SIMPLE_FACT.topK;
        const initialChunks = await SearchManager.searchLocalPdfs(query, user, baseLimit);
        
        if (initialChunks.length > 0) {
            const documentId = initialChunks[0].metadata?.documentId;
            if (documentId) {
                const doc = await Document.findById(documentId).lean();
                if (doc) {
                    const isFeeOrAdmissionDoc = doc.category === "fees" || doc.category === "admissions" || doc.originalName.toLowerCase().includes("fee") || doc.originalName.toLowerCase().includes("eligib") || doc.originalName.toLowerCase().includes("course");
                    if (isFeeOrAdmissionDoc) {
                        console.log(`[ADAPTIVE] Fee structure detected. Fetching all chunks of "${doc.originalName}" to ensure table continuity.`);
                        const docChunks = await Chunk.find({ document: documentId })
                            .sort({ "metadata.pageNumber": 1, "metadata.chunkIndex": 1 })
                            .lean();
                        
                        chunks = docChunks.map(c => ({
                            id: c._id.toString(),
                            content: c.content,
                            metadata: {
                                documentId: documentId,
                                originalName: doc.originalName,
                                filename: doc.originalName,
                                pageNumber: c.metadata?.pageNumber || 1,
                                page: c.metadata?.pageNumber || 1,
                                category: c.metadata?.category || doc.category || "",
                                department: c.metadata?.department || doc.department || "",
                                institution: c.metadata?.institution || doc.institution || "",
                                sourceType: "document",
                                uploadedFrom: doc.metadata?.uploadedFrom || "api"
                            },
                            score: 1.0
                        }));
                    }
                }
            }
        }
        
        if (chunks.length === 0) {
            chunks = initialChunks;
        }
    } else if (queryType === "RECOMMENDATION" && profile) {
        // Staged retrieval: filter candidate courses first, then retrieve eligibility chunks
        const candidates = getCandidateCourses(profile);
        
        if (candidates.length > 0) {
            const candidateNames = candidates.map(c => c.shortName);
            const searchQuery = `eligibility criteria requirements for ${candidateNames.join(" ")}`;
            console.log(`[ADAPTIVE] Recommendation staged query: "${searchQuery}"`);
            chunks = await SearchManager.searchLocalPdfs(searchQuery, user, CONFIG.RECOMMENDATION.topK);
        } else {
            chunks = await SearchManager.searchLocalPdfs(query, user, CONFIG.RECOMMENDATION.topK);
        }
    } else {
        // SIMPLE_FACT or DETAILED queries
        const config = CONFIG[queryType] || CONFIG.SIMPLE_FACT;
        chunks = await SearchManager.searchLocalPdfs(query, user, config.topK);
        
        // Filter chunks dynamically to fit context budget
        let totalTokens = 0;
        const budgetedChunks = [];
        for (const chunk of chunks) {
            const tokens = countTokens(chunk.content);
            if (totalTokens + tokens > config.maxContextTokens) {
                break;
            }
            budgetedChunks.push(chunk);
            totalTokens += tokens;
        }
        chunks = budgetedChunks;
    }

    const duration = Date.now() - startedAt;
    console.log(`[ADAPTIVE RETRIEVAL] Type: ${queryType} | Duration: ${duration}ms | Chunks: ${chunks.length}`);

    return {
        chunks,
        budget: CONFIG[queryType] || CONFIG.SIMPLE_FACT,
        telemetry: {
            retrievalTime: duration,
            chunksRetrieved: chunks.length
        }
    };
};

module.exports = {
    CONFIG,
    getCandidateCourses,
    retrieveAdaptiveChunks
};
