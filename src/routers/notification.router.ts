import { Router } from 'express';
import { getUserNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getUserNotifications);
router.patch('/:notificationId/read', authenticateToken, markAsRead);
router.patch('/mark-all-read', authenticateToken, markAllAsRead);

export default router;