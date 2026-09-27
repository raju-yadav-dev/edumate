/**
 * EduMate Mission 12.1 — Ground Truth University Dataset
 * 
 * 110+ comprehensive, verified ground truth questions mapped directly to
 * real university documents indexed in EduMate.
 * 
 * Categories (10 items each + Negative Controls):
 * 1. Admissions
 * 2. Fees
 * 3. Faculty
 * 4. HOD
 * 5. Departments
 * 6. Syllabus & Curriculum
 * 7. Hostel & Accommodation
 * 8. Scholarships & Financial Aid
 * 9. Notices & Regulations
 * 10. Contact Information & Campus Services
 * 11. Negative Controls (Out-of-Domain / Hallucination prevention)
 */

const GROUND_TRUTH_DATASET = Object.freeze([
    // ==========================================
    // 1. ADMISSIONS
    // ==========================================
    {
        id: "adm-01",
        category: "Admissions",
        question: "What is the eligibility criteria for BCA admission at Brainware University?",
        expectedDocumentMatches: [/bca.*course.*details/i, /bca/i],
        expectedKeywords: ["eligibility", "10+2", "mathematics", "computer", "admission"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-02",
        category: "Admissions",
        question: "How can a student apply for MCA admission 2026?",
        expectedDocumentMatches: [/mca.*master.*computer/i, /mca/i],
        expectedKeywords: ["mca", "bca", "graduate", "admission", "mathematics"],
        expectedSection: "Admission",
        type: "factual"
    },
    {
        id: "adm-03",
        category: "Admissions",
        question: "What are the entry requirements for B.Tech CSE in Artificial Intelligence and Machine Learning?",
        expectedDocumentMatches: [/b\.?tech.*cse.*artificial.*intelligence/i, /btech/i],
        expectedKeywords: ["b.tech", "cse", "physics", "mathematics", "chemistry", "ai"],
        expectedSection: "Eligibility Criteria",
        type: "factual"
    },
    {
        id: "adm-04",
        category: "Admissions",
        question: "What is the admission procedure for MBA in Hospital Management?",
        expectedDocumentMatches: [/mba.*hospital.*management/i, /hospital.*management/i],
        expectedKeywords: ["mba", "hospital management", "graduation", "admission"],
        expectedSection: "Admission",
        type: "factual"
    },
    {
        id: "adm-05",
        category: "Admissions",
        question: "What is the qualification required for BSc Nursing admission?",
        expectedDocumentMatches: [/bsc.*nursing/i, /nursing/i],
        expectedKeywords: ["b.sc nursing", "10+2", "pcb", "physics", "chemistry", "biology"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-06",
        category: "Admissions",
        question: "What is the eligibility for Diploma in Pharmacy (D Pharma)?",
        expectedDocumentMatches: [/diploma.*pharmacy.*d.*pharma/i, /d pharma/i],
        expectedKeywords: ["d pharma", "diploma", "pharmacy", "10+2", "science"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-07",
        category: "Admissions",
        question: "What are the requirements for BBA LLB admission?",
        expectedDocumentMatches: [/bba.*llb/i, /law/i],
        expectedKeywords: ["bba llb", "law", "10+2", "marks", "admission"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-08",
        category: "Admissions",
        question: "What is the admission criteria for Bachelor of Optometry?",
        expectedDocumentMatches: [/bachelor.*optometry/i, /optometry/i],
        expectedKeywords: ["optometry", "10+2", "science", "physics", "chemistry", "biology"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-09",
        category: "Admissions",
        question: "What is the eligibility for BSc Agriculture admission 2026?",
        expectedDocumentMatches: [/bsc.*agriculture/i, /agriculture/i],
        expectedKeywords: ["agriculture", "10+2", "science", "physics", "chemistry", "biology"],
        expectedSection: "Eligibility",
        type: "factual"
    },
    {
        id: "adm-10",
        category: "Admissions",
        question: "Tell me everything about BCA admissions and eligibility.",
        expectedDocumentMatches: [/bca/i],
        expectedKeywords: ["bca", "eligibility", "admission", "duration", "career"],
        expectedSection: "Overview",
        type: "long_response"
    },

    // ==========================================
    // 2. FEES
    // ==========================================
    {
        id: "fee-01",
        category: "Fees",
        question: "What is the total fee structure for BCA?",
        expectedDocumentMatches: [/bca/i],
        expectedKeywords: ["fee", "semester", "total", "admission", "bca"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-02",
        category: "Fees",
        question: "What is the course fee for B.Tech Computer Science and Engineering?",
        expectedDocumentMatches: [/btech.*cse/i, /b\.?tech/i],
        expectedKeywords: ["b.tech", "cse", "fees", "semester", "course fee"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-03",
        category: "Fees",
        question: "How much is the tuition fee for MBA in Hospital Management?",
        expectedDocumentMatches: [/mba.*hospital/i, /mba/i],
        expectedKeywords: ["mba", "fee", "semester", "tuition"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-04",
        category: "Fees",
        question: "What is the fee breakdown for BBA Business Analytics?",
        expectedDocumentMatches: [/bba.*business.*analytics/i, /bba/i],
        expectedKeywords: ["bba", "business analytics", "fee", "semester"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-05",
        category: "Fees",
        question: "What are the semester fees for MCA?",
        expectedDocumentMatches: [/mca/i],
        expectedKeywords: ["mca", "fee", "semester", "total"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-06",
        category: "Fees",
        question: "What is the fee structure for GNM Nursing?",
        expectedDocumentMatches: [/gnm.*nursing/i, /nursing/i],
        expectedKeywords: ["gnm", "nursing", "fee", "course"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-07",
        category: "Fees",
        question: "How much does Diploma in Robotics & Automation cost?",
        expectedDocumentMatches: [/diploma.*robotics/i, /robotics/i],
        expectedKeywords: ["robotics", "diploma", "fee", "semester"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-08",
        category: "Fees",
        question: "What are the fees for MSc Biotechnology?",
        expectedDocumentMatches: [/msc.*biotechnology/i, /biotechnology/i],
        expectedKeywords: ["m.sc", "biotechnology", "fee", "semester"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-09",
        category: "Fees",
        question: "What is the course fee for LLB 3-year programme?",
        expectedDocumentMatches: [/llb.*bachelor/i, /law/i],
        expectedKeywords: ["llb", "law", "fee", "semester"],
        expectedSection: "Fees",
        type: "factual"
    },
    {
        id: "fee-10",
        category: "Fees",
        question: "Compare the fee structures of BCA and B.Tech CSE in a table.",
        expectedDocumentMatches: [/bca/i, /btech/i],
        expectedKeywords: ["bca", "b.tech", "fees", "semester"],
        expectedSection: "Fees",
        type: "comparison"
    },

    // ==========================================
    // 3. FACULTY
    // ==========================================
    {
        id: "fac-01",
        category: "Faculty",
        question: "List the faculty members in the Department of Computational Sciences.",
        expectedDocumentMatches: [/department.*computational.*sciences/i, /computational/i],
        expectedKeywords: ["faculty", "professor", "designation", "computational sciences"],
        expectedSection: "Faculty List",
        type: "long_response"
    },
    {
        id: "fac-02",
        category: "Faculty",
        question: "Who are the professors in Department of Law?",
        expectedDocumentMatches: [/department.*law/i, /law/i],
        expectedKeywords: ["law", "faculty", "professor", "assistant professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-03",
        category: "Faculty",
        question: "List the faculty members of Department of Management.",
        expectedDocumentMatches: [/department.*management/i, /management/i],
        expectedKeywords: ["management", "faculty", "professor", "designation"],
        expectedSection: "Faculty",
        type: "long_response"
    },
    {
        id: "fac-04",
        category: "Faculty",
        question: "Who teaches in the Department of Biotechnology?",
        expectedDocumentMatches: [/department.*biotechnology/i, /biotechnology/i],
        expectedKeywords: ["biotechnology", "faculty", "professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-05",
        category: "Faculty",
        question: "List the faculty in Department of Computer Science & Engineering AI.",
        expectedDocumentMatches: [/department.*computer.*science.*engineering.*ai/i, /cse/i],
        expectedKeywords: ["cse", "ai", "faculty", "professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-06",
        category: "Faculty",
        question: "Who are the faculty members in Department of Allied Health Sciences?",
        expectedDocumentMatches: [/department.*allied.*health/i, /allied health/i],
        expectedKeywords: ["allied health", "faculty", "professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-07",
        category: "Faculty",
        question: "Who are the professors in Department of Pharmaceutical Technology?",
        expectedDocumentMatches: [/department.*pharmaceutical/i, /pharmacy/i],
        expectedKeywords: ["pharmaceutical", "pharmacy", "faculty", "professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-08",
        category: "Faculty",
        question: "Who teaches in the Department of English?",
        expectedDocumentMatches: [/department.*english/i, /english/i],
        expectedKeywords: ["english", "faculty", "professor", "assistant professor"],
        expectedSection: "Faculty",
        type: "factual"
    },
    {
        id: "fac-09",
        category: "Faculty",
        question: "List all CSS faculty with their designations.",
        expectedDocumentMatches: [/department.*computational.*sciences/i, /computational/i],
        expectedKeywords: ["css", "computational sciences", "professor", "designation"],
        expectedSection: "Faculty",
        type: "long_response"
    },
    {
        id: "fac-10",
        category: "Faculty",
        question: "Who are the faculty in Department of Media Science and Journalism?",
        expectedDocumentMatches: [/department.*media/i, /media/i],
        expectedKeywords: ["media science", "journalism", "faculty", "professor"],
        expectedSection: "Faculty",
        type: "factual"
    },

    // ==========================================
    // 4. HOD (HEAD OF DEPARTMENT)
    // ==========================================
    {
        id: "hod-01",
        category: "HOD",
        question: "Who is the HOD of CSS?",
        expectedDocumentMatches: [/department.*computational.*sciences/i, /computational/i],
        expectedKeywords: ["hod", "head", "department", "computational sciences"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-02",
        category: "HOD",
        question: "Who is the Head of Department of Computational Sciences?",
        expectedDocumentMatches: [/department.*computational.*sciences/i, /computational/i],
        expectedKeywords: ["head of department", "computational sciences", "hod"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-03",
        category: "HOD",
        question: "Who leads the Department of Law as HOD?",
        expectedDocumentMatches: [/department.*law/i, /law/i],
        expectedKeywords: ["law", "hod", "head of department"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-04",
        category: "HOD",
        question: "Who is the HOD of Management Department?",
        expectedDocumentMatches: [/department.*management/i, /management/i],
        expectedKeywords: ["management", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-05",
        category: "HOD",
        question: "Who is the Head of Department of Biotechnology?",
        expectedDocumentMatches: [/department.*biotechnology/i, /biotechnology/i],
        expectedKeywords: ["biotechnology", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-06",
        category: "HOD",
        question: "Who is the HOD of Nursing Department?",
        expectedDocumentMatches: [/department.*nursing/i, /nursing/i],
        expectedKeywords: ["nursing", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-07",
        category: "HOD",
        question: "Who is the HOD of Pharmaceutical Technology?",
        expectedDocumentMatches: [/department.*pharmaceutical/i, /pharmacy/i],
        expectedKeywords: ["pharmaceutical", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-08",
        category: "HOD",
        question: "Who is the Head of Department of Agriculture?",
        expectedDocumentMatches: [/department.*agriculture/i, /agriculture/i],
        expectedKeywords: ["agriculture", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-09",
        category: "HOD",
        question: "Who is the HOD of Media Science?",
        expectedDocumentMatches: [/department.*media/i, /media/i],
        expectedKeywords: ["media science", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },
    {
        id: "hod-10",
        category: "HOD",
        question: "Who is the Head of Department of English?",
        expectedDocumentMatches: [/department.*english/i, /english/i],
        expectedKeywords: ["english", "hod", "head"],
        expectedSection: "HOD",
        type: "factual"
    },

    // ==========================================
    // 5. DEPARTMENTS
    // ==========================================
    {
        id: "dept-01",
        category: "Departments",
        question: "What courses are offered by the Department of Computational Sciences?",
        expectedDocumentMatches: [/department.*computational.*sciences/i, /bca/i],
        expectedKeywords: ["bca", "mca", "computational sciences", "courses"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-02",
        category: "Departments",
        question: "Explain the focus areas of Department of Computer Science & Engineering AI.",
        expectedDocumentMatches: [/department.*computer.*science.*engineering.*ai/i, /btech/i],
        expectedKeywords: ["artificial intelligence", "machine learning", "cse", "robotics"],
        expectedSection: "Overview",
        type: "factual"
    },
    {
        id: "dept-03",
        category: "Departments",
        question: "What degrees does the Department of Law offer?",
        expectedDocumentMatches: [/department.*law/i, /llb/i, /ba.*llb/i],
        expectedKeywords: ["llb", "bba llb", "ba llb", "llm", "law"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-04",
        category: "Departments",
        question: "What are the programs available in Department of Allied Health Sciences?",
        expectedDocumentMatches: [/department.*allied.*health/i, /optometry/i, /radiology/i],
        expectedKeywords: ["optometry", "medical laboratory", "physiotherapy", "allied health"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-05",
        category: "Departments",
        question: "What are the facilities in Department of Pharmaceutical Technology?",
        expectedDocumentMatches: [/department.*pharmaceutical/i, /pharmacy/i],
        expectedKeywords: ["pharmacy", "pharmaceutical", "lab", "b pharm", "d pharma"],
        expectedSection: "Facilities",
        type: "factual"
    },
    {
        id: "dept-06",
        category: "Departments",
        question: "Explain the academic offerings of the Department of Management.",
        expectedDocumentMatches: [/department.*management/i, /bba/i, /mba/i],
        expectedKeywords: ["bba", "mba", "hospital management", "business analytics"],
        expectedSection: "Overview",
        type: "long_response"
    },
    {
        id: "dept-07",
        category: "Departments",
        question: "What courses are offered by the Department of Biotechnology?",
        expectedDocumentMatches: [/department.*biotechnology/i, /biotechnology/i],
        expectedKeywords: ["b.sc biotechnology", "m.sc biotechnology", "b.tech"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-08",
        category: "Departments",
        question: "What specialized degrees exist in Department of Cyber Science & Technology?",
        expectedDocumentMatches: [/department.*cyber/i, /cyber/i],
        expectedKeywords: ["cyber security", "networking", "b.sc", "m.sc"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-09",
        category: "Departments",
        question: "What programs are provided by Department of Agriculture?",
        expectedDocumentMatches: [/department.*agriculture/i, /agriculture/i],
        expectedKeywords: ["b.sc agriculture", "m.sc agronomy", "horticulture"],
        expectedSection: "Programmes",
        type: "factual"
    },
    {
        id: "dept-10",
        category: "Departments",
        question: "Explain all departments under School of Engineering and Technology.",
        expectedDocumentMatches: [/department.*computer.*science/i, /btech/i],
        expectedKeywords: ["engineering", "cse", "ai", "robotics", "mechanical", "civil"],
        expectedSection: "Overview",
        type: "long_response"
    },

    // ==========================================
    // 6. SYLLABUS & CURRICULUM
    // ==========================================
    {
        id: "syl-01",
        category: "Syllabus",
        question: "What programming languages and subjects are taught in BCA?",
        expectedDocumentMatches: [/bca/i],
        expectedKeywords: ["c", "c++", "java", "python", "data structures", "database", "web"],
        expectedSection: "Curriculum",
        type: "long_response"
    },
    {
        id: "syl-02",
        category: "Syllabus",
        question: "What core topics are covered in B.Tech CSE Artificial Intelligence?",
        expectedDocumentMatches: [/b\.?tech.*cse.*artificial.*intelligence/i, /btech/i],
        expectedKeywords: ["machine learning", "deep learning", "neural networks", "python", "ai"],
        expectedSection: "Syllabus",
        type: "factual"
    },
    {
        id: "syl-03",
        category: "Syllabus",
        question: "What are the subjects in BBA Hospital Management?",
        expectedDocumentMatches: [/bba.*hospital/i, /hospital/i],
        expectedKeywords: ["hospital administration", "healthcare", "management", "billing"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-04",
        category: "Syllabus",
        question: "What subjects are included in MCA first year curriculum?",
        expectedDocumentMatches: [/mca/i],
        expectedKeywords: ["mca", "algorithms", "software engineering", "database"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-05",
        category: "Syllabus",
        question: "What is taught in BSc Animation, VFX and Gaming?",
        expectedDocumentMatches: [/animation/i, /vfx/i],
        expectedKeywords: ["3d animation", "vfx", "game design", "modeling", "texturing"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-06",
        category: "Syllabus",
        question: "What are the key subjects in BBA Digital Marketing?",
        expectedDocumentMatches: [/bba.*digital.*marketing/i, /digital marketing/i],
        expectedKeywords: ["seo", "sem", "social media", "content marketing", "analytics"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-07",
        category: "Syllabus",
        question: "What practical lab subjects are in D Pharma curriculum?",
        expectedDocumentMatches: [/d.*pharma/i, /pharmacy/i],
        expectedKeywords: ["pharmaceutics", "pharmacology", "chemistry", "lab"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-08",
        category: "Syllabus",
        question: "What topics are studied in MSc Cyber Security and Advanced Networking?",
        expectedDocumentMatches: [/msc.*cyber.*security/i, /cyber/i],
        expectedKeywords: ["cryptography", "network security", "ethical hacking", "forensics"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-09",
        category: "Syllabus",
        question: "What are the core law papers in BA LLB curriculum?",
        expectedDocumentMatches: [/ba.*llb/i, /llb/i, /law/i],
        expectedKeywords: ["constitutional law", "criminal law", "torts", "contracts"],
        expectedSection: "Curriculum",
        type: "factual"
    },
    {
        id: "syl-10",
        category: "Syllabus",
        question: "Provide an overview of the curriculum for Master of Science in Agronomy.",
        expectedDocumentMatches: [/agronomy/i, /agriculture/i],
        expectedKeywords: ["crop production", "soil science", "agronomy", "field experiments"],
        expectedSection: "Curriculum",
        type: "factual"
    },

    // ==========================================
    // 7. HOSTEL & ACCOMMODATION
    // ==========================================
    {
        id: "hos-01",
        category: "Hostel",
        question: "What are the hostel facilities available on campus?",
        expectedDocumentMatches: [/hostel/i, /campus/i],
        expectedKeywords: ["hostel", "rooms", "wifi", "mess", "security"],
        expectedSection: "Hostel Facilities",
        type: "factual"
    },
    {
        id: "hos-02",
        category: "Hostel",
        question: "Is there separate hostel accommodation for boys and girls?",
        expectedDocumentMatches: [/hostel/i, /campus/i],
        expectedKeywords: ["boys hostel", "girls hostel", "separate", "security"],
        expectedSection: "Accommodation",
        type: "factual"
    },
    {
        id: "hos-03",
        category: "Hostel",
        question: "What are the mess and food rules in the university hostel?",
        expectedDocumentMatches: [/hostel/i, /campus/i],
        expectedKeywords: ["mess", "food", "dining", "meals"],
        expectedSection: "Mess",
        type: "factual"
    },
    {
        id: "hos-04",
        category: "Hostel",
        question: "What is the curfew time and entry rules for hostel residents?",
        expectedDocumentMatches: [/hostel/i, /campus/i],
        expectedKeywords: ["curfew", "timing", "entry", "rules", "in-time"],
        expectedSection: "Hostel Rules",
        type: "factual"
    },
    {
        id: "hos-05",
        category: "Hostel",
        question: "Are medical emergency services available in the hostel?",
        expectedDocumentMatches: [/hostel/i, /campus/i, /medical/i],
        expectedKeywords: ["medical", "first aid", "doctor", "emergency", "ambulance"],
        expectedSection: "Medical Care",
        type: "factual"
    },
    {
        id: "hos-06",
        category: "Hostel",
        question: "What items and appliances are prohibited in hostel rooms?",
        expectedDocumentMatches: [/hostel/i],
        expectedKeywords: ["prohibited", "appliances", "heater", "rules"],
        expectedSection: "Hostel Rules",
        type: "factual"
    },
    {
        id: "hos-07",
        category: "Hostel",
        question: "How can parents or guests visit students in hostel?",
        expectedDocumentMatches: [/hostel/i],
        expectedKeywords: ["visitors", "guest", "parents", "permission", "visiting hours"],
        expectedSection: "Visitor Rules",
        type: "factual"
    },
    {
        id: "hos-08",
        category: "Hostel",
        question: "What are the laundry and maintenance facilities in hostel?",
        expectedDocumentMatches: [/hostel/i],
        expectedKeywords: ["laundry", "washing", "maintenance", "cleaning"],
        expectedSection: "Amenities",
        type: "factual"
    },
    {
        id: "hos-09",
        category: "Hostel",
        question: "What is the fee structure for hostel accommodation?",
        expectedDocumentMatches: [/hostel/i, /fees/i],
        expectedKeywords: ["hostel fee", "occupancy", "seat rent", "mess charges"],
        expectedSection: "Hostel Fees",
        type: "factual"
    },
    {
        id: "hos-10",
        category: "Hostel",
        question: "Explain the complete hostel rules and code of conduct.",
        expectedDocumentMatches: [/hostel/i],
        expectedKeywords: ["hostel", "rules", "conduct", "discipline", "warden"],
        expectedSection: "Code of Conduct",
        type: "long_response"
    },

    // ==========================================
    // 8. SCHOLARSHIPS & FINANCIAL AID
    // ==========================================
    {
        id: "sch-01",
        category: "Scholarships",
        question: "What merit scholarships are offered at Brainware University?",
        expectedDocumentMatches: [/scholarship/i, /admission/i],
        expectedKeywords: ["merit scholarship", "percentage", "marks", "waiver"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-02",
        category: "Scholarships",
        question: "Is there any scholarship for sports achievers?",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["sports scholarship", "national", "state level", "sports"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-03",
        category: "Scholarships",
        question: "How can a student apply for government scholarships like Swami Vivekananda (SVMCM)?",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["svmcm", "oasis", "aikyashree", "government scholarship", "portal"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-04",
        category: "Scholarships",
        question: "What percentage is required in 10+2 to get a merit scholarship for BCA?",
        expectedDocumentMatches: [/scholarship/i, /bca/i],
        expectedKeywords: ["merit", "marks", "percentage", "scholarship", "bca"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-05",
        category: "Scholarships",
        question: "Are there fee concessions for siblings studying at the university?",
        expectedDocumentMatches: [/scholarship/i, /fee/i],
        expectedKeywords: ["sibling", "concession", "discount", "scholarship"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-06",
        category: "Scholarships",
        question: "What are the renewal conditions for university scholarships in subsequent years?",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["renewal", "attendance", "cgpa", "marks", "clearing all papers"],
        expectedSection: "Renewal Criteria",
        type: "factual"
    },
    {
        id: "sch-07",
        category: "Scholarships",
        question: "Is education loan assistance provided to admitted students?",
        expectedDocumentMatches: [/scholarship/i, /admission/i, /loan/i],
        expectedKeywords: ["education loan", "vidyalakshmi", "bank", "letter"],
        expectedSection: "Financial Aid",
        type: "factual"
    },
    {
        id: "sch-08",
        category: "Scholarships",
        question: "What special scholarships exist for female students?",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["kanyashree", "girl student", "scholarship", "women"],
        expectedSection: "Scholarships",
        type: "factual"
    },
    {
        id: "sch-09",
        category: "Scholarships",
        question: "What documents are required to apply for fee concession?",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["income certificate", "marksheet", "documents", "application"],
        expectedSection: "Documents Required",
        type: "factual"
    },
    {
        id: "sch-10",
        category: "Scholarships",
        question: "Summarize all scholarship schemes available for undergraduate programs.",
        expectedDocumentMatches: [/scholarship/i],
        expectedKeywords: ["scholarship", "schemes", "merit", "undergraduate", "ug"],
        expectedSection: "Summary",
        type: "long_response"
    },

    // ==========================================
    // 9. NOTICES & ACADEMIC REGULATIONS
    // ==========================================
    {
        id: "not-01",
        category: "Notices",
        question: "What is the minimum mandatory attendance required to sit for semester examinations?",
        expectedDocumentMatches: [/notices/i, /policies/i, /handbook/i],
        expectedKeywords: ["attendance", "75%", "semester examination", "eligibility"],
        expectedSection: "Examination Regulations",
        type: "factual"
    },
    {
        id: "not-02",
        category: "Notices",
        question: "What is the grading scale and CGPA calculation system?",
        expectedDocumentMatches: [/notices/i, /policies/i, /academics/i],
        expectedKeywords: ["cgpa", "sgpa", "grading", "10 point scale", "credits"],
        expectedSection: "Grading System",
        type: "factual"
    },
    {
        id: "not-03",
        category: "Notices",
        question: "What are the rules regarding backlogs and supplementary examinations?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["backlog", "supplementary", "re-appear", "exam"],
        expectedSection: "Examination Rules",
        type: "factual"
    },
    {
        id: "not-04",
        category: "Notices",
        question: "What is the university policy regarding anti-ragging?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["anti-ragging", "zero tolerance", "committee", "affidavit"],
        expectedSection: "Anti-Ragging",
        type: "factual"
    },
    {
        id: "not-05",
        category: "Notices",
        question: "What is the dress code and ID card policy on campus?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["id card", "dress code", "uniform", "mandatory"],
        expectedSection: "Campus Regulations",
        type: "factual"
    },
    {
        id: "not-06",
        category: "Notices",
        question: "What is the procedure for semester result review and revaluation?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["revaluation", "review", "scrutiny", "exam cell"],
        expectedSection: "Revaluation",
        type: "factual"
    },
    {
        id: "not-07",
        category: "Notices",
        question: "What are the campus library timings and borrowing rules?",
        expectedDocumentMatches: [/notices/i, /library/i],
        expectedKeywords: ["library", "timings", "books", "borrowing", "card"],
        expectedSection: "Library Rules",
        type: "factual"
    },
    {
        id: "not-08",
        category: "Notices",
        question: "How does the university handle internal assessment marks and assignments?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["internal assessment", "continuous evaluation", "assignments", "marks"],
        expectedSection: "Assessments",
        type: "factual"
    },
    {
        id: "not-09",
        category: "Notices",
        question: "What is the procedure to apply for bonafide certificate or transfer certificate?",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["bonafide certificate", "transfer certificate", "registrar", "application"],
        expectedSection: "Certificates",
        type: "factual"
    },
    {
        id: "not-10",
        category: "Notices",
        question: "Explain the complete academic code of conduct and disciplinary action guidelines.",
        expectedDocumentMatches: [/notices/i, /policies/i],
        expectedKeywords: ["discipline", "code of conduct", "regulations", "penalties"],
        expectedSection: "Disciplinary Code",
        type: "long_response"
    },

    // ==========================================
    // 10. CONTACT INFORMATION & CAMPUS SERVICES
    // ==========================================
    {
        id: "cnt-01",
        category: "Contact Information",
        question: "Where is the University Admission Office located?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["admission office", "main gate", "campus", "enquiry"],
        expectedSection: "Admission Desk",
        type: "factual"
    },
    {
        id: "cnt-02",
        category: "Contact Information",
        question: "Where is the Central Library located on campus?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["library", "building", "floor", "campus"],
        expectedSection: "Library",
        type: "factual"
    },
    {
        id: "cnt-03",
        category: "Contact Information",
        question: "Where is the Accounts and Fee Clearance counter?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["accounts office", "fee clearance", "administrative block"],
        expectedSection: "Accounts",
        type: "factual"
    },
    {
        id: "cnt-04",
        category: "Contact Information",
        question: "Where can a student get first-aid medical attention on campus?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["medical room", "first-aid", "nursing assistant", "emergency"],
        expectedSection: "Medical Services",
        type: "factual"
    },
    {
        id: "cnt-05",
        category: "Contact Information",
        question: "Where is the Examination Cell located for admit cards and marksheets?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["examination cell", "exam cell", "marksheets", "admit card"],
        expectedSection: "Examination Office",
        type: "factual"
    },
    {
        id: "cnt-06",
        category: "Contact Information",
        question: "Where is the main cafeteria and student canteen located?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["canteen", "cafeteria", "food court", "campus"],
        expectedSection: "Canteen",
        type: "factual"
    },
    {
        id: "cnt-07",
        category: "Contact Information",
        question: "Where is the Training and Placement Cell situated?",
        expectedDocumentMatches: [/placement/i, /campus/i],
        expectedKeywords: ["placement cell", "training", "recruitment", "careers"],
        expectedSection: "Placement Desk",
        type: "factual"
    },
    {
        id: "cnt-08",
        category: "Contact Information",
        question: "Where is the Main Auditorium for university events?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["auditorium", "events", "hall", "cultural"],
        expectedSection: "Auditorium",
        type: "factual"
    },
    {
        id: "cnt-09",
        category: "Contact Information",
        question: "Where is the Central Computer Laboratory located?",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["computer lab", "computing center", "internet", "lab"],
        expectedSection: "Computer Labs",
        type: "factual"
    },
    {
        id: "cnt-10",
        category: "Contact Information",
        question: "List all key campus administrative offices with their primary functions.",
        expectedDocumentMatches: [/campus.*navigation/i, /location/i],
        expectedKeywords: ["admission", "accounts", "examination", "library", "offices"],
        expectedSection: "Campus Guide",
        type: "long_response"
    },

    // ==========================================
    // 11. NEGATIVE CONTROLS (OUT-OF-DOMAIN / HALLUCINATION PREVENTION)
    // ==========================================
    {
        id: "neg-01",
        category: "Negative Controls",
        question: "What is the fee for Aerospace Engineering on Mars campus?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "not available", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-02",
        category: "Negative Controls",
        question: "Who is Professor Albus Dumbledore in the Department of Magic?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-03",
        category: "Negative Controls",
        question: "What is the syllabus for Intergalactic Quantum Teleportation?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-04",
        category: "Negative Controls",
        question: "What is the admission cutoff for Bachelor of Time Travel 2026?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-05",
        category: "Negative Controls",
        question: "Give me the phone number of the university president in Atlantis.",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-06",
        category: "Negative Controls",
        question: "Who won the 1920 Olympic Gold Medal from the university?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-07",
        category: "Negative Controls",
        question: "What is the hostel fee for the Moon Base campus residence?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-08",
        category: "Negative Controls",
        question: "How do I register for the Hogwarts Triwizard tournament here?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-09",
        category: "Negative Controls",
        question: "Who is the HOD of Medieval Dragon Studies?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    },
    {
        id: "neg-10",
        category: "Negative Controls",
        question: "What is the placement package for Starship Captains?",
        expectedDocumentMatches: [],
        expectedKeywords: ["couldn't find", "no verified information"],
        expectedSection: "None",
        type: "unknown_fallback"
    }
]);

/**
 * Helper to get dataset filtered by category or type
 */
const getDatasetByCategory = (category = "") => {
    if (!category || category === "all") return GROUND_TRUTH_DATASET;
    return GROUND_TRUTH_DATASET.filter(item => item.category.toLowerCase() === category.toLowerCase());
};

const getAllCategories = () => {
    return Array.from(new Set(GROUND_TRUTH_DATASET.map(i => i.category)));
};

module.exports = {
    GROUND_TRUTH_DATASET,
    getDatasetByCategory,
    getAllCategories
};
