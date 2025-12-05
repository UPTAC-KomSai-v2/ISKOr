import { Router, Request, Response } from 'express';
import { User, Role, Enrollment, EnrollmentStatus } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { createUserValidator, mongoIdValidator, paginationValidator } from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/users
 * List users (Admin only)
 */
router.get('/', authenticate, authorize(Role.ADMIN), paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { studentNumber: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' } });
  }
});

/**
 * GET /api/v1/users/students
 * List students (Faculty/Admin)
 */
router.get('/students', authenticate, authorize(Role.ADMIN, Role.FACULTY), paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = { role: Role.STUDENT, isActive: true };

    if (req.query.program) filter.program = req.query.program;
    if (req.query.yearLevel) filter.yearLevel = parseInt(req.query.yearLevel as string);
    if (req.query.section) filter.section = req.query.section;
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { studentNumber: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [students, total] = await Promise.all([
      User.find(filter)
        .select('firstName lastName email studentNumber program yearLevel section')
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { students, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error('List students error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students' } });
  }
});

/**
 * GET /api/v1/users/faculty
 * List faculty (Admin only)
 */
router.get('/faculty', authenticate, authorize(Role.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const faculty = await User.find({ role: Role.FACULTY, isActive: true })
      .select('firstName lastName email facultyId department designation')
      .sort({ lastName: 1, firstName: 1 });

    res.json({ success: true, data: { faculty } });
  } catch (error) {
    logger.error('List faculty error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch faculty' } });
  }
});

/**
 * GET /api/v1/users/:id
 * Get user details
 */
router.get('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    // Users can only view their own details unless Admin
    if (req.user!.role !== Role.ADMIN && req.params.id !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Get enrollment info for students
    let enrollments;
    if (user.role === Role.STUDENT) {
      enrollments = await Enrollment.find({ studentId: user._id, status: EnrollmentStatus.ENROLLED })
        .populate('courseId', 'code name semester academicYear');
    }

    res.json({
      success: true,
      data: { user, enrollments },
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } });
  }
});

/**
 * POST /api/v1/users
 * Create a new user (Admin only)
 */
router.post('/', authenticate, authorize(Role.ADMIN), createUserValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, studentNumber, facultyId, department, program, yearLevel, section, designation } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
      return;
    }

    const user = await User.create({
      email,
      passwordHash: password,
      firstName,
      lastName,
      role,
      studentNumber,
      facultyId,
      department,
      program,
      yearLevel,
      section,
      designation,
    });

    logger.info(`User created: ${user.email} by ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' } });
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user
 */
router.put('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    // Users can only update their own profile unless Admin
    if (req.user!.role !== Role.ADMIN && req.params.id !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const { firstName, lastName, department, program, yearLevel, section, designation } = req.body;

    // Only admin can change these fields
    if (req.user!.role === Role.ADMIN) {
      const { role, isActive, studentNumber, facultyId } = req.body;
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      if (studentNumber) user.studentNumber = studentNumber;
      if (facultyId) user.facultyId = facultyId;
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (department !== undefined) user.department = department;
    if (program !== undefined) user.program = program;
    if (yearLevel !== undefined) user.yearLevel = yearLevel;
    if (section !== undefined) user.section = section;
    if (designation !== undefined) user.designation = designation;

    await user.save();

    res.json({
      success: true,
      data: { user: { ...user.toObject(), passwordHash: undefined } },
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' } });
  }
});

/**
 * DELETE /api/v1/users/:id
 * Deactivate user (soft delete)
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    logger.info(`User deactivated: ${user.email} by ${req.user!.email}`);

    res.json({ success: true, data: { message: 'User deactivated successfully' } });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate user' } });
  }
});

/**
 * POST /api/v1/users/bulk
 * Bulk create users (Admin only)
 */
router.post('/bulk', authenticate, authorize(Role.ADMIN), async (req: Request, res: Response): Promise<void> => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'users array required' } });
      return;
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const userData of users) {
      try {
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
          results.skipped++;
          continue;
        }

        await User.create({
          email: userData.email,
          passwordHash: userData.password || 'defaultPassword123',
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role || Role.STUDENT,
          studentNumber: userData.studentNumber,
          program: userData.program,
          yearLevel: userData.yearLevel,
          section: userData.section,
        });
        results.created++;
      } catch (err: any) {
        results.errors.push(`${userData.email}: ${err.message}`);
      }
    }

    res.status(201).json({ success: true, data: results });
  } catch (error) {
    logger.error('Bulk create users error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create users' } });
  }
});

export default router;
