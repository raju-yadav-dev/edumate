require("dotenv").config();
const { classifyQueryRoute, ROUTER_ROUTES } = require("../server/ai/routing/queryRouter");
const { planQuery } = require("../server/ai/utils/queryPlanner");

let passed = 0;
let failed = 0;

function assertRoute(query, expectedRoute, expectedSkipRag, options = {}) {
    const plan = planQuery(query, options);
    const actualRoute = plan.route;
    const actualSkipRag = plan.skipRag;

    const routeOk = actualRoute === expectedRoute;
    const skipOk = actualSkipRag === expectedSkipRag;

    if (routeOk && skipOk) {
        passed++;
        console.log(`  ✓ [PASS] "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}" -> ${actualRoute} (skipRag: ${actualSkipRag})`);
    } else {
        failed++;
        console.error(`  ✗ [FAIL] "${query}"\n     Expected: ${expectedRoute} (skipRag: ${expectedSkipRag})\n     Actual:   ${actualRoute} (skipRag: ${actualSkipRag})\n     Reason:   ${plan.routingDetails?.reason}`);
    }
}

console.log("================================================================================");
console.log("🚀 EDUMATE MISSION 13.4 — INTELLIGENT QUERY PLANNER & ROUTER MASTER TEST SUITE");
console.log("================================================================================\n");

// ============================================================================
// SECTION 1: 50 General Knowledge Questions (Skip RAG = true, 0ms retrieval)
// ============================================================================
console.log("--- SECTION 1: 50 General Knowledge Questions ---");

const GENERAL_QUESTIONS = [
    // Programming Languages & Concepts
    "What is Python and why is it so popular?",
    "Explain the difference between Python lists and tuples.",
    "What is the GIL in Python and how does it affect multithreading?",
    "How does memory management work in Java?",
    "Explain Java inheritance with a simple code example.",
    "What is polymorphism in Object Oriented Programming?",
    "What is the difference between an abstract class and an interface?",
    "Explain pointers and dynamic memory allocation in C.",
    "What is the difference between pass by value and pass by reference in C++?",
    "Explain JavaScript closures and how they retain lexical scope.",
    "What is the event loop in Node.js and how does it process asynchronous tasks?",
    "What is the difference between let, const, and var in JavaScript?",
    "What are Promises and async/await in modern JavaScript?",
    "What is HTML semantic structure and why is it important?",
    "Explain CSS flexbox vs CSS grid layout models.",
    "What is the difference between synchronous and asynchronous execution?",
    "Explain how garbage collection works in modern programming runtimes.",

    // Data Structures & Algorithms
    "Explain recursion with the example of calculating Fibonacci numbers.",
    "How does binary search work and what is its time complexity?",
    "What is a doubly linked list and how does it differ from a singly linked list?",
    "Explain the working of a Hash Table and how hash collisions are resolved.",
    "What is a Binary Search Tree and how do you perform in-order traversal?",
    "Explain how Dijkstra's shortest path algorithm works on a weighted graph.",
    "What is dynamic programming and how does memoization prevent redundant computations?",
    "Explain the difference between QuickSort and MergeSort algorithms.",
    "What is Big O notation and how do you calculate time complexity?",
    "Explain the working of a Trie data structure for prefix search.",

    // Operating Systems & Systems Programming
    "What is the difference between a process and a thread in an operating system?",
    "What is a deadlock and what are the four Coffman conditions required for it?",
    "Explain the difference between a mutex and a semaphore.",
    "How does virtual memory and paging work in modern operating systems?",
    "Explain the round-robin CPU scheduling algorithm.",

    // Networking
    "Explain the difference between TCP and UDP protocols.",
    "What are the seven layers of the OSI model and their respective functions?",
    "How does the DNS resolution process translate a domain name to an IP address?",
    "What is the three-way handshake mechanism in TCP connection establishment?",
    "What is the difference between HTTP and HTTPS?",

    // Database Management Systems
    "What is database normalization and explain 1NF, 2NF, and 3NF.",
    "What are ACID properties in relational database management systems?",
    "Explain the difference between SQL relational databases and NoSQL document stores.",
    "What is a database index and how does a B-Tree improve query performance?",

    // Artificial Intelligence & Machine Learning
    "What is the difference between Artificial Intelligence, Machine Learning, and Deep Learning?",
    "Explain supervised learning vs unsupervised learning with real-world examples.",
    "What is gradient descent and how does it optimize loss functions in neural networks?",
    "What is overfitting in machine learning and how can regularization mitigate it?",
    "Explain how self-attention mechanism works in Transformer neural network architectures.",

    // Acronym Full Forms / Definitions (Must be GENERAL_KNOWLEDGE, not University RAG)
    "What is the full form of BCA?",
    "What does MCA stand for?",
    "What is the full form of API in computer science?",
    "What does DBMS stand for?",
    "What is the full form of HTML?"
];

GENERAL_QUESTIONS.forEach(q => {
    assertRoute(q, ROUTER_ROUTES.GENERAL_KNOWLEDGE, true);
});

// ============================================================================
// SECTION 2: 50 University Specific Questions (Execute RAG = true)
// ============================================================================
console.log("\n--- SECTION 2: 50 University Specific Questions ---");

const UNIVERSITY_QUESTIONS = [
    // Admissions & Fees
    "What is the admission procedure for B.Tech Computer Science and Engineering?",
    "What are the eligibility criteria for MCA admission this academic year?",
    "How do I apply for MBA admissions this year?",
    "What is the cutoff percentage for BBA LLB admission?",
    "Where can I get the university application form?",
    "What documents are required during campus admission verification?",
    "What is the seat intake capacity for Diploma in Mechanical Engineering?",
    "Is there an entrance exam for M.Tech admissions?",
    "What are the eligibility requirements for BCA at our university?",
    "When does the university admission registration portal close?",
    "What is the total fee structure for B.Tech in CSE at Brainware University?",
    "How much is the semester tuition fee for BBA?",
    "What is the hostel fee per semester including food charges?",
    "How do I pay the semester fees online through the student portal?",
    "Is there any refund policy for tuition fees if a student cancels admission?",
    "What is the total course cost for the 3-year BCA program?",
    "What are the bus transport fees for students traveling from Kolkata?",
    "What is the examination fee per semester at our college?",
    "Are there installment payment options for college fees?",
    "What is the fee breakdown for M.Sc in Applied Mathematics?",

    // Course Synonyms (Requirement 3)
    "Computer Application fee details for this session",
    "Bachelor of Computer Applications fees at EduMate university",
    "Bachelor of Technology in CSE admission guidelines",
    "Business Administration tuition fees per semester",

    // Faculty & Administration
    "Who is the HOD of the Computational Sciences department?",
    "Who is the Dean of Engineering at Brainware University?",
    "Who is the Vice Chancellor of our university?",
    "List all professors and faculty members in the CSE department.",
    "Who teaches Data Structures and Algorithms in our department?",
    "Who is the HOD of Biotechnology?",
    "Where can I find the contact details of the HOD of Law?",
    "Who is the Registrar of Brainware University?",
    "Which professor conducts the Artificial Intelligence lab sessions?",
    "Who is the faculty advisor for first-year engineering students?",

    // Facilities, Rules & Navigation
    "What are the hostel rules and curfew timings for students?",
    "Is mess food included in the hostel accommodation fee?",
    "How do I apply for hostel room allotment?",
    "Where is the university central library located on campus?",
    "How many books can a student issue from the library at one time?",
    "What are the operating hours of the college central library?",
    "Where is Room 302 in Building 5 located?",
    "How do I reach the accounts section in Building 1?",
    "Where is the moot court room in the Department of Law?",
    "Where is the campus sick room and medical center located?",

    // Placements & Scholarships & Notices
    "What was the highest placement package offered in our university placement drive?",
    "Which top recruiters visit our campus for engineering placements?",
    "What is the average salary package for MCA placements?",
    "How do I apply for the merit-based scholarship at Brainware University?",
    "What are the eligibility criteria for the Swami Vivekananda scholarship?",
    "When will the semester exam routine and academic calendar be published?",
    "Where can I view the latest official notices and circulars on the notice board?",
    "What is the syllabus and course structure for BCA 3rd semester?",
    "What are the minimum attendance rules required to sit for semester exams?",
    "What degrees and courses are offered by Brainware University?"
];

UNIVERSITY_QUESTIONS.forEach(q => {
    assertRoute(q, ROUTER_ROUTES.UNIVERSITY_SPECIFIC, false);
});

// ============================================================================
// SECTION 3: 30 Mixed Questions (General Explanation + University RAG)
// ============================================================================
console.log("\n--- SECTION 3: 30 Mixed Questions ---");

const MIXED_QUESTIONS = [
    "Explain BCA and tell me EduMate BCA fees.",
    "What is DBMS and how is it taught in CSS?",
    "Explain AI and tell me university AI electives.",
    "What is Machine Learning and what ML courses are offered at Brainware?",
    "Explain what Cloud Computing is and tell me the semester fee for Cloud Technology specialization.",
    "What is Cybersecurity and who is the faculty advisor for cyber defense in our department?",
    "What is corporate law and how are the placements for BBA LLB in our university?",
    "What is Biotechnology and what is the fee structure for B.Sc Biotech?",
    "Explain what a Database Management System is and where the DBMS lab is located on campus.",
    "What is Internet of Things and what IoT lab facilities exist at our university?",
    "Explain OOP concepts in Java and how Java is covered in the BCA curriculum.",
    "What is data science and what is the eligibility for M.Sc Data Science at Brainware?",
    "Explain operating system deadlock and tell me which semester covers OS in CSE.",
    "What is computer graphics and who is the professor teaching it in CSS?",
    "Explain full stack web development and tell me the placement opportunities for web developers.",
    "What is robotics engineering and what are the admission requirements for robotics diploma?",
    "Explain financial accounting and tell me the fee structure for B.Com at our college.",
    "What is pharmaceutical chemistry and what are the lab facilities for B.Pharm on campus?",
    "Explain computer networking basics and tell me the curriculum structure for BCA networking paper.",
    "What is deep learning and does our university offer scholarships for AI research?",
    "Explain mobile app development and tell me if Android development is an elective in MCA.",
    "What is software engineering and who is the head of department for software studies?",
    "Explain discrete mathematics and tell me the exam routine for math paper.",
    "What is constitutional law and where is the moot court room located in the law department?",
    "Explain microservices architecture and how cloud computing labs are scheduled.",
    "What is digital marketing and what is the fee structure for MBA in Marketing?",
    "Explain blockchain technology and tell me if our college conducts workshops on web3.",
    "What is hospital management and what are the internship placements for BBA HM?",
    "Explain natural language processing and tell me which faculty teaches NLP in CSE.",
    "What is bio-informatics and what is the admission deadline for biotechnology programs?"
];

MIXED_QUESTIONS.forEach(q => {
    assertRoute(q, ROUTER_ROUTES.MIXED, false);
});

// ============================================================================
// SECTION 4: 20 Conversation Follow-ups (Context-Aware Routing)
// ============================================================================
console.log("\n--- SECTION 4: 20 Conversation Follow-up Questions ---");

const FOLLOW_UP_SCENARIOS = [
    { history: "User: Tell me about the BCA course at Brainware University.\nAssistant: BCA is a 3-year undergraduate program.", query: "Fees?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about B.Tech CSE.\nAssistant: B.Tech CSE covers algorithms, cloud computing, and AI.", query: "Who is the HOD?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: I want to know about MCA program.\nAssistant: MCA is a 2-year postgraduate program.", query: "What is the eligibility?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about the campus hostel facilities.\nAssistant: We offer boys and girls hostels.", query: "What are the rules?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about BBA program.", query: "What is the fee structure?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Brainware University admission process.\nAssistant: Applications are open.", query: "How to apply?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about Computational Sciences department.", query: "Where is the department located?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about B.Tech in CSE.", query: "What are the placement statistics?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: I want to apply for university scholarship.", query: "Criteria?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about MCA program.", query: "Syllabus?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: I am looking for B.Pharm admission.", query: "Cutoff percentage?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about the college central library.", query: "Timings?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about Building 5 on campus.", query: "Where is the accounts counter?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about Biotechnology department.", query: "Who is the faculty?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about hostel accommodation.", query: "Mess charges?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about MBA program.", query: "Total cost?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about semester examinations.", query: "When is the routine published?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about BBA LLB course.", query: "How many semesters?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about the campus placement cell.", query: "Highest package?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC },
    { history: "User: Tell me about B.Sc Nursing.", query: "Admission process?", expected: ROUTER_ROUTES.UNIVERSITY_SPECIFIC }
];

FOLLOW_UP_SCENARIOS.forEach(s => {
    assertRoute(s.query, s.expected, false, { conversationHistory: s.history, activeTopic: s.history });
});

console.log("\n================================================================================");
console.log(`📊 MASTER ROUTING SUMMARY:`);
console.log(`  - General Knowledge:  ${GENERAL_QUESTIONS.length}/50`);
console.log(`  - University Specific: ${UNIVERSITY_QUESTIONS.length}/50`);
console.log(`  - Mixed Questions:    ${MIXED_QUESTIONS.length}/30`);
console.log(`  - Conversation Follow-ups: ${FOLLOW_UP_SCENARIOS.length}/20`);
console.log(`  TOTAL TESTS:          ${passed + failed} (${passed} PASSED | ${failed} FAILED)`);
console.log(`  ACCURACY RATE:        ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log("================================================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
