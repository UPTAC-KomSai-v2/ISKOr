import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user?._id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// Get current user profile
router.get(
  '/me',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.user!._id).select('-passwordHash');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

// Update profile
router.put(
  '/me',
  authenticateToken,
  [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('bio').optional().isLength({ max: 500 }),
    body('phoneNumber').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!._id;
      const { firstName, lastName, bio, phoneNumber, program, yearLevel, section, department, designation } = req.body;

      const updateData: any = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (bio !== undefined) updateData.bio = bio;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

      // Role-specific fields
      if (req.user!.role === 'STUDENT') {
        if (program) updateData.program = program;
        if (yearLevel) updateData.yearLevel = yearLevel;
        if (section) updateData.section = section;
      }

      if (req.user!.role === 'FACULTY') {
        if (department) updateData.department = department;
        if (designation) updateData.designation = designation;
      }

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true }
      ).select('-passwordHash');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// Upload profile photo
router.post(
  '/me/photo',
  authenticateToken,
  upload.single('photo'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user!._id;
      
      // Get current user to delete old photo
      const currentUser = await User.findById(userId);
      if (currentUser?.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '../../uploads/profiles', path.basename(currentUser.profilePhoto));
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }

      // Save new photo URL
      const photoUrl = `/uploads/profiles/${req.file.filename}`;
      
      const user = await User.findByIdAndUpdate(
        userId,
        { profilePhoto: photoUrl },
        { new: true }
      ).select('-passwordHash');

      res.json({ 
        message: 'Photo uploaded successfully', 
        profilePhoto: photoUrl,
        user 
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

// Delete profile photo
router.delete(
  '/me/photo',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!._id;
      
      const user = await User.findById(userId);
      if (user?.profilePhoto) {
        const photoPath = path.join(__dirname, '../../uploads/profiles', path.basename(user.profilePhoto));
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

      await User.findByIdAndUpdate(userId, { profilePhoto: null });

      res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  }
);

// Change password
router.put(
  '/me/password',
  authenticateToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user!._id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password
      user.passwordHash = newPassword; // Will be hashed by pre-save hook
      await user.save();

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Get user profile by ID (for viewing other profiles)
router.get(
  '/:userId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select(
        'firstName lastName email role profilePhoto bio department designation program yearLevel section studentNumber facultyId'
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  }
);

export default router;
