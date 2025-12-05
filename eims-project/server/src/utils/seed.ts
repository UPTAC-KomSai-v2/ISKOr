import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Role, Course, Enrollment, EnrollmentStatus, Exam, ExamStatus, ExamType, Announcement, AnnouncementType, AnnouncementPriority } from '../models';

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
      department: 'Computer Science',
      designation: 'Assistant Professor',
    });

    const faculty2 = await User.create({
      email: 'faculty2@up.edu.ph',
      passwordHash: 'password123',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      role: Role.FACULTY,
      facultyId: 'FAC-2024-002',
      department: 'Computer Science',
      designation: 'Instructor',
    });
    console.log('Created faculty members');

    // Create Students
    const students = await User.create([
      {
        email: 'student@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Ana',
        lastName: 'Reyes',
        role: Role.STUDENT,
        studentNumber: '2021-00001',
        program: 'BSCS',
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
        program: 'BSCS',
        yearLevel: 3,
        section: 'A',
      },
      {
        email: 'student3@up.edu.ph',
        passwordHash: 'password123',
        firstName: 'Maria',
        lastName: 'Lopez',
        role: Role.STUDENT,
        studentNumber: '2021-00003',
        program: 'BSCS',
        yearLevel: 3,
        section: 'B',
      },
    ]);
    console.log('Created students');

    // Create Courses
    const course1 = await Course.create({
      code: 'CMSC 135',
      name: 'Data Communication and Networking',
      description: 'Study of computer networks, protocols, and data communication principles.',
      semester: '1ST',
      academicYear: '2024-2025',
      facultyId: faculty1._id,
    });

    const course2 = await Course.create({
      code: 'CMSC 142',
      name: 'Design and Analysis of Algorithms',
      description: 'Advanced algorithm design techniques and complexity analysis.',
      semester: '1ST',
      academicYear: '2024-2025',
      facultyId: faculty2._id,
    });
    console.log('Created courses');

    // Create Enrollments
    await Enrollment.create([
      { studentId: students[0]._id, courseId: course1._id, status: EnrollmentStatus.ENROLLED },
      { studentId: students[1]._id, courseId: course1._id, status: EnrollmentStatus.ENROLLED },
      { studentId: students[2]._id, courseId: course1._id, status: EnrollmentStatus.ENROLLED },
      { studentId: students[0]._id, courseId: course2._id, status: EnrollmentStatus.ENROLLED },
      { studentId: students[1]._id, courseId: course2._id, status: EnrollmentStatus.ENROLLED },
    ]);
    console.log('Created enrollments');

    // Create Exams
    const midtermDate = new Date();
    midtermDate.setDate(midtermDate.getDate() + 7);

    const finalDate = new Date();
    finalDate.setDate(finalDate.getDate() + 30);

    const exam1 = await Exam.create({
      title: 'Midterm Examination',
      description: 'Covers networking fundamentals, OSI model, and TCP/IP.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.MIDTERM,
      status: ExamStatus.SCHEDULED,
      totalPoints: 100,
      passingScore: 60,
      guidelines: '1. This is a closed-book exam.\n2. No electronic devices allowed.\n3. Show all your work for partial credit.',
      schedules: [
        {
          section: 'Section A',
          room: 'Room 301',
          startTime: midtermDate,
          endTime: new Date(midtermDate.getTime() + 2 * 60 * 60 * 1000),
          instructions: 'Please arrive 15 minutes early.',
        },
        {
          section: 'Section B',
          room: 'Room 302',
          startTime: new Date(midtermDate.getTime() + 3 * 60 * 60 * 1000),
          endTime: new Date(midtermDate.getTime() + 5 * 60 * 60 * 1000),
          instructions: 'Please arrive 15 minutes early.',
        },
      ],
    });

    const exam2 = await Exam.create({
      title: 'Final Examination',
      description: 'Comprehensive exam covering all topics.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.FINAL,
      status: ExamStatus.DRAFT,
      totalPoints: 150,
      passingScore: 90,
    });

    const quiz1 = await Exam.create({
      title: 'Quiz 1: Network Basics',
      description: 'Short quiz on network fundamentals.',
      courseId: course1._id,
      createdById: faculty1._id,
      type: ExamType.QUIZ,
      status: ExamStatus.COMPLETED,
      totalPoints: 20,
      passingScore: 12,
    });
    console.log('Created exams');

    // Create Announcements
    await Announcement.create([
      {
        title: 'Midterm Examination Schedule Released',
        content: 'The midterm examination for CMSC 135 has been scheduled. Please check the exam details for your section. Make sure to bring your ID and necessary materials.',
        type: AnnouncementType.EXAM,
        priority: AnnouncementPriority.HIGH,
        courseId: course1._id,
        createdById: faculty1._id,
        targetRoles: [Role.STUDENT],
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        title: 'Welcome to CMSC 135!',
        content: 'Welcome to Data Communication and Networking! This course will cover fundamental concepts in computer networks. Please review the syllabus and course requirements.',
        type: AnnouncementType.GENERAL,
        priority: AnnouncementPriority.NORMAL,
        courseId: course1._id,
        createdById: faculty1._id,
        targetRoles: [Role.STUDENT],
        isPublished: true,
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'System Maintenance Notice',
        content: 'The ExamFlow system will undergo maintenance this weekend. Please save your work and expect brief interruptions.',
        type: AnnouncementType.URGENT,
        priority: AnnouncementPriority.URGENT,
        createdById: admin._id,
        targetRoles: [],
        isPublished: true,
        publishedAt: new Date(),
      },
    ]);
    console.log('Created announcements');

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
