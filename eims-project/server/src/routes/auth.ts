import { Router, Request, Response } from 'express';
import { User, RefreshToken, Role } from '../models';
import {
  authenticate,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth';
import { loginValidator, refreshTokenValidator, createUserValidator } from '../middleware/validation';
import { createAuditLog } from '../middleware/audit';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', loginValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Your account has been disabled' },
      });
      return;
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await createAuditLog(null, 'LOGIN_FAILED', 'User', user._id.toString(), { email }, req.ip, req.get('user-agent'));
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Delete old refresh tokens and create new one
    await RefreshToken.deleteMany({ userId: user._id });
    await RefreshToken.create({
      token: refreshToken,
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await createAuditLog(user._id.toString(), 'LOGIN', 'User', user._id.toString(), { email }, req.ip, req.get('user-agent'));
    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          studentNumber: user.studentNumber,
          facultyId: user.facultyId,
          department: user.department,
          program: user.program,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during login' },
    });
  }
});

/**
 * POST /api/v1/auth/register
 * Register a new user (Admin only in production)
 */
router.post('/register', createUserValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, studentNumber, facultyId, department, program, yearLevel, section, designation } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already registered' },
      });
      return;
    }

    const user = await User.create({
      email,
      passwordHash: password,
      firstName,
      lastName,
      role: role || Role.STUDENT,
      studentNumber,
      facultyId,
      department,
      program,
      yearLevel,
      section,
      designation,
    });

    logger.info(`User registered: ${user.email}`);

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
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during registration' },
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post('/refresh', refreshTokenValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
      });
      return;
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken }).populate('userId');
    if (!storedToken || storedToken.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not found or expired' },
      });
      return;
    }

    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during token refresh' },
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user and invalidate refresh token
 */
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken, userId: req.user!.id });
    }

    await createAuditLog(req.user!.id, 'LOGOUT', 'User', req.user!.id, {}, req.ip, req.get('user-agent'));
    logger.info(`User logged out: ${req.user!.email}`);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during logout' },
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

/**
 * PUT /api/v1/auth/password
 * Change password
 */
router.put('/password', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid current and new password required' },
      });
      return;
    }

    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
      return;
    }

    user.passwordHash = newPassword;
    await user.save();

    // Invalidate all refresh tokens
    await RefreshToken.deleteMany({ userId: user._id });

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

export default router;
