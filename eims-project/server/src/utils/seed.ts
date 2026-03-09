import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  User, Role,
  Course,
  Enrollment,
  Exam, ExamStatus, ExamType,
  Question, QuestionType,
  ExamSubmission, SubmissionStatus,
  ExamResult, ResultStatus,
  Announcement, AnnouncementType, AnnouncementPriority,
} from '../models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/examflow';

// ─── Helpers ────────────────────────────────────────────────
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

/** Score ratios per student index — produces a realistic bell-curve spread */
const SCORE_RATIOS = [
  0.98, 0.96, 0.94, 0.92, 0.90, 0.88, 0.86, 0.84, 0.82, 0.80,
  0.78, 0.76, 0.74, 0.72, 0.70, 0.68, 0.66, 0.64, 0.62, 0.60,
  0.58, 0.56, 0.76, 0.80, 0.72, 0.68, 0.90, 0.85, 0.55, 0.50,
  0.94, 0.48, 0.88, 0.74, 0.82, 0.78, 0.66, 0.92, 0.70, 0.64,
  0.96, 0.60, 0.84, 0.76, 0.88, 0.52, 0.80, 0.72, 0.86, 0.58,
];

// ─── Data ────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aaliyah','Bea','Carlo','Diana','Enrique','Fatima','Gabriel','Hannah','Ivan','Jasmine',
  'Kevin','Liza','Marco','Nina','Oscar','Patricia','Quentin','Rosa','Samuel','Teresa',
  'Ulysses','Vanessa','William','Ximena','Yolanda','Zeus','Abby','Benito','Carla','Dante',
  'Elena','Francisco','Grace','Hector','Iris','Jerome','Kristine','Luis','Maricel','Neil',
  'Olivia','Pablo','Queenie','Ramon','Sheila','Tomas','Uma','Victor','Wendy','Xander',
];

const LAST_NAMES = [
  'Reyes','Cruz','Santos','Bautista','Ocampo','Garcia','Torres','Aquino','Lim','Ramos',
  'Dela Cruz','Gonzales','Flores','Villanueva','Castillo','Mendoza','Fernandez','Pascual','Dizon','Marquez',
  'Andres','Soriano','Navarro','Aguilar','Salazar','Perez','Magno','Tolentino','Abad','Buenaventura',
  'Tañada','Macaraeg','Umali','Sison','Capistrano','Legarda','Pimentel','Magsaysay','Macapagal','Laurel',
  'Cayetano','Poe','Arroyo','Estrada','Binay','Robredo','Lacson','Escudero','Padilla','Villafuerte',
];

const PROGRAMS = ['BS Computer Science','BS Mathematics','BS Biology','BS Statistics','BS Physics'];
const SECTIONS = ['A','B','C'];

// ─── Main seed ───────────────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // ── Clear ──────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Course.deleteMany({}),
      Enrollment.deleteMany({}),
      Exam.deleteMany({}),
      Question.deleteMany({}),
      ExamSubmission.deleteMany({}),
      ExamResult.deleteMany({}),
      Announcement.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // ── Admin ──────────────────────────────────────────────
    const admin = await User.create({
      email: 'admin@up.edu.ph',
      passwordHash: 'password123',
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
    });

    // ── Faculty ────────────────────────────────────────────
    const [faculty1, faculty2, faculty3] = await User.create([
      {
        email: 'maria.santos@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Maria',
        lastName: 'Santos',
        role: Role.FACULTY,
        facultyId: 'FAC-2024-001',
        department: 'Division of Natural Sciences and Mathematics',
        designation: 'Associate Professor',
      },
      {
        email: 'jose.reyes@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Jose',
        lastName: 'Reyes',
        role: Role.FACULTY,
        facultyId: 'FAC-2024-002',
        department: 'Division of Social Sciences',
        designation: 'Assistant Professor',
      },
      {
        email: 'ana.garcia@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Ana',
        lastName: 'Garcia',
        role: Role.FACULTY,
        facultyId: 'FAC-2024-003',
        department: 'Division of Natural Sciences and Mathematics',
        designation: 'Instructor',
      },
    ]);
    console.log('Created 3 faculty');

    // ── 50 Students ────────────────────────────────────────
    const studentDocs = Array.from({ length: 50 }, (_, i) => ({
      email: `student${String(i + 1).padStart(2, '0')}@up.edu.ph`,
      passwordHash: 'password123',
      firstName: FIRST_NAMES[i],
      lastName: LAST_NAMES[i],
      role: Role.STUDENT,
      studentNumber: `2021-${String(i + 1).padStart(5, '0')}`,
      program: PROGRAMS[i % PROGRAMS.length],
      yearLevel: (i % 4) + 1,
      section: SECTIONS[i % 3],
    }));
    const students = await User.create(studentDocs);
    console.log('Created 50 students');

    // ── Courses ────────────────────────────────────────────
    const [course1, course2, course3] = await Course.create([
      {
        code: 'CMSC 135',
        name: 'Data Communication and Networking',
        description: 'Study of computer networks, protocols, and data communication principles.',
        semester: '1ST',
        academicYear: '2024-2025',
        facultyId: faculty1._id,
      },
      {
        code: 'MATH 114',
        name: 'Linear Algebra',
        description: 'Vectors, matrices, linear transformations, eigenvalues and eigenvectors.',
        semester: '1ST',
        academicYear: '2024-2025',
        facultyId: faculty2._id,
      },
      {
        code: 'CMSC 100',
        name: 'Web Programming',
        description: 'Introduction to web technologies: HTML, CSS, JavaScript, and Node.js.',
        semester: '1ST',
        academicYear: '2024-2025',
        facultyId: faculty3._id,
      },
    ]);
    console.log('Created 3 courses');

    // ── Enrollments ────────────────────────────────────────
    // All 50 → CMSC 135 | first 30 → MATH 114 | last 25 → CMSC 100
    const enrollmentDocs = students.flatMap((s, i) => {
      const rows: any[] = [{ studentId: s._id, courseId: course1._id, isActive: true }];
      if (i < 30) rows.push({ studentId: s._id, courseId: course2._id, isActive: true });
      if (i >= 25) rows.push({ studentId: s._id, courseId: course3._id, isActive: true });
      return rows;
    });
    await Enrollment.create(enrollmentDocs);
    console.log(`Created ${enrollmentDocs.length} enrollments`);

    // ── Exam 1: CMSC 135 Quiz 1 (closed) ──────────────────
    const exam1 = await Exam.create({
      title: 'Quiz 1: Network Fundamentals',
      description: 'Basic concepts of networking and the OSI model.',
      instructions: 'Answer all questions. No backtracking allowed.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.QUIZ,
      status: ExamStatus.CLOSED,
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
    });

    const exam1Questions = await Question.create([
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 0, points: 2,
        questionText: 'Which layer of the OSI model is responsible for end-to-end communication?',
        choices: [
          { text: 'Physical', isCorrect: false }, { text: 'Data Link', isCorrect: false },
          { text: 'Transport', isCorrect: true }, { text: 'Application', isCorrect: false },
        ],
        explanation: 'The Transport layer handles end-to-end communication.',
      },
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 1, points: 2,
        questionText: 'What does IP stand for?',
        choices: [
          { text: 'Internet Protocol', isCorrect: true }, { text: 'Internal Process', isCorrect: false },
          { text: 'Integrated Path', isCorrect: false }, { text: 'Internet Port', isCorrect: false },
        ],
      },
      {
        examId: exam1._id, type: QuestionType.TRUE_FALSE, order: 2, points: 2,
        questionText: 'The TCP protocol guarantees delivery of packets.',
        correctAnswer: true,
        explanation: 'TCP is connection-oriented and guarantees delivery.',
      },
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 3, points: 2,
        questionText: 'Which protocol is used to assign IP addresses automatically?',
        choices: [
          { text: 'DNS', isCorrect: false }, { text: 'HTTP', isCorrect: false },
          { text: 'DHCP', isCorrect: true }, { text: 'FTP', isCorrect: false },
        ],
      },
      {
        examId: exam1._id, type: QuestionType.TRUE_FALSE, order: 4, points: 2,
        questionText: 'UDP is a connection-oriented protocol.',
        correctAnswer: false,
        explanation: 'UDP is connectionless. TCP is connection-oriented.',
      },
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 5, points: 2,
        questionText: 'Which device operates at Layer 3 of the OSI model?',
        choices: [
          { text: 'Hub', isCorrect: false }, { text: 'Switch', isCorrect: false },
          { text: 'Router', isCorrect: true }, { text: 'Repeater', isCorrect: false },
        ],
      },
      {
        examId: exam1._id, type: QuestionType.TRUE_FALSE, order: 6, points: 2,
        questionText: 'HTTP uses port 80 by default.',
        correctAnswer: true,
      },
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 7, points: 2,
        questionText: 'What does DNS stand for?',
        choices: [
          { text: 'Dynamic Network System', isCorrect: false }, { text: 'Domain Name System', isCorrect: true },
          { text: 'Data Network Service', isCorrect: false }, { text: 'Distributed Node Service', isCorrect: false },
        ],
      },
      {
        examId: exam1._id, type: QuestionType.TRUE_FALSE, order: 8, points: 2,
        questionText: 'A subnet mask of 255.255.255.0 gives exactly 256 usable host addresses.',
        correctAnswer: false,
        explanation: '255.255.255.0 gives 254 usable hosts (256 minus network and broadcast).',
      },
      {
        examId: exam1._id, type: QuestionType.MULTIPLE_CHOICE, order: 9, points: 2,
        questionText: 'Which protocol is used for secure web browsing?',
        choices: [
          { text: 'HTTP', isCorrect: false }, { text: 'FTP', isCorrect: false },
          { text: 'HTTPS', isCorrect: true }, { text: 'SMTP', isCorrect: false },
        ],
      },
    ]);

    // ── Exam 2: CMSC 135 Midterm (closed) ─────────────────
    const exam2 = await Exam.create({
      title: 'Midterm Exam: Networking Protocols',
      description: 'Covers TCP/IP, routing, and network security basics.',
      instructions: 'Read each question carefully. Manage your time wisely.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.MIDTERM,
      status: ExamStatus.CLOSED,
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
    });

    const exam2Questions = await Question.create([
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 0, points: 5,
        questionText: 'Which routing protocol uses Dijkstra\'s shortest path algorithm?',
        choices: [
          { text: 'RIP', isCorrect: false }, { text: 'BGP', isCorrect: false },
          { text: 'OSPF', isCorrect: true }, { text: 'EIGRP', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 1, points: 5,
        questionText: 'What is the purpose of ARP?',
        choices: [
          { text: 'Assign IP addresses', isCorrect: false }, { text: 'Map IP to MAC addresses', isCorrect: true },
          { text: 'Encrypt network traffic', isCorrect: false }, { text: 'Route packets', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.TRUE_FALSE, order: 2, points: 5,
        questionText: 'BGP is used for inter-domain routing on the Internet.',
        correctAnswer: true,
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 3, points: 5,
        questionText: 'Which attack involves flooding a server with SYN packets?',
        choices: [
          { text: 'Phishing', isCorrect: false }, { text: 'Man-in-the-Middle', isCorrect: false },
          { text: 'SYN Flood', isCorrect: true }, { text: 'SQL Injection', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.TRUE_FALSE, order: 4, points: 5,
        questionText: 'TLS operates at the Application Layer of the OSI model.',
        correctAnswer: false,
        explanation: 'TLS operates between the Transport and Application layers (Session layer in OSI).',
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 5, points: 5,
        questionText: 'What is the purpose of NAT?',
        choices: [
          { text: 'Encrypts traffic', isCorrect: false }, { text: 'Translates private IPs to public IPs', isCorrect: true },
          { text: 'Assigns domain names', isCorrect: false }, { text: 'Monitors bandwidth', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 6, points: 5,
        questionText: 'Which protocol provides reliable, ordered data delivery?',
        choices: [
          { text: 'UDP', isCorrect: false }, { text: 'ICMP', isCorrect: false },
          { text: 'TCP', isCorrect: true }, { text: 'ARP', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.TRUE_FALSE, order: 7, points: 5,
        questionText: 'IPv6 addresses are 128 bits long.',
        correctAnswer: true,
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 8, points: 5,
        questionText: 'What does HTTPS add over HTTP?',
        choices: [
          { text: 'Faster speed', isCorrect: false }, { text: 'Encryption via TLS/SSL', isCorrect: true },
          { text: 'Larger packet size', isCorrect: false }, { text: 'No headers', isCorrect: false },
        ],
      },
      {
        examId: exam2._id, type: QuestionType.MULTIPLE_CHOICE, order: 9, points: 5,
        questionText: 'Which layer handles MAC addresses?',
        choices: [
          { text: 'Physical', isCorrect: false }, { text: 'Data Link', isCorrect: true },
          { text: 'Network', isCorrect: false }, { text: 'Transport', isCorrect: false },
        ],
      },
    ]);

    // ── Exam 3: MATH 114 Quiz 1 (closed) ──────────────────
    const exam3 = await Exam.create({
      title: 'Quiz 1: Vectors and Matrices',
      description: 'Fundamentals of vectors, matrix operations, and determinants.',
      courseId: course2._id,
      createdById: faculty2._id,
      type: ExamType.QUIZ,
      status: ExamStatus.CLOSED,
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
    });

    const exam3Questions = await Question.create([
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 0, points: 3,
        questionText: 'What is the result of the dot product of two perpendicular vectors?',
        choices: [
          { text: '1', isCorrect: false }, { text: '-1', isCorrect: false },
          { text: '0', isCorrect: true }, { text: 'Undefined', isCorrect: false },
        ],
      },
      {
        examId: exam3._id, type: QuestionType.TRUE_FALSE, order: 1, points: 3,
        questionText: 'The determinant of a 2x2 identity matrix is 1.',
        correctAnswer: true,
      },
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 2, points: 3,
        questionText: 'Which operation is NOT always defined for matrices of different sizes?',
        choices: [
          { text: 'Scalar multiplication', isCorrect: false }, { text: 'Addition', isCorrect: true },
          { text: 'Transpose', isCorrect: false }, { text: 'None of the above', isCorrect: false },
        ],
        explanation: 'Matrix addition requires both matrices to have the same dimensions.',
      },
      {
        examId: exam3._id, type: QuestionType.TRUE_FALSE, order: 3, points: 3,
        questionText: 'A matrix multiplied by its inverse gives the identity matrix.',
        correctAnswer: true,
      },
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 4, points: 3,
        questionText: 'What is the rank of a 3x3 zero matrix?',
        choices: [
          { text: '0', isCorrect: true }, { text: '1', isCorrect: false },
          { text: '3', isCorrect: false }, { text: 'Undefined', isCorrect: false },
        ],
      },
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 5, points: 3,
        questionText: 'If det(A) = 0, the matrix A is:',
        choices: [
          { text: 'Invertible', isCorrect: false }, { text: 'Singular', isCorrect: true },
          { text: 'Diagonal', isCorrect: false }, { text: 'Symmetric', isCorrect: false },
        ],
      },
      {
        examId: exam3._id, type: QuestionType.TRUE_FALSE, order: 6, points: 3,
        questionText: 'Matrix multiplication is always commutative (AB = BA for all matrices).',
        correctAnswer: false,
      },
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 7, points: 3,
        questionText: 'The transpose of an m×n matrix has size:',
        choices: [
          { text: 'm×n', isCorrect: false }, { text: 'n×m', isCorrect: true },
          { text: 'm×m', isCorrect: false }, { text: 'n×n', isCorrect: false },
        ],
      },
      {
        examId: exam3._id, type: QuestionType.TRUE_FALSE, order: 8, points: 3,
        questionText: 'Every square matrix has an inverse.',
        correctAnswer: false,
        explanation: 'Only non-singular (det ≠ 0) square matrices have an inverse.',
      },
      {
        examId: exam3._id, type: QuestionType.MULTIPLE_CHOICE, order: 9, points: 3,
        questionText: 'A linear combination of vectors v1 and v2 is expressed as:',
        choices: [
          { text: 'v1 × v2', isCorrect: false }, { text: 'c1·v1 + c2·v2 for scalars c1, c2', isCorrect: true },
          { text: 'v1 / v2', isCorrect: false }, { text: 'v1 − v2 only', isCorrect: false },
        ],
      },
    ]);

    // ── Exam 4: CMSC 100 Quiz 1 (closed) ──────────────────
    const exam4 = await Exam.create({
      title: 'Quiz 1: HTML and CSS Basics',
      description: 'Foundational concepts of web markup and styling.',
      courseId: course3._id,
      createdById: faculty3._id,
      type: ExamType.QUIZ,
      status: ExamStatus.CLOSED,
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
    });

    const exam4Questions = await Question.create([
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 0, points: 2,
        questionText: 'What does HTML stand for?',
        choices: [
          { text: 'Hyper Text Markup Language', isCorrect: true },
          { text: 'High Transfer Markup Language', isCorrect: false },
          { text: 'Hyper Text Machine Language', isCorrect: false },
          { text: 'Home Tool Markup Language', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.TRUE_FALSE, order: 1, points: 2,
        questionText: 'The <head> tag contains visible page content.',
        correctAnswer: false,
        explanation: 'The <head> tag contains metadata. Visible content goes in <body>.',
      },
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 2, points: 2,
        questionText: 'Which CSS property changes the text color?',
        choices: [
          { text: 'font-color', isCorrect: false }, { text: 'text-color', isCorrect: false },
          { text: 'color', isCorrect: true }, { text: 'foreground', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.TRUE_FALSE, order: 3, points: 2,
        questionText: 'CSS stands for Cascading Style Sheets.',
        correctAnswer: true,
      },
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 4, points: 2,
        questionText: 'Which HTML tag is used for the largest heading?',
        choices: [
          { text: '<h6>', isCorrect: false }, { text: '<h1>', isCorrect: true },
          { text: '<head>', isCorrect: false }, { text: '<title>', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 5, points: 2,
        questionText: 'What is the correct CSS to set background color to blue?',
        choices: [
          { text: 'background-color: blue;', isCorrect: true },
          { text: 'bg-color: blue;', isCorrect: false },
          { text: 'color-background: blue;', isCorrect: false },
          { text: 'background: #blue;', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.TRUE_FALSE, order: 6, points: 2,
        questionText: "In CSS, 'margin' and 'padding' refer to the same spacing concept.",
        correctAnswer: false,
        explanation: 'Margin is outside the border; padding is inside the border.',
      },
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 7, points: 2,
        questionText: 'Which attribute links an external CSS file in HTML?',
        choices: [
          { text: 'src', isCorrect: false }, { text: 'href', isCorrect: true },
          { text: 'link', isCorrect: false }, { text: 'style', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.MULTIPLE_CHOICE, order: 8, points: 2,
        questionText: "What does CSS 'display: flex' enable?",
        choices: [
          { text: 'Grid layout', isCorrect: false }, { text: 'Flexbox layout', isCorrect: true },
          { text: 'Table layout', isCorrect: false }, { text: 'Block layout only', isCorrect: false },
        ],
      },
      {
        examId: exam4._id, type: QuestionType.TRUE_FALSE, order: 9, points: 2,
        questionText: 'The <br> tag in HTML creates a line break.',
        correctAnswer: true,
      },
    ]);

    // ── Exam 5: CMSC 135 Final (upcoming) ─────────────────
    await Exam.create({
      title: 'Final Exam: Advanced Networking',
      description: 'Comprehensive assessment covering all networking topics.',
      instructions: 'All topics from Week 1 to Week 14 are included.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.FINAL,
      status: ExamStatus.PUBLISHED,
      totalPoints: 100,
      questionCount: 0,
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
    });
    console.log('Created 5 exams with questions');

    // ─── Submissions & Results ───────────────────────────────
    // Generates realistic answers for MC and TF questions based on student score ratio

    async function createSubmissionsForExam(
      exam: any,
      questions: any[],
      participatingStudents: any[],
      submittedDaysAgo: number,
    ) {
      const submissionDocs: any[] = [];
      const resultDocs: any[] = [];

      for (let i = 0; i < participatingStudents.length; i++) {
        const student = participatingStudents[i];
        const studentIdx = students.indexOf(student);
        const baseRatio = SCORE_RATIOS[studentIdx] ?? 0.70;
        // Small per-exam jitter for realism
        const ratio = Math.min(1, Math.max(0.3, baseRatio + (Math.random() * 0.08 - 0.04)));

        const answers: any[] = [];
        let totalScore = 0;

        for (const q of questions) {
          const correct = Math.random() < ratio;

          if (q.type === QuestionType.MULTIPLE_CHOICE) {
            const correctChoice = q.choices.find((c: any) => c.isCorrect);
            const wrongChoices = q.choices.filter((c: any) => !c.isCorrect);
            const chosen = correct ? correctChoice : wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
            const pts = correct ? q.points : 0;
            totalScore += pts;
            answers.push({
              questionId: q._id,
              selectedChoiceId: chosen._id,
              pointsEarned: pts,
              isCorrect: correct,
              gradedAt: daysAgo(submittedDaysAgo - 1),
            });
          } else if (q.type === QuestionType.TRUE_FALSE) {
            const answer = correct ? q.correctAnswer : !q.correctAnswer;
            const pts = correct ? q.points : 0;
            totalScore += pts;
            answers.push({
              questionId: q._id,
              booleanAnswer: answer,
              pointsEarned: pts,
              isCorrect: correct,
              gradedAt: daysAgo(submittedDaysAgo - 1),
            });
          }
        }

        const percentage = Math.round((totalScore / exam.totalPoints) * 100);
        const isPassing = percentage >= exam.settings.passingPercentage;
        const submittedAt = daysAgo(submittedDaysAgo);

        submissionDocs.push({
          examId: exam._id,
          studentId: student._id,
          status: SubmissionStatus.RETURNED,
          answers,
          startedAt: new Date(submittedAt.getTime() - 25 * 60_000),
          submittedAt,
          timeAllottedMinutes: exam.settings.timeLimitMinutes,
          totalScore,
          maxScore: exam.totalPoints,
          percentage,
          isPassing,
          overallFeedback: percentage >= 80
            ? 'Excellent work!'
            : percentage >= 60
            ? 'Good effort, keep it up.'
            : 'Please review the material and see your instructor.',
          attemptNumber: 1,
        });

        resultDocs.push({
          examId: exam._id,
          studentId: student._id,
          score: totalScore,
          status: ResultStatus.PUBLISHED,
          publishedAt: new Date(submittedAt.getTime() + 86_400_000),
          regradeRequests: [],
        });
      }

      await ExamSubmission.insertMany(submissionDocs);
      await ExamResult.insertMany(resultDocs);
      console.log(`  → ${submissionDocs.length} submissions for "${exam.title}"`);
    }

    console.log('Creating submissions and results...');
    await createSubmissionsForExam(exam1, exam1Questions, students, 50);             // all 50
    await createSubmissionsForExam(exam2, exam2Questions, students, 30);             // all 50
    await createSubmissionsForExam(exam3, exam3Questions, students.slice(0, 30), 45); // first 30
    await createSubmissionsForExam(exam4, exam4Questions, students.slice(25), 35);   // last 25

    // ── Announcements ──────────────────────────────────────
    await Announcement.create([
      {
        title: 'Welcome to ISKOR!',
        content: 'Welcome to the Integrated Student Knowledge and Output Repository. This platform handles all quizzes, exams, and assessments this semester.',
        type: AnnouncementType.GENERAL,
        priority: AnnouncementPriority.NORMAL,
        createdById: admin._id,
        targetRoles: [Role.STUDENT, Role.FACULTY],
        isPublished: true,
        publishedAt: daysAgo(88),
      },
      {
        title: 'Quiz 1 Results Now Available',
        content: 'Results for CMSC 135 Quiz 1 have been published. View your scores and feedback in the Results section.',
        type: AnnouncementType.RESULT,
        priority: AnnouncementPriority.NORMAL,
        courseId: course1._id,
        examId: exam1._id,
        createdById: faculty1._id,
        targetRoles: [Role.STUDENT],
        isPublished: true,
        publishedAt: daysAgo(49),
      },
      {
        title: 'Midterm Exam Results Released',
        content: 'CMSC 135 Midterm results are now available. Please review your performance.',
        type: AnnouncementType.RESULT,
        priority: AnnouncementPriority.HIGH,
        courseId: course1._id,
        examId: exam2._id,
        createdById: faculty1._id,
        targetRoles: [Role.STUDENT],
        isPublished: true,
        publishedAt: daysAgo(29),
      },
      {
        title: 'Final Exam: Advanced Networking — Opens in 7 Days',
        content: 'The CMSC 135 Final Exam will open in 7 days. Review all modules from Week 1–14. Coverage includes routing protocols, network security, and architecture.',
        type: AnnouncementType.EXAM,
        priority: AnnouncementPriority.URGENT,
        courseId: course1._id,
        createdById: faculty1._id,
        targetRoles: [Role.STUDENT],
        isPublished: true,
        publishedAt: daysAgo(2),
      },
    ]);
    console.log('Created 4 announcements');

    // ── Summary ────────────────────────────────────────────
    const [userCount, courseCount, examCount, subCount, resultCount] = await Promise.all([
      User.countDocuments(),
      Course.countDocuments(),
      Exam.countDocuments(),
      ExamSubmission.countDocuments(),
      ExamResult.countDocuments(),
    ]);

    console.log('\n✅ Database seeded successfully!\n');
    console.log('─────────────────────────────────────────');
    console.log(`Users:        ${userCount}  (1 admin, 3 faculty, 50 students)`);
    console.log(`Courses:      ${courseCount}`);
    console.log(`Exams:        ${examCount}  (4 closed + 1 upcoming final)`);
    console.log(`Submissions:  ${subCount}`);
    console.log(`Results:      ${resultCount}`);
    console.log('─────────────────────────────────────────');
    console.log('🔑 Login credentials (password: password123)');
    console.log('  Admin:    admin@up.edu.ph');
    console.log('  Faculty:  maria.santos@up.edu.ph  (CMSC 135)');
    console.log('            jose.reyes@up.edu.ph    (MATH 114)');
    console.log('            ana.garcia@up.edu.ph    (CMSC 100)');
    console.log('  Students: student01@up.edu.ph ... student50@up.edu.ph');
    console.log('─────────────────────────────────────────\n');

  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();