/**
 * EduMate Mission 12.6 — 30 Curated Showcase Demo Questions
 * 
 * Specifically designed for live hackathon demonstration highlighting
 * EduMate's speed, multi-source citations, table generation, and grounding.
 */

const DEMO_SHOWCASE_QUESTIONS = Object.freeze([
    // Group 1: High-Frequency Admissions & Eligibility (1-5)
    {
        id: "demo-01",
        group: "Admissions",
        question: "What is the eligibility criteria and course duration for BCA?",
        highlight: "Factual retrieval with exact percentages & subjects"
    },
    {
        id: "demo-02",
        group: "Admissions",
        question: "How do I get admitted into MCA and what are the mathematics requirements?",
        highlight: "PG Admission requirements grounding"
    },
    {
        id: "demo-03",
        group: "Admissions",
        question: "What are the entry criteria for B.Tech CSE in Artificial Intelligence and Machine Learning?",
        highlight: "Engineering requirements grounding"
    },
    {
        id: "demo-04",
        group: "Admissions",
        question: "What is the qualification needed for MBA in Hospital Management?",
        highlight: "Specialized Healthcare Management eligibility"
    },
    {
        id: "demo-05",
        group: "Admissions",
        question: "Tell me everything about BCA admissions, duration, career options, and eligibility.",
        highlight: "Comprehensive long-form structured answer"
    },

    // Group 2: Fees & Program Comparisons (6-10)
    {
        id: "demo-06",
        group: "Fees",
        question: "What is the total fee structure for BCA?",
        highlight: "Instant fee schedule extraction"
    },
    {
        id: "demo-07",
        group: "Fees",
        question: "What are the semester fees for B.Tech Computer Science and Engineering?",
        highlight: "Detailed semester-wise fee breakdown"
    },
    {
        id: "demo-08",
        group: "Fees",
        question: "Compare the fee structures of BCA and B.Tech CSE in a clean markdown table.",
        highlight: "Comparative table generation with alternate row shading"
    },
    {
        id: "demo-09",
        group: "Fees",
        question: "How much is the course fee for Diploma in Pharmacy (D Pharma)?",
        highlight: "Diploma fee extraction"
    },
    {
        id: "demo-10",
        group: "Fees",
        question: "What is the fee breakdown for BBA Business Analytics?",
        highlight: "Management fee extraction"
    },

    // Group 3: CSS Department & Faculty Leadership (11-15)
    {
        id: "demo-11",
        group: "CSS Department",
        question: "Who is the HOD of CSS department?",
        highlight: "Verified HOD extraction: Dr. Jayanta Aich"
    },
    {
        id: "demo-12",
        group: "CSS Department",
        question: "List all CSS faculty members with their designations and qualifications in a table.",
        highlight: "Department faculty roster in table format"
    },
    {
        id: "demo-13",
        group: "Faculty",
        question: "Who are the professors in the Department of Law?",
        highlight: "Law department faculty verification"
    },
    {
        id: "demo-14",
        group: "Faculty",
        question: "Who teaches in the Department of Management?",
        highlight: "Management department faculty verification"
    },
    {
        id: "demo-15",
        group: "Faculty",
        question: "Who is the Head of Department of Biotechnology?",
        highlight: "Biotech department leadership"
    },

    // Group 4: Syllabus, Programming & Curriculum (16-20)
    {
        id: "demo-16",
        group: "Syllabus",
        question: "What programming languages and database subjects are taught in BCA?",
        highlight: "Curriculum paper extraction"
    },
    {
        id: "demo-17",
        group: "Syllabus",
        question: "What machine learning and AI subjects are covered in B.Tech CSE AI?",
        highlight: "Specialization syllabus grounding"
    },
    {
        id: "demo-18",
        group: "Syllabus",
        question: "What subjects are included in the MCA first year curriculum?",
        highlight: "Core MCA subjects extraction"
    },
    {
        id: "demo-19",
        group: "Syllabus",
        question: "What is taught in BSc Animation, VFX and Gaming?",
        highlight: "Media & animation syllabus"
    },
    {
        id: "demo-20",
        group: "Syllabus",
        question: "What core papers are studied in BA LLB?",
        highlight: "Law curriculum extraction"
    },

    // Group 5: Hostel & Student Residential Life (21-25)
    {
        id: "demo-21",
        group: "Hostel",
        question: "What are the hostel room amenities, wifi, and mess facilities?",
        highlight: "Hostel life overview"
    },
    {
        id: "demo-22",
        group: "Hostel",
        question: "What is the curfew time and entry rules for hostel residents?",
        highlight: "Hostel disciplinary rules"
    },
    {
        id: "demo-23",
        group: "Hostel",
        question: "What is the fee for hostel accommodation and mess?",
        highlight: "Hostel fee schedule"
    },
    {
        id: "demo-24",
        group: "Scholarships",
        question: "What merit scholarships are offered and what percentage is required in 10+2?",
        highlight: "Scholarship percentage thresholds"
    },
    {
        id: "demo-25",
        group: "Scholarships",
        question: "Are there fee concessions for siblings and sports achievers?",
        highlight: "Special quota and concession rules"
    },

    // Group 6: Notices, Regulations & Campus Navigation (26-30)
    {
        id: "demo-26",
        group: "Notices & Rules",
        question: "What is the mandatory attendance percentage required for semester exams?",
        highlight: "75% attendance rule validation"
    },
    {
        id: "demo-27",
        group: "Notices & Rules",
        question: "What is the university's anti-ragging policy and disciplinary action?",
        highlight: "Zero-tolerance anti-ragging guidelines"
    },
    {
        id: "demo-28",
        group: "Campus Navigation",
        question: "Where is the University Admission Office and Accounts counter located?",
        highlight: "Building & floor navigation"
    },
    {
        id: "demo-29",
        group: "Campus Navigation",
        question: "Where is the Central Library and Medical Room on campus?",
        highlight: "Campus map & amenity location"
    },
    {
        id: "demo-30",
        group: "Negative Control",
        question: "What is the tuition fee for the Intergalactic Starship Engineering course on Mars?",
        highlight: "Zero hallucination test - cleanly triggers institutional fallback"
    }
]);

module.exports = {
    DEMO_SHOWCASE_QUESTIONS
};
