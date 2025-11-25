import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { paginationValidator, idParamValidator } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/students
 * @desc    Get all students (paginated)
 * @access  Private (Faculty, Admin)
 */
router.get(
  '/',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  paginationValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, search, program, yearLevel } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { studentNumber: { contains: String(search) } },
          { user: { firstName: { contains: String(search) } } },
          { user: { lastName: { contains: String(search) } } },
          { user: { email: { contains: String(search) } } },
        ];
      }

      if (program) {
        whereClause.program = program;
      }

      if (yearLevel) {
        whereClause.yearLevel = Number(yearLevel);
      }

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where: whereClause,
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
            },
          },
          orderBy: { studentNumber: 'asc' },
          skip,
          take: Number(limit),
        }),
        prisma.student.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: students,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get students error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/students/:id
 * @desc    Get student by ID
 * @access  Private (Faculty, Admin, or Self)
 */
router.get(
  '/:id',
  authenticate,
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const student = await prisma.student.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
          },
          enrollments: {
            include: {
              course: { select: { id: true, code: true, name: true, semester: true } },
            },
          },
        },
      });

      if (!student) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Student not found' },
        });
        return;
      }

      // Check access: Admin, Faculty, or the student themselves
      if (
        req.user!.role === Role.STUDENT &&
        student.user.id !== req.user!.id
      ) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only view your own profile' },
        });
        return;
      }

      res.json({
        success: true,
        data: student,
      });
    } catch (error) {
      logger.error('Get student error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch student' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/students/by-course/:courseId
 * @desc    Get students enrolled in a course
 * @access  Private (Faculty, Admin)
 */
router.get(
  '/by-course/:courseId',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          courseId: req.params.courseId,
          status: 'ENROLLED',
        },
        include: {
          student: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { student: { studentNumber: 'asc' } },
      });

      const students = enrollments.map((e) => e.student);

      res.json({
        success: true,
        data: students,
        meta: { courseId: req.params.courseId, count: students.length },
      });
    } catch (error) {
      logger.error('Get students by course error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students' },
      });
    }
  }
);

/**
 * @route   POST /api/v1/students/sync
 * @desc    Sync students from parent application API
 * @access  Private (Admin)
 */
router.post(
  '/sync',
  authenticate,
  authorize(Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // This would normally fetch from parent app API
      // For now, we'll accept the data in the request body
      const { students } = req.body;

      if (!Array.isArray(students)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Students array required' },
        });
        return;
      }

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const studentData of students) {
        try {
          const { email, firstName, lastName, studentNumber, program, yearLevel, section } = studentData;

          // Upsert user
          const user = await prisma.user.upsert({
            where: { email },
            update: { firstName, lastName },
            create: {
              email,
              firstName,
              lastName,
              passwordHash: '$2a$12$defaulthashforsynced', // Placeholder - should be reset
              role: Role.STUDENT,
            },
          });

          // Upsert student
          const existingStudent = await prisma.student.findUnique({
            where: { studentNumber },
          });

          if (existingStudent) {
            await prisma.student.update({
              where: { studentNumber },
              data: { program, yearLevel, section },
            });
            updated++;
          } else {
            await prisma.student.create({
              data: {
                userId: user.id,
                studentNumber,
                program,
                yearLevel,
                section,
              },
            });
            created++;
          }
        } catch (err) {
          logger.error('Error syncing student:', err);
          errors++;
        }
      }

      logger.info(`Student sync completed: ${created} created, ${updated} updated, ${errors} errors`);

      res.json({
        success: true,
        data: {
          message: 'Sync completed',
          created,
          updated,
          errors,
        },
      });
    } catch (error) {
      logger.error('Sync students error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to sync students' },
      });
    }
  }
);

export default router;
