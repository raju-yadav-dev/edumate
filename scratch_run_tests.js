const path = require("path");
const mongoose = require("mongoose");

// Load env
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Set GROQ_MODEL to llama-3.1-8b-instant during the tests to bypass Groq rate limits.
process.env.GROQ_MODEL = "llama-3.1-8b-instant";

// Monkey-patch SearchManager to retrieve a maximum of 2 chunks to minimize token usage under 6000 TPM limit
const SearchManager = require("./server/knowledge/SearchManager");
const originalSearchLocalPdfs = SearchManager.searchLocalPdfs;
SearchManager.searchLocalPdfs = async (query, user, limit, ignoreInstitution) => {
    console.log(`[TEST-MOCK] searchLocalPdfs called with limit ${limit}. Intercepting and reducing to 2 chunks.`);
    return originalSearchLocalPdfs(query, user, 2, ignoreInstitution);
};

const { askQuestion } = require("./server/ai/services/chatService");
const Chat = require("./server/models/Chat");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("\n=========================================");
    console.log("Connected to MongoDB. Starting Tests...");
    console.log("=========================================\n");

    const mockUserId = new mongoose.Types.ObjectId();
    const mockUser = {
        _id: mockUserId,
        fullName: "Test User",
        role: "student",
        institution: "Brainware University"
    };

    // Helper to print results
    const printResult = (testNum, description, result) => {
        console.log(`TEST ${testNum}: ${description}`);
        console.log(`- Query: "${result.query}"`);
        console.log(`- Answer:\n${result.message}`);
        if (result.sources && result.sources.length > 0) {
            console.log(`- Sources:`);
            result.sources.forEach(src => {
                console.log(`  * Name: "${src.title}"`);
                console.log(`    URL: ${src.downloadUrl ? src.downloadUrl.slice(0, 80) + "..." : "none"}`);
                console.log(`    Id: ${src.metadata?.documentId}`);
                console.log(`    UploadedFrom: ${src.metadata?.uploadedFrom}`);
            });
        } else {
            console.log(`- Sources: none`);
        }
        console.log("-----------------------------------------\n");
    };

    try {
        // ==================================================
        // TEST 1: Normal informational question
        // ==================================================
        const chat1 = await Chat.create({
            title: "Test 1",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res1 = await askQuestion({
            user: mockUser,
            question: "What is the BCA fee?",
            conversationId: chat1._id
        });
        printResult(1, "Normal question (What is the BCA fee?) - Expected: Normal RAG answer, no document", {
            query: "What is the BCA fee?",
            message: res1.message,
            sources: res1.sources
        });

        console.log("Sleeping 65 seconds to clear sliding window after RAG search...");
        await sleep(65000);

        // ==================================================
        // TEST 2: Explicit document request
        // ==================================================
        const chat2 = await Chat.create({
            title: "Test 2",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res2 = await askQuestion({
            user: mockUser,
            question: "Give me the BCA fee document.",
            conversationId: chat2._id
        });
        printResult(2, "Explicit request (Give me the BCA fee document.) - Expected: Relevant Admin BCA fee document", {
            query: "Give me the BCA fee document.",
            message: res2.message,
            sources: res2.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 3: B.Pharm fee document (exists or not?)
        // ==================================================
        const chat3 = await Chat.create({
            title: "Test 3",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res3 = await askQuestion({
            user: mockUser,
            question: "Give me the B.Pharm fee document.",
            conversationId: chat3._id
        });
        printResult(3, "Explicit request (Give me the B.Pharm fee document.) - Expected: Relevant B.Pharm document if exists, or not found", {
            query: "Give me the B.Pharm fee document.",
            message: res3.message,
            sources: res3.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 4: B.Pharm document not found fallthrough
        // ==================================================
        const chat4 = await Chat.create({
            title: "Test 4",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res4 = await askQuestion({
            user: mockUser,
            question: "Give me the B.Pharm fee document.",
            conversationId: chat4._id
        });
        printResult(4, "Not found verification (Give me the B.Pharm fee document.) - Expected: 'No relevant Admin document was found for your request.'", {
            query: "Give me the B.Pharm fee document.",
            message: res4.message,
            sources: res4.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 5: Context lookup (Tell me about BCA -> Give me the document)
        // ==================================================
        const chat5 = await Chat.create({
            title: "Test 5",
            user: mockUserId,
            institution: "Brainware University",
            status: "active",
            messages: [
                {
                    id: "msg-1",
                    role: "user",
                    content: "Tell me about BCA.",
                    topic: "BCA"
                },
                {
                    id: "msg-2",
                    role: "assistant",
                    content: "BCA is a 3-year undergraduate course in computing science.",
                    topic: "BCA"
                }
            ]
        });
        const res5 = await askQuestion({
            user: mockUser,
            question: "Give me the document.",
            conversationId: chat5._id,
            parentId: "msg-2"
        });
        printResult(5, "Context lookup (Tell me about BCA. -> Give me the document.) - Expected: Relevant Admin BCA document", {
            query: "Give me the document.",
            message: res5.message,
            sources: res5.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 6: Context lookup with specific document
        // ==================================================
        const chat6 = await Chat.create({
            title: "Test 6",
            user: mockUserId,
            institution: "Brainware University",
            status: "active",
            messages: [
                {
                    id: "msg-10",
                    role: "user",
                    content: "Tell me about BSc Digital Media Science & Journalism",
                    topic: "BSc Digital Media Science & Journalism"
                },
                {
                    id: "msg-20",
                    role: "assistant",
                    content: "It is a digital media course.",
                    topic: "BSc Digital Media Science & Journalism"
                }
            ]
        });
        const res6 = await askQuestion({
            user: mockUser,
            question: "Give me the official document for this.",
            conversationId: chat6._id,
            parentId: "msg-20"
        });
        printResult(6, "Context lookup specific (Tell me about BSc Digital Media... -> Give me the official document for this.) - Expected: BSc Digital Media...pdf", {
            query: "Give me the official document for this.",
            message: res6.message,
            sources: res6.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 7: Ambiguity detection
        // ==================================================
        const chat7 = await Chat.create({
            title: "Test 7",
            user: mockUserId,
            institution: "Brainware University",
            status: "active",
            messages: [
                {
                    id: "msg-100",
                    role: "user",
                    content: "Tell me about BCA and B.Pharm.",
                    topic: "BCA and B.Pharm"
                },
                {
                    id: "msg-200",
                    role: "assistant",
                    content: "BCA is computing, B.Pharm is pharmacy.",
                    topic: "BCA and B.Pharm"
                }
            ]
        });
        const res7 = await askQuestion({
            user: mockUser,
            question: "Give me the document.",
            conversationId: chat7._id,
            parentId: "msg-200"
        });
        printResult(7, "Context ambiguity (BCA and B.Pharm discussed -> Give me the document.) - Expected: Ask user which document they want", {
            query: "Give me the document.",
            message: res7.message,
            sources: res7.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 8: Document exists only in crawler storage
        // ==================================================
        const chat8 = await Chat.create({
            title: "Test 8",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res8 = await askQuestion({
            user: mockUser,
            question: "Give me the RefundRules.pdf document.",
            conversationId: chat8._id
        });
        printResult(8, "Crawler document check (Give me the RefundRules.pdf document.) - Expected: 'No relevant Admin document was found for your request.'", {
            query: "Give me the RefundRules.pdf document.",
            message: res8.message,
            sources: res8.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 9: Document exists only on the Internet
        // ==================================================
        const chat9 = await Chat.create({
            title: "Test 9",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res9 = await askQuestion({
            user: mockUser,
            question: "Give me the Google privacy policy document.",
            conversationId: chat9._id
        });
        printResult(9, "Internet document check (Give me the Google privacy policy document.) - Expected: 'No relevant Admin document was found for your request.'", {
            query: "Give me the Google privacy policy document.",
            message: res9.message,
            sources: res9.sources
        });

        console.log("Sleeping 15 seconds to prevent TPM limit...");
        await sleep(15000);

        // ==================================================
        // TEST 10: Original Admin-uploaded file verification
        // ==================================================
        const chat10 = await Chat.create({
            title: "Test 10",
            user: mockUserId,
            institution: "Brainware University",
            status: "active"
        });
        const res10 = await askQuestion({
            user: mockUser,
            question: "Give me the BCA fee document.",
            conversationId: chat10._id
        });
        console.log(`TEST 10: Original Admin-uploaded file verification`);
        if (res10.sources && res10.sources.length > 0) {
            const firstSource = res10.sources[0];
            const isOriginal = firstSource.metadata?.uploadedFrom === "api";
            const containsSignedUrl = firstSource.downloadUrl && firstSource.downloadUrl.includes("supabase") && firstSource.downloadUrl.includes("token=");
            console.log(`- Source type: "${firstSource.type}"`);
            console.log(`- Uploaded from Admin (api): ${isOriginal}`);
            console.log(`- Contains valid signed URL: ${containsSignedUrl}`);
            console.log(`- Result: ${isOriginal && containsSignedUrl ? "PASS" : "FAIL"}`);
        } else {
            console.log(`- Result: FAIL (No sources returned)`);
        }
        console.log("-----------------------------------------\n");

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runTests();
