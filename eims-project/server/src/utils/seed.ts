import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Role, Course, Enrollment, Exam, ExamStatus, ExamType, Question, QuestionType, Announcement, AnnouncementType, AnnouncementPriority } from '../models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/examflow';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Course.deleteMany({}),
      Enrollment.deleteMany({}),
      Exam.deleteMany({}),
      Question.deleteMany({}),
      Announcement.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create Admin
    const admin = await User.create({
      email: 'admin@up.edu.ph',
      passwordHash: 'password123',
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
    });
    console.log('Created admin:', admin.email);

    // Create Faculty
    const faculty1 = await User.create({
      email: 'faculty@up.edu.ph',
      passwordHash: 'password123',
      firstName: 'Maria',
      lastName: 'Santos',
      role: Role.FACULTY,
      facultyId: 'FAC-2024-001',
      department: 'Division of Natural Sciences and Mathematics',
      designation: 'Assistant Professor',
    });
    console.log('Created faculty:', faculty1.email);

    // Create Students
    const students = await User.create([
      {
        email: 'student@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Ana',
        lastName: 'Reyes',
        role: Role.STUDENT,
        studentNumber: '2021-00001',
        program: 'BS Computer Science',
        yearLevel: 3,
        section: 'A',
      },
      {
        email: 'student2@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Jose',
        lastName: 'Garcia',
        role: Role.STUDENT,
        studentNumber: '2021-00002',
        program: 'BS Computer Science',
        yearLevel: 3,
        section: 'A',
      },
    ]);
    console.log('Created students');

    // Create Course
    const course1 = await Course.create({
      code: 'CMSC 135',
      name: 'Data Communication and Networking',
      description: 'Study of computer networks, protocols, and data communication principles.',
      semester: '1ST',
      academicYear: '2024-2025',
      facultyId: faculty1._id,
    });
    console.log('Created course:', course1.code);

    // Create Enrollments
    await Enrollment.create([
      { studentId: students[0]._id, courseId: course1._id, isActive: true },
      { studentId: students[1]._id, courseId: course1._id, isActive: true },
    ]);
    console.log('Created enrollments');

    // Create Quiz with Questions
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    const quiz1 = await Exam.create({
      title: 'Quiz 1: Network Fundamentals',
      description: 'Test your knowledge of basic networking concepts.',
      instructions: 'Answer all questions. You have 30 minutes.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.QUIZ,
      status: ExamStatus.ACTIVE,
      totalPoints: 10,
      questionCount: 5,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: endDate,
      settings: {
        shuffleQuestions: true,
        shuffleChoices: true,
        showResults: true,
        showCorrectAnswers: true,
        showFeedback: true,
        allowReview: true,
        maxAttempts: 2,
        timeLimitMinutes: 30,
        passingPercentage: 60,
        lateSubmissionAllowed: false,
        lateSubmissionPenalty: 0,
      },
    });

    await Question.create([
      {
        examId: quiz1._id,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'Which layer of the OSI model is responsible for routing?',
        points: 2,
        order: 0,
        choices: [
          { text: 'Physical Layer', isCorrect: false },
          { text: 'Data Link Layer', isCorrect: false },
          { text: 'Network Layer', isCorrect: true },
          { text: 'Transport Layer', isCorrect: false },
        ],
        explanation: 'The Network Layer (Layer 3) handles routing.',
      },
      {
        examId: quiz1._id,
        type: QuestionType.TRUE_FALSE,
        questionText: 'TCP is a connectionless protocol.',
        points: 2,
        order: 1,
        correctAnswer: false,
        explanation: 'TCP is connection-oriented. UDP is connectionless.',
      },
      {
        examId: quiz1._id,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'What is the default port for HTTP?',
        points: 2,
        order: 2,
        choices: [
          { text: '21', isCorrect: false },
          { text: '22', isCorrect: false },
          { text: '80', isCorrect: true },
          { text: '443', isCorrect: false },
        ],
        explanation: 'HTTP uses port 80. HTTPS uses port 443.',
      },
      {
        examId: quiz1._id,
        type: QuestionType.SHORT_ANSWER,
        questionText: 'What does DNS stand for?',
        points: 2,
        order: 3,
        acceptedAnswers: ['Domain Name System', 'domain name system'],
        caseSensitive: false,
      },
      {
        examId: quiz1._id,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: 'Which protocol is used for secure web browsing?',
        points: 2,
        order: 4,
        choices: [
          { text: 'HTTP', isCorrect: false },
          { text: 'FTP', isCorrect: false },
          { text: 'HTTPS', isCorrect: true },
          { text: 'SMTP', isCorrect: false },
        ],
      },
    ]);
    console.log('Created Quiz with 5 questions');

    // Create Draft Midterm
    await Exam.create({
      title: 'Midterm Examination',
      description: 'Comprehensive exam covering Chapters 1-5.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.MIDTERM,
      status: ExamStatus.DRAFT,
      totalPoints: 0,
      questionCount: 0,
      settings: {
        shuffleQuestions: false,
        shuffleChoices: true,
        showResults: true,
        showCorrectAnswers: false,
        showFeedback: true,
        allowReview: true,
        maxAttempts: 1,
        timeLimitMinutes: 120,
        passingPercentage: 60,
        lateSubmissionAllowed: false,
        lateSubmissionPenalty: 0,
      },
    });
    console.log('Created Midterm (draft)');

    // Create Announcement
    await Announcement.create({
      title: 'Quiz 1 Now Available!',
      content: 'Quiz 1 on Network Fundamentals is now open. Good luck!',
      type: AnnouncementType.EXAM,
      priority: AnnouncementPriority.HIGH,
      courseId: course1._id,
      createdById: faculty1._id,
      targetRoles: [Role.STUDENT],
      isPublished: true,
      publishedAt: new Date(),
    });
    console.log('Created announcement');

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Test Credentials:');
    console.log('─────────────────');
    console.log('Admin:   admin@up.edu.ph / password123');
    console.log('Faculty: faculty@up.edu.ph / password123');
    console.log('Student: student@up.edu.ph / password123');
    console.log('');

  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seed();
