import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import courseRoutes from './courses';
import examRoutes from './exams';
import questionRoutes from './questions';
import submissionRoutes from './submissions';
import resultRoutes from './results';
import announcementRoutes from './announcements';
import notificationRoutes from './notifications';
import dashboardRoutes from './dashboard';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/courses', courseRoutes);
router.use('/exams', examRoutes);
router.use('/questions', questionRoutes);
router.use('/submissions', submissionRoutes);
router.use('/results', resultRoutes);
router.use('/announcements', announcementRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
