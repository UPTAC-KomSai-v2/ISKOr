// ============================================================
// ISKOR - Full Mock Data Seed Script
// Run with: mongosh "your-connection-string" iskor_seed.js
//   OR:     mongosh --file iskor_seed.js  (if already connected)
// ============================================================
// Password for ALL accounts: password123
// ============================================================

const DB_NAME = "examflow"; // Change this if your DB name differs
db = db.getSiblingDB(DB_NAME);

print("🗑️  Clearing existing collections...");
db.users.deleteMany({});
db.courses.deleteMany({});
db.enrollments.deleteMany({});
db.exams.deleteMany({});
db.questions.deleteMany({});
db.examsubmissions.deleteMany({});
db.examresults.deleteMany({});
db.announcements.deleteMany({});
db.notifications.deleteMany({});
print("✅ Collections cleared.\n");

// ============================================================
// HELPERS
// ============================================================
const now = new Date();
const PASS_HASH = "$2b$12$MuWPMUsFf4hJvTRVsk2AA.F2jfxrSKMR54kCHXy4L3b.5Zc925fFm"; // password123

function daysAgo(n) { return new Date(now - n * 86400000); }
function daysFromNow(n) { return new Date(now.getTime() + n * 86400000); }

// ============================================================
// 1. USERS — 1 Admin, 3 Faculty, 50 Students
// ============================================================
print("👤 Creating users...");

// --- Admin ---
const adminId = new ObjectId();
db.users.insertOne({
  _id: adminId,
  email: "admin@up.edu.ph",
  passwordHash: PASS_HASH,
  firstName: "System",
  lastName: "Admin",
  role: "ADMIN",
  isActive: true,
  createdAt: daysAgo(180),
  updatedAt: daysAgo(180),
});

// --- Faculty ---
const faculty1Id = new ObjectId();
const faculty2Id = new ObjectId();
const faculty3Id = new ObjectId();

db.users.insertMany([
  {
    _id: faculty1Id,
    email: "maria.santos@up.edu.ph",
    passwordHash: PASS_HASH,
    firstName: "Maria",
    lastName: "Santos",
    role: "FACULTY",
    isActive: true,
    facultyId: "FAC-2024-001",
    department: "Division of Natural Sciences and Mathematics",
    designation: "Associate Professor",
    createdAt: daysAgo(180),
    updatedAt: daysAgo(180),
  },
  {
    _id: faculty2Id,
    email: "jose.reyes@up.edu.ph",
    passwordHash: PASS_HASH,
    firstName: "Jose",
    lastName: "Reyes",
    role: "FACULTY",
    isActive: true,
    facultyId: "FAC-2024-002",
    department: "Division of Social Sciences",
    designation: "Assistant Professor",
    createdAt: daysAgo(180),
    updatedAt: daysAgo(180),
  },
  {
    _id: faculty3Id,
    email: "ana.garcia@up.edu.ph",
    passwordHash: PASS_HASH,
    firstName: "Ana",
    lastName: "Garcia",
    role: "FACULTY",
    isActive: true,
    facultyId: "FAC-2024-003",
    department: "Division of Natural Sciences and Mathematics",
    designation: "Instructor",
    createdAt: daysAgo(180),
    updatedAt: daysAgo(180),
  },
]);

// --- 50 Students ---
const filipinoFirstNames = [
  "Aaliyah","Bea","Carlo","Diana","Enrique","Fatima","Gabriel","Hannah","Ivan","Jasmine",
  "Kevin","Liza","Marco","Nina","Oscar","Patricia","Quentin","Rosa","Samuel","Teresa",
  "Ulysses","Vanessa","William","Ximena","Yolanda","Zeus","Abby","Benito","Carla","Dante",
  "Elena","Francisco","Grace","Hector","Iris","Jerome","Kristine","Luis","Maricel","Neil",
  "Olivia","Pablo","Queenie","Ramon","Sheila","Tomas","Uma","Victor","Wendy","Xander"
];
const filipinoLastNames = [
  "Reyes","Cruz","Santos","Bautista","Ocampo","Garcia","Torres","Aquino","Lim","Ramos",
  "Dela Cruz","Gonzales","Flores","Villanueva","Castillo","Mendoza","Fernandez","Pascual","Dizon","Marquez",
  "Andres","Soriano","Navarro","Aguilar","Salazar","Perez","Magno","Tolentino","Abad","Buenaventura",
  "Tañada","Macaraeg","Umali","Sison","Capistrano","Legarda","Pimentel","Magsaysay","Macapagal","Laurel",
  "Cayetano","Poe","Arroyo","Estrada","Binay","Robredo","Lacson","Escudero","Padilla","Villafuerte"
];
const programs = ["BS Computer Science", "BS Mathematics", "BS Biology", "BS Statistics", "BS Physics"];
const sections = ["A", "B", "C"];

const studentIds = [];
const studentDocs = [];
for (let i = 0; i < 50; i++) {
  const sid = new ObjectId();
  studentIds.push(sid);
  studentDocs.push({
    _id: sid,
    email: `student${String(i + 1).padStart(2, "0")}@up.edu.ph`,
    passwordHash: PASS_HASH,
    firstName: filipinoFirstNames[i],
    lastName: filipinoLastNames[i],
    role: "STUDENT",
    isActive: true,
    studentNumber: `2021-${String(i + 1).padStart(5, "0")}`,
    program: programs[i % programs.length],
    yearLevel: (i % 4) + 1,
    section: sections[i % 3],
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
  });
}
db.users.insertMany(studentDocs);
print(`✅ Created 1 admin, 3 faculty, 50 students.\n`);

// ============================================================
// 2. COURSES — 3 courses
// ============================================================
print("📚 Creating courses...");

const course1Id = new ObjectId();
const course2Id = new ObjectId();
const course3Id = new ObjectId();

db.courses.insertMany([
  {
    _id: course1Id,
    code: "CMSC 135",
    name: "Data Communication and Networking",
    description: "Study of computer networks, protocols, and data communication principles.",
    semester: "1ST",
    academicYear: "2024-2025",
    facultyId: faculty1Id,
    isActive: true,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
  },
  {
    _id: course2Id,
    code: "MATH 114",
    name: "Linear Algebra",
    description: "Vectors, matrices, linear transformations, eigenvalues and eigenvectors.",
    semester: "1ST",
    academicYear: "2024-2025",
    facultyId: faculty2Id,
    isActive: true,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
  },
  {
    _id: course3Id,
    code: "CMSC 100",
    name: "Web Programming",
    description: "Introduction to web technologies including HTML, CSS, JavaScript, and Node.js.",
    semester: "1ST",
    academicYear: "2024-2025",
    facultyId: faculty3Id,
    isActive: true,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90),
  },
]);
print("✅ Created 3 courses.\n");

// ============================================================
// 3. ENROLLMENTS — 50 students split across courses
// ============================================================
print("📋 Creating enrollments...");

const enrollmentDocs = [];
for (let i = 0; i < 50; i++) {
  // All students in course 1 (primary)
  enrollmentDocs.push({
    _id: new ObjectId(),
    studentId: studentIds[i],
    courseId: course1Id,
    isActive: true,
    enrolledAt: daysAgo(85),
    createdAt: daysAgo(85),
    updatedAt: daysAgo(85),
  });
  // First 30 students in course 2
  if (i < 30) {
    enrollmentDocs.push({
      _id: new ObjectId(),
      studentId: studentIds[i],
      courseId: course2Id,
      isActive: true,
      enrolledAt: daysAgo(85),
      createdAt: daysAgo(85),
      updatedAt: daysAgo(85),
    });
  }
  // Last 25 students in course 3
  if (i >= 25) {
    enrollmentDocs.push({
      _id: new ObjectId(),
      studentId: studentIds[i],
      courseId: course3Id,
      isActive: true,
      enrolledAt: daysAgo(85),
      createdAt: daysAgo(85),
      updatedAt: daysAgo(85),
    });
  }
}
db.enrollments.insertMany(enrollmentDocs);
print(`✅ Created ${enrollmentDocs.length} enrollments.\n`);

// ============================================================
// 4. EXAMS + QUESTIONS
// ============================================================
print("📝 Creating exams and questions...");

// Helper: build MC question
function mcQuestion(examId, order, text, choices, correctIdx, points) {
  const choiceDocs = choices.map((c, i) => ({ _id: new ObjectId(), text: c, isCorrect: i === correctIdx }));
  return {
    _id: new ObjectId(),
    examId,
    type: "MULTIPLE_CHOICE",
    questionText: text,
    points,
    order,
    choices: choiceDocs,
    explanation: `The correct answer is: ${choices[correctIdx]}`,
    createdAt: daysAgo(70),
    updatedAt: daysAgo(70),
  };
}

// Helper: build T/F question
function tfQuestion(examId, order, text, correctAnswer, points) {
  return {
    _id: new ObjectId(),
    examId,
    type: "TRUE_FALSE",
    questionText: text,
    points,
    order,
    correctAnswer,
    explanation: `The statement is ${correctAnswer ? "TRUE" : "FALSE"}.`,
    createdAt: daysAgo(70),
    updatedAt: daysAgo(70),
  };
}

// ── EXAM 1: CMSC 135 Quiz 1 ──────────────────────────────────
const exam1Id = new ObjectId();
db.exams.insertOne({
  _id: exam1Id,
  title: "Quiz 1: Network Fundamentals",
  description: "Basic concepts of networking and the OSI model.",
  instructions: "Answer all questions. No backtracking allowed.",
  courseId: course1Id,
  createdById: faculty1Id,
  type: "QUIZ",
  status: "PUBLISHED",
  totalPoints: 20,
  questionCount: 10,
  startDate: daysAgo(60),
  endDate: daysAgo(53),
  settings: {
    shuffleQuestions: false, shuffleChoices: false,
    showResults: true, showCorrectAnswers: true,
    showFeedback: true, allowReview: true,
    maxAttempts: 1, timeLimitMinutes: 30,
    autoSubmitOnTimeExpire: true, showTimerWarning: true,
    warningThresholdMinutes: 5, passingPercentage: 60,
    lateSubmissionAllowed: false, lateSubmissionPenalty: 0,
  },
  createdAt: daysAgo(70),
  updatedAt: daysAgo(70),
});

const exam1Questions = [
  mcQuestion(exam1Id, 0, "Which layer of the OSI model is responsible for end-to-end communication?",
    ["Physical","Data Link","Transport","Application"], 2, 2),
  mcQuestion(exam1Id, 1, "What does IP stand for?",
    ["Internet Protocol","Internal Process","Integrated Path","Internet Port"], 0, 2),
  tfQuestion(exam1Id, 2, "The TCP protocol guarantees delivery of packets.", true, 2),
  mcQuestion(exam1Id, 3, "Which protocol is used to assign IP addresses automatically?",
    ["DNS","HTTP","DHCP","FTP"], 2, 2),
  tfQuestion(exam1Id, 4, "UDP is a connection-oriented protocol.", false, 2),
  mcQuestion(exam1Id, 5, "What is the maximum transmission unit (MTU) for Ethernet?",
    ["512 bytes","1024 bytes","1500 bytes","9000 bytes"], 2, 2),
  mcQuestion(exam1Id, 6, "Which device operates at Layer 3 of the OSI model?",
    ["Hub","Switch","Router","Repeater"], 2, 2),
  tfQuestion(exam1Id, 7, "HTTP uses port 80 by default.", true, 2),
  mcQuestion(exam1Id, 8, "What does DNS stand for?",
    ["Dynamic Network System","Domain Name System","Data Network Service","Distributed Node Service"], 1, 2),
  tfQuestion(exam1Id, 9, "A subnet mask of 255.255.255.0 gives 256 host addresses.", false, 2),
];
db.questions.insertMany(exam1Questions);

// ── EXAM 2: CMSC 135 Midterm ─────────────────────────────────
const exam2Id = new ObjectId();
db.exams.insertOne({
  _id: exam2Id,
  title: "Midterm Exam: Networking Protocols",
  description: "Covers TCP/IP, routing, and network security basics.",
  instructions: "Read each question carefully. Manage your time wisely.",
  courseId: course1Id,
  createdById: faculty1Id,
  type: "MIDTERM",
  status: "PUBLISHED",
  totalPoints: 50,
  questionCount: 10,
  startDate: daysAgo(40),
  endDate: daysAgo(33),
  settings: {
    shuffleQuestions: true, shuffleChoices: true,
    showResults: true, showCorrectAnswers: false,
    showFeedback: false, allowReview: false,
    maxAttempts: 1, timeLimitMinutes: 90,
    autoSubmitOnTimeExpire: true, showTimerWarning: true,
    warningThresholdMinutes: 10, passingPercentage: 50,
    lateSubmissionAllowed: false, lateSubmissionPenalty: 0,
  },
  createdAt: daysAgo(50),
  updatedAt: daysAgo(50),
});

const exam2Questions = [
  mcQuestion(exam2Id, 0, "Which routing protocol uses Dijkstra's algorithm?",
    ["RIP","BGP","OSPF","EIGRP"], 2, 5),
  mcQuestion(exam2Id, 1, "What is the purpose of ARP?",
    ["Assign IP addresses","Map IP to MAC addresses","Encrypt network traffic","Route packets"], 1, 5),
  tfQuestion(exam2Id, 2, "BGP is used for inter-domain routing on the Internet.", true, 5),
  mcQuestion(exam2Id, 3, "Which attack involves flooding a network with SYN packets?",
    ["Phishing","Man-in-the-Middle","SYN Flood","SQL Injection"], 2, 5),
  tfQuestion(exam2Id, 4, "TLS operates at the Application Layer of the OSI model.", false, 5),
  mcQuestion(exam2Id, 5, "What is the purpose of NAT?",
    ["Encrypts traffic","Translates private IPs to public IPs","Assigns domain names","Monitors bandwidth"], 1, 5),
  mcQuestion(exam2Id, 6, "Which protocol provides reliable, ordered data delivery?",
    ["UDP","ICMP","TCP","ARP"], 2, 5),
  tfQuestion(exam2Id, 7, "IPv6 addresses are 128 bits long.", true, 5),
  mcQuestion(exam2Id, 8, "What does HTTPS add over HTTP?",
    ["Faster speed","Encryption via TLS/SSL","Larger packet size","No headers"], 1, 5),
  mcQuestion(exam2Id, 9, "Which layer handles MAC addresses?",
    ["Physical","Data Link","Network","Transport"], 1, 5),
];
db.questions.insertMany(exam2Questions);

// ── EXAM 3: MATH 114 Quiz 1 ──────────────────────────────────
const exam3Id = new ObjectId();
db.exams.insertOne({
  _id: exam3Id,
  title: "Quiz 1: Vectors and Matrices",
  description: "Fundamentals of vectors, matrix operations, and determinants.",
  instructions: "Show your conceptual understanding. Choose the best answer.",
  courseId: course2Id,
  createdById: faculty2Id,
  type: "QUIZ",
  status: "PUBLISHED",
  totalPoints: 30,
  questionCount: 10,
  startDate: daysAgo(55),
  endDate: daysAgo(48),
  settings: {
    shuffleQuestions: false, shuffleChoices: false,
    showResults: true, showCorrectAnswers: true,
    showFeedback: true, allowReview: true,
    maxAttempts: 2, timeLimitMinutes: 45,
    autoSubmitOnTimeExpire: true, showTimerWarning: true,
    warningThresholdMinutes: 5, passingPercentage: 60,
    lateSubmissionAllowed: false, lateSubmissionPenalty: 0,
  },
  createdAt: daysAgo(65),
  updatedAt: daysAgo(65),
});

const exam3Questions = [
  mcQuestion(exam3Id, 0, "What is the result of the dot product of two perpendicular vectors?",
    ["1","-1","0","Undefined"], 2, 3),
  tfQuestion(exam3Id, 1, "The determinant of a 2x2 identity matrix is 1.", true, 3),
  mcQuestion(exam3Id, 2, "Which operation is NOT defined for matrices of different dimensions?",
    ["Scalar multiplication","Addition","Transpose","Multiplication (always)"], 1, 3),
  tfQuestion(exam3Id, 3, "A matrix multiplied by its inverse gives the identity matrix.", true, 3),
  mcQuestion(exam3Id, 4, "What is the rank of a 3x3 zero matrix?",
    ["0","1","3","Undefined"], 0, 3),
  mcQuestion(exam3Id, 5, "If det(A) = 0, the matrix A is:",
    ["Invertible","Singular","Diagonal","Symmetric"], 1, 3),
  tfQuestion(exam3Id, 6, "Matrix multiplication is commutative (AB = BA always).", false, 3),
  mcQuestion(exam3Id, 7, "The transpose of an m×n matrix is of size:",
    ["m×n","n×m","m×m","n×n"], 1, 3),
  tfQuestion(exam3Id, 8, "Every square matrix has an inverse.", false, 3),
  mcQuestion(exam3Id, 9, "A linear combination of vectors v1 and v2 is:",
    ["v1 × v2","c1*v1 + c2*v2 for scalars c1,c2","v1 / v2","v1 - v2 only"], 1, 3),
];
db.questions.insertMany(exam3Questions);

// ── EXAM 4: CMSC 100 Quiz 1 ──────────────────────────────────
const exam4Id = new ObjectId();
db.exams.insertOne({
  _id: exam4Id,
  title: "Quiz 1: HTML and CSS Basics",
  description: "Foundational concepts of web markup and styling.",
  courseId: course3Id,
  createdById: faculty3Id,
  type: "QUIZ",
  status: "PUBLISHED",
  totalPoints: 20,
  questionCount: 10,
  startDate: daysAgo(45),
  endDate: daysAgo(38),
  settings: {
    shuffleQuestions: false, shuffleChoices: false,
    showResults: true, showCorrectAnswers: true,
    showFeedback: true, allowReview: true,
    maxAttempts: 1, timeLimitMinutes: 25,
    autoSubmitOnTimeExpire: true, showTimerWarning: true,
    warningThresholdMinutes: 5, passingPercentage: 60,
    lateSubmissionAllowed: false, lateSubmissionPenalty: 0,
  },
  createdAt: daysAgo(55),
  updatedAt: daysAgo(55),
});

const exam4Questions = [
  mcQuestion(exam4Id, 0, "What does HTML stand for?",
    ["Hyper Text Markup Language","High Transfer Markup Language","Hyper Text Machine Language","Home Tool Markup Language"], 0, 2),
  tfQuestion(exam4Id, 1, "The <head> tag contains visible page content.", false, 2),
  mcQuestion(exam4Id, 2, "Which CSS property changes the text color?",
    ["font-color","text-color","color","foreground"], 2, 2),
  tfQuestion(exam4Id, 3, "CSS stands for Cascading Style Sheets.", true, 2),
  mcQuestion(exam4Id, 4, "Which HTML tag is used for the largest heading?",
    ["<h6>","<h1>","<head>","<title>"], 1, 2),
  mcQuestion(exam4Id, 5, "What is the correct CSS syntax to change the background color?",
    ["background-color: blue;","bg-color: blue;","color-background: blue;","background: #blue;"], 0, 2),
  tfQuestion(exam4Id, 6, "In CSS, 'margin' and 'padding' refer to the same thing.", false, 2),
  mcQuestion(exam4Id, 7, "Which attribute is used to link an external CSS file?",
    ["src","href","link","style"], 1, 2),
  mcQuestion(exam4Id, 8, "What does the 'display: flex' CSS property enable?",
    ["Grid layout","Flexbox layout","Table layout","Block layout only"], 1, 2),
  tfQuestion(exam4Id, 9, "The <br> tag in HTML creates a line break.", true, 2),
];
db.questions.insertMany(exam4Questions);

// ── EXAM 5: CMSC 135 Final (upcoming) ────────────────────────
const exam5Id = new ObjectId();
db.exams.insertOne({
  _id: exam5Id,
  title: "Final Exam: Advanced Networking",
  description: "Comprehensive assessment covering all networking topics.",
  instructions: "This is the final exam. All topics covered in the semester are included.",
  courseId: course1Id,
  createdById: faculty1Id,
  type: "FINAL",
  status: "PUBLISHED",
  totalPoints: 100,
  questionCount: 10,
  startDate: daysFromNow(7),
  endDate: daysFromNow(14),
  settings: {
    shuffleQuestions: true, shuffleChoices: true,
    showResults: false, showCorrectAnswers: false,
    showFeedback: false, allowReview: false,
    maxAttempts: 1, timeLimitMinutes: 120,
    autoSubmitOnTimeExpire: true, showTimerWarning: true,
    warningThresholdMinutes: 15, passingPercentage: 60,
    lateSubmissionAllowed: false, lateSubmissionPenalty: 0,
  },
  createdAt: daysAgo(10),
  updatedAt: daysAgo(10),
});

const exam5Questions = [
  mcQuestion(exam5Id, 0, "What is the primary function of the Transport layer?", ["Physical transmission","Logical addressing","End-to-end communication","Data formatting"], 2, 10),
  mcQuestion(exam5Id, 1, "Which protocol is stateless?", ["TCP","FTP","HTTP","SSH"], 2, 10),
  tfQuestion(exam5Id, 2, "ICMP is used primarily for error reporting in IP networks.", true, 10),
  mcQuestion(exam5Id, 3, "What is subnetting used for?", ["Speed up routing","Divide a network into sub-networks","Encrypt data","Assign domain names"], 1, 10),
  tfQuestion(exam5Id, 4, "A default gateway is used when a packet's destination is outside the local network.", true, 10),
  mcQuestion(exam5Id, 5, "Which of the following is a private IP range?", ["8.8.8.0/24","172.16.0.0/12","200.1.1.0/24","100.0.0.0/8"], 1, 10),
  mcQuestion(exam5Id, 6, "What does VPN stand for?", ["Virtual Private Network","Verified Packet Node","Variable Protocol Nexus","Visual Port Network"], 0, 10),
  tfQuestion(exam5Id, 7, "Switches make forwarding decisions based on IP addresses.", false, 10),
  mcQuestion(exam5Id, 8, "Which protocol translates domain names to IP addresses?", ["DHCP","ARP","DNS","SMTP"], 2, 10),
  mcQuestion(exam5Id, 9, "What is the purpose of a firewall?", ["Increase bandwidth","Filter network traffic","Assign IP addresses","Encrypt data at rest"], 1, 10),
];
db.questions.insertMany(exam5Questions);

print("✅ Created 5 exams with 10 questions each.\n");

// ============================================================
// 5. EXAM SUBMISSIONS + RESULTS (for past exams)
// ============================================================
print("📊 Creating submissions and results for past exams...");

// Score weights per student to simulate realistic distribution
// Some high scorers, some average, some struggling
function getScoreRatio(studentIndex) {
  const ratios = [
    0.98,0.96,0.94,0.92,0.90,0.88,0.86,0.84,0.82,0.80,
    0.78,0.76,0.74,0.72,0.70,0.68,0.66,0.64,0.62,0.60,
    0.58,0.56,0.76,0.80,0.72,0.68,0.90,0.85,0.55,0.50,
    0.94,0.48,0.88,0.74,0.82,0.78,0.66,0.92,0.70,0.64,
    0.96,0.60,0.84,0.76,0.88,0.52,0.80,0.72,0.86,0.58,
  ];
  return ratios[studentIndex] || 0.70;
}

// Helper: create submission with auto-graded MC/TF answers
function buildSubmission(examId, studentId, studentIdx, questions, totalPoints, submittedDaysAgo, attemptNumber) {
  const ratio = getScoreRatio(studentIdx);
  // Add slight randomness per exam
  const jitter = (Math.random() * 0.10) - 0.05;
  const effectiveRatio = Math.min(1.0, Math.max(0.3, ratio + jitter));

  const answers = [];
  let totalScore = 0;

  for (const q of questions) {
    let isCorrect, pointsEarned, selectedChoiceId, booleanAnswer;

    const qCorrect = effectiveRatio > 0.5 ? (Math.random() < effectiveRatio) : (Math.random() < 0.4);

    if (q.type === "MULTIPLE_CHOICE") {
      const correctChoice = q.choices.find(c => c.isCorrect);
      const wrongChoices = q.choices.filter(c => !c.isCorrect);
      if (qCorrect) {
        selectedChoiceId = correctChoice._id;
        isCorrect = true;
        pointsEarned = q.points;
      } else {
        selectedChoiceId = wrongChoices[Math.floor(Math.random() * wrongChoices.length)]._id;
        isCorrect = false;
        pointsEarned = 0;
      }
      answers.push({
        _id: new ObjectId(),
        questionId: q._id,
        selectedChoiceId,
        pointsEarned,
        isCorrect,
        gradedAt: new Date(now - submittedDaysAgo * 86400000 + 3600000),
      });
    } else if (q.type === "TRUE_FALSE") {
      if (qCorrect) {
        booleanAnswer = q.correctAnswer;
        isCorrect = true;
        pointsEarned = q.points;
      } else {
        booleanAnswer = !q.correctAnswer;
        isCorrect = false;
        pointsEarned = 0;
      }
      answers.push({
        _id: new ObjectId(),
        questionId: q._id,
        booleanAnswer,
        pointsEarned,
        isCorrect,
        gradedAt: new Date(now - submittedDaysAgo * 86400000 + 3600000),
      });
    }
    totalScore += pointsEarned;
  }

  const percentage = Math.round((totalScore / totalPoints) * 100);
  const passingPercentage = 60;
  const submittedAt = new Date(now - submittedDaysAgo * 86400000);

  return {
    submission: {
      _id: new ObjectId(),
      examId,
      studentId,
      status: "RETURNED",
      answers,
      startedAt: new Date(submittedAt.getTime() - 25 * 60000),
      submittedAt,
      timeAllottedMinutes: 30,
      totalScore,
      maxScore: totalPoints,
      percentage,
      isPassing: percentage >= passingPercentage,
      overallFeedback: percentage >= 80 ? "Excellent work!" : percentage >= 60 ? "Good effort, keep it up." : "Please review the material.",
      attemptNumber,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    },
    result: {
      _id: new ObjectId(),
      examId,
      studentId,
      score: totalScore,
      status: "PUBLISHED",
      publishedAt: new Date(submittedAt.getTime() + 86400000),
      regradeRequests: [],
      createdAt: submittedAt,
      updatedAt: submittedAt,
    }
  };
}

const allSubmissions = [];
const allResults = [];

// Exam 1 — all 50 students
for (let i = 0; i < 50; i++) {
  const { submission, result } = buildSubmission(
    exam1Id, studentIds[i], i, exam1Questions, 20, 50, 1
  );
  allSubmissions.push(submission);
  allResults.push(result);
}

// Exam 2 — all 50 students
for (let i = 0; i < 50; i++) {
  const { submission, result } = buildSubmission(
    exam2Id, studentIds[i], i, exam2Questions, 50, 30, 1
  );
  allSubmissions.push(submission);
  allResults.push(result);
}

// Exam 3 — first 30 students (enrolled in MATH 114)
for (let i = 0; i < 30; i++) {
  const { submission, result } = buildSubmission(
    exam3Id, studentIds[i], i, exam3Questions, 30, 45, 1
  );
  allSubmissions.push(submission);
  allResults.push(result);
}

// Exam 4 — last 25 students (enrolled in CMSC 100)
for (let i = 25; i < 50; i++) {
  const { submission, result } = buildSubmission(
    exam4Id, studentIds[i], i, exam4Questions, 20, 35, 1
  );
  allSubmissions.push(submission);
  allResults.push(result);
}

db.examsubmissions.insertMany(allSubmissions);
db.examresults.insertMany(allResults);
print(`✅ Created ${allSubmissions.length} submissions and ${allResults.length} results.\n`);

// ============================================================
// 6. ANNOUNCEMENTS
// ============================================================
print("📢 Creating announcements...");
db.announcements.insertMany([
  {
    _id: new ObjectId(),
    title: "Midterm Exam Schedule Released",
    content: "The midterm exam for CMSC 135 is scheduled. Please check your exam dates and prepare accordingly. Good luck to all students!",
    type: "EXAM",
    priority: "HIGH",
    courseId: course1Id,
    createdById: faculty1Id,
    targetRoles: ["STUDENT"],
    isPublished: true,
    publishedAt: daysAgo(42),
    createdAt: daysAgo(42),
    updatedAt: daysAgo(42),
  },
  {
    _id: new ObjectId(),
    title: "Final Exam: Advanced Networking — Reminder",
    content: "The final exam for CMSC 135 will open in 7 days. Review all modules from Week 1 to Week 14. Coverage includes routing protocols, security, and network architecture.",
    type: "EXAM",
    priority: "URGENT",
    courseId: course1Id,
    createdById: faculty1Id,
    targetRoles: ["STUDENT"],
    isPublished: true,
    publishedAt: daysAgo(2),
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    _id: new ObjectId(),
    title: "Welcome to ISKOR",
    content: "Welcome to the Integrated Student Knowledge and Output Repository system. This platform will be used for all quizzes, exams, and assessments this semester.",
    type: "GENERAL",
    priority: "NORMAL",
    createdById: adminId,
    targetRoles: ["STUDENT", "FACULTY"],
    isPublished: true,
    publishedAt: daysAgo(88),
    createdAt: daysAgo(88),
    updatedAt: daysAgo(88),
  },
  {
    _id: new ObjectId(),
    title: "Quiz 1 Results Now Available",
    content: "Results for CMSC 135 Quiz 1 have been published. You may view your scores and feedback in the Results section.",
    type: "RESULT",
    priority: "NORMAL",
    courseId: course1Id,
    examId: exam1Id,
    createdById: faculty1Id,
    targetRoles: ["STUDENT"],
    isPublished: true,
    publishedAt: daysAgo(49),
    createdAt: daysAgo(49),
    updatedAt: daysAgo(49),
  },
]);
print("✅ Created 4 announcements.\n");

// ============================================================
// SUMMARY
// ============================================================
print("============================================================");
print("✅ ISKOR SEED COMPLETE");
print("============================================================");
print(`Users:           ${db.users.countDocuments()}`);
print(`  - Admin:       ${db.users.countDocuments({role:"ADMIN"})}`);
print(`  - Faculty:     ${db.users.countDocuments({role:"FACULTY"})}`);
print(`  - Students:    ${db.users.countDocuments({role:"STUDENT"})}`);
print(`Courses:         ${db.courses.countDocuments()}`);
print(`Enrollments:     ${db.enrollments.countDocuments()}`);
print(`Exams:           ${db.exams.countDocuments()}`);
print(`Questions:       ${db.questions.countDocuments()}`);
print(`Submissions:     ${db.examsubmissions.countDocuments()}`);
print(`Results:         ${db.examresults.countDocuments()}`);
print(`Announcements:   ${db.announcements.countDocuments()}`);
print("============================================================");
print("");
print("🔑 LOGIN CREDENTIALS (all accounts use password: password123)");
print("------------------------------------------------------------");
print("Admin:    admin@up.edu.ph");
print("Faculty:  maria.santos@up.edu.ph  (CMSC 135)");
print("          jose.reyes@up.edu.ph    (MATH 114)");
print("          ana.garcia@up.edu.ph    (CMSC 100)");
print("Students: student01@up.edu.ph ... student50@up.edu.ph");
print("============================================================");
