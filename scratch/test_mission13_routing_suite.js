const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const { ROUTER_ROUTES, classifyQueryRoute, routeQuery } = require("../server/ai/routing/queryRouter");
const { planQuery } = require("../server/ai/utils/queryPlanner");

// -------------------------------------------------------------
// 50 GENERAL KNOWLEDGE QUESTIONS (Science, Tech, Math, World, Code)
// -------------------------------------------------------------
const GENERAL_KNOWLEDGE_QUESTIONS = [
    // Programming & Computer Science (15)
    "What is Python?",
    "Explain how a hash map works internally.",
    "Write a binary search algorithm in JavaScript.",
    "What is the difference between TCP and UDP?",
    "How does React's virtual DOM improve rendering performance?",
    "What is SQL injection and how can it be prevented?",
    "Explain the concept of recursion with an example.",
    "What is Big O notation?",
    "How does garbage collection work in Java?",
    "What is the difference between synchronous and asynchronous programming?",
    "Explain Docker containerization and how it differs from virtual machines.",
    "What are WebSockets and when should they be used?",
    "How does a neural network learn using backpropagation?",
    "What is polymorphism in Object-Oriented Programming?",
    "Explain the difference between SQL and NoSQL databases.",

    // Science & Physics & Chemistry (15)
    "What is photosynthesis and what are its main stages?",
    "Explain Newton's three laws of motion with real-world examples.",
    "How do solar panels generate electricity from sunlight?",
    "What is quantum entanglement in quantum mechanics?",
    "What is the speed of light in vacuum?",
    "Explain the structure of an atom and its subatomic particles.",
    "How do airplanes generate aerodynamic lift?",
    "What is the difference between AC and DC current?",
    "Explain the second law of thermodynamics and entropy.",
    "What is DNA replication and how do enzymes assist in it?",
    "How do vaccines help the human immune system fight viruses?",
    "What is CRISPR gene editing technology?",
    "Explain the Doppler effect and its applications in astronomy.",
    "How do black holes form in outer space?",
    "What is the periodic table and how are elements organized?",

    // Mathematics & Statistics (10)
    "What is the Pythagorean theorem?",
    "How do you find the derivative of a polynomial function in calculus?",
    "What is standard deviation in statistics?",
    "Explain Bayes' theorem and its applications in probability.",
    "What is Euler's formula in complex analysis?",
    "How do you calculate the eigenvalues of a matrix?",
    "Solve the equation: 3x + 12 = 36.",
    "What is the Fibonacci sequence and where does it appear in nature?",
    "Explain the difference between permutations and combinations.",
    "What is a prime number and why are they important in cryptography?",

    // History, Geography, Economics, Literature (10)
    "What was the main cause of World War 1?",
    "What is the capital of Japan?",
    "Who was William Shakespeare and what were his major plays?",
    "Explain the concept of inflation in macroeconomics.",
    "What is the difference between GDP and GNP?",
    "Who painted the Mona Lisa?",
    "What is the water cycle and how does precipitation occur?",
    "Explain the difference between a simile and a metaphor.",
    "What was the Industrial Revolution and how did it change society?",
    "What is the law of supply and demand in microeconomics?"
];

// -------------------------------------------------------------
// 50 UNIVERSITY SPECIFIC QUESTIONS (Fees, Admissions, Hostel, Faculty, etc.)
// -------------------------------------------------------------
const UNIVERSITY_SPECIFIC_QUESTIONS = [
    // Admissions & Eligibility (10)
    "What is the admission procedure for B.Tech Computer Science at Brainware University?",
    "What are the eligibility criteria for MCA admission?",
    "How do I apply for MBA admissions this year?",
    "What is the cutoff percentage for BBA LLB admission?",
    "Where can I get the university application form?",
    "What documents are required during campus admission enrollment?",
    "What is the seat intake capacity for Diploma in Mechanical Engineering?",
    "Is there an entrance exam for M.Tech admissions at the university?",
    "What are the eligibility requirements for BCA admission?",
    "When does the university admission registration close for the upcoming batch?",

    // Fees & Tuition (10)
    "What is the total fee structure for B.Tech in CSE at Brainware University?",
    "How much is the semester tuition fee for BBA?",
    "What is the hostel fee per semester including mess food?",
    "How do I pay the semester fees online through the student portal?",
    "Is there any refund policy for tuition fees if admission is cancelled?",
    "What is the total course cost for the 3-year BCA program?",
    "What are the bus transport fees for students traveling from Kolkata?",
    "What is the examination fee per semester at our university?",
    "Are there installment payment options for college fees?",
    "What is the fee breakdown for M.Sc in Applied Mathematics?",

    // Faculty & Leadership & HODs (10)
    "Who is the HOD of the Computational Sciences department?",
    "Who is the Dean of Engineering at Brainware University?",
    "Who is the Vice Chancellor of our university?",
    "List all professors and faculty members in the Department of Management.",
    "Who teaches Data Structures and Algorithms in the CSE department?",
    "Who is the HOD of Biotechnology?",
    "Where can I find the contact details of the Head of the Department?",
    "Who is the Registrar of Brainware University?",
    "Which professor conducts the Artificial Intelligence lab sessions?",
    "Who is the faculty advisor for first-year engineering students?",

    // Hostel, Mess & Campus Facilities (10)
    "What are the hostel rules and curfew timings for students?",
    "Is mess food included in the hostel accommodation charges?",
    "How do I apply for hostel room allotment?",
    "Where is the university central library located?",
    "How many books can a student issue from the library at once?",
    "What are the operating hours of the college canteen and cafeteria?",
    "Where is Room 302 in Building 5 located?",
    "How do I reach the accounts section in Building 1?",
    "Where is the moot court room in the Department of Law?",
    "Where is the campus sick room and medical center located?",

    // Placements, Scholarships, Notices & Academics (10)
    "What was the highest placement package offered at Brainware University last year?",
    "Which top recruiters visit our campus for engineering placement drives?",
    "What is the average salary package for MCA placements?",
    "How do I apply for the merit-based scholarship fee waiver?",
    "What are the eligibility criteria for the Swami Vivekananda scholarship at the college?",
    "When will the semester exam routine and academic calendar be published?",
    "Where can I view the latest official notices and circulars from the exam cell?",
    "What is the syllabus and course structure for 3rd semester B.Tech CSE?",
    "What are the minimum attendance rules required to sit for semester exams?",
    "What degrees and courses are offered by Brainware University?"
];

// -------------------------------------------------------------
// 10 MIXED QUESTIONS (General concept + University specific)
// -------------------------------------------------------------
const MIXED_QUESTIONS = [
    "What is Machine Learning and what ML courses does Brainware University offer?",
    "Explain what Cloud Computing is and tell me the fees for Cloud Computing at this college.",
    "What is Cybersecurity and who is the faculty for Cybersecurity at Brainware?",
    "Explain the difference between AI and Data Science, and what is the admission eligibility for B.Tech CSE here?",
    "What is corporate law and how are the placements for BBA LLB students at Brainware University?",
    "What is Biotechnology and what is the fee structure for B.Tech Biotech at our college?",
    "Explain what a Database Management System is and tell me the syllabus for DBMS in our university curriculum.",
    "What is Internet of Things and what IoT lab facilities are available on campus?",
    "Explain the fundamentals of financial management and tell me the MBA tuition fees here.",
    "What is robotics engineering and what are the admission requirements for robotics at Brainware?"
];

// -------------------------------------------------------------
// 10 CONVERSATIONAL QUESTIONS (Greetings, bot identity, thanks)
// -------------------------------------------------------------
const CONVERSATIONAL_QUESTIONS = [
    "Hello",
    "Hi there",
    "Good morning!",
    "Hey, how are you doing today?",
    "Who are you?",
    "What is your name?",
    "What can you do?",
    "Thank you very much for your help!",
    "Thanks a lot!",
    "Goodbye, have a great day!"
];

async function runMission13RoutingTestSuite() {
    console.log("================================================================================");
    console.log("    EDUMATE MISSION 13.1 — INTELLIGENT LLM + RAG ROUTING ENGINE TEST SUITE      ");
    console.log("================================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    const test = (name, fn) => {
        totalTests++;
        process.stdout.write(`[TEST ${totalTests}] ${name}... `);
        try {
            fn();
            passedTests++;
            console.log("✓ PASS");
        } catch (err) {
            console.log(`❌ FAIL\n  Error: ${err.message}`);
        }
    };

    // -------------------------------------------------------------
    // SECTION 1: 50 General Knowledge Questions Routing
    // -------------------------------------------------------------
    console.log("\n--- SECTION 1: 50 General Knowledge Questions (Bypassing RAG) ---");

    let generalPassed = 0;
    GENERAL_KNOWLEDGE_QUESTIONS.forEach((q, idx) => {
        test(`General Query ${idx + 1}/50: "${q.slice(0, 45)}..."`, () => {
            const plan = planQuery(q);
            assert.strictEqual(plan.route, ROUTER_ROUTES.GENERAL_KNOWLEDGE, `Expected GENERAL_KNOWLEDGE, got ${plan.route}`);
            assert.strictEqual(plan.skipRag, true, `Expected skipRag === true for general query`);
            generalPassed++;
        });
    });

    // -------------------------------------------------------------
    // SECTION 2: 50 University Specific Questions Routing
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: 50 University Specific Questions (Executing RAG) ---");

    let universityPassed = 0;
    UNIVERSITY_SPECIFIC_QUESTIONS.forEach((q, idx) => {
        test(`University Query ${idx + 1}/50: "${q.slice(0, 45)}..."`, () => {
            const plan = planQuery(q);
            assert.strictEqual(plan.route, ROUTER_ROUTES.UNIVERSITY_SPECIFIC, `Expected UNIVERSITY_SPECIFIC, got ${plan.route}`);
            assert.strictEqual(plan.skipRag, false, `Expected skipRag === false for university query`);
            universityPassed++;
        });
    });

    // -------------------------------------------------------------
    // SECTION 3: 10 Mixed Questions Routing
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: 10 Mixed Questions (Dual Knowledge + RAG) ---");

    let mixedPassed = 0;
    MIXED_QUESTIONS.forEach((q, idx) => {
        test(`Mixed Query ${idx + 1}/10: "${q.slice(0, 45)}..."`, () => {
            const plan = planQuery(q);
            assert.strictEqual(plan.route, ROUTER_ROUTES.MIXED, `Expected MIXED, got ${plan.route}`);
            assert.strictEqual(plan.skipRag, false, `Expected skipRag === false for mixed query`);
            mixedPassed++;
        });
    });

    // -------------------------------------------------------------
    // SECTION 4: 10 Conversational Questions Routing
    // -------------------------------------------------------------
    console.log("\n--- SECTION 4: 10 Conversational Questions (Fast Greeting Route) ---");

    let convPassed = 0;
    CONVERSATIONAL_QUESTIONS.forEach((q, idx) => {
        test(`Conversational Query ${idx + 1}/10: "${q}"`, () => {
            const plan = planQuery(q);
            assert.strictEqual(plan.route, ROUTER_ROUTES.CONVERSATIONAL, `Expected CONVERSATIONAL, got ${plan.route}`);
            assert.strictEqual(plan.skipRag, true, `Expected skipRag === true for conversational query`);
            convPassed++;
        });
    });

    // -------------------------------------------------------------
    // SECTION 5: Query Plan & Metadata Filter Verifications
    // -------------------------------------------------------------
    console.log("\n--- SECTION 5: Query Planner Telemetry & Metadata Filters ---");

    test("HOD query produces correct route, category, and heading filter", () => {
        const plan = planQuery("Who is the HOD of Computational Sciences?");
        assert.strictEqual(plan.route, ROUTER_ROUTES.UNIVERSITY_SPECIFIC);
        assert.strictEqual(plan.skipRag, false);
        assert.strictEqual(plan.category, "Faculty");
        assert.strictEqual(plan.heading, "HOD");
        assert.deepStrictEqual(plan.filters.category, "Faculty");
    });

    test("Fee structure query produces correct category and documentType", () => {
        const plan = planQuery("What is the B.Tech CSE fee structure?");
        assert.strictEqual(plan.route, ROUTER_ROUTES.UNIVERSITY_SPECIFIC);
        assert.strictEqual(plan.skipRag, false);
        assert.strictEqual(plan.category, "Admissions");
        assert.strictEqual(plan.documentType, "Fee Structure");
    });

    test("General Python question produces no unwanted RAG filters", () => {
        const plan = planQuery("How do you implement quicksort in Python?");
        assert.strictEqual(plan.route, ROUTER_ROUTES.GENERAL_KNOWLEDGE);
        assert.strictEqual(plan.skipRag, true);
        assert.strictEqual(Object.keys(plan.filters).length, 0);
    });

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`    ROUTING ACCURACY SUMMARY:`);
    console.log(`    - General Knowledge:  ${generalPassed}/50 (${((generalPassed / 50) * 100).toFixed(1)}%)`);
    console.log(`    - University Specific: ${universityPassed}/50 (${((universityPassed / 50) * 100).toFixed(1)}%)`);
    console.log(`    - Mixed:              ${mixedPassed}/10 (${((mixedPassed / 10) * 100).toFixed(1)}%)`);
    console.log(`    - Conversational:     ${convPassed}/10 (${((convPassed / 10) * 100).toFixed(1)}%)`);
    console.log(`    TOTAL TESTS:          ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log("================================================================================\n");

    if (passedTests !== totalTests) {
        throw new Error(`Test suite completed with failures: ${totalTests - passedTests} failed.`);
    }
}

runMission13RoutingTestSuite().catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
});
