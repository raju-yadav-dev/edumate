const Chat = require("../models/Chat");
const { classifyIntent } = require("./intentService");
const { decide } = require("./decisionEngine");
const ragService = require("./ragService");
const mapService = require("./mapService");
const promptService = require("./promptService");
const groqProviderManager = require("./groqProviderManager");
const responseValidator = require("./responseValidator");
const responseFormatter = require("./responseFormatter");
const memoryService = require("./memoryService");

const deterministicGreeting = (user) => ({
    answer: `Hello ${user?.fullName || "there"}. I can help with institutional questions, documents, campus services, routes, and academic support.`,
    confidence: "high",
    sources: [
        {
            type: "system",
            title: "EduMate Assistant",
            reference: "deterministic-greeting"
        }
    ]
});

const buildGuestUser = () => ({
    _id: null,
    fullName: "Guest",
    role: "guest",
    institution: "",
    department: ""
});

const shouldClarifyFees = (question) => {
    const normalized = question.toLowerCase();

    return /\b(fee|fees|tuition|payment|cost)\b/.test(normalized) &&
        !/\b(btech|b\.tech|mtech|m\.tech|mba|bca|mca|bba|ba|bsc|msc|course|program|department)\b/.test(normalized);
};

const shouldClarifyRoute = (question) => {
    const normalized = question.toLowerCase();

    return /\b(route|directions|how to reach|distance|travel|nearby)\b/.test(normalized) &&
        !/\b(from|to|near|current location|station|airport|bus stand|college)\b/.test(normalized);
};

const clarificationAnswer = (question) => {
    if (shouldClarifyFees(question)) {
        return {
            answer: "Which course or program do you want the fee structure for? For example: B.Tech CSE, BCA, MBA, hostel fee, admission fee, or semester fee.",
            confidence: "high",
            sources: [
                {
                    type: "system",
                    title: "EduMate Clarification",
                    reference: "fee-course-required"
                }
            ]
        };
    }

    if (shouldClarifyRoute(question)) {
        return {
            answer: "Please share your starting point and destination so I can compare possible routes, travel time, and approximate cost. Example: from Howrah Station to the college.",
            confidence: "high",
            sources: [
                {
                    type: "system",
                    title: "EduMate Clarification",
                    reference: "route-origin-destination-required"
                }
            ]
        };
    }

    return null;
};

const getOrCreateChat = async ({ user, conversationId, question }) => {
    if (!user?._id) {
        return null;
    }

    if (conversationId) {
        const existingChat = await Chat.findOne({
            _id: conversationId,
            user: user._id,
            status: "active"
        });

        if (existingChat) {
            return existingChat;
        }
    }

    return Chat.create({
        title: question.slice(0, 80),
        user: user._id,
        institution: user.institution || "",
        createdBy: user._id,
        updatedBy: user._id
    });
};

const askQuestion = async ({ user, question, conversationId }) => {
    const startedAt = Date.now();
    const normalizedQuestion = String(question || "").trim();
    const activeUser = user || buildGuestUser();

    if (!normalizedQuestion) {
        const error = new Error("Question is required.");
        error.statusCode = 422;
        throw error;
    }

    const intentResult = classifyIntent(normalizedQuestion);
    const decision = decide(intentResult);
    const memory = await memoryService.getRecentMemory({
        userId: activeUser._id,
        conversationId
    });

    let retrievedContext = {
        found: false,
        chunks: [],
        sources: [],
        confidence: 0
    };

    let formatted;
    let provider = "system";

    const clarification = clarificationAnswer(normalizedQuestion);

    if (clarification) {
        formatted = clarification;
    } else if (decision.service === "deterministic") {
        formatted = deterministicGreeting(activeUser);
    } else if (decision.service === "map") {
        const mapResult = await mapService.resolveLocationRequest({
            question: normalizedQuestion,
            user: activeUser
        });

        formatted = mapResult.found
            ? responseFormatter.formatAnswer({
                answer: mapResult.answer,
                confidence: "high",
                sources: mapResult.sources
            })
            : responseFormatter.formatUnavailable({ reason: mapResult.answer });
    } else {
        retrievedContext = await ragService.searchKnowledgeBase({
            question: normalizedQuestion,
            institution: activeUser.institution,
            intent: intentResult.intent
        });

        if (decision.requiresVerifiedContext && !retrievedContext.sources.length) {
            formatted = responseFormatter.formatUnavailable({
                reason: "No matching uploaded document, official institution source, or trusted source was found."
            });
        } else {
            const messages = promptService.buildMessages({
                question: normalizedQuestion,
                intent: intentResult.intent,
                retrievedContext,
                memory,
                user: activeUser
            });

            const completion = await groqProviderManager.generateCompletion({ messages });
            provider = completion.provider;

            const validation = responseValidator.validateResponse({
                intent: intentResult.intent,
                retrievedContext,
                generatedAnswer: completion.content,
                providerSuccess: completion.success
            });

            formatted = validation.valid
                ? responseFormatter.formatAnswer({
                    answer: completion.content,
                    confidence: validation.confidence,
                    sources: retrievedContext.sources
                })
                : responseFormatter.formatUnavailable({ reason: validation.reason });
        }
    }

    const chat = await getOrCreateChat({
        user: activeUser,
        conversationId,
        question: normalizedQuestion
    });

    const responseTimeMs = Date.now() - startedAt;

    if (chat) {
        chat.messages.push({
            role: "user",
            content: normalizedQuestion,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            provider: "user"
        });

        chat.messages.push({
            role: "assistant",
            content: formatted.answer,
            intent: intentResult.intent,
            confidence: formatted.confidence === "high" ? 0.9 : formatted.confidence === "medium" ? 0.65 : 0.25,
            sources: formatted.sources,
            provider,
            responseTimeMs
        });

        chat.updatedBy = activeUser._id;
        await chat.save();
    }

    return {
        conversationId: chat?._id || conversationId || null,
        mode: activeUser._id ? "authenticated" : "guest",
        message: formatted.answer,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        confidence: formatted.confidence,
        sources: formatted.sources,
        provider,
        responseTimeMs
    };
};

module.exports = {
    askQuestion
};
