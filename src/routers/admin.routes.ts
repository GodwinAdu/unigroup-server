import { Router } from 'express';
import { signUp, signIn, signOut, getMe } from '../controllers/admin.auth.controller';
import { authenticateToken } from '../libs/middleware/auth.middleware';

const router = Router();

// Auth routes
router.post('/auth/signup', signUp);
router.post('/auth/signin', signIn);
router.post('/auth/signout', signOut);

// Protected routes
router.get('/auth/me', authenticateToken, getMe);

export default router;
