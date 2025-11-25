import { PrismaClient, Role, ExamType, ExamStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.regradeRequest.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.examFile.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.student.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Create password hash
  const passwordHash = await bcrypt.hash('password123', 12);

  // ============================================
  // Create Users
  // ============================================

  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@up.edu.ph',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: Role.ADMIN,
    },
  });
  console.log('✅ Created admin user:', adminUser.email);

  // Faculty Users
  const faculty1User = await prisma.user.create({
    data: {
      email: 'faculty@up.edu.ph',
      passwordHash,
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      role: Role.FACULTY,
      faculty: {
        create: {
          facultyId: 'FAC-2020-001',
          department: 'Division of Natural Sciences and Mathematics',
          designation: 'Associate Professor',
        },
      },
    },
    include: { faculty: true },
  });
  console.log('✅ Created faculty user:', faculty1User.email);

  const faculty2User = await prisma.user.create({
    data: {
      email: 'maria.santos@up.edu.ph',
      passwordHash,
      firstName: 'Maria',
      lastName: 'Santos',
      role: Role.FACULTY,
      faculty: {
        create: {
          facultyId: 'FAC-2019-015',
          department: 'Division of Natural Sciences and Mathematics',
          designation: 'Assistant Professor',
        },
      },
    },
    include: { faculty: true },
  });

  // Student Users
  const student1User = await prisma.user.create({
    data: {
      email: 'student@up.edu.ph',
      passwordHash,
      firstName: 'Pedro',
      lastName: 'Penduko',
      role: Role.STUDENT,
      student: {
        create: {
          studentNumber: '2021-00001',
          program: 'BS Computer Science',
          yearLevel: 4,
          section: 'A',
        },
      },
    },
    include: { student: true },
  });
  console.log('✅ Created student user:', student1User.email);

  const student2User = await prisma.user.create({
    data: {
      email: 'ana.reyes@up.edu.ph',
      passwordHash,
      firstName: 'Ana',
      lastName: 'Reyes',
      role: Role.STUDENT,
      student: {
        create: {
          studentNumber: '2021-00002',
          program: 'BS Computer Science',
          yearLevel: 4,
          section: 'A',
        },
      },
    },
    include: { student: true },
  });

  const student3User = await prisma.user.create({
    data: {
      email: 'carlos.garcia@up.edu.ph',
      passwordHash,
      firstName: 'Carlos',
      lastName: 'Garcia',
      role: Role.STUDENT,
      student: {
        create: {
          studentNumber: '2021-00003',
          program: 'BS Computer Science',
          yearLevel: 4,
          section: 'B',
        },
      },
    },
    include: { student: true },
  });

  // ============================================
  // Create Courses
  // ============================================

  const cmsc135 = await prisma.course.create({
    data: {
      code: 'CMSC 135',
      name: 'Data Communication and Networking',
      description: 'Concepts and principles of data communications and computer networks.',
      units: 3,
      facultyId: faculty1User.faculty!.id,
      semester: '1st Sem 2024-2025',
    },
  });
  console.log('✅ Created course:', cmsc135.code);

  const cmsc142 = await prisma.course.create({
    data: {
      code: 'CMSC 142',
      name: 'Design and Analysis of Algorithms',
      description: 'Techniques for analyzing and designing efficient algorithms.',
      units: 3,
      facultyId: faculty2User.faculty!.id,
      semester: '1st Sem 2024-2025',
    },
  });

  // ============================================
  // Create Enrollments
  // ============================================

  await prisma.enrollment.createMany({
    data: [
      { studentId: student1User.student!.id, courseId: cmsc135.id },
      { studentId: student1User.student!.id, courseId: cmsc142.id },
      { studentId: student2User.student!.id, courseId: cmsc135.id },
      { studentId: student2User.student!.id, courseId: cmsc142.id },
      { studentId: student3User.student!.id, courseId: cmsc135.id },
    ],
  });
  console.log('✅ Created enrollments');

  // ============================================
  // Create Exams
  // ============================================

  const midtermExam = await prisma.exam.create({
    data: {
      title: 'Midterm Examination',
      description: 'Covers TCP/IP, OSI Model, and Network Protocols',
      courseId: cmsc135.id,
      createdById: faculty1User.id,
      type: ExamType.WRITTEN,
      status: ExamStatus.SCHEDULED,
      totalPoints: 100,
      passingScore: 60,
      guidelines: `
        1. This is a closed-book examination.
        2. No electronic devices allowed except calculators.
        3. Answer all questions in the provided answer sheet.
        4. Time limit: 2 hours.
        5. Late submissions will not be accepted.
      `,
      schedules: {
        create: [
          {
            section: 'A',
            room: 'Room 301',
            startTime: new Date('2024-12-15T08:00:00Z'),
            endTime: new Date('2024-12-15T10:00:00Z'),
          },
          {
            section: 'B',
            room: 'Room 302',
            startTime: new Date('2024-12-15T10:30:00Z'),
            endTime: new Date('2024-12-15T12:30:00Z'),
          },
        ],
      },
    },
  });
  console.log('✅ Created midterm exam');

  const finalExam = await prisma.exam.create({
    data: {
      title: 'Final Examination',
      description: 'Comprehensive exam covering all topics',
      courseId: cmsc135.id,
      createdById: faculty1User.id,
      type: ExamType.WRITTEN,
      status: ExamStatus.DRAFT,
      totalPoints: 150,
      passingScore: 90,
      guidelines: 'Guidelines to be announced.',
    },
  });

  // ============================================
  // Create Announcements
  // ============================================

  await prisma.announcement.create({
    data: {
      title: 'Midterm Exam Schedule Released',
      content: `
        Dear Students,
        
        The schedule for the CMSC 135 Midterm Examination has been released. 
        Please check your respective exam schedules and rooms.
        
        Section A: December 15, 2024, 8:00 AM - 10:00 AM, Room 301
        Section B: December 15, 2024, 10:30 AM - 12:30 PM, Room 302
        
        Please arrive 15 minutes before your scheduled time.
        
        Best regards,
        Prof. Juan Dela Cruz
      `,
      type: 'EXAM_UPDATE',
      priority: 'HIGH',
      examId: midtermExam.id,
      createdById: faculty1User.id,
      targetRoles: 'STUDENT',
    },
  });
  console.log('✅ Created announcements');

  await prisma.announcement.create({
    data: {
      title: 'Welcome to CMSC 135',
      content: `
        Welcome to Data Communication and Networking!
        
        This course will cover fundamental concepts of computer networks,
        including the OSI and TCP/IP models, network protocols, and more.
        
        Please check the course syllabus for more details.
      `,
      type: 'GENERAL',
      priority: 'NORMAL',
      createdById: faculty1User.id,
      targetRoles: 'STUDENT,FACULTY',
    },
  });

  // ============================================
  // Create Sample Audit Logs
  // ============================================

  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'CREATE',
        entity: 'User',
        entityId: faculty1User.id,
        changes: JSON.stringify({ email: faculty1User.email, role: 'FACULTY' }),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        userId: faculty1User.id,
        action: 'CREATE',
        entity: 'Exam',
        entityId: midtermExam.id,
        changes: JSON.stringify({ title: midtermExam.title, status: 'SCHEDULED' }),
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    ],
  });
  console.log('✅ Created audit logs');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('   Admin:   admin@up.edu.ph / password123');
  console.log('   Faculty: faculty@up.edu.ph / password123');
  console.log('   Student: student@up.edu.ph / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
